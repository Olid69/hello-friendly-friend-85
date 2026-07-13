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

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WebView webView = getBridge().getWebView();
    WebSettings settings = webView.getSettings();

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

  public class SonoraNativeAudioBridge {
    @JavascriptInterface
    public void start(String title, String artist) {
      Intent intent = new Intent(MainActivity.this, SonoraAudioService.class);
      intent.setAction(SonoraAudioService.ACTION_START);
      intent.putExtra(SonoraAudioService.EXTRA_TITLE, title == null ? "Sonora" : title);
      intent.putExtra(SonoraAudioService.EXTRA_ARTIST, artist == null ? "Playing" : artist);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        startForegroundService(intent);
      } else {
        startService(intent);
      }
    }

    @JavascriptInterface
    public void stop() {
      Intent intent = new Intent(MainActivity.this, SonoraAudioService.class);
      intent.setAction(SonoraAudioService.ACTION_STOP);
      startService(intent);
    }
  }

  @Override
  public void onPause() {
    super.onPause();
    // Keep HTML5 audio (MediaSession) running when the app goes to background.
    // BridgeActivity/Chromium will pause the WebView on backgrounding, which stops audio.
    // Immediately resume it so MediaSession keeps the stream alive under the OS media notification.
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
