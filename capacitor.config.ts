import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.sonora.personal",
  appName: "Sonora",
  // TanStack Start's production build writes browser assets here.
  // Pointing Capacitor at plain "dist" can package the server bundle instead
  // of the installable web app and make GitHub Actions fail/produce a blank APK.
  webDir: "dist/client",
  server: {
    // Load the live published site so SSR routes + server functions
    // (`/_serverFn/*`, `/api/public/*`) all work inside the APK.
    // Without this, the WebView loads only the static shell and every
    // server-function call 404s against capacitor://localhost → blank screen.
    url: "https://sonora-stream.lovable.app",
    androidScheme: "https",
    cleartext: true,
    // Keep OAuth navigation INSIDE the WebView. Without this, Capacitor's
    // default WebViewClient sends oauth.lovable.app / accounts.google.com
    // to Chrome, and the returned session never lands back in the app.
    allowNavigation: [
      "sonora-stream.lovable.app",
      "*.lovable.app",
      "*.lovable.dev",
      "oauth.lovable.app",
      "*.supabase.co",
      "*.supabase.io",
      "accounts.google.com",
      "*.google.com",
      "*.googleapis.com",
      "*.gstatic.com",
      "ssl.gstatic.com",
    ],
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
