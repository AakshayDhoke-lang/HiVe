import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { setToken } from "@/lib/api";
import { HiveLogo } from "@/components/hive/Logo";

export const Route = createFileRoute("/auth-success")({
  ssr: false,
  component: AuthSuccess,
});

function AuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setToken(token);
      navigate({ to: "/" });
    } else {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <HiveLogo size={36} />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
