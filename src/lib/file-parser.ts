import path from "node:path";
import mammoth from "mammoth";
import { marked } from "marked";
import { sanitizeRichHtml } from "./sanitize";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_FILE_SIZE_LABEL = "5 MB";

export const IMPORTABLE_EXTENSIONS = [".txt", ".md", ".docx"] as const;
export const ATTACHMENT_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
  ".md",
  ".docx",
  ".csv",
] as const;

export class FileValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "FileValidationError";
    this.status = status;
  }
}

export function getFileExtension(fileName: string): string {
  return path.extname(fileName || "").toLowerCase();
}

export function deriveDocumentTitleFromFileName(fileName: string): string {
  const base = path.basename(fileName || "", path.extname(fileName || ""));
  const normalized = base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "Imported Document";
  return normalized.slice(0, 120);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "<p></p>";
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br />");
      return `<p>${lines}</p>`;
    })
    .join("");
}

export interface ParsedImportResult {
  title: string;
  contentHtml: string;
  sourceExtension: string;
  warnings: string[];
}

export async function parseImportedFile(params: {
  fileName: string;
  buffer: Buffer;
}): Promise<ParsedImportResult> {
  const { fileName, buffer } = params;
  const trimmedName = (fileName || "").trim();

  if (!trimmedName) {
    throw new FileValidationError("A file name is required.");
  }
  if (!buffer || buffer.byteLength === 0) {
    throw new FileValidationError("The uploaded file is empty.");
  }
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new FileValidationError(
      `File exceeds the ${MAX_FILE_SIZE_LABEL} limit.`
    );
  }

  const ext = getFileExtension(trimmedName);
  if (
    !(IMPORTABLE_EXTENSIONS as readonly string[]).includes(ext)
  ) {
    throw new FileValidationError(
      `Unsupported import format "${ext || "unknown"}". Supported formats: ${IMPORTABLE_EXTENSIONS.join(", ")}.`
    );
  }

  const title = deriveDocumentTitleFromFileName(trimmedName);
  const warnings: string[] = [];
  let rawHtml = "";

  if (ext === ".txt") {
    rawHtml = plainTextToHtml(buffer.toString("utf-8"));
  } else if (ext === ".md") {
    const markdownText = buffer.toString("utf-8");
    rawHtml = await marked.parse(markdownText, { gfm: true, breaks: false });
  } else if (ext === ".docx") {
    try {
      const result = await mammoth.convertToHtml({ buffer });
      rawHtml = result.value;
      if (result.messages?.length) {
        for (const msg of result.messages) {
          if (msg.type === "warning") {
            warnings.push(msg.message);
          }
        }
      }
    } catch {
      throw new FileValidationError(
        "Unable to parse .docx file. Please verify it is a valid Word document."
      );
    }
  }

  return {
    title,
    contentHtml: sanitizeRichHtml(rawHtml),
    sourceExtension: ext,
    warnings,
  };
}

export function validateAttachmentFile(params: {
  fileName: string;
  sizeBytes: number;
  mimeType?: string;
}): { safeFileName: string; mimeType: string } {
  const safeFileName = path.basename((params.fileName || "").trim());
  if (!safeFileName) {
    throw new FileValidationError("A valid file name is required.");
  }
  if (params.sizeBytes <= 0) {
    throw new FileValidationError("Cannot attach an empty file.");
  }
  if (params.sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new FileValidationError(
      `Attachment exceeds the ${MAX_FILE_SIZE_LABEL} limit.`
    );
  }

  const ext = getFileExtension(safeFileName);
  if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new FileValidationError(
      `Unsupported attachment type "${ext || "unknown"}". Supported formats: ${ATTACHMENT_EXTENSIONS.join(", ")}.`
    );
  }

  const fallbackMimeByExt: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".csv": "text/csv",
  };

  return {
    safeFileName: safeFileName.slice(0, 180),
    mimeType: params.mimeType?.trim() || fallbackMimeByExt[ext] || "application/octet-stream",
  };
}
