import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { HiveLogo } from "@/components/hive/Logo";
import { getSharedConversation } from "@/lib/api";

type SharedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

export const Route = createFileRoute("/shared/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shared Conversation — HiVe" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedChatPage,
});

function SharedChatPage() {
  const { slug } = Route.useParams();
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<SharedMessage[] | "missing" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getSharedConversation(slug);
        if (cancelled) return;
        setTitle(data.title);
        setMessages(
          data.messages.map((m, i) => ({
            id: `shared-${i}`,
            role: m.role,
            content: m.content,
            sources: m.sources?.map((s) => s.filename),
          })),
        );
      } catch {
        if (!cancelled) setMessages("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (messages === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (messages === "missing") {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <HiveLogo size={36} />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Conversation unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This shared conversation is no longer available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            <HiveLogo size={22} withWordmark />
          </div>
          <span className="text-xs text-muted-foreground">Shared conversation</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-6 text-lg font-semibold tracking-tight text-foreground">
          {title || "Untitled conversation"}
        </h1>
        <div className="flex flex-col gap-5">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl rounded-br-md bg-brand px-4 py-2.5 text-sm leading-relaxed text-white shadow-glow">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand text-white">
                  <Sparkles size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3 text-sm leading-relaxed text-foreground">
                    {m.content}
                  </div>
                  {m.sources && m.sources.length > 0 && (
                    <p className="mt-1.5 flex items-center gap-1.5 px-1 text-xs italic text-muted-foreground">
                      <BookOpen size={12} />
                      Sources: {m.sources.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </main>
    </div>
  );
}
