"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Cloud,
  Eye,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  Save,
  Share2,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import type {
  DocumentAttachmentMeta,
  DocumentDetail,
  DocumentShareWithUser,
  User,
} from "@/lib/types";
import { AttachmentsDrawer } from "./AttachmentsDrawer";
import { ImportModal } from "./ImportModal";
import { RichTextEditor } from "./RichTextEditor";
import { ShareModal } from "./ShareModal";
import { UserSwitcher } from "./UserSwitcher";

type SaveState = "saved" | "unsaved" | "saving" | "error";

interface DocumentEditorViewProps {
  documentId: string;
}

export function DocumentEditorView({ documentId }: DocumentEditorViewProps) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<{
    status: number;
    message: string;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("<p></p>");
  const [syncVersion, setSyncVersion] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<{ title: string; html: string }>({
    title: "",
    html: "<p></p>",
  });
  const lastSavedRef = useRef<{ title: string; html: string }>({
    title: "",
    html: "<p></p>",
  });

  const canEdit = doc?.accessRole === "owner" || doc?.accessRole === "editor";

  const applyLoadedPayload = useCallback(
    (payload: {
      currentUser: User | null;
      users: User[];
      doc: DocumentDetail | null;
      accessError: { status: number; message: string } | null;
    }) => {
      if (payload.currentUser) setCurrentUser(payload.currentUser);
      if (payload.users.length > 0) setUsers(payload.users);

      if (payload.accessError || !payload.doc) {
        setDoc(null);
        setAccessError(
          payload.accessError ?? {
            status: 404,
            message: "Unable to open this document.",
          }
        );
        return;
      }

      const loaded = payload.doc;
      setAccessError(null);
      setDoc(loaded);
      setTitle(loaded.title);
      setHtml(loaded.contentHtml);
      latestDraftRef.current = {
        title: loaded.title,
        html: loaded.contentHtml,
      };
      lastSavedRef.current = {
        title: loaded.title,
        html: loaded.contentHtml,
      };
      setSyncVersion((v) => v + 1);
      setSaveState("saved");
      setSaveError(null);
    },
    []
  );

  const fetchWorkspaceAndDoc = useCallback(async () => {
    const [sessionRes, docRes] = await Promise.all([
      fetch("/api/session", { cache: "no-store" }),
      fetch(`/api/documents/${documentId}`, { cache: "no-store" }),
    ]);

    let nextUser: User | null = null;
    let nextUsers: User[] = [];
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      nextUser = sessionData.currentUser;
      nextUsers = sessionData.users;
    }

    const docData = await docRes.json();
    if (!docRes.ok) {
      return {
        currentUser: nextUser,
        users: nextUsers,
        doc: null,
        accessError: {
          status: docRes.status,
          message: docData.error || "Unable to open this document.",
        },
      };
    }

    return {
      currentUser: nextUser,
      users: nextUsers,
      doc: docData.document as DocumentDetail,
      accessError: null,
    };
  }, [documentId]);

  const loadWorkspaceAndDoc = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchWorkspaceAndDoc();
      applyLoadedPayload(payload);
    } catch {
      setAccessError({
        status: 500,
        message: "Network error while loading document.",
      });
    } finally {
      setLoading(false);
    }
  }, [fetchWorkspaceAndDoc, applyLoadedPayload]);

  useEffect(() => {
    let active = true;
    fetchWorkspaceAndDoc()
      .then((payload) => {
        if (!active) return;
        applyLoadedPayload(payload);
      })
      .catch(() => {
        if (!active) return;
        setAccessError({
          status: 500,
          message: "Network error while loading document.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchWorkspaceAndDoc, applyLoadedPayload]);

  const persistChanges = useCallback(
    async (override?: { title?: string; html?: string }) => {
      if (!doc || (doc.accessRole !== "owner" && doc.accessRole !== "editor")) {
        return;
      }

      const nextTitle = (override?.title ?? latestDraftRef.current.title).trim();
      const nextHtml = override?.html ?? latestDraftRef.current.html;

      if (!nextTitle) {
        setSaveError("Document title cannot be empty.");
        setSaveState("error");
        return;
      }

      if (
        nextTitle === lastSavedRef.current.title &&
        nextHtml === lastSavedRef.current.html
      ) {
        setSaveState("saved");
        return;
      }

      setSaveState("saving");
      setSaveError(null);

      try {
        const res = await fetch(`/api/documents/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: nextTitle,
            contentHtml: nextHtml,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSaveState("error");
          setSaveError(data.error || "Could not save changes.");
          return;
        }
        const savedDoc: DocumentDetail = data.document;
        setDoc(savedDoc);
        lastSavedRef.current = {
          title: savedDoc.title,
          html: nextHtml,
        };
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setSaveError("Connection issue — click Retry to save.");
      }
    },
    [doc]
  );

  const scheduleAutosave = useCallback(() => {
    setSaveState("unsaved");
    setSaveError(null);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void persistChanges();
    }, 800);
  }, [persistChanges]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Warn on tab close if unsaved
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveState === "unsaved" || saveState === "saving") {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveState]);

  // Cmd/Ctrl + S immediate save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canEdit) {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          void persistChanges();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canEdit, persistChanges]);

  function handleTitleChange(nextTitle: string) {
    setTitle(nextTitle);
    latestDraftRef.current.title = nextTitle;
    scheduleAutosave();
  }

  function handleHtmlChange(nextHtml: string) {
    setHtml(nextHtml);
    latestDraftRef.current.html = nextHtml;
    scheduleAutosave();
  }

  async function handleSwitchUser(userId: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      await loadWorkspaceAndDoc();
    }
  }

  function handleSharesUpdated(shares: DocumentShareWithUser[]) {
    setDoc((prev) => (prev ? { ...prev, shares } : prev));
  }

  function handleAttachmentsChanged(attachments: DocumentAttachmentMeta[]) {
    setDoc((prev) =>
      prev
        ? { ...prev, attachments, attachmentCount: attachments.length }
        : prev
    );
  }

  function handleImportedIntoDraft(updatedDoc: DocumentDetail) {
    setDoc(updatedDoc);
    setTitle(updatedDoc.title);
    setHtml(updatedDoc.contentHtml);
    latestDraftRef.current = {
      title: updatedDoc.title,
      html: updatedDoc.contentHtml,
    };
    lastSavedRef.current = {
      title: updatedDoc.title,
      html: updatedDoc.contentHtml,
    };
    setSyncVersion((v) => v + 1);
    setSaveState("saved");
    setShowImportModal(false);
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Top Document Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Link
            href="/"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
            title="Back to Workspace"
            aria-label="Back to Workspace"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white sm:flex">
            <FileText className="h-4 w-4" />
          </div>

          {doc ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="text"
                value={title}
                disabled={!canEdit}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => {
                  if (canEdit) {
                    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                    void persistChanges();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                maxLength={120}
                aria-label="Document title"
                className={`min-w-0 flex-1 max-w-md truncate rounded-md px-2 py-1 text-sm font-semibold text-gray-900 transition focus:outline-none ${
                  canEdit
                    ? "hover:bg-gray-100/80 focus:bg-white focus:ring-2 focus:ring-indigo-500/30"
                    : "cursor-default text-gray-700"
                }`}
              />

              {/* Role Pill */}
              {doc.accessRole === "owner" ? (
                <span className="hidden shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 md:inline-flex">
                  Owner
                </span>
              ) : doc.accessRole === "editor" ? (
                <span className="hidden shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 md:inline-flex">
                  Shared · Can edit
                </span>
              ) : (
                <span className="hidden shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 md:inline-flex">
                  <Eye className="h-3 w-3" />
                  View only
                </span>
              )}

              {/* Live Save Indicator */}
              {canEdit && (
                <div className="hidden items-center gap-1.5 text-xs lg:flex">
                  {saveState === "saving" && (
                    <span className="inline-flex items-center gap-1 text-gray-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                      Saving…
                    </span>
                  )}
                  {saveState === "saved" && (
                    <span className="inline-flex items-center gap-1 text-gray-400">
                      <Cloud className="h-3.5 w-3.5 text-emerald-500" />
                      Saved · {formatRelativeTime(doc.updatedAt)}
                    </span>
                  )}
                  {saveState === "unsaved" && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      Unsaved changes
                    </span>
                  )}
                  {saveState === "error" && (
                    <button
                      type="button"
                      onClick={() => void persistChanges()}
                      className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline cursor-pointer"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      {saveError || "Save failed — Retry"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm font-semibold text-gray-800">
              Ajaia Docs
            </span>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex shrink-0 items-center gap-2">
          {doc && canEdit && (
            <button
              type="button"
              onClick={() => {
                if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                void persistChanges();
              }}
              disabled={saveState === "saving" || saveState === "saved"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              title="Save now (Cmd/Ctrl+S)"
            >
              {saveState === "saved" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Save className="h-3.5 w-3.5 text-indigo-600" />
              )}
              <span className="hidden sm:inline">
                {saveState === "saved" ? "Saved" : "Save"}
              </span>
            </button>
          )}

          {doc && (
            <>
              <button
                type="button"
                onClick={() => setShowAttachments(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer"
                title="View or upload document attachments"
              >
                <Paperclip className="h-3.5 w-3.5 text-gray-500" />
                <span className="hidden sm:inline">Files</span>
                {doc.attachments.length > 0 && (
                  <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-700">
                    {doc.attachments.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-2xs transition hover:bg-indigo-700 cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
                {doc.shares.length > 0 && (
                  <span className="rounded-full bg-white/20 px-1.5 text-[10px] font-semibold">
                    {doc.shares.length}
                  </span>
                )}
              </button>
            </>
          )}

          {currentUser && (
            <UserSwitcher
              currentUser={currentUser}
              users={users}
              onSwitch={handleSwitchUser}
              compact
            />
          )}
        </div>
      </header>

      {/* Main Content */}
      {loading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-2.5 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            Loading document…
          </div>
        </div>
      ) : accessError ? (
        <div className="mx-auto mt-16 max-w-md px-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Lock className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-gray-900">
              {accessError.status === 403
                ? "Access Restricted"
                : "Document Not Found"}
            </h1>
            <p className="mt-1.5 text-sm text-gray-600">{accessError.message}</p>
            {currentUser && accessError.status === 403 && (
              <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Signed in as <strong>{currentUser.name}</strong> (
                {currentUser.email}). Switch accounts in the top-right to view as
                the document owner or an authorized collaborator.
              </p>
            )}
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Workspace
            </Link>
          </div>
        </div>
      ) : doc ? (
        <>
          {doc.accessRole === "viewer" && (
            <div className="border-b border-amber-200/80 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
              <div className="mx-auto inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>
                  You have <strong>View-Only</strong> access to this document
                  (owned by <strong>{doc.owner.name}</strong>). Editing,
                  renaming, and file uploads are disabled and enforced
                  server-side.
                </span>
              </div>
            </div>
          )}

          <RichTextEditor
            initialHtml={html}
            contentSyncVersion={syncVersion}
            canEdit={canEdit}
            onChangeHtml={handleHtmlChange}
            onRequestImportIntoDraft={
              canEdit ? () => setShowImportModal(true) : undefined
            }
          />

          {showShareModal && (
            <ShareModal
              documentId={doc.id}
              documentTitle={title || doc.title}
              owner={doc.owner}
              accessRole={doc.accessRole}
              shares={doc.shares}
              allUsers={users}
              onClose={() => setShowShareModal(false)}
              onSharesUpdated={handleSharesUpdated}
            />
          )}

          {showAttachments && (
            <AttachmentsDrawer
              documentId={doc.id}
              attachments={doc.attachments}
              canEdit={canEdit}
              onClose={() => setShowAttachments(false)}
              onAttachmentsChanged={handleAttachmentsChanged}
            />
          )}

          {showImportModal && (
            <ImportModal
              mode="append"
              targetDocumentId={doc.id}
              onClose={() => setShowImportModal(false)}
              onImported={handleImportedIntoDraft}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
