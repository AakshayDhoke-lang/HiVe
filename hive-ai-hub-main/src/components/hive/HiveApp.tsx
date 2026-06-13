import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/hive/Sidebar";
import { PdfLibrary } from "@/components/hive/PdfLibrary";
import { ChatPanel } from "@/components/hive/ChatPanel";
import { useHive } from "@/lib/hive-store";

export function HiveApp() {
  const { user, loading, initialized } = useHive();
  const [topPct, setTopPct] = useState(60);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setTopPct(Math.min(80, Math.max(25, pct)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (!initialized || loading) {
    return (
      <div className="grid h-screen w-full place-items-center bg-background text-sm text-muted-foreground">
        Loading HiVe…
      </div>
    );
  }

  if (!user) return <LoggedOutGate />;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div ref={containerRef} className="flex min-w-0 flex-1 flex-col">
        <div style={{ height: `${topPct}%` }} className="min-h-0 overflow-hidden">
          <PdfLibrary />
        </div>
        <div
          onMouseDown={onMouseDown}
          className="group relative h-1.5 shrink-0 cursor-row-resize bg-border transition-colors hover:bg-primary/40"
        >
          <div className="absolute inset-x-0 -top-1 -bottom-1" />
        </div>
        <div style={{ height: `${100 - topPct}%` }} className="min-h-0 overflow-hidden">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}

function LoggedOutGate() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
  return null;
}
