const TOKEN_KEY = "hive:token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const err = data as { error?: string };
    throw new ApiError(err?.error || `Request failed (${res.status})`, res.status);
  }

  return data as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export type BackendUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  theme: string;
  createdAt: string;
};

export async function getMe() {
  return request<BackendUser>("/auth/me");
}

export async function logout() {
  return request<{ success: boolean }>("/auth/logout", { method: "POST" });
}

export async function updateTheme(theme: "light" | "dark" | "system") {
  return request<BackendUser>("/api/user/theme", {
    method: "PATCH",
    body: JSON.stringify({ theme }),
  });
}

// ── Subjects ─────────────────────────────────────────────────────────────────

export type BackendSubject = {
  id: string;
  name: string;
  color: string;
  isPublic?: boolean;
  publicApiKey?: string | null;
  pdfCount?: number;
  createdAt?: string;
};

export async function listSubjects() {
  return request<BackendSubject[]>("/api/subjects");
}

export async function createSubject(data: { name: string; color: string }) {
  return request<BackendSubject>("/api/subjects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSubjectApi(
  id: string,
  data: Partial<{ name: string; color: string; isPublic: boolean; publicApiKey: string | null }>,
) {
  return request<BackendSubject>(`/api/subjects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSubjectApi(id: string) {
  return request<{ success: boolean }>(`/api/subjects/${id}`, { method: "DELETE" });
}

// ── PDFs ─────────────────────────────────────────────────────────────────────

export type BackendPdf = {
  id: string;
  filename: string;
  fileSize: number;
  subjectId: string | null;
  status?: string;
  createdAt: string;
};

export async function listPdfs(subjectId?: string | null) {
  const qs = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : "";
  return request<BackendPdf[]>(`/api/pdfs${qs}`);
}

export function getPdfFileUrl(id: string) {
  return `/api/pdfs/${id}/file`;
}

export function uploadPdf(
  file: File,
  subjectId: string | null,
  onProgress?: (pct: number) => void,
): Promise<BackendPdf> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    if (subjectId) formData.append("subjectId", subjectId);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress((e.loaded / e.total) * 100);
      }
    });

    xhr.addEventListener("load", () => {
      let body: { error?: string } & BackendPdf = { id: "", filename: "", fileSize: 0, subjectId: null, createdAt: "" };
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        reject(new ApiError("Invalid upload response", xhr.status));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as BackendPdf);
      } else {
        reject(new ApiError(body.error || "Upload failed", xhr.status));
      }
    });

    xhr.addEventListener("error", () => reject(new ApiError("Upload network error", 0)));

    xhr.open("POST", "/api/pdfs");
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function deletePdfApi(id: string) {
  return request<{ success: boolean }>(`/api/pdfs/${id}`, { method: "DELETE" });
}

// ── Conversations ────────────────────────────────────────────────────────────

export type BackendConversation = {
  id: string;
  title: string;
  subjectId: string | null;
  createdAt: string;
};

export type BackendMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Array<{ pdfId?: string; filename: string }> | string[] | null;
  createdAt: string;
};

export async function listConversations(subjectId?: string | null) {
  const qs = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : "";
  return request<BackendConversation[]>(`/api/conversations${qs}`);
}

export async function createConversation(data: { title?: string; subjectId: string | null }) {
  return request<BackendConversation>("/api/conversations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getConversationMessages(id: string) {
  return request<BackendMessage[]>(`/api/conversations/${id}/messages`);
}

export async function sendServerMessage(conversationId: string, content: string) {
  return request<{
    userMessage: BackendMessage;
    assistantMessage: BackendMessage;
  }>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function saveUserMessage(conversationId: string, content: string) {
  return request<BackendMessage>(`/api/conversations/${conversationId}/user-message`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function saveAssistantMessage(
  conversationId: string,
  content: string,
  sources?: Array<{ pdfId?: string; filename: string }>,
) {
  return request<BackendMessage>(`/api/conversations/${conversationId}/assistant-message`, {
    method: "POST",
    body: JSON.stringify({ content, sources }),
  });
}

export async function deleteConversationApi(id: string) {
  return request<{ success: boolean }>(`/api/conversations/${id}`, { method: "DELETE" });
}

export async function getConversationShareStatus(id: string) {
  return request<{ slug: string; url: string }>(`/api/conversations/${id}/share`);
}

export async function shareConversationApi(id: string) {
  return request<{ slug: string; url: string }>(`/api/conversations/${id}/share`, { method: "POST" });
}

export async function revokeShareApi(id: string) {
  return request<{ success: boolean }>(`/api/conversations/${id}/share`, { method: "DELETE" });
}

// ── Retrieve ─────────────────────────────────────────────────────────────────

export async function retrieve(question: string, subjectId?: string | null) {
  return request<{
    chunks: Array<{ text: string; source: string }>;
    sources: string[];
  }>("/api/retrieve", {
    method: "POST",
    body: JSON.stringify({ question, subjectId: subjectId || undefined }),
  });
}

// ── AI config ────────────────────────────────────────────────────────────────

export type BackendAiConfig = {
  configured: boolean;
  provider_type?: string;
  base_url?: string;
  api_key_masked?: string | null;
  model?: string;
  use_client_side?: boolean;
};

export async function getAiConfig() {
  return request<BackendAiConfig>("/api/ai-config");
}

export async function saveAiConfig(data: {
  provider_type: string;
  base_url: string;
  api_key: string;
  model: string;
  use_client_side: boolean;
}) {
  return request<{ success: boolean }>("/api/ai-config", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function testAiConfig(data: {
  provider_type: string;
  base_url: string;
  api_key: string;
  model: string;
}) {
  return request<{ success: boolean; message?: string; error?: string }>("/api/ai-config/test", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Shared ───────────────────────────────────────────────────────────────────

export async function getSharedConversation(slug: string) {
  return request<{
    title: string;
    messages: Array<{
      role: "user" | "assistant";
      content: string;
      sources: Array<{ filename: string }> | null;
    }>;
  }>(`/api/shared/${slug}`);
}
