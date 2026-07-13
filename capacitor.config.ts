import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.sonora.personal",
  appName: "Sonora",
  // TanStack Start's production build writes browser assets here.
  // Pointing Capacitor at plain "dist" can package the server bundle instead
  // of the installable web app and make GitHub Actions fail/produce a blank APK.
  webDir: "dist/client",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
