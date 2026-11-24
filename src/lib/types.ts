export type ShareRole = "viewer" | "editor";
export type DocumentAccessRole = "owner" | ShareRole;

export interface User {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  avatarColor: string;
  initials: string;
}

export interface DocumentShareRecord {
  id: string;
  documentId: string;
  userId: string;
  role: ShareRole;
  createdAt: string;
}

export interface DocumentShareWithUser extends DocumentShareRecord {
  user: User;
}

export interface DocumentAttachmentMeta {
  id: string;
  documentId: string;
  uploadedBy: string;
  uploaderName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DocumentAttachmentFull extends DocumentAttachmentMeta {
  contentBase64: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  contentHtml: string;
  ownerId: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  excerpt: string;
  ownerId: string;
  owner: User;
  accessRole: DocumentAccessRole;
  shares: DocumentShareWithUser[];
  attachmentCount: number;
  updatedBy: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  contentHtml: string;
  attachments: DocumentAttachmentMeta[];
}

export type StorageBackend = "postgres" | "file" | "memory";
