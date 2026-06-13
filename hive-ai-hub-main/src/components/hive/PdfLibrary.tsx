import { lazy, Suspense, useRef, useState } from "react";
import { Upload, FileText, Trash2, Plus, FileX, Eye, Loader2, X } from "lucide-react";
import { useHive, formatBytes, type Pdf } from "@/lib/hive-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
const PdfViewer = lazy(() => import("./PdfViewer").then((m) => ({ default: m.PdfViewer })));
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

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB

type UploadTask = {
  key: string;
  name: string;
  size: number;
  progress: number; // 0..100
};

export function PdfLibrary() {
  const { pdfs, subjects, activeSubjectId, uploadPdfs, deletePdf } = useHive();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [preview, setPreview] = useState<Pdf | null>(null);
  const [uploads, setUploads] = useState<UploadTask[]>([]);


  const subject = subjects.find((s) => s.id === activeSubjectId);
  const filtered = activeSubjectId
    ? pdfs.filter((p) => p.subjectId === activeSubjectId)
    : pdfs;

  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type === "application/pdf");
    const tooBig = arr.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) {
      toast.error(`${tooBig.length} file(s) exceed the 200 MB limit`);
    }
    const ok = arr.filter((f) => f.size <= MAX_BYTES);
    if (!ok.length) {
      if (!tooBig.length) toast.error("Only PDF files are supported");
      return;
    }

    const tasks: UploadTask[] = ok.map((f) => ({
      key: `u_${Math.random().toString(36).slice(2, 9)}`,
      name: f.name,
      size: f.size,
      progress: 0,
    }));
    setUploads((cur) => [...cur, ...tasks]);

    ok.forEach((file, i) => {
      const taskKey = tasks[i].key;
      void uploadPdfs([file], {
        onTaskProgress: (key, pct) => {
          if (key !== taskKey) return;
          setUploads((cur) => cur.map((u) => (u.key === key ? { ...u, progress: pct } : u)));
        },
        onTaskDone: (key) => {
          setUploads((cur) => cur.filter((u) => u.key !== key));
        },
      }).catch((err: Error) => {
        toast.error(err.message || "Upload failed");
        setUploads((cur) => cur.filter((u) => u.key !== taskKey));
      });
    });

    toast.success(`Uploading ${ok.length} PDF${ok.length > 1 ? "s" : ""}…`);
  };


  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {subject && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: subject.color }}
              />
            )}
            <h1 className="truncate text-lg font-semibold text-foreground">
              {subject?.name ?? "All documents"}
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filtered.length} PDF{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          onClick={() => inputRef.current?.click()}
          className="bg-brand text-white shadow-glow hover:opacity-90"
        >
          <Upload size={16} className="mr-2" />
          Upload PDF
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Body */}
      <div
        className="relative flex-1 overflow-y-auto p-6"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-4 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
            <p className="text-sm font-medium text-primary">Drop PDFs to upload</p>
          </div>
        )}

        {filtered.length === 0 ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="grid min-h-[260px] w-full place-items-center rounded-2xl border-2 border-dashed border-border bg-muted/30 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <div className="flex flex-col items-center gap-3 px-6">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-glow">
                <Upload size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Drag & drop PDFs here, or click to browse
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF only · up to 200 MB each
                </p>
              </div>
            </div>
          </button>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {filtered.map((p) => {
              const sub = subjects.find((s) => s.id === p.subjectId);
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreview(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPreview(p);
                    }
                  }}
                  className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreview(p);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md bg-background/80 text-muted-foreground backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
                      aria-label="Preview PDF"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setToDelete(p.id);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md bg-background/80 text-muted-foreground backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Delete PDF"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-rose-500/15 to-pink-500/15 text-rose-600">
                    <FileText size={20} />
                  </div>

                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                      {p.name}
                    </p>
                    {p.processing && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        <Loader2 size={10} className="animate-spin" />
                        Processing
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 text-[11px]">
                    {sub ? (
                      <span
                        className="flex items-center gap-1.5 truncate rounded-full px-2 py-0.5 font-medium"
                        style={{
                          backgroundColor: `${sub.color}1a`,
                          color: sub.color,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: sub.color }}
                        />
                        {sub.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unfiled</span>
                    )}
                    <span className="shrink-0 text-muted-foreground">
                      {formatBytes(p.size)}
                    </span>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => inputRef.current?.click()}
              className="grid min-h-[140px] place-items-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 hover:text-foreground"
            >
              <div className="flex flex-col items-center gap-1.5 text-xs font-medium">
                <Plus size={20} />
                Add more
              </div>
            </button>
          </div>
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileX size={18} className="text-destructive" /> Delete PDF?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the document from your library. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) {
                  void deletePdf(toDelete).then(() => toast.success("PDF deleted"));
                }
                setToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {preview && (
        <Suspense fallback={null}>
          <PdfViewer pdf={preview} onClose={() => setPreview(null)} />
        </Suspense>
      )}

      {uploads.length > 0 && (
        <div className="pointer-events-auto fixed bottom-4 right-4 z-40 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-card-hover">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-foreground">
              Uploading {uploads.length} file{uploads.length > 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setUploads([])}
              className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Dismiss uploads"
            >
              <X size={12} />
            </button>
          </div>
          <ul className="max-h-64 space-y-2.5 overflow-y-auto p-3">
            {uploads.map((u) => (
              <li key={u.key}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[12px] font-medium text-foreground">{u.name}</p>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {Math.round(u.progress)}% · {formatBytes(u.size)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-brand transition-[width] duration-150 ease-out"
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>

  );
}
