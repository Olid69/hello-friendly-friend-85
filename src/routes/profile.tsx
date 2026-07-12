import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, User as UserIcon, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getProfile, updateProfile } from "@/lib/library.functions";
import { useLiked, usePlaylists } from "@/lib/library-store";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Sonora" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, session, signOut, loading } = useAuth();
  const router = useRouter();
  const { liked } = useLiked();
  const { playlists } = usePlaylists();

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <UserIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">Sign in to Sonora</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sync your liked songs, playlists, and history across every device.
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-flex rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:scale-105 transition-transform"
        >
          Sign in / Sign up
        </Link>
      </div>
    );
  }

  return <ProfileEditor onSignOut={async () => {
    await signOut();
    router.invalidate();
    toast.success("Signed out");
  }} likedCount={liked.length} playlistCount={playlists.length} email={user?.email ?? ""} />;
}

function ProfileEditor({
  onSignOut,
  likedCount,
  playlistCount,
  email,
}: {
  onSignOut: () => Promise<void>;
  likedCount: number;
  playlistCount: number;
  email: string;
}) {
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data?.display_name) setName(data.display_name);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ data: { display_name: name } });
      toast.success("Profile updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const initial = (name || email || "U").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="flex items-center gap-4">
        {data?.avatar_url ? (
          <img
            src={data.avatar_url}
            alt=""
            className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/40"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/40 text-2xl font-bold text-primary-foreground">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{name || email}</h1>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Liked</p>
          <p className="text-2xl font-bold">{likedCount}</p>
        </div>
        <div className="rounded-lg bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Playlists</p>
          <p className="text-2xl font-bold">{playlistCount}</p>
        </div>
      </div>

      <div className="mt-8 rounded-lg bg-card p-5">
        <h2 className="font-semibold">Display name</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            maxLength={80}
          />
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      <button
        onClick={onSignOut}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
