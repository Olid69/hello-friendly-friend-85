package app.sonora.personal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.text.TextUtils;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground media playback service.
 *
 * Owns:
 *  - MediaSession (lock-screen + hardware / BT media button controls)
 *  - MediaStyle notification with prev / play-pause / next / stop
 *  - Partial wake lock so the OS doesn't suspend the WebView audio pipeline
 *  - A local BroadcastReceiver that forwards notification button taps back to JS
 *    via MainActivity.dispatchMediaAction().
 *
 * Nothing in here decodes or drives audio itself — the HTML5 audio element inside
 * the WebView remains the source of truth. This service only mirrors state to the
 * OS so background playback + system controls behave correctly.
 */
public class SonoraAudioService extends Service {
  public static final String ACTION_START = "app.sonora.personal.audio.START";
  public static final String ACTION_STOP = "app.sonora.personal.audio.STOP";

  public static final String EXTRA_TITLE = "title";
  public static final String EXTRA_ARTIST = "artist";
  public static final String EXTRA_ARTWORK = "artwork";
  public static final String EXTRA_IS_PLAYING = "isPlaying";
  public static final String EXTRA_POSITION_MS = "positionMs";
  public static final String EXTRA_DURATION_MS = "durationMs";

  // Notification button broadcast actions.
  static final String BTN_PLAY_PAUSE = "app.sonora.personal.audio.PLAY_PAUSE";
  static final String BTN_NEXT = "app.sonora.personal.audio.NEXT";
  static final String BTN_PREV = "app.sonora.personal.audio.PREV";
  static final String BTN_STOP = "app.sonora.personal.audio.STOP_BTN";

  private static final String CHANNEL_ID = "sonora_playback";
  private static final int NOTIFICATION_ID = 7001;

  private PowerManager.WakeLock wakeLock;
  private MediaSession mediaSession;
  private ButtonReceiver receiver;
  private ExecutorService artworkExecutor;

