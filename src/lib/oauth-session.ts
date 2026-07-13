import { supabase } from "@/integrations/supabase/client";

type OAuthCompletion =
  | { completed: true; error: null }
  | { completed: false; error: Error | null };

const OAUTH_KEYS = ["access_token", "refresh_token", "code", "error", "error_description"];

function collectParams(url: string) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
  if (hash) {
    new URLSearchParams(hash).forEach((value, key) => params.set(key, value));
  }
  return params;
}

export function hasOAuthParams(url = window.location.href) {
  try {
    const params = collectParams(url);
    return OAUTH_KEYS.some((key) => params.has(key));
  } catch {
    return false;
  }
}

export function cleanOAuthParamsFromCurrentUrl() {
  if (typeof window === "undefined") return;
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

export async function completeOAuthSessionFromUrl(url = window.location.href): Promise<OAuthCompletion> {
  if (typeof window === "undefined") return { completed: false, error: null };

  let params: URLSearchParams;
  try {
    params = collectParams(url);
  } catch (error) {
    return { completed: false, error: error instanceof Error ? error : new Error(String(error)) };
  }

  const authError = params.get("error");
  if (authError) {
    return {
      completed: false,
      error: new Error(params.get("error_description") || authError),
    };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return error ? { completed: false, error } : { completed: true, error: null };
  }

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? { completed: false, error } : { completed: true, error: null };
  }

  return { completed: false, error: null };
}