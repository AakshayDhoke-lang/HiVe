import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Chrome,
  Boxes,
  Check,
  ExternalLink,
  Globe,
  FileText,
  Sparkles,
  Link2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "chrome" | "capsule";

export function ExtensionsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("chrome");
  const [chromeConnected, setChromeConnected] = useState(false);
  const [capsuleConnected, setCapsuleConnected] = useState(false);
  const [apiKey] = useState(() => "hive_sk_" + Math.random().toString(36).slice(2, 14));

  const copyKey = () => {
    navigator.clipboard?.writeText(apiKey);
    toast.success("API key copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand" />
            Extensions & integrations
          </DialogTitle>
          <DialogDescription>
            Capture knowledge from anywhere on the web and send it straight into your HiVe library.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <TabBtn active={tab === "chrome"} onClick={() => setTab("chrome")} icon={<Chrome size={14} />}>
            HiVe for Chrome
          </TabBtn>
          <TabBtn active={tab === "capsule"} onClick={() => setTab("capsule")} icon={<Boxes size={14} />}>
            Capsule Hub by Tilantra
          </TabBtn>
        </div>

        {tab === "chrome" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-gradient-to-br from-brand/5 to-transparent p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <Chrome size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">HiVe Companion Extension</h3>
                  <Badge variant="secondary" className="text-[10px]">v0.1 · Beta</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save any page as PDF, clip selected text, or send a URL directly to a HiVe subject —
                  searchable in seconds alongside the rest of your library.
                </p>
              </div>
            </div>

            <ul className="space-y-2 text-sm">
              <Feature icon={<FileText size={14} />} label="Save current tab as a PDF into a subject" />
              <Feature icon={<Globe size={14} />} label="Clip selected text or a URL as a searchable note" />
              <Feature icon={<Link2 size={14} />} label="One-click sign-in with your HiVe Google account" />
            </ul>

            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your extension API key
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-xs">
                  {apiKey}
                </code>
                <Button size="sm" variant="ghost" onClick={copyKey} className="h-8 px-2">
                  <Copy size={13} />
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Paste this into the extension popup to link it to your account.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => {
                  setChromeConnected(true);
                  toast.success("Extension linked. Open Chrome to finish setup.");
                }}
                disabled={chromeConnected}
                className="bg-brand text-white hover:bg-brand/90"
              >
                {chromeConnected ? (
                  <><Check size={14} className="mr-1.5" /> Linked</>
                ) : (
                  <><Chrome size={14} className="mr-1.5" /> Install for Chrome</>
                )}
              </Button>
              <Button variant="outline" asChild>
                <a href="#" onClick={(e) => e.preventDefault()}>
                  View on Web Store <ExternalLink size={13} className="ml-1.5" />
                </a>
              </Button>
            </div>
          </div>
        )}

        {tab === "capsule" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-gradient-to-br from-amber-500/10 to-transparent p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Boxes size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Capsule Hub by Tilantra</h3>
                  <Badge variant="secondary" className="text-[10px]">Integration</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sync capsules from your Tilantra Capsule Hub into HiVe as searchable notes and PDFs.
                  Two-way sync keeps your context up to date.
                </p>
              </div>
            </div>

            <ul className="space-y-2 text-sm">
              <Feature icon={<Boxes size={14} />} label="Import existing capsules as subject-bound notes" />
              <Feature icon={<Sparkles size={14} />} label="AI Q&A across capsules and PDFs together" />
              <Feature icon={<Link2 size={14} />} label="Auto-sync new captures from the Capsule Hub extension" />
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => {
                  setCapsuleConnected(true);
                  toast.success("Connected to Capsule Hub. Initial sync queued.");
                }}
                disabled={capsuleConnected}
                className="bg-amber-500 text-white hover:bg-amber-500/90"
              >
                {capsuleConnected ? (
                  <><Check size={14} className="mr-1.5" /> Connected</>
                ) : (
                  <><Boxes size={14} className="mr-1.5" /> Connect Capsule Hub</>
                )}
              </Button>
              <Button variant="outline" asChild>
                <a href="#" onClick={(e) => e.preventDefault()}>
                  Learn more <ExternalLink size={13} className="ml-1.5" />
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TabBtn({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2.5 rounded-md px-1 py-0.5 text-sm text-foreground">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      {label}
    </li>
  );
}
