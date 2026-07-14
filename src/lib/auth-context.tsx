import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fire the listener FIRST so we never miss the SIGNED_IN event emitted
    // by detectSessionInUrl right after an OAuth redirect return.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);

      // After OAuth redirect completes, hop to the intended page and clear
      // the tokens out of the URL so they don't linger in history.
      if (event === "SIGNED_IN" && typeof window !== "undefined") {
        try {
          if (window.location.hash.includes("access_token")) {
            history.replaceState(null, "", window.location.pathname + window.location.search);
          }
          const dest = sessionStorage.getItem("sonora:post-auth-redirect");
          if (dest) {
            sessionStorage.removeItem("sonora:post-auth-redirect");
            if (window.location.pathname === "/auth") {
              window.location.replace(dest);
            }
          }
        } catch {}
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpEmail = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: displayName ? { full_name: displayName } : undefined,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInEmail,
        signUpEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