  private String lastTitle;
  private String lastArtist;
  private String lastArtworkUrl;
  private Bitmap lastArtworkBitmap;
  private boolean lastIsPlaying = true;
  private long lastPositionMs = 0;
  private long lastDurationMs = 0;

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
    setupMediaSession();
    registerButtonReceiver();
    artworkExecutor = Executors.newSingleThreadExecutor();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      stopForeground(true);
      stopSelf();
      return START_NOT_STICKY;
    }

    if (intent != null) {
      String title = intent.getStringExtra(EXTRA_TITLE);
      String artist = intent.getStringExtra(EXTRA_ARTIST);
      String artwork = intent.getStringExtra(EXTRA_ARTWORK);
      boolean isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true);
      long position = intent.getLongExtra(EXTRA_POSITION_MS, 0);
      long duration = intent.getLongExtra(EXTRA_DURATION_MS, 0);

      if (title != null) lastTitle = title;
      if (artist != null) lastArtist = artist;
      lastIsPlaying = isPlaying;
      lastPositionMs = position;
      lastDurationMs = duration;

      boolean artworkChanged = artwork != null && !TextUtils.equals(artwork, lastArtworkUrl);
      if (artworkChanged) {
        lastArtworkUrl = artwork;
        loadArtworkAsync(artwork);
      }
    }

    acquireWakeLock();
    updateMediaSession();
    // Android 14+ (API 34) requires an explicit foregroundServiceType on
    // startForeground() or the OS kills the service after a short while —
    // this is why playback was stopping in the background.
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(
          NOTIFICATION_ID,
          buildNotification(),
          android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        );
      } else {
        startForeground(NOTIFICATION_ID, buildNotification());
      }
    } catch (Exception e) {
      startForeground(NOTIFICATION_ID, buildNotification());
    }
    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    releaseWakeLock();
    if (receiver != null) {
      try { unregisterReceiver(receiver); } catch (Exception ignored) {}
      receiver = null;
    }
    if (mediaSession != null) {
      mediaSession.setActive(false);
      mediaSession.release();
      mediaSession = null;
    }
    if (artworkExecutor != null) {
      artworkExecutor.shutdownNow();
      artworkExecutor = null;
    }
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  // ---------------------------------------------------------------- Channel

  private void createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "Sonora playback",
      NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription("Media controls while music is playing.");
    channel.setShowBadge(false);
    channel.setSound(null, null);
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager != null) manager.createNotificationChannel(channel);
  }

  // ------------------------------------------------------------ MediaSession

  private void setupMediaSession() {
    mediaSession = new MediaSession(this, "SonoraMediaSession");
    mediaSession.setFlags(
      MediaSession.FLAG_HANDLES_MEDIA_BUTTONS |
      MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
    );
    mediaSession.setCallback(new MediaSession.Callback() {
      @Override public void onPlay() { MainActivity.dispatchMediaAction("play"); }
      @Override public void onPause() { MainActivity.dispatchMediaAction("pause"); }
      @Override public void onSkipToNext() { MainActivity.dispatchMediaAction("next"); }
      @Override public void onSkipToPrevious() { MainActivity.dispatchMediaAction("prev"); }
      @Override public void onStop() {
        MainActivity.dispatchMediaAction("stop");
        stopForeground(true);
        stopSelf();
      }
      @Override public void onSeekTo(long pos) {
        MainActivity.dispatchMediaAction("seek:" + pos);
      }
    });
    mediaSession.setActive(true);
  }

  private void updateMediaSession() {
    if (mediaSession == null) return;

    MediaMetadata.Builder meta = new MediaMetadata.Builder()
      .putString(MediaMetadata.METADATA_KEY_TITLE, safe(lastTitle, "Sonora"))
      .putString(MediaMetadata.METADATA_KEY_ARTIST, safe(lastArtist, ""))
      .putString(MediaMetadata.METADATA_KEY_ALBUM, "Sonora")
      .putLong(MediaMetadata.METADATA_KEY_DURATION, Math.max(0, lastDurationMs));
    if (lastArtworkBitmap != null) {
      meta.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, lastArtworkBitmap);
      meta.putBitmap(MediaMetadata.METADATA_KEY_ART, lastArtworkBitmap);
    }
    mediaSession.setMetadata(meta.build());

    long actions = PlaybackState.ACTION_PLAY
      | PlaybackState.ACTION_PAUSE
      | PlaybackState.ACTION_PLAY_PAUSE
      | PlaybackState.ACTION_SKIP_TO_NEXT
      | PlaybackState.ACTION_SKIP_TO_PREVIOUS
      | PlaybackState.ACTION_SEEK_TO
      | PlaybackState.ACTION_STOP;
    int state = lastIsPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
    PlaybackState.Builder ps = new PlaybackState.Builder()
      .setActions(actions)
      .setState(state, Math.max(0, lastPositionMs), 1f);
    mediaSession.setPlaybackState(ps.build());
  }

  // ------------------------------------------------------------ Notification

  private Notification buildNotification() {
    Intent openIntent = new Intent(this, MainActivity.class);
    openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent contentIntent = PendingIntent.getActivity(
      this, 0, openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      ? new Notification.Builder(this, CHANNEL_ID)
      : new Notification.Builder(this);

    builder
      .setContentTitle(safe(lastTitle, "Sonora"))
      .setContentText(safe(lastArtist, "Playing music"))
      .setSmallIcon(getApplicationInfo().icon)
      .setContentIntent(contentIntent)
      .setOngoing(lastIsPlaying)
      .setShowWhen(false)
      .setOnlyAlertOnce(true);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      builder.setVisibility(Notification.VISIBILITY_PUBLIC);
      builder.setCategory(Notification.CATEGORY_TRANSPORT);
    }
    if (lastArtworkBitmap != null) builder.setLargeIcon(lastArtworkBitmap);

    // Actions: prev / play-pause / next / stop
    builder.addAction(action(android.R.drawable.ic_media_previous, "Previous", BTN_PREV));
    builder.addAction(action(
      lastIsPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
      lastIsPlaying ? "Pause" : "Play",
      BTN_PLAY_PAUSE
    ));
    builder.addAction(action(android.R.drawable.ic_media_next, "Next", BTN_NEXT));
    builder.addAction(action(android.R.drawable.ic_menu_close_clear_cancel, "Stop", BTN_STOP));

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && mediaSession != null) {
      Notification.MediaStyle style = new Notification.MediaStyle()
        .setMediaSession(mediaSession.getSessionToken())
        .setShowActionsInCompactView(0, 1, 2);
      builder.setStyle(style);
    }

    return builder.build();
  }

  private Notification.Action action(int icon, String label, String action) {
    Intent intent = new Intent(action).setPackage(getPackageName());
    PendingIntent pi = PendingIntent.getBroadcast(
      this, action.hashCode(), intent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    return new Notification.Action.Builder(
      android.graphics.drawable.Icon.createWithResource(this, icon),
      label,
      pi
    ).build();
  }

  // ---------------------------------------------------------------- Artwork

  private void loadArtworkAsync(final String url) {
    if (artworkExecutor == null || url == null || url.length() == 0) return;
    artworkExecutor.submit(() -> {
      Bitmap bmp = downloadBitmap(url);
      if (bmp == null) return;
      lastArtworkBitmap = bmp;
      // Refresh notification + session metadata on main thread via re-post.
      NotificationManager mgr = getSystemService(NotificationManager.class);
      if (mgr != null) {
        try {
          updateMediaSession();
          mgr.notify(NOTIFICATION_ID, buildNotification());
        } catch (Exception ignored) {}
      }
    });
  }

  private static Bitmap downloadBitmap(String url) {
    HttpURLConnection conn = null;
    InputStream in = null;
    try {
      URL u = new URL(url);
      conn = (HttpURLConnection) u.openConnection();
      conn.setConnectTimeout(6000);
      conn.setReadTimeout(8000);
      conn.setInstanceFollowRedirects(true);
      in = conn.getInputStream();
      BitmapFactory.Options opts = new BitmapFactory.Options();
      opts.inPreferredConfig = Bitmap.Config.RGB_565;
      return BitmapFactory.decodeStream(in, null, opts);
    } catch (Exception e) {
      return null;
    } finally {
      try { if (in != null) in.close(); } catch (Exception ignored) {}
      if (conn != null) conn.disconnect();
    }
  }

  // ----------------------------------------------------------- Button receiver

  private void registerButtonReceiver() {
    receiver = new ButtonReceiver();
    IntentFilter filter = new IntentFilter();
    filter.addAction(BTN_PLAY_PAUSE);
    filter.addAction(BTN_NEXT);
    filter.addAction(BTN_PREV);
    filter.addAction(BTN_STOP);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
    } else {
      registerReceiver(receiver, filter);
    }
  }

  private class ButtonReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
      if (intent == null || intent.getAction() == null) return;
      switch (intent.getAction()) {
        case BTN_PLAY_PAUSE:
          MainActivity.dispatchMediaAction(lastIsPlaying ? "pause" : "play");
          break;
        case BTN_NEXT:
          MainActivity.dispatchMediaAction("next");
          break;
        case BTN_PREV:
          MainActivity.dispatchMediaAction("prev");
          break;
        case BTN_STOP:
          MainActivity.dispatchMediaAction("stop");
          stopForeground(true);
          stopSelf();
          break;
      }
    }
  }

  // ---------------------------------------------------------------- Wakelock

  private void acquireWakeLock() {
    if (wakeLock != null && wakeLock.isHeld()) return;
    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
    if (pm == null) return;
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Sonora:PlaybackWakeLock");
    wakeLock.setReferenceCounted(false);
    wakeLock.acquire(12 * 60 * 60 * 1000L);
  }

  private void releaseWakeLock() {
    if (wakeLock == null || !wakeLock.isHeld()) return;
    wakeLock.release();
    wakeLock = null;
  }

  private static String safe(String value, String fallback) {
    return (value == null || value.length() == 0) ? fallback : value;
  }
}
