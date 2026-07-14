package app.sonora.personal;

import android.app.Dialog;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final String APP_ORIGIN = "https://sonora-stream.lovable.app";
  private static MainActivity instance;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    instance = this;

    WebView webView = getBridge().getWebView();
    WebSettings settings = webView.getSettings();

    // Google blocks OAuth in "; wv)" WebViews with "disallowed_useragent".
    // Strip the wv marker so Continue with Google works inside the APK.
    String ua = settings.getUserAgentString();
    if (ua != null && ua.contains("; wv)")) {
      settings.setUserAgentString(ua.replace("; wv)", ")"));
    }

    // Allow Google OAuth popup + audio background quirks
    settings.setJavaScriptCanOpenWindowsAutomatically(true);
    settings.setSupportMultipleWindows(true);
    settings.setDomStorageEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
    webView.addJavascriptInterface(new SonoraNativeAudioBridge(), "SonoraNativeAudio");

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 7002);
    }


    webView.setWebChromeClient(new WebChromeClient() {
      @Override
      public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        final WebView popup = new WebView(view.getContext());
        WebSettings ps = popup.getSettings();
        ps.setJavaScriptEnabled(true);
        ps.setDomStorageEnabled(true);
        ps.setSupportMultipleWindows(false);
        ps.setUserAgentString(view.getSettings().getUserAgentString());
        CookieManager.getInstance().setAcceptThirdPartyCookies(popup, true);

        final Dialog dialog = new Dialog(MainActivity.this);
        dialog.setContentView(popup);
        if (dialog.getWindow() != null) {
          dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        }
        dialog.show();

        popup.setWebViewClient(new WebViewClient() {
          @Override
          public boolean shouldOverrideUrlLoading(WebView childView, WebResourceRequest request) {
            return handleOAuthCallback(view, dialog, request.getUrl().toString());
          }

          @Override
          public boolean shouldOverrideUrlLoading(WebView childView, String url) {
            return handleOAuthCallback(view, dialog, url);
          }

          @Override
          public void onPageFinished(WebView childView, String url) {
            handleOAuthCallback(view, dialog, url);
          }
        });
        popup.setWebChromeClient(new WebChromeClient() {
          @Override
          public void onCloseWindow(WebView w) {
            dialog.dismiss();
          }
        });

        ((WebView.WebViewTransport) resultMsg.obj).setWebView(popup);
        resultMsg.sendToTarget();
        return true;
      }
    });
  }

  private boolean handleOAuthCallback(WebView mainWebView, Dialog dialog, String url) {
    if (url == null || !url.startsWith(APP_ORIGIN)) return false;
    boolean hasAuthPayload =
      url.contains("access_token=") ||
      url.contains("refresh_token=") ||
      url.contains("code=") ||
      url.contains("error=");
    if (!hasAuthPayload) return false;

    mainWebView.post(() -> {
      mainWebView.loadUrl(url);
      if (dialog.isShowing()) dialog.dismiss();
    });
    return true;
  }

  /**
   * Called from SonoraAudioService on the binder thread when a notification /
   * MediaSession / hardware button fires. Bounces to the JS layer, which owns
   * the audio element and queue.
   */
  public static void dispatchMediaAction(final String action) {
    final MainActivity a = instance;
    if (a == null || a.getBridge() == null || a.getBridge().getWebView() == null) return;
    final WebView wv = a.getBridge().getWebView();
    final String safe = action == null ? "" : action.replace("\\", "\\\\").replace("'", "\\'");
    wv.post(() -> wv.evaluateJavascript(
      "window.dispatchEvent(new CustomEvent('sonora:media-action',{detail:'" + safe + "'}))",
      null
    ));
  }

  public static void dispatchNativeState(final boolean isPlaying, final long positionMs,
                                         final long durationMs, final String status) {
    final MainActivity a = instance;
    if (a == null || a.getBridge() == null || a.getBridge().getWebView() == null) return;
    final WebView wv = a.getBridge().getWebView();
    final String safeStatus = status == null ? "" : status.replace("\\", "\\\\").replace("'", "\\'");
    final String script =
      "window.dispatchEvent(new CustomEvent('sonora:native-state',{detail:{" +
        "isPlaying:" + isPlaying + "," +
        "positionMs:" + positionMs + "," +
        "durationMs:" + durationMs + "," +
        "status:'" + safeStatus + "'" +
      "}}))";
    wv.post(() -> wv.evaluateJavascript(script, null));
  }

  private void startPlaybackService(Intent intent) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startForegroundService(intent);
    } else {
      startService(intent);
    }
  }

  public class SonoraNativeAudioBridge {
    @JavascriptInterface
    public void play(String streamUrl, String title, String artist, String artwork,
                     boolean isPlaying, double positionMs, double durationMs) {
      Intent intent = new Intent(MainActivity.this, SonoraAudioService.class);
      intent.setAction(SonoraAudioService.ACTION_START);
      intent.putExtra(SonoraAudioService.EXTRA_STREAM_URL, streamUrl == null ? "" : streamUrl);
      intent.putExtra(SonoraAudioService.EXTRA_TITLE, title == null ? "Sonora" : title);
      intent.putExtra(SonoraAudioService.EXTRA_ARTIST, artist == null ? "Playing" : artist);
      if (artwork != null) intent.putExtra(SonoraAudioService.EXTRA_ARTWORK, artwork);
      intent.putExtra(SonoraAudioService.EXTRA_IS_PLAYING, isPlaying);
      intent.putExtra(SonoraAudioService.EXTRA_POSITION_MS, (long) positionMs);
      intent.putExtra(SonoraAudioService.EXTRA_DURATION_MS, (long) durationMs);
      startPlaybackService(intent);
    }

    @JavascriptInterface
    public void control(String action, double positionMs) {
      Intent intent = new Intent(MainActivity.this, SonoraAudioService.class);
      intent.setAction(SonoraAudioService.ACTION_CONTROL);
      intent.putExtra(SonoraAudioService.EXTRA_CONTROL, action == null ? "" : action);
      intent.putExtra(SonoraAudioService.EXTRA_POSITION_MS, (long) positionMs);
      startPlaybackService(intent);
    }

    @JavascriptInterface
    public void start(String title, String artist, String artwork,
                      boolean isPlaying, double positionMs, double durationMs) {
      Intent intent = new Intent(MainActivity.this, SonoraAudioService.class);
      intent.setAction(SonoraAudioService.ACTION_START);
      intent.putExtra(SonoraAudioService.EXTRA_TITLE, title == null ? "Sonora" : title);
      intent.putExtra(SonoraAudioService.EXTRA_ARTIST, artist == null ? "Playing" : artist);
      if (artwork != null) intent.putExtra(SonoraAudioService.EXTRA_ARTWORK, artwork);
      intent.putExtra(SonoraAudioService.EXTRA_IS_PLAYING, isPlaying);
      intent.putExtra(SonoraAudioService.EXTRA_POSITION_MS, (long) positionMs);
      intent.putExtra(SonoraAudioService.EXTRA_DURATION_MS, (long) durationMs);
      startPlaybackService(intent);
    }

    // Back-compat overload for any older JS callers.
    @JavascriptInterface
    public void start(String title, String artist) {
      start(title, artist, null, true, 0.0, 0.0);
    }

    @JavascriptInterface
    public void stop() {
      Intent intent = new Intent(MainActivity.this, SonoraAudioService.class);
      intent.setAction(SonoraAudioService.ACTION_STOP);
      startPlaybackService(intent);
    }
  }


  @Override
  public void onDestroy() {
    if (instance == this) instance = null;
    super.onDestroy();
  }

  @Override
  public void onPause() {
    super.onPause();
    // Keep HTML5 audio (MediaSession) running when the app goes to background.
    if (getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().onResume();
    }
  }

  @Override
  public void onStop() {
    super.onStop();
    if (getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().onResume();
    }
  }
}

