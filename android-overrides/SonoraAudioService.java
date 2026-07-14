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
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.text.TextUtils;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.LoadControl;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy;

/**
 * Foreground media playback service.
 *
 * Owns:
 *  - MediaSession (lock-screen + hardware / BT media button controls)
 *  - MediaStyle notification with prev / play-pause / next / stop
 *  - Native ExoPlayer playback so Android keeps audio alive when the WebView
 *    is backgrounded or the screen is off, with buffering + reconnect recovery
 *  - Partial wake lock + Wi-Fi lock so streamed media continues in doze
 *  - A local BroadcastReceiver that forwards notification button taps back to JS
 *    via MainActivity.dispatchMediaAction().
 *
 */
public class SonoraAudioService extends Service {
  public static final String ACTION_START = "app.sonora.personal.audio.START";
  public static final String ACTION_STOP = "app.sonora.personal.audio.STOP";
  public static final String ACTION_CONTROL = "app.sonora.personal.audio.CONTROL";

  public static final String EXTRA_STREAM_URL = "streamUrl";
  public static final String EXTRA_TITLE = "title";
  public static final String EXTRA_ARTIST = "artist";
  public static final String EXTRA_ARTWORK = "artwork";
  public static final String EXTRA_IS_PLAYING = "isPlaying";
  public static final String EXTRA_POSITION_MS = "positionMs";
  public static final String EXTRA_DURATION_MS = "durationMs";
  public static final String EXTRA_CONTROL = "control";

  // Notification button broadcast actions.
  static final String BTN_PLAY_PAUSE = "app.sonora.personal.audio.PLAY_PAUSE";
  static final String BTN_NEXT = "app.sonora.personal.audio.NEXT";
  static final String BTN_PREV = "app.sonora.personal.audio.PREV";
  static final String BTN_STOP = "app.sonora.personal.audio.STOP_BTN";

  private static final String CHANNEL_ID = "sonora_playback";
  private static final int NOTIFICATION_ID = 7001;

  private PowerManager.WakeLock wakeLock;
  private WifiManager.WifiLock wifiLock;
  private MediaSession mediaSession;
  private ExoPlayer exoPlayer;
  private ButtonReceiver receiver;
  private ExecutorService artworkExecutor;
  private Handler handler;
  private AudioFocusRequest audioFocusRequest;
  private int retryAttempt = 0;
  private static final int MAX_RETRY_ATTEMPTS = 10;
  private static final long[] RETRY_DELAYS_MS = new long[] { 1000, 2000, 4000, 8000, 12000, 20000, 30000 };

