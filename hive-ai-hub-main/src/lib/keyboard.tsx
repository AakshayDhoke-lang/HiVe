import { useEffect } from "react";
import { useTheme } from "./theme";

export function useGlobalShortcuts({
  onFocusChat,
  onOpenShortcuts,
}: {
  onFocusChat?: () => void;
  onOpenShortcuts?: () => void;
} = {}) {
  const { toggle } = useTheme();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "/") {
        e.preventDefault();
        toggle();
      } else if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onFocusChat?.();
      } else if (meta && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
        e.preventDefault();
        onOpenShortcuts?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, onFocusChat, onOpenShortcuts]);
}
