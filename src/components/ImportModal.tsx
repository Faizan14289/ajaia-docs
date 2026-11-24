"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import {
  formatFileSize,
  IMPORT_ACCEPT,
  IMPORT_SUPPORTED_LABEL,
  MAX_UPLOAD_BYTES,
} from "@/lib/format";
import type { DocumentDetail } from "@/lib/types";

interface ImportModalProps {
  mode: "new" | "append";
  targetDocumentId?: string;
  onClose: () => void;
  onImported: (doc: DocumentDetail) => void;
}

export function ImportModal({
  mode,
  targetDocumentId,
  onClose,
  onImported,
}: ImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validateAndSetFile(file: File | null) {
    setError(null);
    if (!file) return;

    const lower = file.name.toLowerCase();
    const validExt =
      lower.endsWith(".txt") ||
      lower.endsWith(".md") ||
      lower.endsWith(".docx");
    if (!validExt) {
      setError(
        `Unsupported file "${file.name}". Please upload a ${IMPORT_SUPPORTED_LABEL}.`
      );
      return;
    }
    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File exceeds the 5 MB size limit.");
      return;
    }
    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (mode === "append" && targetDocumentId) {
        formData.append("documentId", targetDocumentId);
      }

      const res = await fetch("/api/documents/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed. Please check the file format.");
        return;
      }
      onImported(data.document);
    } catch {
      setError("Network error while importing file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          mode === "new"
            ? "Import File as Document"
            : "Import Content into Draft"
        }
        className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {mode === "new"
                ? "Import File as Document"
                : "Import Content into Draft"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Supported formats: {IMPORT_SUPPORTED_LABEL}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
            aria-label="Close import dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              validateAndSetFile(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center transition cursor-pointer ${
              dragActive
                ? "border-indigo-500 bg-indigo-50/60"
                : "border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-indigo-50/30"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={IMPORT_ACCEPT}
              className="hidden"
              onChange={(e) =>
                validateAndSetFile(e.target.files?.[0] ?? null)
              }
            />
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <UploadCloud className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900">
              Drop a file here, or{" "}
              <span className="text-indigo-600 underline underline-offset-2">
                browse
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Converts headings, lists, and inline formatting into editable rich text.
            </p>
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-gray-900">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700 cursor-pointer"
                aria-label="Clear selected file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedFile || uploading}
            onClick={handleUpload}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-2xs transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {uploading
              ? "Importing…"
              : mode === "new"
              ? "Create Editable Document"
              : "Append into Document"}
          </button>
        </div>
      </div>
    </div>
  );
}
