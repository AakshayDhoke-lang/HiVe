import { useEffect, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  Plus,
  MessageSquare,
  Settings,
  LogOut,
  MoreHorizontal,
  Pencil,
  Trash2,
  Sun,
  Moon,
  Keyboard,
  Puzzle,
} from "lucide-react";
import { useHive } from "@/lib/hive-store";
import { useTheme } from "@/lib/theme";
import { HiveLogo } from "./Logo";
import { SubjectModal } from "./SubjectModal";
import { AiConfigModal } from "./AiConfigModal";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { ExtensionsModal } from "./ExtensionsModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Subject } from "@/lib/hive-store";


export function Sidebar() {
  const {
    subjects,
    pdfs,
    conversations,
    activeSubjectId,
    activeConversationId,
    setActiveSubject,
    setActiveConversation,
    newConversation,
    deleteSubject,
    deleteConversation,
    sidebarCollapsed,
    toggleSidebar,
    user,
    signOut,
  } = useHive();

  const [subjectModal, setSubjectModal] = useState<{ open: boolean; edit?: Subject }>({
    open: false,
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [extensionsOpen, setExtensionsOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  // Global Cmd/Ctrl + / toggles dark mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleTheme]);

  const collapsed = sidebarCollapsed;


  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ${
        collapsed ? "w-[64px]" : "w-[260px]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        {collapsed ? (
          <div className="mx-auto"><HiveLogo size={26} /></div>
        ) : (
          <HiveLogo size={26} withWordmark />
        )}
        <button
          onClick={toggleSidebar}
          className={`rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground ${
            collapsed ? "absolute right-2 top-3" : ""
          }`}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      {/* New chat */}
      <div className="px-3">
        <button
          onClick={() => void newConversation(activeSubjectId)}
          className={`group flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-hover/40 px-3 py-2 text-sm font-medium hover:bg-sidebar-hover ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Plus size={16} />
          {!collapsed && <span>New chat</span>}
        </button>
      </div>

      {/* Subjects */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={`flex items-center justify-between px-4 ${collapsed ? "hidden" : ""}`}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Subjects
          </span>
          <button
            onClick={() => setSubjectModal({ open: true })}
            className="rounded p-1 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
            aria-label="New subject"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="mt-2 space-y-0.5 overflow-y-auto px-2 pb-2">
          <SubjectRow
            collapsed={collapsed}
            color="#94a3b8"
            name="All documents"
            count={pdfs.length}
            active={activeSubjectId === null}
            onClick={() => setActiveSubject(null)}
          />
          {subjects.map((s) => (
            <SubjectRow
              key={s.id}
              collapsed={collapsed}
              color={s.color}
              name={s.name}
              count={pdfs.filter((p) => p.subjectId === s.id).length}
              active={activeSubjectId === s.id}
              onClick={() => setActiveSubject(s.id)}
              onEdit={() => setSubjectModal({ open: true, edit: s })}
              onDelete={() => {
                void deleteSubject(s.id).then(() => toast.success(`Deleted "${s.name}"`));
              }}
            />
          ))}
        </div>

        {/* Chats */}
        {!collapsed && (
          <>
            <div className="mt-4 px-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                Recent chats
              </span>
            </div>
            <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
              {conversations.length === 0 && (
                <p className="px-3 py-2 text-xs text-sidebar-muted">No chats yet.</p>
              )}
              {conversations.map((c) => (
                <div key={c.id} className="group relative">
                  <button
                    onClick={() => setActiveConversation(c.id)}
                    className={`flex w-full items-center gap-2 truncate rounded-md py-2 pl-3 pr-8 text-left text-[13px] hover:bg-sidebar-hover ${
                      activeConversationId === c.id ? "bg-sidebar-hover" : ""
                    }`}
                  >
                    <MessageSquare size={14} className="shrink-0 text-sidebar-muted" />
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(c.id);
                    }}
                    aria-label="Delete conversation"
                    title="Delete conversation"
                    className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-sidebar-muted opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer / user */}
      <div className="border-t border-sidebar-border p-3">
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.name ?? "Guest"}</p>
              <p className="truncate text-[11px] text-sidebar-muted">{user?.email ?? ""}</p>
            </div>
          )}
          {!collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground">
                  <MoreHorizontal size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === "dark" ? (
                    <><Sun size={14} className="mr-2" /> Light mode</>
                  ) : (
                    <><Moon size={14} className="mr-2" /> Dark mode</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
                  <Keyboard size={14} className="mr-2" /> Keyboard shortcuts
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setExtensionsOpen(true)}>
                  <Puzzle size={14} className="mr-2" /> Extensions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAiOpen(true)}>
                  <Settings size={14} className="mr-2" /> AI configuration
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    void signOut().then(() => {
                      toast.success("Signed out");
                      window.location.href = "/login";
                    });
                  }}
                >
                  <LogOut size={14} className="mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {!collapsed && (
          <div className="mt-2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
              onClick={() => setAiOpen(true)}
            >
              <Settings size={14} className="mr-2" /> AI configuration
            </Button>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={theme === "dark" ? "Light mode (⌘/)" : "Dark mode (⌘/)"}
              className="rounded-md p-2 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts"
              className="rounded-md p-2 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <Keyboard size={14} />
            </button>
          </div>
        )}
        {collapsed && (
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="mt-2 grid w-full place-items-center rounded-md p-2 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        )}
      </div>

      <SubjectModal
        open={subjectModal.open}
        edit={subjectModal.edit}
        onOpenChange={(open) => setSubjectModal({ open })}
      />
      <AiConfigModal open={aiOpen} onOpenChange={setAiOpen} />
      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ExtensionsModal open={extensionsOpen} onOpenChange={setExtensionsOpen} />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
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
                if (confirmDeleteId) {
                  void deleteConversation(confirmDeleteId).then(() => toast.success("Conversation deleted"));
                }
                setConfirmDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </aside>
  );
}

function SubjectRow({
  collapsed,
  color,
  name,
  count,
  active,
  onClick,
  onEdit,
  onDelete,
}: {
  collapsed: boolean;
  color: string;
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
          active
            ? "bg-brand text-white shadow-glow"
            : "text-sidebar-foreground hover:bg-sidebar-hover"
        } ${collapsed ? "justify-center px-0" : ""}`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                active ? "bg-white/20 text-white" : "bg-sidebar-hover text-sidebar-muted"
              }`}
            >
              {count}
            </span>
          </>
        )}
      </button>
      {!collapsed && onEdit && onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 group-hover:opacity-100 ${
                active ? "text-white hover:bg-white/20" : "text-sidebar-muted hover:bg-sidebar-hover"
              }`}
              aria-label="Subject options"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil size={14} className="mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 size={14} className="mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
