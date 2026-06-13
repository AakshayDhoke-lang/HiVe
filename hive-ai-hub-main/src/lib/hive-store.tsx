import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as api from "./api";

export { getPdfFileUrl } from "./api";

export type Subject = {
  id: string;
  name: string;
  color: string;
};

export type Pdf = {
  id: string;
  name: string;
  size: number;
  subjectId: string | null;
  uploadedAt: number;
  preview?: string;
  processing?: boolean;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  subjectId: string | null;
  messages: Message[];
  createdAt: number;
};

export type AiProvider = "openai" | "lmstudio" | "ollama" | "custom";

export type AiConfig = {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  clientSide: boolean;
};

export type User = {
  name: string;
  email: string;
  avatar?: string;
};

type State = {
  user: User | null;
  subjects: Subject[];
  pdfs: Pdf[];
  conversations: Conversation[];
  activeSubjectId: string | null;
  activeConversationId: string | null;
  aiConfig: AiConfig;
  sidebarCollapsed: boolean;
  shares: Record<string, string>;
  loading: boolean;
  initialized: boolean;
};

type Ctx = State & {
  setUser: (u: User | null) => void;
  addSubject: (s: Omit<Subject, "id">) => Promise<Subject>;
  updateSubject: (id: string, patch: Partial<Subject>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  setActiveSubject: (id: string | null) => void;
  uploadPdfs: (
    files: File[],
    opts?: {
      onTaskProgress?: (key: string, pct: number) => void;
      onTaskDone?: (key: string) => void;
    },
  ) => Promise<void>;
  updatePdf: (id: string, patch: Partial<Pdf>) => void;
  deletePdf: (id: string) => Promise<void>;
  newConversation: (subjectId: string | null) => Promise<Conversation>;
  setActiveConversation: (id: string | null) => void;
  sendMessage: (text: string) => Promise<void>;
  clearActiveConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  getShareSlug: (conversationId: string) => string | undefined;
  createShare: (conversationId: string) => Promise<string>;
  revokeShare: (conversationId: string) => Promise<void>;
  loadShareSlug: (conversationId: string) => Promise<void>;
  setAiConfig: (c: AiConfig) => Promise<void>;
  toggleSidebar: () => void;
  signOut: () => Promise<void>;
  refreshData: () => Promise<void>;
};

const HiveContext = createContext<Ctx | null>(null);

const UI_STORAGE_KEY = "hive:ui:v1";

const DEFAULT_AI: AiConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  clientSide: false,
};

function loadUiPrefs(): Pick<State, "sidebarCollapsed" | "activeSubjectId"> {
  if (typeof window === "undefined") {
    return { sidebarCollapsed: false, activeSubjectId: null };
  }
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { sidebarCollapsed?: boolean; activeSubjectId?: string | null };
      return {
        sidebarCollapsed: parsed.sidebarCollapsed ?? false,
        activeSubjectId: parsed.activeSubjectId ?? null,
      };
    }
  } catch {}
  return { sidebarCollapsed: false, activeSubjectId: null };
}

function mapSources(sources: api.BackendMessage["sources"]): string[] | undefined {
  if (!sources || !Array.isArray(sources) || sources.length === 0) return undefined;
  return sources.map((s) => (typeof s === "string" ? s : s.filename));
}

function mapMessage(m: api.BackendMessage): Message {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    sources: mapSources(m.sources),
    createdAt: new Date(m.createdAt).getTime(),
  };
}

function mapPdf(p: api.BackendPdf): Pdf {
  return {
    id: p.id,
    name: p.filename,
    size: p.fileSize,
    subjectId: p.subjectId,
    uploadedAt: new Date(p.createdAt).getTime(),
    processing: p.status === "processing",
  };
}

function mapAiConfig(cfg: api.BackendAiConfig): AiConfig {
  if (!cfg.configured) return DEFAULT_AI;
  return {
    provider: (cfg.provider_type as AiProvider) || "openai",
    baseUrl: cfg.base_url || DEFAULT_AI.baseUrl,
    apiKey: cfg.api_key_masked || "",
    model: cfg.model || DEFAULT_AI.model,
    clientSide: cfg.use_client_side ?? false,
  };
}

export function getPdfBlobUrl(_id: string): string | undefined {
  return undefined;
}

