import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HiveLogo } from "@/components/hive/Logo";
import { useEffect } from "react";
import { getToken } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in to HiVe" },
      { name: "description", content: "Sign in to HiVe to start chatting with your PDFs." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    if (getToken()) navigate({ to: "/" });
  }, [navigate]);

  const signIn = () => {
    window.location.href = "/auth/google";
  };

  return (
    <div
      className="relative grid min-h-screen place-items-center overflow-hidden bg-[oklch(0.16_0.01_270)] text-white"
      style={{
        backgroundImage:
          "radial-gradient(800px 400px at 20% 10%, rgba(124,58,237,0.20), transparent 60%), radial-gradient(700px 400px at 85% 90%, rgba(59,130,246,0.20), transparent 60%), linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "auto, auto, 32px 32px, 32px 32px",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center text-center">
          <HiveLogo size={48} />
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Welcome to HiVe</h1>
          <p className="mt-1.5 text-sm text-white/60">
            Your documents, intelligently searched.
          </p>
        </div>

        <button
          onClick={signIn}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#3c4043] shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
        >
          <GoogleG />
          Sign in with Google
        </button>

        <p className="mt-6 text-center text-[11px] text-white/40">
          By continuing you agree to the Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.6 2.4-7.3 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.2 5.2c-.4.4 6.8-5 6.8-14.8 0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
