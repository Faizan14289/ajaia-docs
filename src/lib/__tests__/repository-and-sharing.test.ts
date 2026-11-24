import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "../db/errors";
import { FileWorkspaceRepository } from "../db/file-repository";
import { extractPlainTextExcerpt } from "../sanitize";

const tempDirs: string[] = [];

function createTempStorePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ajaia-docs-test-"));
  tempDirs.push(dir);
  return path.join(dir, "store.json");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("WorkspaceRepository — persistence & rich-text sanitization", () => {
  it("persists created, renamed, and formatted documents across repository restarts", async () => {
    const storePath = createTempStorePath();
    const repo1 = new FileWorkspaceRepository(storePath);

    const created = await repo1.createDocument("user_faizan", {
      title: "Initial Draft",
      contentHtml:
        '<h1>Spec</h1><p><strong>Bold</strong> <em>italic</em> <u>underline</u></p><ul><li>Item 1</li></ul><script>alert("xss")</script>',
    });

    expect(created.title).toBe("Initial Draft");
    expect(created.accessRole).toBe("owner");
    expect(created.contentHtml).toContain("<h1>Spec</h1>");
    expect(created.contentHtml).toContain("<u>underline</u>");
    expect(created.contentHtml).not.toContain("<script>");

    await repo1.updateDocument(created.id, "user_faizan", {
      title: "Finalized Spec",
      contentHtml: "<h2>Updated Heading</h2><ol><li>First step</li></ol>",
    });

    // Simulate a server restart with a brand-new repository instance reading from disk
    const repo2 = new FileWorkspaceRepository(storePath);
    const reloaded = await repo2.getDocumentForUser(created.id, "user_faizan");

    expect(reloaded.title).toBe("Finalized Spec");
    expect(reloaded.contentHtml).toContain("<h2>Updated Heading</h2>");
    expect(reloaded.contentHtml).toContain("<ol><li>First step</li></ol>");
  });

  it("extracts clean plain-text excerpts with decoded entities and block spacing", () => {
    const excerpt = extractPlainTextExcerpt(
      "<h1>API &amp; Persistence</h1><p>Fast &amp; safe editing.</p>"
    );
    expect(excerpt).toBe("API & Persistence Fast & safe editing.");
  });
});

describe("WorkspaceRepository — role-based sharing & permission enforcement", () => {
  it("enforces owner, editor, viewer, and unauthorized boundaries strictly", async () => {
    const repo = new FileWorkspaceRepository(":memory:");

    const doc = await repo.createDocument("user_faizan", {
      title: "Private Engineering Roadmap",
      contentHtml: "<p>Confidential roadmap</p>",
    });

    // 1. Unauthorized user cannot view or list the private doc
    await expect(
      repo.getDocumentForUser(doc.id, "user_devon")
    ).rejects.toBeInstanceOf(ForbiddenError);

    const devonListBefore = await repo.listDocumentsForUser("user_devon");
    expect(devonListBefore.some((d) => d.id === doc.id)).toBe(false);

    // 2. Owner adds an attachment, then shares with Devon as Viewer
    const attachment = await repo.addAttachment(doc.id, "user_faizan", {
      fileName: "architecture.pdf",
      mimeType: "application/pdf",
      sizeBytes: 12,
      contentBase64: Buffer.from("%PDF-1.4 mock").toString("base64"),
    });

    await repo.upsertShare(doc.id, "user_faizan", {
      targetEmail: "devon@ajaia.io",
      role: "viewer",
    });

    // Viewer can read doc and download attachment
    const devonView = await repo.getDocumentForUser(doc.id, "user_devon");
    expect(devonView.accessRole).toBe("viewer");
    const downloaded = await repo.getAttachmentForUser(
      doc.id,
      attachment.id,
      "user_devon"
    );
    expect(downloaded.fileName).toBe("architecture.pdf");

    // Viewer CANNOT edit, rename, upload attachments, share, or delete
    await expect(
      repo.updateDocument(doc.id, "user_devon", { title: "Hijacked Title" })
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      repo.addAttachment(doc.id, "user_devon", {
        fileName: "notes.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
        contentBase64: Buffer.from("hello").toString("base64"),
      })
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      repo.upsertShare(doc.id, "user_devon", {
        targetUserId: "user_sofia",
        role: "editor",
      })
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      repo.deleteDocument(doc.id, "user_devon")
    ).rejects.toBeInstanceOf(ForbiddenError);

    // 3. Owner upgrades Devon to Editor
    await repo.upsertShare(doc.id, "user_faizan", {
      targetUserId: "user_devon",
      role: "editor",
    });

    const edited = await repo.updateDocument(doc.id, "user_devon", {
      title: "Collaborative Roadmap",
      contentHtml: "<p>Updated by Devon</p>",
    });
    expect(edited.title).toBe("Collaborative Roadmap");
    expect(edited.accessRole).toBe("editor");

    // Editor can attach files, but STILL cannot share or delete the document
    const editorAtt = await repo.addAttachment(doc.id, "user_devon", {
      fileName: "metrics.csv",
      mimeType: "text/csv",
      sizeBytes: 10,
      contentBase64: Buffer.from("a,b\n1,2\n").toString("base64"),
    });
    expect(editorAtt.fileName).toBe("metrics.csv");

    await expect(
      repo.upsertShare(doc.id, "user_devon", {
        targetUserId: "user_sofia",
        role: "viewer",
      })
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      repo.deleteDocument(doc.id, "user_devon")
    ).rejects.toBeInstanceOf(ForbiddenError);

    // 4. Owner revokes Devon's access
    await repo.removeShare(doc.id, "user_faizan", "user_devon");
    await expect(
      repo.getDocumentForUser(doc.id, "user_devon")
    ).rejects.toBeInstanceOf(ForbiddenError);

    // 5. Owner deletes document cleanly
    await repo.deleteDocument(doc.id, "user_faizan");
    await expect(
      repo.getDocumentForUser(doc.id, "user_faizan")
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