export function getPdfAuthHeaders(): Record<string, string> {
  const token = api.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function HiveProvider({ children }: { children: ReactNode }) {
  const uiPrefs = loadUiPrefs();
  const [state, setState] = useState<State>({
    user: null,
    subjects: [],
    pdfs: [],
    conversations: [],
    activeSubjectId: uiPrefs.activeSubjectId,
    activeConversationId: null,
    aiConfig: DEFAULT_AI,
    sidebarCollapsed: uiPrefs.sidebarCollapsed,
    shares: {},
    loading: true,
    initialized: false,
  });

  const update = useCallback(
    (patch: Partial<State> | ((s: State) => Partial<State>)) =>
      setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })),
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        UI_STORAGE_KEY,
        JSON.stringify({
          sidebarCollapsed: state.sidebarCollapsed,
          activeSubjectId: state.activeSubjectId,
        }),
      );
    } catch {}
  }, [state.sidebarCollapsed, state.activeSubjectId]);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    const messages = await api.getConversationMessages(conversationId);
    update((cur) => ({
      conversations: cur.conversations.map((c) =>
        c.id === conversationId ? { ...c, messages: messages.map(mapMessage) } : c,
      ),
    }));
  }, [update]);

  const refreshData = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      update({ user: null, loading: false, initialized: true });
      return;
    }

    update({ loading: true });
    try {
      const me = await api.getMe();
      const [subjects, pdfs, conversations, aiCfg] = await Promise.all([
        api.listSubjects(),
        api.listPdfs(),
        api.listConversations(),
        api.getAiConfig(),
      ]);

      update({
        user: {
          name: me.name,
          email: me.email,
          avatar: me.avatarUrl || undefined,
        },
        subjects: subjects.map((s) => ({ id: s.id, name: s.name, color: s.color })),
        pdfs: pdfs.map(mapPdf),
        conversations: conversations.map((c) => ({
          id: c.id,
          title: c.title,
          subjectId: c.subjectId,
          messages: [],
          createdAt: new Date(c.createdAt).getTime(),
        })),
        aiConfig: mapAiConfig(aiCfg),
        loading: false,
        initialized: true,
      });
    } catch {
      api.clearToken();
      update({ user: null, loading: false, initialized: true });
    }
  }, [update]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (state.activeConversationId) {
      const conv = state.conversations.find((c) => c.id === state.activeConversationId);
      if (conv && conv.messages.length === 0) {
        void loadConversationMessages(state.activeConversationId);
      }
    }
  }, [state.activeConversationId, state.conversations, loadConversationMessages]);

  const value: Ctx = useMemo(() => {
    return {
      ...state,
      setUser: (user) => update({ user }),
      refreshData,

      addSubject: async (s) => {
        const created = await api.createSubject(s);
        const sub: Subject = { id: created.id, name: created.name, color: created.color };
        update((cur) => ({ subjects: [...cur.subjects, sub] }));
        return sub;
      },

      updateSubject: async (id, patch) => {
        await api.updateSubjectApi(id, patch);
        update((cur) => ({
          subjects: cur.subjects.map((sub) => (sub.id === id ? { ...sub, ...patch } : sub)),
        }));
      },

      deleteSubject: async (id) => {
        await api.deleteSubjectApi(id);
        update((cur) => ({
          subjects: cur.subjects.filter((s) => s.id !== id),
          pdfs: cur.pdfs.map((p) => (p.subjectId === id ? { ...p, subjectId: null } : p)),
          activeSubjectId: cur.activeSubjectId === id ? null : cur.activeSubjectId,
        }));
      },

      setActiveSubject: (id) => update({ activeSubjectId: id, activeConversationId: null }),

      uploadPdfs: async (files, opts) => {
        for (const file of files) {
          const key = `u_${Math.random().toString(36).slice(2, 9)}`;
          try {
            const created = await api.uploadPdf(file, state.activeSubjectId, (pct) => {
              opts?.onTaskProgress?.(key, pct);
            });
            const pdf = mapPdf(created);
            update((cur) => ({ pdfs: [pdf, ...cur.pdfs] }));
            opts?.onTaskDone?.(key);

            if (pdf.processing) {
              const poll = async () => {
                const list = await api.listPdfs(state.activeSubjectId);
                const match = list.find((p) => p.id === pdf.id);
                if (match?.status === "processing") {
                  setTimeout(poll, 2000);
                } else {
                  update((cur) => ({
                    pdfs: cur.pdfs.map((p) =>
                      p.id === pdf.id ? { ...p, processing: match?.status === "processing" } : p,
                    ),
                  }));
                }
              };
              setTimeout(poll, 2000);
            }
          } catch (err) {
            opts?.onTaskDone?.(key);
            throw err;
          }
        }
      },

      updatePdf: (id, patch) =>
        update((cur) => ({
          pdfs: cur.pdfs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      deletePdf: async (id) => {
        await api.deletePdfApi(id);
        update((cur) => ({ pdfs: cur.pdfs.filter((p) => p.id !== id) }));
      },

      newConversation: async (subjectId) => {
        const created = await api.createConversation({ title: "New chat", subjectId });
        const conv: Conversation = {
          id: created.id,
          title: created.title,
          subjectId: created.subjectId,
          messages: [],
          createdAt: new Date(created.createdAt).getTime(),
        };
        update((cur) => ({
          conversations: [conv, ...cur.conversations],
          activeConversationId: conv.id,
        }));
        return conv;
      },

      setActiveConversation: (id) => update({ activeConversationId: id }),

      sendMessage: async (text) => {
        let convId = state.activeConversationId;
        let conversations = state.conversations;

        if (!convId) {
          const created = await api.createConversation({
            title: text.slice(0, 40),
            subjectId: state.activeSubjectId,
          });
          const conv: Conversation = {
            id: created.id,
            title: created.title,
            subjectId: created.subjectId,
            messages: [],
            createdAt: new Date(created.createdAt).getTime(),
          };
          conversations = [conv, ...conversations];
          convId = conv.id;
          update({ conversations, activeConversationId: convId });
        }

        const cfg = state.aiConfig;

        if (cfg.clientSide && cfg.baseUrl) {
          const userMsg = await api.saveUserMessage(convId, text);
          const retrieval = await api.retrieve(text, state.activeSubjectId);
          const context =
            retrieval.chunks.length > 0
              ? retrieval.chunks.map((c) => `[${c.source}]\n${c.text}`).join("\n\n")
              : "No matching document context found.";

          const systemPrompt = `You are HiVe, a professional AI assistant. Answer using ONLY the context below.\n\n${context}`;
          let content = "I could not get a response from the configured AI endpoint.";

          try {
            const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(cfg.apiKey && !cfg.apiKey.includes("*") ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
              },
              body: JSON.stringify({
                model: cfg.model || "local-model",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: text },
                ],
              }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
            content = data.choices?.[0]?.message?.content ?? content;
          } catch {
            content = `⚠️ Could not connect to local AI at \`${cfg.baseUrl}\`. Please check that your server is running and accepts requests from this origin.`;
          }

          const sourceMeta = retrieval.sources.map((filename) => ({ filename }));
          const assistantMsg = await api.saveAssistantMessage(convId, content, sourceMeta);

          update((cur) => ({
            conversations: cur.conversations.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
                    messages: [...c.messages, mapMessage(userMsg), mapMessage(assistantMsg)],
                  }
                : c,
            ),
          }));
        } else {
          const result = await api.sendServerMessage(convId, text);
          update((cur) => ({
            conversations: cur.conversations.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
                    messages: [
                      ...c.messages,
                      mapMessage(result.userMessage),
                      mapMessage(result.assistantMessage),
                    ],
                  }
                : c,
            ),
          }));
        }
      },

      clearActiveConversation: () =>
        update((cur) => ({
          conversations: cur.conversations.map((c) =>
            c.id === cur.activeConversationId ? { ...c, messages: [] } : c,
          ),
        })),

      deleteConversation: async (id) => {
        await api.deleteConversationApi(id);
        update((cur) => {
          const nextShares = { ...cur.shares };
          for (const [slug, cid] of Object.entries(nextShares)) {
            if (cid === id) delete nextShares[slug];
          }
          return {
            conversations: cur.conversations.filter((c) => c.id !== id),
            activeConversationId: cur.activeConversationId === id ? null : cur.activeConversationId,
            shares: nextShares,
          };
        });
      },

      getShareSlug: (conversationId) => {
        const entry = Object.entries(state.shares).find(([, id]) => id === conversationId);
        return entry?.[0];
      },

      loadShareSlug: async (conversationId) => {
        try {
          const result = await api.getConversationShareStatus(conversationId);
          update((cur) => ({ shares: { ...cur.shares, [result.slug]: conversationId } }));
        } catch {
          // Not shared yet
        }
      },

      createShare: async (conversationId) => {
        const result = await api.shareConversationApi(conversationId);
        update((cur) => ({ shares: { ...cur.shares, [result.slug]: conversationId } }));
        return result.slug;
      },

      revokeShare: async (conversationId) => {
        await api.revokeShareApi(conversationId);
        update((cur) => {
          const nextShares = { ...cur.shares };
          for (const [slug, cid] of Object.entries(nextShares)) {
            if (cid === conversationId) delete nextShares[slug];
          }
          return { shares: nextShares };
        });
      },

      setAiConfig: async (aiConfig) => {
        await api.saveAiConfig({
          provider_type: aiConfig.provider,
          base_url: aiConfig.baseUrl,
          api_key: aiConfig.apiKey,
          model: aiConfig.model,
          use_client_side: aiConfig.clientSide,
        });
        const saved = await api.getAiConfig();
        update({ aiConfig: mapAiConfig(saved) });
      },

      toggleSidebar: () => update((cur) => ({ sidebarCollapsed: !cur.sidebarCollapsed })),

      signOut: async () => {
        try {
          await api.logout();
        } catch {}
        api.clearToken();
        update({
          user: null,
          subjects: [],
          pdfs: [],
          conversations: [],
          activeConversationId: null,
          shares: {},
        });
      },
    };
  }, [state, update, refreshData, loadConversationMessages]);

  return <HiveContext.Provider value={value}>{children}</HiveContext.Provider>;
}

export function useHive() {
  const ctx = useContext(HiveContext);
  if (!ctx) throw new Error("useHive must be used inside HiveProvider");
  return ctx;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
