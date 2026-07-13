package app.sonora.personal;

import android.app.Dialog;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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

        popup.setWebViewClient(new WebViewClient());
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
}
