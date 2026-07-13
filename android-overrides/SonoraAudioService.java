package app.sonora.personal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class SonoraAudioService extends Service {
  public static final String ACTION_START = "app.sonora.personal.audio.START";
  public static final String ACTION_STOP = "app.sonora.personal.audio.STOP";
  public static final String EXTRA_TITLE = "title";
  public static final String EXTRA_ARTIST = "artist";

  private static final String CHANNEL_ID = "sonora_playback";
  private static final int NOTIFICATION_ID = 7001;

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      stopForeground(true);
      stopSelf();
      return START_NOT_STICKY;
    }

    String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
    String artist = intent != null ? intent.getStringExtra(EXTRA_ARTIST) : null;
    startForeground(NOTIFICATION_ID, buildNotification(title, artist));
    return START_STICKY;
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "Sonora playback",
      NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription("Keeps Sonora playing in the background.");
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager != null) manager.createNotificationChannel(channel);
  }

  private Notification buildNotification(String title, String artist) {
    Intent openIntent = new Intent(this, MainActivity.class);
    openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pendingIntent = PendingIntent.getActivity(
      this,
      0,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      ? new Notification.Builder(this, CHANNEL_ID)
      : new Notification.Builder(this);

    return builder
      .setContentTitle(title == null || title.length() == 0 ? "Sonora" : title)
      .setContentText(artist == null || artist.length() == 0 ? "Playing music" : artist)
      .setSmallIcon(getApplicationInfo().icon)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setShowWhen(false)
      .build();
  }
}