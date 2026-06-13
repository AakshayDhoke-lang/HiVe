import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, Trash2, Plus, BookOpen, Cpu, Cloud, Server, Globe, Copy, Check, ClipboardList, Loader2, Share2 } from "lucide-react";
import { ShareModal } from "./ShareModal";
import { useHive, type Message } from "@/lib/hive-store";
import { HiveLogo } from "./Logo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function ChatPanel() {
  const {
    conversations,
    activeConversationId,
    activeSubjectId,
    subjects,
    sendMessage,
    newConversation,
    clearActiveConversation,
    deleteConversation,
  } = useHive();



  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const conv = conversations.find((c) => c.id === activeConversationId);
  const subject = subjects.find((s) => s.id === activeSubjectId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conv?.messages.length, loading]);

  // Cmd/Ctrl+K → focus chat input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);
    try {
      await sendMessage(text);
    } catch {
      toast.error("Failed to send message. Check your AI configuration and try again.");
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Summarize the key points",
    "What are the action items?",
    "Find clauses about termination",
    "Compare the two documents",
  ];

  const hasMessages = !!conv && conv.messages.length > 0;
  const [copyingAll, setCopyingAll] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyAll = async () => {
    if (!conv || conv.messages.length === 0 || copyingAll) return;
    setCopyingAll(true);
    try {
      const formatted = conv.messages
        .map((m) => {
          const prefix = m.role === "user" ? "You: " : "HiVe: ";
          let text = prefix + m.content;
          if (m.role === "assistant" && m.sources?.length) {
            text += "\n📚 Sources: " + m.sources.join(", ");
          }
          return text;
        })
        .join("\n\n");
      await copyToClipboard(formatted);
      setCopiedAll(true);
      toast.success("Conversation copied to clipboard");
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      toast.error("Failed to copy conversation");
    } finally {
      setCopyingAll(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h2 className="truncate text-sm font-semibold">
            {subject ? `Ask HiVe · ${subject.name}` : "Ask HiVe"}
          </h2>
          <ProviderBadge />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyAll}
            disabled={!hasMessages || copyingAll}
            title="Copy full conversation"
            aria-label="Copy full conversation"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copyingAll ? <Loader2 size={14} className="animate-spin" /> : copiedAll ? <Check size={14} className="text-emerald-500" /> : <ClipboardList size={14} />}
          </button>
          <button
            onClick={() => void newConversation(activeSubjectId)}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus size={14} className="mr-1 inline" /> New chat
          </button>
          <button
            onClick={() => setShareOpen(true)}
            disabled={!conv}
            title="Share conversation via link"
            aria-label="Share conversation"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Share2 size={14} />
          </button>
          {conv && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              aria-label="Delete conversation"
              title="Delete conversation"
            >
              <Trash2 size={14} className="fill-current/0" />
            </button>
          )}
        </div>
      </div>


      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {!conv || conv.messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
            <HiveLogo size={42} />
            <h3 className="mt-4 text-xl font-semibold tracking-tight">
              Ask anything about your PDFs
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              HiVe reads your library and answers with sources.
            </p>
            <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                  }}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {conv.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand text-white">
                  <Sparkles size={14} />
                </div>
                <div className="rounded-2xl bg-muted/60 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="hive-dot h-1.5 w-1.5 rounded-full bg-muted-foreground"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-background/80 px-6 py-4 backdrop-blur">
        <form onSubmit={submit} className="mx-auto max-w-3xl">
          <div className="relative flex items-end gap-2 rounded-3xl border border-border bg-card px-4 py-2.5 shadow-card focus-within:border-primary/40 focus-within:ring-brand">
            <textarea
              ref={inputRef}

              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask a question about your PDFs…"
              className="min-h-[24px] max-h-40 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white shadow-glow transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp size={16} />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Press <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Enter</kbd> to send ·{" "}
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Shift</kbd>+
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Enter</kbd> for newline
          </p>
        </form>
      </div>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              All messages in this chat will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearActiveConversation();
                toast.success("Chat cleared");
              }}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all messages in this conversation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (conv) {
                  void deleteConversation(conv.id).then(() => toast.success("Conversation deleted"));
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        conversationId={conv?.id ?? null}
      />
    </div>
  );
}

function ProviderBadge() {
  const { aiConfig } = useHive();
  const labels: Record<string, { name: string; icon: typeof Cloud; tone: string }> = {
    openai: { name: "Cloud", icon: Cloud, tone: "text-sky-600 dark:text-sky-400" },
    lmstudio: { name: "Local · LM Studio", icon: Cpu, tone: "text-emerald-600 dark:text-emerald-400" },
    ollama: { name: "Local · Ollama", icon: Server, tone: "text-emerald-600 dark:text-emerald-400" },
    custom: { name: "Custom", icon: Globe, tone: "text-violet-600 dark:text-violet-400" },
  };
  const meta = labels[aiConfig.provider] ?? labels.openai;
  const Icon = meta.icon;
  const detail = aiConfig.model ? ` · ${aiConfig.model}` : "";
  return (
    <span
      className={`hidden items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${meta.tone}`}
      title={aiConfig.baseUrl}
    >
      <Icon size={11} />
      {meta.name}{detail}
    </span>
  );
}


/** Tiny markdown subset: **bold**, lists, code, paragraphs. */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 ml-5 list-disc space-y-1">
          {listBuf.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      listBuf = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw;
    if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
      out.push(<div key={`sp-${idx}`} className="h-2" />);
    } else {
      flushList();
      out.push(<p key={`p-${idx}`}>{inline(line)}</p>);
    }
  });
  flushList();
  return <div className="space-y-1">{out}</div>;
}

function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
          {p.slice(1, -1)}
        </code>
      );
    return <span key={i}>{p}</span>;
  });
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall through to legacy
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
}

function CopyButton({ message, position }: { message: Message; position: "left" | "right" }) {
  const [copied, setCopied] = useState(false);
  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let text = message.content;
    if (message.role === "assistant" && message.sources?.length) {
      text += "\n📚 Sources: " + message.sources.join(", ");
    }
    try {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };
  return (
    <button
      onClick={handle}
      aria-label="Copy message"
      title={copied ? "Copied!" : "Copy message"}
      className={`absolute ${position === "right" ? "right-1" : "left-1"} top-1 grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-all duration-150 hover:bg-black/5 hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-hover:opacity-100 dark:hover:bg-white/10 max-md:opacity-60`}
    >
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
}

function MessageBubble({ message: m }: { message: Message }) {
  if (m.role === "user") {
    return (
      <div className="group relative flex justify-end">
        <div className="relative max-w-[80%] rounded-3xl rounded-br-md bg-brand px-4 py-2.5 pl-9 text-sm leading-relaxed text-white shadow-glow">
          <CopyButton message={m} position="left" />
          {m.content}
        </div>
      </div>
    );
  }
  return (
    <div className="group flex gap-3">
      <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand text-white">
        <Sparkles size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="relative rounded-2xl rounded-tl-md border-l-2 border-l-transparent bg-muted/60 px-4 py-3 pr-9 text-sm leading-relaxed text-foreground"
          style={{ borderImage: "linear-gradient(180deg, #7c3aed, #3b82f6) 1" }}
        >
          <CopyButton message={m} position="right" />
          <Markdown text={m.content} />
        </div>
        {m.sources && m.sources.length > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 px-1 text-xs italic text-muted-foreground">
            <BookOpen size={12} />
            Sources: {m.sources.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
