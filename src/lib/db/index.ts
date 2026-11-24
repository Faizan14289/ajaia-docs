import path from "node:path";
import type {
  DocumentAttachmentFull,
  DocumentAttachmentMeta,
  DocumentDetail,
  DocumentShareWithUser,
  DocumentSummary,
  ShareRole,
  StorageBackend,
  User,
} from "../types";
import { FileWorkspaceRepository } from "./file-repository";
import { PostgresWorkspaceRepository } from "./postgres-repository";

export interface WorkspaceRepository {
  readonly backend: StorageBackend;
  listUsers(): Promise<User[]>;
  findUserById(userId: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  listDocumentsForUser(userId: string): Promise<DocumentSummary[]>;
  getDocumentForUser(
    documentId: string,
    userId: string
  ): Promise<DocumentDetail>;
  createDocument(
    userId: string,
    input: { title?: string; contentHtml?: string }
  ): Promise<DocumentDetail>;
  updateDocument(
    documentId: string,
    userId: string,
    input: { title?: string; contentHtml?: string }
  ): Promise<DocumentDetail>;
  deleteDocument(documentId: string, userId: string): Promise<void>;
  upsertShare(
    documentId: string,
    actingUserId: string,
    input: { targetUserId?: string; targetEmail?: string; role: ShareRole }
  ): Promise<DocumentShareWithUser[]>;
  removeShare(
    documentId: string,
    actingUserId: string,
    targetUserId: string
  ): Promise<DocumentShareWithUser[]>;
  addAttachment(
    documentId: string,
    userId: string,
    input: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      contentBase64: string;
    }
  ): Promise<DocumentAttachmentMeta>;
  getAttachmentForUser(
    documentId: string,
    attachmentId: string,
    userId: string
  ): Promise<DocumentAttachmentFull>;
  deleteAttachment(
    documentId: string,
    attachmentId: string,
    userId: string
  ): Promise<void>;
}

const globalForRepo = globalThis as unknown as {
  __ajaiaWorkspaceRepo?: WorkspaceRepository;
};

export function getRepository(): WorkspaceRepository {
  if (globalForRepo.__ajaiaWorkspaceRepo) {
    return globalForRepo.__ajaiaWorkspaceRepo;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const repo: WorkspaceRepository = databaseUrl
    ? new PostgresWorkspaceRepository(databaseUrl)
    : new FileWorkspaceRepository(
        process.env.LOCAL_DATA_FILE?.trim() ||
          path.join(process.cwd(), "data", "ajaia-docs-store.json")
      );

  globalForRepo.__ajaiaWorkspaceRepo = repo;
  return repo;
}
