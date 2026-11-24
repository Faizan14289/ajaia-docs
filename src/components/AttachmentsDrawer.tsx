"use client";

import { useRef, useState } from "react";
import {
  Download,
  File as FileIcon,
  Lock,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_SUPPORTED_LABEL,
  formatFileSize,
  formatRelativeTime,
  MAX_UPLOAD_BYTES,
} from "@/lib/format";
import type { DocumentAttachmentMeta } from "@/lib/types";

interface AttachmentsDrawerProps {
  documentId: string;
  attachments: DocumentAttachmentMeta[];
  canEdit: boolean;
  onClose: () => void;
  onAttachmentsChanged: (next: DocumentAttachmentMeta[]) => void;
}

export function AttachmentsDrawer({
  documentId,
  attachments,
  canEdit,
  onClose,
  onAttachmentsChanged,
}: AttachmentsDrawerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(file: File | null) {
    if (!file) return;
    setError(null);

    if (file.size === 0) {
      setError("Cannot attach an empty file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Attachment exceeds the 5 MB limit.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/documents/${documentId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to upload attachment.");
        return;
      }
      onAttachmentsChanged([data.attachment, ...attachments]);
    } catch {
      setError("Network error while uploading attachment.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(attachmentId: string) {
    setError(null);
    setDeletingId(attachmentId);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to remove attachment.");
        return;
      }
      onAttachmentsChanged(attachments.filter((a) => a.id !== attachmentId));
    } catch {
      setError("Network error while deleting attachment.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              Document Attachments ({attachments.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
            aria-label="Close attachments panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {canEdit ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-4 text-center">
              <input
                ref={inputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={(e) =>
                  handleFileSelected(e.target.files?.[0] ?? null)
                }
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-2xs transition hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Uploading…" : "Attach a File"}
              </button>
              <p className="mt-2 text-[11px] text-gray-500">
                Supported: {ATTACHMENT_SUPPORTED_LABEL}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900">
              <Lock className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                View-only mode: you can download existing attachments, but only
                Owners and Editors can upload or remove files.
              </span>
            </div>
          )}

          {attachments.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 py-10 text-center">
              <FileIcon className="mx-auto h-7 w-7 text-gray-300" />
              <p className="mt-2 text-xs font-medium text-gray-600">
                No files attached yet
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Attach specs, PDFs, screenshots, or data sheets to keep context
                beside this document.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {attachments.map((att) => (
                <li
                  key={att.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/90 bg-white p-3 transition hover:border-gray-300"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <FileIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-gray-900">
                        {att.fileName}
                      </div>
                      <div className="truncate text-[11px] text-gray-500">
                        {formatFileSize(att.sizeBytes)} · {att.uploaderName} ·{" "}
                        {formatRelativeTime(att.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={`/api/documents/${documentId}/attachments/${att.id}`}
                      download={att.fileName}
                      className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                      title={`Download ${att.fileName}`}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={deletingId === att.id}
                        onClick={() => handleDelete(att.id)}
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                        title={`Delete ${att.fileName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
