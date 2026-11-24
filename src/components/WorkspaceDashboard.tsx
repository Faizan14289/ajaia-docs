"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  Eye,
  FilePlus2,
  FileText,
  FileUp,
  FolderKanban,
  HardDrive,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  DOCUMENT_TEMPLATES,
  formatRelativeTime,
  IMPORT_SUPPORTED_LABEL,
} from "@/lib/format";
import type {
  DocumentDetail,
  DocumentShareWithUser,
  DocumentSummary,
  StorageBackend,
  User,
} from "@/lib/types";
import { ImportModal } from "./ImportModal";
import { ShareModal } from "./ShareModal";
import { UserSwitcher } from "./UserSwitcher";

type WorkspaceFilter = "all" | "owned" | "shared";

export function WorkspaceDashboard() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [storageBackend, setStorageBackend] = useState<StorageBackend>("file");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<WorkspaceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [sharingDoc, setSharingDoc] = useState<DocumentSummary | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<DocumentSummary | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renamingBusy, setRenamingBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchWorkspaceData = useCallback(async () => {
    const [sessionRes, docsRes] = await Promise.all([
      fetch("/api/session", { cache: "no-store" }),
      fetch("/api/documents", { cache: "no-store" }),
    ]);

    if (!sessionRes.ok || !docsRes.ok) {
      throw new Error("Could not load workspace data.");
    }

    const [sessionData, docsData] = await Promise.all([
      sessionRes.json(),
      docsRes.json(),
    ]);

    return {
      currentUser: sessionData.currentUser as User,
      users: sessionData.users as User[],
      storageBackend: sessionData.storageBackend as StorageBackend,
      documents: docsData.documents as DocumentSummary[],
    };
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaceData();
      setCurrentUser(data.currentUser);
      setUsers(data.users);
      setStorageBackend(data.storageBackend);
      setDocuments(data.documents);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load workspace."
      );
    } finally {
      setLoading(false);
    }
  }, [fetchWorkspaceData]);

  useEffect(() => {
    let active = true;
    fetchWorkspaceData()
      .then((data) => {
        if (!active) return;
        setCurrentUser(data.currentUser);
        setUsers(data.users);
        setStorageBackend(data.storageBackend);
        setDocuments(data.documents);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Failed to load workspace."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchWorkspaceData]);

  const ownedDocs = useMemo(
    () => documents.filter((d) => d.accessRole === "owner"),
    [documents]
  );
  const sharedDocs = useMemo(
    () => documents.filter((d) => d.accessRole !== "owner"),
    [documents]
  );

  const matchesSearch = useCallback(
    (doc: DocumentSummary) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.excerpt.toLowerCase().includes(q) ||
        doc.owner.name.toLowerCase().includes(q)
      );
    },
    [searchQuery]
  );

  const filteredOwned = useMemo(
    () => ownedDocs.filter(matchesSearch),
    [ownedDocs, matchesSearch]
  );
  const filteredShared = useMemo(
    () => sharedDocs.filter(matchesSearch),
    [sharedDocs, matchesSearch]
  );

  async function handleSwitchUser(userId: string) {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      await loadWorkspace();
    }
  }

  async function handleCreateDocument(preset?: {
    title: string;
    contentHtml: string;
  }) {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          preset ?? {
            title: "Untitled Document",
            contentHtml: "<p></p>",
          }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to create document.");
        return;
      }
      router.push(`/docs/${data.document.id}`);
    } catch {
      setError("Network error while creating document.");
    } finally {
      setCreating(false);
    }
  }

  function handleImported(doc: DocumentDetail) {
    setShowImportModal(false);
    router.push(`/docs/${doc.id}`);
  }

  function openRenameModal(doc: DocumentSummary) {
    setRenamingDoc(doc);
    setRenameInput(doc.title);
  }

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renamingDoc) return;
    const trimmed = renameInput.trim();
    if (!trimmed) return;

    setRenamingBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${renamingDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to rename document.");
        return;
      }
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === renamingDoc.id
            ? {
                ...d,
                title: data.document.title,
                updatedAt: data.document.updatedAt,
              }
            : d
        )
      );
      setRenamingDoc(null);
    } catch {
      setError("Network error while renaming document.");
    } finally {
      setRenamingBusy(false);
    }
  }

  async function handleDelete(doc: DocumentSummary) {
    const confirmed = window.confirm(
      `Delete "${doc.title}"? This will also remove its attachments and sharing permissions.`
    );
    if (!confirmed) return;

    setDeletingId(doc.id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to delete document.");
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      setError("Network error while deleting document.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSharesUpdated(docId: string, shares: DocumentShareWithUser[]) {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, shares } : d))
    );
    setSharingDoc((prev) =>
      prev && prev.id === docId ? { ...prev, shares } : prev
    );
  }

  function renderDocumentCard(doc: DocumentSummary) {
    const isOwner = doc.accessRole === "owner";
    const canEdit = isOwner || doc.accessRole === "editor";

    return (
      <div
        key={doc.id}
        className="group relative flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 shadow-2xs transition hover:border-indigo-300/80 hover:shadow-sm"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/docs/${doc.id}`}
              className="min-w-0 flex-1 focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    isOwner
                      ? "bg-indigo-50 text-indigo-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <h3 className="truncate text-sm font-semibold text-gray-900 group-hover:text-indigo-700">
                  {doc.title}
                </h3>
              </div>
            </Link>

            {/* Quick action buttons */}
            <div className="flex shrink-0 items-center gap-0.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => openRenameModal(doc)}
                  className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                  title="Rename document"
                  aria-label={`Rename ${doc.title}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setSharingDoc(doc)}
                className="rounded-md p-1.5 text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer"
                title={isOwner ? "Share document" : "View collaborators"}
                aria-label={`Share ${doc.title}`}
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
              {isOwner && (
                <button
                  type="button"
                  disabled={deletingId === doc.id}
                  onClick={() => void handleDelete(doc)}
                  className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                  title="Delete document"
                  aria-label={`Delete ${doc.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <Link href={`/docs/${doc.id}`} className="mt-2.5 block">
            <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">
              {doc.excerpt}
            </p>
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {isOwner ? (
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                Owner
              </span>
            ) : doc.accessRole === "editor" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Shared · Editor
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                <Eye className="h-3 w-3" />
                Shared · View only
              </span>
            )}

            {!isOwner && (
              <span className="text-[11px] text-gray-500">
                by <strong className="font-medium text-gray-700">{doc.owner.name}</strong>
              </span>
            )}

            {doc.attachmentCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                title={`${doc.attachmentCount} attached file(s)`}
              >
                <Paperclip className="h-3 w-3" />
                {doc.attachmentCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {doc.shares.length > 0 && (
              <div
                className="flex -space-x-1.5"
                title={`Shared with ${doc.shares
                  .map((s) => `${s.user.name} (${s.role})`)
                  .join(", ")}`}
              >
                {doc.shares.slice(0, 3).map((s) => (
                  <span
                    key={s.id}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-white"
                    style={{ backgroundColor: s.user.avatarColor }}
                  >
                    {s.user.initials}
                  </span>
                ))}
                {doc.shares.length > 3 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[9px] font-semibold text-gray-700 ring-2 ring-white">
                    +{doc.shares.length - 3}
                  </span>
                )}
              </div>
            )}
            <span className="text-[11px] text-gray-400">
              {formatRelativeTime(doc.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] lg:flex-row">
      {/* Left Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-white lg:w-64 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-gray-900">
                Ajaia Docs
              </div>
              <div className="text-[11px] text-gray-400">
                Team Workspace
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 px-4 pb-4">
          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreateDocument()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            New Document
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 cursor-pointer"
          >
            <FileUp className="h-4 w-4" />
            Import File (.txt, .md, .docx)
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`flex shrink-0 items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition cursor-pointer ${
              filter === "all"
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
            }`}
          >
            <span className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              All Documents
            </span>
            <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold">
              {documents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("owned")}
            className={`flex shrink-0 items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition cursor-pointer ${
              filter === "owned"
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
            }`}
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              My Documents
            </span>
            <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold">
              {ownedDocs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("shared")}
            className={`flex shrink-0 items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition cursor-pointer ${
              filter === "shared"
                ? "bg-emerald-50 text-emerald-700"
                : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Shared with Me
            </span>
            <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold">
              {sharedDocs.length}
            </span>
          </button>
        </nav>

        <div className="hidden border-t border-gray-100 p-4 lg:block">
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
            {storageBackend === "postgres" ? (
              <>
                <Database className="h-3.5 w-3.5 text-emerald-600" />
                <span>PostgreSQL persistence active</span>
              </>
            ) : (
              <>
                <HardDrive className="h-3.5 w-3.5 text-indigo-600" />
                <span>Local file store active</span>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-6 py-3 backdrop-blur-sm">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by title, content, or owner…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50/70 py-1.5 pr-3 pl-9 text-xs text-gray-800 placeholder:text-gray-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {currentUser && (
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] font-medium text-gray-400 sm:inline">
                Active user:
              </span>
              <UserSwitcher
                currentUser={currentUser}
                users={users}
                onSwitch={handleSwitchUser}
                compact
              />
            </div>
          )}
        </header>

        <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-7">
          {error && (
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded p-1 hover:bg-red-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Quick-Start Strip */}
          <section aria-label="Start a new document">
            <div className="mb-3 flex items-center justify-between">
              <h1 className="text-base font-semibold text-gray-900">
                Start a document
              </h1>
              <span className="text-[11px] text-gray-500">
                File import supports {IMPORT_SUPPORTED_LABEL}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                disabled={creating}
                onClick={() => void handleCreateDocument()}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 text-left transition hover:border-indigo-300 hover:shadow-xs cursor-pointer"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <FilePlus2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900">
                    Blank Document
                  </div>
                  <div className="truncate text-[11px] text-gray-500">
                    Clean rich-text canvas
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 text-left transition hover:border-indigo-300 hover:shadow-xs cursor-pointer"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <FileUp className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900">
                    Import File
                  </div>
                  <div className="truncate text-[11px] text-gray-500">
                    .txt, .md, or .docx
                  </div>
                </div>
              </button>

              {DOCUMENT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  disabled={creating}
                  onClick={() =>
                    void handleCreateDocument({
                      title: tpl.title,
                      contentHtml: tpl.contentHtml,
                    })
                  }
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 text-left transition hover:border-indigo-300 hover:shadow-xs cursor-pointer"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-900">
                      {tpl.label}
                    </div>
                    <div className="truncate text-[11px] text-gray-500">
                      {tpl.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Document Lists */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-600" />
              Loading workspace documents…
            </div>
          ) : (
            <div className="space-y-8">
              {/* Owned Documents Section */}
              {(filter === "all" || filter === "owned") && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-gray-900">
                        My Documents
                      </h2>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                        {filteredOwned.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      Owned by {currentUser?.name}
                    </span>
                  </div>

                  {filteredOwned.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white/70 py-10 text-center">
                      <p className="text-xs font-medium text-gray-600">
                        {searchQuery
                          ? "No owned documents match your search."
                          : "You haven't created any documents yet."}
                      </p>
                      {!searchQuery && (
                        <button
                          type="button"
                          onClick={() => void handleCreateDocument()}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create your first document
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                      {filteredOwned.map(renderDocumentCard)}
                    </div>
                  )}
                </section>
              )}

              {/* Shared with Me Section */}
              {(filter === "all" || filter === "shared") && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-gray-900">
                        Shared with Me
                      </h2>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        {filteredShared.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      Collaborating as Editor or Viewer
                    </span>
                  </div>

                  {filteredShared.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white/70 py-10 text-center">
                      <p className="text-xs font-medium text-gray-600">
                        {searchQuery
                          ? "No shared documents match your search."
                          : "No documents have been shared with this account yet."}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        Try switching accounts in the top-right and sharing a
                        document with {currentUser?.name}.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                      {filteredShared.map(renderDocumentCard)}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          mode="new"
          onClose={() => setShowImportModal(false)}
          onImported={handleImported}
        />
      )}

      {/* Share Modal */}
      {sharingDoc && (
        <ShareModal
          documentId={sharingDoc.id}
          documentTitle={sharingDoc.title}
          owner={sharingDoc.owner}
          accessRole={sharingDoc.accessRole}
          shares={sharingDoc.shares}
          allUsers={users}
          onClose={() => setSharingDoc(null)}
          onSharesUpdated={(shares) => handleSharesUpdated(sharingDoc.id, shares)}
        />
      )}

      {/* Rename Modal */}
      {renamingDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
          onClick={() => setRenamingDoc(null)}
        >
          <form
            onSubmit={handleRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Rename Document
              </h2>
            </div>
            <div className="p-5">
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                maxLength={120}
                placeholder="Document title"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-3">
              <button
                type="button"
                onClick={() => setRenamingDoc(null)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renamingBusy || !renameInput.trim()}
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {renamingBusy ? "Saving…" : "Save Name"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
