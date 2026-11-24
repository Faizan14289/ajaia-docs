import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  SEED_ATTACHMENTS,
  SEED_DOCUMENTS,
  SEED_SHARES,
  SEED_USERS,
} from "../seed-data";
import { extractPlainTextExcerpt, sanitizeRichHtml } from "../sanitize";
import type {
  DocumentAccessRole,
  DocumentAttachmentFull,
  DocumentAttachmentMeta,
  DocumentDetail,
  DocumentRecord,
  DocumentShareRecord,
  DocumentShareWithUser,
  DocumentSummary,
  ShareRole,
  StorageBackend,
  User,
} from "../types";
import { BadRequestError, ForbiddenError, NotFoundError } from "./errors";
import type { WorkspaceRepository } from "./index";

interface StoreSnapshot {
  users: User[];
  documents: DocumentRecord[];
  shares: DocumentShareRecord[];
  attachments: DocumentAttachmentFull[];
}

function createSeedSnapshot(): StoreSnapshot {
  return {
    users: structuredClone(SEED_USERS),
    documents: structuredClone(SEED_DOCUMENTS),
    shares: structuredClone(SEED_SHARES),
    attachments: structuredClone(SEED_ATTACHMENTS),
  };
}

function toAttachmentMeta(att: DocumentAttachmentFull): DocumentAttachmentMeta {
  return {
    id: att.id,
    documentId: att.documentId,
    uploadedBy: att.uploadedBy,
    uploaderName: att.uploaderName,
    fileName: att.fileName,
    mimeType: att.mimeType,
    sizeBytes: att.sizeBytes,
    createdAt: att.createdAt,
  };
}

export class FileWorkspaceRepository implements WorkspaceRepository {
  readonly backend: StorageBackend;
  private readonly filePath: string | null;
  private memoryState: StoreSnapshot | null = null;

  constructor(filePath: string | ":memory:") {
    if (filePath === ":memory:") {
      this.backend = "memory";
      this.filePath = null;
      this.memoryState = createSeedSnapshot();
    } else {
      this.backend = "file";
      this.filePath = filePath;
    }
  }