  private final AudioManager.OnAudioFocusChangeListener audioFocusListener = focusChange -> {
    if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
      setPlayerVolume(1f);
      if (playWhenPrepared && exoPlayer != null) {
        exoPlayer.setPlayWhenReady(true);
      }
    } else if (focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
      setPlayerVolume(0.35f);
    } else if (focusChange == AudioManager.AUDIOFOCUS_LOSS) {
      pauseNativePlayback(true);
    }
  };

  private String lastStreamUrl;
  private String lastTitle;
  private String lastArtist;
  private String lastArtworkUrl;
  private Bitmap lastArtworkBitmap;
  private boolean lastIsPlaying = true;
  private boolean isPrepared = false;
  private boolean playWhenPrepared = false;
  private long lastPositionMs = 0;
  private long lastDurationMs = 0;

  private final Runnable retryRunnable = new Runnable() {
    @Override public void run() {
      retryPlaybackFromLastPosition();
    }
  };

  private final Runnable progressRunnable = new Runnable() {
    @Override public void run() {
      syncPlayerPosition();
      String status = exoPlayer != null && exoPlayer.getPlaybackState() == Player.STATE_BUFFERING
        ? "buffering"
        : "progress";
      MainActivity.dispatchNativeState(lastIsPlaying, lastPositionMs, lastDurationMs, status);
      if (handler != null && exoPlayer != null) handler.postDelayed(this, 1000);
    }
  };

  @Override
  public void onCreate() {
    super.onCreate();
    handler = new Handler(Looper.getMainLooper());
    createChannel();
    setupMediaSession();
    registerButtonReceiver();
    artworkExecutor = Executors.newSingleThreadExecutor();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      stopNativePlayback();
      stopForeground(true);
      stopSelf();
      return START_NOT_STICKY;
    }

    if (intent != null && ACTION_CONTROL.equals(intent.getAction())) {
      String control = intent.getStringExtra(EXTRA_CONTROL);
      handlePlaybackControl(control, intent.getLongExtra(EXTRA_POSITION_MS, 0));
      if (!"stop".equals(control)) promoteToForeground();
      return START_REDELIVER_INTENT;
    }

    if (intent != null) {
      String streamUrl = intent.getStringExtra(EXTRA_STREAM_URL);
      String title = intent.getStringExtra(EXTRA_TITLE);
      String artist = intent.getStringExtra(EXTRA_ARTIST);
      String artwork = intent.getStringExtra(EXTRA_ARTWORK);
      boolean isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true);
      long position = intent.getLongExtra(EXTRA_POSITION_MS, 0);
      long duration = intent.getLongExtra(EXTRA_DURATION_MS, 0);

      if (title != null) lastTitle = title;
      if (artist != null) lastArtist = artist;
      lastIsPlaying = isPlaying;
      playWhenPrepared = isPlaying;
      lastPositionMs = position;
      lastDurationMs = duration;

      boolean artworkChanged = artwork != null && !TextUtils.equals(artwork, lastArtworkUrl);
      if (artworkChanged) {
        lastArtworkUrl = artwork;
        loadArtworkAsync(artwork);
      }

      if (streamUrl != null && streamUrl.length() > 0) {
        if (!TextUtils.equals(streamUrl, lastStreamUrl)) {
          prepareNativePlayer(streamUrl);
        } else {
          applyDesiredPlaybackState();
        }
      }
    }

    acquireWakeLock();
    updateMediaSession();
    promoteToForeground();
    return START_REDELIVER_INTENT;
  }

  @Override
  public void onDestroy() {
    if (handler != null) {
      handler.removeCallbacks(progressRunnable);
      handler.removeCallbacks(retryRunnable);
    }
    releaseNativePlayer();
    releaseWakeLock();
    releaseWifiLock();
    abandonAudioFocus();
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
      @Override public void onPlay() { handlePlaybackControl("play", 0); }
      @Override public void onPause() { handlePlaybackControl("pause", 0); }
      @Override public void onSkipToNext() { MainActivity.dispatchMediaAction("next"); }
      @Override public void onSkipToPrevious() { MainActivity.dispatchMediaAction("prev"); }
      @Override public void onStop() {
        handlePlaybackControl("stop", 0);
      }
      @Override public void onSeekTo(long pos) {
        handlePlaybackControl("seek", pos);
      }
    });
    mediaSession.setActive(true);
  }

  private void updateMediaSession() {
    if (mediaSession == null) return;
    syncPlayerPosition();

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
    int state = PlaybackState.STATE_PAUSED;
    if (exoPlayer != null && exoPlayer.getPlaybackState() == Player.STATE_BUFFERING) {
      state = PlaybackState.STATE_BUFFERING;
    } else if (lastIsPlaying) {
      state = PlaybackState.STATE_PLAYING;
    }
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

  private void promoteToForeground() {
    // Android 14+ (API 34) requires an explicit foregroundServiceType on
    // startForeground() or the OS kills the service after a short while.
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
      try { startForeground(NOTIFICATION_ID, buildNotification()); } catch (Exception ignored) {}
    }
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
          handlePlaybackControl(lastIsPlaying ? "pause" : "play", 0);
          break;
        case BTN_NEXT:
          MainActivity.dispatchMediaAction("next");
          break;
        case BTN_PREV:
          MainActivity.dispatchMediaAction("prev");
          break;
        case BTN_STOP:
          handlePlaybackControl("stop", 0);
          break;
      }
    }
  }

  // --------------------------------------------------------- Native playback

  private void prepareNativePlayer(String streamUrl) {
    releaseNativePlayer();
    lastStreamUrl = streamUrl;
    isPrepared = false;
    retryAttempt = 0;
    requestAudioFocus();
    acquireWakeLock();
    acquireWifiLock();

    try {
      exoPlayer = buildExoPlayer();
      exoPlayer.setMediaItem(MediaItem.fromUri(streamUrl));
      if (lastPositionMs > 0) exoPlayer.seekTo(Math.max(0, lastPositionMs));
      exoPlayer.setPlayWhenReady(playWhenPrepared);
      exoPlayer.prepare();
      startProgressUpdates();
    } catch (Exception e) {
      lastIsPlaying = false;
      MainActivity.dispatchNativeState(false, lastPositionMs, lastDurationMs, "error");
      releaseNativePlayer();
    }
  }

  private ExoPlayer buildExoPlayer() {
    DefaultHttpDataSource.Factory httpFactory = new DefaultHttpDataSource.Factory()
      .setUserAgent("Sonora/1.0 Android")
      .setAllowCrossProtocolRedirects(true)
      .setConnectTimeoutMs(20000)
      .setReadTimeoutMs(45000);

    DefaultDataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(this, httpFactory);
    LoadControl loadControl = new DefaultLoadControl.Builder()
      .setBufferDurationsMs(
        50000,   // min buffer: tolerate short network stalls
        180000,  // max buffer: long enough for mobile radio / Wi-Fi handoffs
        2500,    // start playback quickly
        7000     // wait slightly longer after rebuffering to avoid looped stalls
      )
      .setPrioritizeTimeOverSizeThresholds(true)
      .build();

    DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(dataSourceFactory)
      .setLoadErrorHandlingPolicy(new DefaultLoadErrorHandlingPolicy(8));

    ExoPlayer player = new ExoPlayer.Builder(this)
      .setMediaSourceFactory(mediaSourceFactory)
      .setLoadControl(loadControl)
      .build();

    player.setAudioAttributes(new AudioAttributes.Builder()
      .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
      .setUsage(C.USAGE_MEDIA)
      .build(), false);
    player.setHandleAudioBecomingNoisy(true);
    player.setWakeMode(C.WAKE_MODE_LOCAL);
    player.setVolume(1f);
    player.addListener(new Player.Listener() {
      @Override public void onPlaybackStateChanged(int state) {
        if (state == Player.STATE_READY) {
          isPrepared = true;
          retryAttempt = 0;
          syncPlayerPosition();
          if (playWhenPrepared && exoPlayer != null) exoPlayer.setPlayWhenReady(true);
          updateMediaSession();
          refreshNotification();
          MainActivity.dispatchNativeState(lastIsPlaying, lastPositionMs, lastDurationMs, "ready");
        } else if (state == Player.STATE_BUFFERING) {
          lastIsPlaying = playWhenPrepared;
          updateMediaSession();
          refreshNotification();
          MainActivity.dispatchNativeState(lastIsPlaying, lastPositionMs, lastDurationMs, "buffering");
        } else if (state == Player.STATE_ENDED) {
          lastIsPlaying = false;
          syncPlayerPosition();
          updateMediaSession();
          refreshNotification();
          MainActivity.dispatchNativeState(false, lastPositionMs, lastDurationMs, "ended");
          MainActivity.dispatchMediaAction("ended");
        }
      }

      @Override public void onIsPlayingChanged(boolean isPlaying) {
        boolean isBufferingToResume = exoPlayer != null
          && exoPlayer.getPlaybackState() == Player.STATE_BUFFERING
          && playWhenPrepared;
        lastIsPlaying = isPlaying || isBufferingToResume;
        if (isPlaying) {
          playWhenPrepared = true;
          acquireWakeLock();
          acquireWifiLock();
          startProgressUpdates();
        }
        updateMediaSession();
        refreshNotification();
        MainActivity.dispatchNativeState(
          lastIsPlaying,
          lastPositionMs,
          lastDurationMs,
          isBufferingToResume ? "buffering" : (isPlaying ? "play" : "pause")
        );
      }

      @Override public void onPlayerError(PlaybackException error) {
        isPrepared = true;
        syncPlayerPosition();
        if (playWhenPrepared && shouldRetryPlayback(error)) {
          scheduleRetry();
          return;
        }
        lastIsPlaying = false;
        updateMediaSession();
        refreshNotification();
        MainActivity.dispatchNativeState(false, lastPositionMs, lastDurationMs, "error");
      }
    });
    return player;
  }

  private void startPreparedPlayer() {
    if (exoPlayer == null) return;
    try {
      requestAudioFocus();
      exoPlayer.setPlayWhenReady(true);
      exoPlayer.play();
      lastIsPlaying = true;
      playWhenPrepared = true;
      acquireWakeLock();
      acquireWifiLock();
      startProgressUpdates();
    } catch (Exception e) {
      lastIsPlaying = false;
      MainActivity.dispatchNativeState(false, lastPositionMs, lastDurationMs, "error");
    }
  }

  private void pauseNativePlayback(boolean notifyJs) {
    playWhenPrepared = false;
    if (handler != null) handler.removeCallbacks(retryRunnable);
    if (exoPlayer != null) {
      try {
        exoPlayer.setPlayWhenReady(false);
        exoPlayer.pause();
      } catch (Exception ignored) {}
    }
    syncPlayerPosition();
    lastIsPlaying = false;
    stopProgressUpdates();
    updateMediaSession();
    refreshNotification();
    if (notifyJs) MainActivity.dispatchNativeState(false, lastPositionMs, lastDurationMs, "pause");
  }

  private void applyDesiredPlaybackState() {
    if (lastIsPlaying) {
      playWhenPrepared = true;
      if (isPrepared) startPreparedPlayer();
    } else {
      pauseNativePlayback(false);
    }
  }

  private void handlePlaybackControl(String action, long positionMs) {
    if (action == null) return;
    switch (action) {
      case "play":
        playWhenPrepared = true;
        if (exoPlayer != null) startPreparedPlayer();
        updateMediaSession();
        refreshNotification();
        MainActivity.dispatchNativeState(lastIsPlaying, lastPositionMs, lastDurationMs, "play");
        break;
      case "pause":
        pauseNativePlayback(true);
        break;
      case "seek":
        if (exoPlayer != null) {
          try {
            exoPlayer.seekTo(Math.max(0, positionMs));
            lastPositionMs = Math.max(0, positionMs);
          } catch (Exception ignored) {}
        }
        updateMediaSession();
        refreshNotification();
        MainActivity.dispatchNativeState(lastIsPlaying, lastPositionMs, lastDurationMs, "seek");
        break;
      case "stop":
        stopNativePlayback();
        MainActivity.dispatchNativeState(false, lastPositionMs, lastDurationMs, "stop");
        stopForeground(true);
        stopSelf();
        break;
    }
  }

  private void stopNativePlayback() {
    playWhenPrepared = false;
    lastIsPlaying = false;
    stopProgressUpdates();
    releaseNativePlayer();
    releaseWakeLock();
    releaseWifiLock();
    abandonAudioFocus();
    updateMediaSession();
  }

  private void releaseNativePlayer() {
    stopProgressUpdates();
    if (handler != null) handler.removeCallbacks(retryRunnable);
    if (exoPlayer != null) {
      try { exoPlayer.release(); } catch (Exception ignored) {}
      exoPlayer = null;
    }
    isPrepared = false;
  }

  private void syncPlayerPosition() {
    if (exoPlayer == null) return;
    try {
      long pos = exoPlayer.getCurrentPosition();
      long d = exoPlayer.getDuration();
      if (pos != C.TIME_UNSET) lastPositionMs = Math.max(0, pos);
      if (d != C.TIME_UNSET && d > 0) lastDurationMs = d;
      boolean isBufferingToResume = exoPlayer.getPlaybackState() == Player.STATE_BUFFERING && playWhenPrepared;
      lastIsPlaying = exoPlayer.isPlaying() || isBufferingToResume;
    } catch (Exception ignored) {}
  }

  private boolean shouldRetryPlayback(PlaybackException error) {
    if (retryAttempt >= MAX_RETRY_ATTEMPTS) return false;
    if (lastStreamUrl == null || lastStreamUrl.length() == 0) return false;
    int code = error == null ? PlaybackException.ERROR_CODE_UNSPECIFIED : error.errorCode;
    return code == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED
      || code == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT
      || code == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS
      || code == PlaybackException.ERROR_CODE_IO_CLEARTEXT_NOT_PERMITTED
      || code == PlaybackException.ERROR_CODE_IO_READ_POSITION_OUT_OF_RANGE
      || code == PlaybackException.ERROR_CODE_IO_UNSPECIFIED
      || code == PlaybackException.ERROR_CODE_REMOTE_ERROR
      || code == PlaybackException.ERROR_CODE_UNSPECIFIED;
  }

  private void scheduleRetry() {
    if (handler == null) return;
    handler.removeCallbacks(retryRunnable);
    long delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
    retryAttempt += 1;
    lastIsPlaying = true;
    updateMediaSession();
    refreshNotification();
    MainActivity.dispatchNativeState(true, lastPositionMs, lastDurationMs, "buffering");
    handler.postDelayed(retryRunnable, delay);
  }

  private void retryPlaybackFromLastPosition() {
    if (!playWhenPrepared || lastStreamUrl == null || lastStreamUrl.length() == 0) return;
    long resumePosition = Math.max(0, lastPositionMs);
    releaseNativePlayer();
    lastPositionMs = resumePosition;
    isPrepared = false;
    requestAudioFocus();
    acquireWakeLock();
    acquireWifiLock();
    try {
      exoPlayer = buildExoPlayer();
      exoPlayer.setMediaItem(MediaItem.fromUri(lastStreamUrl));
      if (resumePosition > 0) exoPlayer.seekTo(resumePosition);
      exoPlayer.setPlayWhenReady(true);
      exoPlayer.prepare();
      startProgressUpdates();
    } catch (Exception e) {
      scheduleRetry();
    }
  }

  private void startProgressUpdates() {
    if (handler == null) return;
    handler.removeCallbacks(progressRunnable);
    handler.post(progressRunnable);
  }

  private void stopProgressUpdates() {
    if (handler != null) handler.removeCallbacks(progressRunnable);
  }

  private void refreshNotification() {
    NotificationManager mgr = getSystemService(NotificationManager.class);
    if (mgr != null) {
      try { mgr.notify(NOTIFICATION_ID, buildNotification()); } catch (Exception ignored) {}
    }
  }

  private void requestAudioFocus() {
    AudioManager manager = (AudioManager) getSystemService(AUDIO_SERVICE);
    if (manager == null) return;
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        if (audioFocusRequest == null) {
          audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setOnAudioFocusChangeListener(audioFocusListener)
            .setWillPauseWhenDucked(false)
            .setAudioAttributes(new android.media.AudioAttributes.Builder()
              .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
              .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
              .build())
            .build();
        }
        manager.requestAudioFocus(audioFocusRequest);
      } else {
        manager.requestAudioFocus(audioFocusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
      }
    } catch (Exception ignored) {}
  }

  private void abandonAudioFocus() {
    AudioManager manager = (AudioManager) getSystemService(AUDIO_SERVICE);
    if (manager == null) return;
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
        manager.abandonAudioFocusRequest(audioFocusRequest);
      } else {
        manager.abandonAudioFocus(audioFocusListener);
      }
    } catch (Exception ignored) {}
  }

  private void setPlayerVolume(float volume) {
    if (exoPlayer == null) return;
    try { exoPlayer.setVolume(volume); } catch (Exception ignored) {}
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

  private void acquireWifiLock() {
    if (wifiLock != null && wifiLock.isHeld()) return;
    WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
    if (wm == null) return;
    wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "Sonora:PlaybackWifiLock");
    wifiLock.setReferenceCounted(false);
    try { wifiLock.acquire(); } catch (Exception ignored) {}
  }

  private void releaseWakeLock() {
    if (wakeLock == null || !wakeLock.isHeld()) return;
    wakeLock.release();
    wakeLock = null;
  }

  private void releaseWifiLock() {
    if (wifiLock == null) return;
    try { if (wifiLock.isHeld()) wifiLock.release(); } catch (Exception ignored) {}
    wifiLock = null;
  }

  private static String safe(String value, String fallback) {
    return (value == null || value.length() == 0) ? fallback : value;
  }
}
