import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Loader2, Trash2 } from "lucide-react";
import { useHive } from "@/lib/hive-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ShareModal({
  open,
  onOpenChange,
  conversationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
}) {
  const { shares, createShare, revokeShare, loadShareSlug } = useHive();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const slug = useMemo(() => {
    if (!conversationId) return undefined;
    const entry = Object.entries(shares).find(([, id]) => id === conversationId);
    return entry?.[0];
  }, [shares, conversationId]);

  const url = useMemo(() => {
    if (!slug) return "";
    if (typeof window === "undefined") return `/shared/${slug}`;
    return `${window.location.origin}/shared/${slug}`;
  }, [slug]);

  useEffect(() => {
    if (!open) setCopied(false);
    else if (conversationId) void loadShareSlug(conversationId);
  }, [open, conversationId, loadShareSlug]);

  const handleCreate = async () => {
    if (!conversationId) return;
    setBusy(true);
    try {
      await createShare(conversationId);
      toast.success("Share link created");
    } catch {
      toast.error("Could not create share link. Make sure the conversation has messages.");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!conversationId) return;
    try {
      await revokeShare(conversationId);
      toast.success("Share link revoked");
    } catch {
      toast.error("Failed to revoke share link");
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 size={16} /> Share Conversation
          </DialogTitle>
          <DialogDescription>
            Create a link to share this conversation. Anyone with the link can view it.
          </DialogDescription>
        </DialogHeader>

        {slug ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check size={14} className="mr-1 text-emerald-500" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} className="mr-1" /> Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Anyone with this link can view a read-only copy of the conversation.
            </p>
            <button
              onClick={handleRevoke}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline"
            >
              <Trash2 size={12} /> Revoke link
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              No share link yet. Create one to generate a read-only public view.
            </p>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={busy || !conversationId}
              className="bg-brand text-white hover:opacity-90"
            >
              {busy ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Link2 size={14} className="mr-1.5" />}
              Create share link
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