  private readState(): StoreSnapshot {
    if (!this.filePath) {
      if (!this.memoryState) {
        this.memoryState = createSeedSnapshot();
      }
      return this.memoryState;
    }

    if (!fs.existsSync(this.filePath)) {
      const initial = createSeedSnapshot();
      this.writeState(initial);
      return initial;
    }

    const raw = fs.readFileSync(this.filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoreSnapshot>;
    return {
      users: parsed.users ?? structuredClone(SEED_USERS),
      documents: parsed.documents ?? [],
      shares: parsed.shares ?? [],
      attachments: parsed.attachments ?? [],
    };
  }

  private writeState(state: StoreSnapshot): void {
    if (!this.filePath) {
      this.memoryState = state;
      return;
    }

    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }

  private getAccessRole(
    state: StoreSnapshot,
    doc: DocumentRecord,
    userId: string
  ): DocumentAccessRole | null {
    if (doc.ownerId === userId) return "owner";
    const share = state.shares.find(
      (s) => s.documentId === doc.id && s.userId === userId
    );
    return share ? share.role : null;
  }

  private toSummary(
    state: StoreSnapshot,
    doc: DocumentRecord,
    accessRole: DocumentAccessRole
  ): DocumentSummary {
    const userMap = new Map(state.users.map((u) => [u.id, u]));
    const owner = userMap.get(doc.ownerId) ?? state.users[0];
    const updatedByUser = userMap.get(doc.updatedBy);
    const shares: DocumentShareWithUser[] = state.shares
      .filter((s) => s.documentId === doc.id)
      .map((s) => {
        const user = userMap.get(s.userId);
        return user ? { ...s, user } : null;
      })
      .filter((s): s is DocumentShareWithUser => s !== null);

    const attachmentCount = state.attachments.filter(
      (a) => a.documentId === doc.id
    ).length;

    return {
      id: doc.id,
      title: doc.title,
      excerpt: extractPlainTextExcerpt(doc.contentHtml),
      ownerId: doc.ownerId,
      owner,
      accessRole,
      shares,
      attachmentCount,
      updatedBy: doc.updatedBy,
      updatedByName: updatedByUser?.name ?? owner.name,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async listUsers(): Promise<User[]> {
    return this.readState().users;
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.readState().users.find((u) => u.id === userId) ?? null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    return (
      this.readState().users.find(
        (u) => u.email.toLowerCase() === normalized
      ) ?? null
    );
  }

  async listDocumentsForUser(userId: string): Promise<DocumentSummary[]> {
    const state = this.readState();
    const results: DocumentSummary[] = [];

    for (const doc of state.documents) {
      const role = this.getAccessRole(state, doc, userId);
      if (role) {
        results.push(this.toSummary(state, doc, role));
      }
    }

    return results.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getDocumentForUser(
    documentId: string,
    userId: string
  ): Promise<DocumentDetail> {
    const state = this.readState();
    const doc = state.documents.find((d) => d.id === documentId);
    if (!doc) {
      throw new NotFoundError("Document not found.");
    }

    const accessRole = this.getAccessRole(state, doc, userId);
    if (!accessRole) {
      throw new ForbiddenError("You do not have access to this document.");
    }

    const summary = this.toSummary(state, doc, accessRole);
    const attachments: DocumentAttachmentMeta[] = state.attachments
      .filter((a) => a.documentId === doc.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map(toAttachmentMeta);

    return {
      ...summary,
      contentHtml: doc.contentHtml,
      attachments,
    };
  }

  async createDocument(
    userId: string,
    input: { title?: string; contentHtml?: string }
  ): Promise<DocumentDetail> {
    const state = this.readState();
    const now = new Date().toISOString();
    const newDoc: DocumentRecord = {
      id: `doc_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      title: input.title?.trim() || "Untitled Document",
      contentHtml: sanitizeRichHtml(input.contentHtml ?? "<p></p>"),
      ownerId: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    state.documents.push(newDoc);
    this.writeState(state);
    return this.getDocumentForUser(newDoc.id, userId);
  }

  async updateDocument(
    documentId: string,
    userId: string,
    input: { title?: string; contentHtml?: string }
  ): Promise<DocumentDetail> {
    const state = this.readState();
    const doc = state.documents.find((d) => d.id === documentId);
    if (!doc) {
      throw new NotFoundError("Document not found.");
    }

    const accessRole = this.getAccessRole(state, doc, userId);
    if (!accessRole) {
      throw new ForbiddenError("You do not have access to this document.");
    }
    if (accessRole === "viewer") {
      throw new ForbiddenError(
        "You have view-only access to this document. Ask the owner for Editor permissions."
      );
    }

    if (input.title !== undefined) {
      const cleanedTitle = input.title.trim();
      if (!cleanedTitle) {
        throw new BadRequestError("Document title cannot be empty.");
      }
      doc.title = cleanedTitle.slice(0, 120);
    }

    if (input.contentHtml !== undefined) {
      doc.contentHtml = sanitizeRichHtml(input.contentHtml);
    }

    doc.updatedBy = userId;
    doc.updatedAt = new Date().toISOString();

    this.writeState(state);
    return this.getDocumentForUser(doc.id, userId);
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const state = this.readState();
    const index = state.documents.findIndex((d) => d.id === documentId);
    if (index === -1) {
      throw new NotFoundError("Document not found.");
    }

    const doc = state.documents[index];
    if (doc.ownerId !== userId) {
      throw new ForbiddenError(
        "Only the document owner can delete this document."
      );
    }

    state.documents.splice(index, 1);
    state.shares = state.shares.filter((s) => s.documentId !== documentId);
    state.attachments = state.attachments.filter(
      (a) => a.documentId !== documentId
    );
    this.writeState(state);
  }

  async upsertShare(
    documentId: string,
    actingUserId: string,
    input: { targetUserId?: string; targetEmail?: string; role: ShareRole }
  ): Promise<DocumentShareWithUser[]> {
    const state = this.readState();
    const doc = state.documents.find((d) => d.id === documentId);
    if (!doc) {
      throw new NotFoundError("Document not found.");
    }

    if (doc.ownerId !== actingUserId) {
      throw new ForbiddenError(
        "Only the document owner can manage sharing permissions."
      );
    }

    const targetUser = input.targetUserId
      ? state.users.find((u) => u.id === input.targetUserId)
      : state.users.find(
          (u) =>
            u.email.toLowerCase() ===
            (input.targetEmail ?? "").trim().toLowerCase()
        );

    if (!targetUser) {
      throw new NotFoundError(
        "No workspace member found with that email address."
      );
    }

    if (targetUser.id === doc.ownerId) {
      throw new BadRequestError(
        "The document owner already has full access."
      );
    }

    const existing = state.shares.find(
      (s) => s.documentId === documentId && s.userId === targetUser.id
    );

    if (existing) {
      existing.role = input.role;
    } else {
      state.shares.push({
        id: `share_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
        documentId,
        userId: targetUser.id,
        role: input.role,
        createdAt: new Date().toISOString(),
      });
    }

    this.writeState(state);
    const updated = await this.getDocumentForUser(documentId, actingUserId);
    return updated.shares;
  }

  async removeShare(
    documentId: string,
    actingUserId: string,
    targetUserId: string
  ): Promise<DocumentShareWithUser[]> {
    const state = this.readState();
    const doc = state.documents.find((d) => d.id === documentId);
    if (!doc) {
      throw new NotFoundError("Document not found.");
    }

    if (doc.ownerId !== actingUserId && actingUserId !== targetUserId) {
      throw new ForbiddenError(
        "Only the document owner can revoke collaborator access."
      );
    }

    state.shares = state.shares.filter(
      (s) => !(s.documentId === documentId && s.userId === targetUserId)
    );
    this.writeState(state);

    if (doc.ownerId === actingUserId) {
      const updated = await this.getDocumentForUser(documentId, actingUserId);
      return updated.shares;
    }
    return [];
  }

  async addAttachment(
    documentId: string,
    userId: string,
    input: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      contentBase64: string;
    }
  ): Promise<DocumentAttachmentMeta> {
    const state = this.readState();
    const doc = state.documents.find((d) => d.id === documentId);
    if (!doc) {
      throw new NotFoundError("Document not found.");
    }

    const accessRole = this.getAccessRole(state, doc, userId);
    if (!accessRole) {
      throw new ForbiddenError("You do not have access to this document.");
    }
    if (accessRole === "viewer") {
      throw new ForbiddenError(
        "View-only collaborators cannot upload attachments."
      );
    }

    const uploader = state.users.find((u) => u.id === userId);
    const record: DocumentAttachmentFull = {
      id: `att_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      documentId,
      uploadedBy: userId,
      uploaderName: uploader?.name ?? "Team Member",
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      contentBase64: input.contentBase64,
      createdAt: new Date().toISOString(),
    };

    state.attachments.push(record);
    this.writeState(state);
    return toAttachmentMeta(record);
  }

  async getAttachmentForUser(
    documentId: string,
    attachmentId: string,
    userId: string
  ): Promise<DocumentAttachmentFull> {
    const state = this.readState();
    const doc = state.documents.find((d) => d.id === documentId);
    if (!doc) {
      throw new NotFoundError("Document not found.");
    }

    const accessRole = this.getAccessRole(state, doc, userId);
    if (!accessRole) {
      throw new ForbiddenError("You do not have access to this document.");
    }

    const att = state.attachments.find(
      (a) => a.documentId === documentId && a.id === attachmentId
    );
    if (!att) {
      throw new NotFoundError("Attachment not found.");
    }
    return att;
  }

  async deleteAttachment(
    documentId: string,
    attachmentId: string,
    userId: string
  ): Promise<void> {
    const state = this.readState();
    const doc = state.documents.find((d) => d.id === documentId);
    if (!doc) {
      throw new NotFoundError("Document not found.");
    }

    const accessRole = this.getAccessRole(state, doc, userId);
    if (!accessRole) {
      throw new ForbiddenError("You do not have access to this document.");
    }
    if (accessRole === "viewer") {
      throw new ForbiddenError(
        "View-only collaborators cannot remove attachments."
      );
    }

    const index = state.attachments.findIndex(
      (a) => a.documentId === documentId && a.id === attachmentId
    );
    if (index === -1) {
      throw new NotFoundError("Attachment not found.");
    }

    state.attachments.splice(index, 1);
    this.writeState(state);
  }
}
