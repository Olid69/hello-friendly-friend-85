import { supabase } from "@/integrations/supabase/client";
import { completeOAuthSessionFromUrl } from "./oauth-session";

const SUPPORTED_OAUTH_ORIGINS = new Set([
  "https://oauth.lovable.app",
  "https://lovable.dev",
]);

const POPUP_TIMEOUT_MS = 120_000;
const POPUP_POLL_MS = 400;

type NativeGoogleResult =
  | { error: null }
  | { error: Error };

type OAuthMessage = {
  type?: string;
  response?: {
    state?: string;
    error?: string;
    error_description?: string;
    access_token?: string;
    refresh_token?: string;
  };
};

function generateState() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function isSupportedOrigin(origin: string) {
  return origin === window.location.origin || SUPPORTED_OAUTH_ORIGINS.has(origin);
}

function processOAuthMessage(message: OAuthMessage, expectedState: string): NativeGoogleResult | null {
  if (message.type !== "authorization_response" || !message.response) return null;
  const response = message.response;
  if (response.state !== expectedState) return { error: new Error("Google sign-in state did not match.") };
  if (response.error) return { error: new Error(response.error_description || response.error) };
  if (!response.access_token || !response.refresh_token) {
    return { error: new Error("Google sign-in finished but no session was returned.") };
  }
  return { error: null };
}

export function isNativeAndroidWebView() {
  if (typeof window === "undefined") return false;
  const capacitor = (window as any).Capacitor;
  if (capacitor?.isNativePlatform?.()) return true;
  return /Android/i.test(navigator.userAgent) && /; wv\)/i.test(navigator.userAgent);
}

export async function signInWithGoogleInNativeWebView(): Promise<NativeGoogleResult> {
  if (typeof window === "undefined") return { error: new Error("Google sign-in is not available yet.") };

  const state = generateState();
  const params = new URLSearchParams({
    provider: "google",
    redirect_uri: window.location.origin,
    response_mode: "web_message",
    state,
  });
  const oauthUrl = `${window.location.origin}/~oauth/initiate?${params.toString()}`;

  return new Promise((resolve) => {
    let popup: Window | null = null;
    let settled = false;
    let timeoutId = 0;
    let pollId = 0;

    const finish = (result: NativeGoogleResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(pollId);
      window.removeEventListener("message", onMessage);
      try {
        popup?.close();
      } catch {}
      resolve(result);
    };

    const finishFromExistingSession = async (fallbackError: Error) => {
      const { data } = await supabase.auth.getSession();
      finish(data.session ? { error: null } : { error: fallbackError });
    };

    const finishWithTokens = async (accessToken: string, refreshToken: string) => {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      finish(error ? { error } : { error: null });
    };

    const onMessage = (event: MessageEvent) => {
      if (!isSupportedOrigin(event.origin)) return;
      const processed = processOAuthMessage(event.data as OAuthMessage, state);
      if (!processed) return;
      if (processed.error) {
        finish(processed);
        return;
      }
      const response = (event.data as OAuthMessage).response!;
      void finishWithTokens(response.access_token!, response.refresh_token!);
    };

    window.addEventListener("message", onMessage);

    popup = window.open(oauthUrl, "_blank");
    if (!popup) {
      finish({ error: new Error("Google sign-in popup was blocked by Android WebView.") });
      return;
    }

    timeoutId = window.setTimeout(() => {
      finish({ error: new Error("Google sign-in timed out. Try again after closing the Google window.") });
    }, POPUP_TIMEOUT_MS);

    pollId = window.setInterval(() => {
      if (!popup || popup.closed) {
        void finishFromExistingSession(new Error("Google sign-in window was closed before it finished."));
        return;
      }

      try {
        if (popup.location.origin !== window.location.origin) return;
        void completeOAuthSessionFromUrl(popup.location.href).then((result) => {
          if (result.completed) finish({ error: null });
          else if (result.error) finish({ error: result.error });
        });
      } catch {
        // Cross-origin while Google/Lovable OAuth pages are still loading.
      }
    }, POPUP_POLL_MS);
  });
}