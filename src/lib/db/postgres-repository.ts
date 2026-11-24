import crypto from "node:crypto";
import { Pool } from "pg";
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
  DocumentShareWithUser,
  DocumentSummary,
  ShareRole,
  StorageBackend,
  User,
} from "../types";
import { BadRequestError, ForbiddenError, NotFoundError } from "./errors";
import type { WorkspaceRepository } from "./index";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role_title TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    initials TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content_html TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS document_shares (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS document_attachments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    content_base64 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_shares_doc ON document_shares(document_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attachments_doc ON document_attachments(document_id)`,
];

function shouldUseSsl(connectionString: string): boolean {
  const lower = connectionString.toLowerCase();
  if (lower.includes("sslmode=disable")) return false;
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false;
  return true;
}

function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    roleTitle: String(row.role_title),
    avatarColor: String(row.avatar_color),
    initials: String(row.initials),
  };
}

export class PostgresWorkspaceRepository implements WorkspaceRepository {
  readonly backend: StorageBackend = "postgres";
  private readonly pool: Pool;
  private initPromise: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      ssl: shouldUseSsl(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initializeSchemaAndSeed().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    await this.initPromise;
  }

  private async initializeSchemaAndSeed(): Promise<void> {
    const client = await this.pool.connect();
    try {
      for (const stmt of SCHEMA_STATEMENTS) {
        await client.query(stmt);
      }

      const { rows } = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM users"
      );
      if (Number(rows[0]?.count ?? 0) === 0) {
        await client.query("BEGIN");
        try {
          for (const user of SEED_USERS) {
            await client.query(
              `INSERT INTO users (id, name, email, role_title, avatar_color, initials)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO NOTHING`,
              [
                user.id,
                user.name,
                user.email,
                user.roleTitle,
                user.avatarColor,
                user.initials,
              ]
            );
          }

          for (const doc of SEED_DOCUMENTS) {
            await client.query(
              `INSERT INTO documents (id, title, content_html, owner_id, updated_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO NOTHING`,
              [
                doc.id,
                doc.title,
                doc.contentHtml,
                doc.ownerId,
                doc.updatedBy,
                doc.createdAt,
                doc.updatedAt,
              ]
            );
          }

          for (const share of SEED_SHARES) {
            await client.query(
              `INSERT INTO document_shares (id, document_id, user_id, role, created_at)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (document_id, user_id) DO NOTHING`,
              [
                share.id,
                share.documentId,
                share.userId,
                share.role,
                share.createdAt,
              ]
            );
          }

          for (const att of SEED_ATTACHMENTS) {
            await client.query(
              `INSERT INTO document_attachments (id, document_id, uploaded_by, file_name, mime_type, size_bytes, content_base64, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [
                att.id,
                att.documentId,
                att.uploadedBy,
                att.fileName,
                att.mimeType,
                att.sizeBytes,
                att.contentBase64,
                att.createdAt,
              ]
            );
          }

          await client.query("COMMIT");
        } catch (seedErr) {
          await client.query("ROLLBACK");
          throw seedErr;
        }
      }
    } finally {
      client.release();
    }
  }

  private async resolveAccessRole(
    documentId: string,
    userId: string
  ): Promise<{ exists: boolean; ownerId: string | null; role: DocumentAccessRole | null }> {
    const docRes = await this.pool.query<{ owner_id: string }>(
      "SELECT owner_id FROM documents WHERE id = $1",
      [documentId]
    );
    if (docRes.rowCount === 0) {
      return { exists: false, ownerId: null, role: null };
    }
    const ownerId = docRes.rows[0].owner_id;
    if (ownerId === userId) {
      return { exists: true, ownerId, role: "owner" };
    }

    const shareRes = await this.pool.query<{ role: ShareRole }>(
      "SELECT role FROM document_shares WHERE document_id = $1 AND user_id = $2",
      [documentId, userId]
    );
    return {
      exists: true,
      ownerId,
      role: shareRes.rows[0]?.role ?? null,
    };
  }

  private async loadSharesForDocs(
    documentIds: string[]
  ): Promise<Map<string, DocumentShareWithUser[]>> {
    const map = new Map<string, DocumentShareWithUser[]>();
    if (documentIds.length === 0) return map;

    const { rows } = await this.pool.query(
      `SELECT
        s.id AS share_id,
        s.document_id,
        s.user_id,
        s.role,
        s.created_at,
        u.name,
        u.email,
        u.role_title,
        u.avatar_color,
        u.initials
       FROM document_shares s
       JOIN users u ON u.id = s.user_id
       WHERE s.document_id = ANY($1::text[])
       ORDER BY s.created_at ASC`,
      [documentIds]
    );

    for (const row of rows) {
      const list = map.get(row.document_id) ?? [];
      list.push({
        id: row.share_id,
        documentId: row.document_id,
        userId: row.user_id,
        role: row.role as ShareRole,
        createdAt: new Date(row.created_at).toISOString(),
        user: {
          id: row.user_id,
          name: row.name,
          email: row.email,
          roleTitle: row.role_title,
          avatarColor: row.avatar_color,
          initials: row.initials,
        },
      });
      map.set(row.document_id, list);
    }

    return map;
  }

  async listUsers(): Promise<User[]> {
    await this.ensureInitialized();
    const { rows } = await this.pool.query("SELECT * FROM users ORDER BY id ASC");
    return rows.map(mapUserRow);
  }

  async findUserById(userId: string): Promise<User | null> {
    await this.ensureInitialized();
    const { rows } = await this.pool.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    await this.ensureInitialized();
    const { rows } = await this.pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email.trim()]
    );
    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async listDocumentsForUser(userId: string): Promise<DocumentSummary[]> {
    await this.ensureInitialized();
    const { rows } = await this.pool.query(
      `SELECT
        d.id,
        d.title,
        d.content_html,
        d.owner_id,
        d.updated_by,
        d.created_at,
        d.updated_at,
        CASE
          WHEN d.owner_id = $1 THEN 'owner'
          ELSE my_share.role
        END AS access_role,
        o.name AS owner_name,
        o.email AS owner_email,
        o.role_title AS owner_role_title,
        o.avatar_color AS owner_avatar_color,
        o.initials AS owner_initials,
        ub.name AS updated_by_name,
        (SELECT COUNT(*)::int FROM document_attachments a WHERE a.document_id = d.id) AS attachment_count
       FROM documents d
       JOIN users o ON o.id = d.owner_id
       JOIN users ub ON ub.id = d.updated_by
       LEFT JOIN document_shares my_share
         ON my_share.document_id = d.id AND my_share.user_id = $1
       WHERE d.owner_id = $1 OR my_share.user_id = $1
       ORDER BY d.updated_at DESC`,
      [userId]
    );

    const docIds = rows.map((r) => String(r.id));
    const sharesMap = await this.loadSharesForDocs(docIds);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      excerpt: extractPlainTextExcerpt(r.content_html),
      ownerId: r.owner_id,
      owner: {
        id: r.owner_id,
        name: r.owner_name,
        email: r.owner_email,
        roleTitle: r.owner_role_title,
        avatarColor: r.owner_avatar_color,
        initials: r.owner_initials,
      },
      accessRole: r.access_role as DocumentAccessRole,
      shares: sharesMap.get(r.id) ?? [],
      attachmentCount: Number(r.attachment_count ?? 0),
      updatedBy: r.updated_by,
      updatedByName: r.updated_by_name,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }

  async getDocumentForUser(
    documentId: string,
    userId: string
  ): Promise<DocumentDetail> {
    await this.ensureInitialized();
    const { rows } = await this.pool.query(
      `SELECT
        d.id,
        d.title,
        d.content_html,
        d.owner_id,
        d.updated_by,
        d.created_at,
        d.updated_at,
        o.name AS owner_name,
        o.email AS owner_email,
        o.role_title AS owner_role_title,
        o.avatar_color AS owner_avatar_color,
        o.initials AS owner_initials,
        ub.name AS updated_by_name,
        my_share.role AS share_role
       FROM documents d
       JOIN users o ON o.id = d.owner_id
       JOIN users ub ON ub.id = d.updated_by
       LEFT JOIN document_shares my_share
         ON my_share.document_id = d.id AND my_share.user_id = $2
       WHERE d.id = $1`,
      [documentId, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundError("Document not found.");
    }

    const r = rows[0];
    const accessRole: DocumentAccessRole | null =
      r.owner_id === userId ? "owner" : (r.share_role as ShareRole | null);
    if (!accessRole) {
      throw new ForbiddenError("You do not have access to this document.");
    }

    const [sharesMap, attRes] = await Promise.all([
      this.loadSharesForDocs([documentId]),
      this.pool.query(
        `SELECT
          a.id,
          a.document_id,
          a.uploaded_by,
          u.name AS uploader_name,
          a.file_name,
          a.mime_type,
          a.size_bytes,
          a.created_at
         FROM document_attachments a
         JOIN users u ON u.id = a.uploaded_by
         WHERE a.document_id = $1
         ORDER BY a.created_at DESC`,
        [documentId]
      ),
    ]);

    const attachments: DocumentAttachmentMeta[] = attRes.rows.map((a) => ({
      id: a.id,
      documentId: a.document_id,
      uploadedBy: a.uploaded_by,
      uploaderName: a.uploader_name,
      fileName: a.file_name,
      mimeType: a.mime_type,
      sizeBytes: Number(a.size_bytes),
      createdAt: new Date(a.created_at).toISOString(),
    }));

    return {
      id: r.id,
      title: r.title,
      excerpt: extractPlainTextExcerpt(r.content_html),
      contentHtml: r.content_html,
      ownerId: r.owner_id,
      owner: {
        id: r.owner_id,
        name: r.owner_name,
        email: r.owner_email,
        roleTitle: r.owner_role_title,
        avatarColor: r.owner_avatar_color,
        initials: r.owner_initials,
      },
      accessRole,
      shares: sharesMap.get(documentId) ?? [],
      attachmentCount: attachments.length,
      attachments,
      updatedBy: r.updated_by,
      updatedByName: r.updated_by_name,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  }

  async createDocument(
    userId: string,
    input: { title?: string; contentHtml?: string }
  ): Promise<DocumentDetail> {
    await this.ensureInitialized();
    const id = `doc_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const title = (input.title?.trim() || "Untitled Document").slice(0, 120);
    const contentHtml = sanitizeRichHtml(input.contentHtml ?? "<p></p>");

    await this.pool.query(
      `INSERT INTO documents (id, title, content_html, owner_id, updated_by)
       VALUES ($1, $2, $3, $4, $4)`,
      [id, title, contentHtml, userId]
    );

    return this.getDocumentForUser(id, userId);
  }

  async updateDocument(
    documentId: string,
    userId: string,
    input: { title?: string; contentHtml?: string }
  ): Promise<DocumentDetail> {
    await this.ensureInitialized();
    const access = await this.resolveAccessRole(documentId, userId);
    if (!access.exists) {
      throw new NotFoundError("Document not found.");
    }
    if (!access.role) {
      throw new ForbiddenError("You do not have access to this document.");
    }
    if (access.role === "viewer") {
      throw new ForbiddenError(
        "You have view-only access to this document. Ask the owner for Editor permissions."
      );
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) {
      const cleanedTitle = input.title.trim();
      if (!cleanedTitle) {
        throw new BadRequestError("Document title cannot be empty.");
      }
      values.push(cleanedTitle.slice(0, 120));
      updates.push(`title = $${values.length}`);
    }

    if (input.contentHtml !== undefined) {
      values.push(sanitizeRichHtml(input.contentHtml));
      updates.push(`content_html = $${values.length}`);
    }

    values.push(userId);
    updates.push(`updated_by = $${values.length}`);
    updates.push(`updated_at = NOW()`);

    values.push(documentId);
    await this.pool.query(
      `UPDATE documents SET ${updates.join(", ")} WHERE id = $${values.length}`,
      values
    );

    return this.getDocumentForUser(documentId, userId);
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    await this.ensureInitialized();
    const access = await this.resolveAccessRole(documentId, userId);
    if (!access.exists) {
      throw new NotFoundError("Document not found.");
    }
    if (access.role !== "owner") {
      throw new ForbiddenError(
        "Only the document owner can delete this document."
      );
    }

    await this.pool.query("DELETE FROM documents WHERE id = $1", [documentId]);
  }

  async upsertShare(
    documentId: string,
    actingUserId: string,
    input: { targetUserId?: string; targetEmail?: string; role: ShareRole }
  ): Promise<DocumentShareWithUser[]> {
    await this.ensureInitialized();
    const access = await this.resolveAccessRole(documentId, actingUserId);
    if (!access.exists) {
      throw new NotFoundError("Document not found.");
    }
    if (access.role !== "owner") {
      throw new ForbiddenError(
        "Only the document owner can manage sharing permissions."
      );
    }

    const targetUser = input.targetUserId
      ? await this.findUserById(input.targetUserId)
      : await this.findUserByEmail(input.targetEmail ?? "");

    if (!targetUser) {
      throw new NotFoundError(
        "No workspace member found with that email address."
      );
    }
    if (targetUser.id === access.ownerId) {
      throw new BadRequestError(
        "The document owner already has full access."
      );
    }

    const shareId = `share_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await this.pool.query(
      `INSERT INTO document_shares (id, document_id, user_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (document_id, user_id)
       DO UPDATE SET role = EXCLUDED.role`,
      [shareId, documentId, targetUser.id, input.role]
    );

    const sharesMap = await this.loadSharesForDocs([documentId]);
    return sharesMap.get(documentId) ?? [];
  }

  async removeShare(
    documentId: string,
    actingUserId: string,
    targetUserId: string
  ): Promise<DocumentShareWithUser[]> {
    await this.ensureInitialized();
    const access = await this.resolveAccessRole(documentId, actingUserId);
    if (!access.exists) {
      throw new NotFoundError("Document not found.");
    }
    if (access.role !== "owner" && actingUserId !== targetUserId) {
      throw new ForbiddenError(
        "Only the document owner can revoke collaborator access."
      );
    }

    await this.pool.query(
      "DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2",
      [documentId, targetUserId]
    );

    if (access.role === "owner") {
      const sharesMap = await this.loadSharesForDocs([documentId]);
      return sharesMap.get(documentId) ?? [];
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
    await this.ensureInitialized();
    const access = await this.resolveAccessRole(documentId, userId);
    if (!access.exists) {
      throw new NotFoundError("Document not found.");
    }
    if (!access.role) {
      throw new ForbiddenError("You do not have access to this document.");
    }
    if (access.role === "viewer") {
      throw new ForbiddenError(
        "View-only collaborators cannot upload attachments."
      );
    }

    const id = `att_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const { rows } = await this.pool.query(
      `INSERT INTO document_attachments (id, document_id, uploaded_by, file_name, mime_type, size_bytes, content_base64)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, document_id, uploaded_by, file_name, mime_type, size_bytes, created_at`,
      [
        id,
        documentId,
        userId,
        input.fileName,
        input.mimeType,
        input.sizeBytes,
        input.contentBase64,
      ]
    );

    const uploader = await this.findUserById(userId);
    const a = rows[0];
    return {
      id: a.id,
      documentId: a.document_id,
      uploadedBy: a.uploaded_by,
      uploaderName: uploader?.name ?? "Team Member",
      fileName: a.file_name,
      mimeType: a.mime_type,
      sizeBytes: Number(a.size_bytes),
      createdAt: new Date(a.created_at).toISOString(),
    };
  }

  async getAttachmentForUser(
    documentId: string,
    attachmentId: string,
    userId: string
  ): Promise<DocumentAttachmentFull> {
    await this.ensureInitialized();
    const access = await this.resolveAccessRole(documentId, userId);
    if (!access.exists) {
      throw new NotFoundError("Document not found.");
    }
    if (!access.role) {
      throw new ForbiddenError("You do not have access to this document.");
    }

    const { rows } = await this.pool.query(
      `SELECT
        a.id,
        a.document_id,
        a.uploaded_by,
        u.name AS uploader_name,
        a.file_name,
        a.mime_type,
        a.size_bytes,
        a.content_base64,
        a.created_at
       FROM document_attachments a
       JOIN users u ON u.id = a.uploaded_by
       WHERE a.document_id = $1 AND a.id = $2`,
      [documentId, attachmentId]
    );

    if (rows.length === 0) {
      throw new NotFoundError("Attachment not found.");
    }
    const a = rows[0];
    return {
      id: a.id,
      documentId: a.document_id,
      uploadedBy: a.uploaded_by,
      uploaderName: a.uploader_name,
      fileName: a.file_name,
      mimeType: a.mime_type,
      sizeBytes: Number(a.size_bytes),
      contentBase64: a.content_base64,
      createdAt: new Date(a.created_at).toISOString(),
    };
  }

  async deleteAttachment(
    documentId: string,
    attachmentId: string,
    userId: string
  ): Promise<void> {
    await this.ensureInitialized();
    const access = await this.resolveAccessRole(documentId, userId);
    if (!access.exists) {
      throw new NotFoundError("Document not found.");
    }
    if (!access.role) {
      throw new ForbiddenError("You do not have access to this document.");
    }
    if (access.role === "viewer") {
      throw new ForbiddenError(
        "View-only collaborators cannot remove attachments."
      );
    }

    const res = await this.pool.query(
      "DELETE FROM document_attachments WHERE document_id = $1 AND id = $2",
      [documentId, attachmentId]
    );
    if (res.rowCount === 0) {
      throw new NotFoundError("Attachment not found.");
    }
  }
}
