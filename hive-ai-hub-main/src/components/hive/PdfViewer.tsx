import { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Loader2,
  FileWarning,
} from "lucide-react";
import { getPdfAuthHeaders, getPdfFileUrl, type Pdf } from "@/lib/hive-store";

// pdfjs-dist v6 ESM with worker (browser-only)
import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerPort) {
  pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
}


type PdfDoc = Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;

export function PdfViewer({ pdf, onClose }: { pdf: Pdf; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const fileUrl = getPdfFileUrl(pdf.id);
  const authHeaders = getPdfAuthHeaders();

  // Load doc
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const task = pdfjsLib.getDocument({ url: fileUrl, httpHeaders: authHeaders });
    task.promise
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setPageNum(1);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load PDF");
        setLoading(false);
      });
    return () => {
      cancelled = true;
      task.destroy?.();
    };
  }, [fileUrl, authHeaders.Authorization]);

  // Render page
  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTaskRef.current?.cancel();
        const task = page.render({ canvasContext: ctx, viewport, canvas });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException" && !cancelled) {
          setError(e?.message ?? "Render error");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [doc, pageNum, scale]);

  const numPages = doc?.numPages ?? 0;
  const prev = useCallback(
    () => setPageNum((n) => Math.max(1, n - 1)),
    [],
  );
  const next = useCallback(
    () => setPageNum((n) => Math.min(numPages || 1, n + 1)),
    [numPages],
  );

  const fitWidth = useCallback(async () => {
    if (!doc || !containerRef.current) return;
    const page = await doc.getPage(pageNum);
    const v = page.getViewport({ scale: 1 });
    const target = containerRef.current.clientWidth - 48;
    setScale(Math.max(0.4, Math.min(4, target / v.width)));
  }, [doc, pageNum]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if ((e.key === "+" || e.key === "=") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setScale((s) => Math.min(4, s + 0.2));
      } else if (e.key === "-" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setScale((s) => Math.max(0.4, s - 0.2));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`PDF preview: ${pdf.name}`}
      onClick={onClose}
    >
      <div
        className="flex h-[95vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl md:h-[90vh] md:max-w-[90vw] md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2 md:hidden">
          <div className="h-1.5 w-12 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-6">
          <h2 className="flex-1 truncate text-sm font-semibold text-foreground md:text-base">
            {pdf.name}
          </h2>
          <div className="hidden items-center gap-1 md:flex">
            <ViewerButton onClick={prev} disabled={pageNum <= 1} aria-label="Previous page">
              <ChevronLeft size={16} />
            </ViewerButton>
            <span className="min-w-[64px] text-center text-xs tabular-nums text-muted-foreground">
              {pageNum} / {numPages || "–"}
            </span>
            <ViewerButton
              onClick={next}
              disabled={!numPages || pageNum >= numPages}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </ViewerButton>
            <div className="mx-2 h-5 w-px bg-border" />
            <ViewerButton
              onClick={() => setScale((s) => Math.max(0.4, s - 0.2))}
              aria-label="Zoom out"
            >
              <ZoomOut size={16} />
            </ViewerButton>
            <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <ViewerButton
              onClick={() => setScale((s) => Math.min(4, s + 0.2))}
              aria-label="Zoom in"
            >
              <ZoomIn size={16} />
            </ViewerButton>
            <ViewerButton onClick={fitWidth} aria-label="Fit to width">
              <Maximize2 size={16} />
            </ViewerButton>
            {fileUrl && (
              <a
                href={fileUrl}
                download={pdf.name}
                className="ml-1 grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Download PDF"
              >
                <Download size={16} />
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close preview"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-auto bg-muted/40"
        >
          {error ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                <FileWarning size={32} className="text-destructive" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-full items-start justify-center p-4 md:p-6">
              {loading && (
                <div className="absolute inset-0 grid place-items-center bg-background/40 backdrop-blur-sm">
                  <Loader2 size={28} className="animate-spin text-primary" />
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="rounded-md bg-white shadow-lg"
              />
            </div>
          )}
        </div>

        {/* Mobile toolbar */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 md:hidden">
          <ViewerButton onClick={prev} disabled={pageNum <= 1} aria-label="Previous page">
            <ChevronLeft size={18} />
          </ViewerButton>
          <span className="text-xs tabular-nums text-muted-foreground">
            {pageNum} / {numPages || "–"}
          </span>
          <div className="flex items-center gap-1">
            <ViewerButton
              onClick={() => setScale((s) => Math.max(0.4, s - 0.2))}
              aria-label="Zoom out"
            >
              <ZoomOut size={16} />
            </ViewerButton>
            <ViewerButton
              onClick={() => setScale((s) => Math.min(4, s + 0.2))}
              aria-label="Zoom in"
            >
              <ZoomIn size={16} />
            </ViewerButton>
          </div>
          <ViewerButton
            onClick={next}
            disabled={!numPages || pageNum >= numPages}
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </ViewerButton>
        </div>
      </div>
    </div>
  );
}

function ViewerButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
