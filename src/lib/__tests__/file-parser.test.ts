import { describe, expect, it } from "vitest";
import {
  FileValidationError,
  MAX_FILE_SIZE_BYTES,
  parseImportedFile,
  validateAttachmentFile,
} from "../file-parser";

describe("parseImportedFile", () => {
  it("converts .md files into sanitized rich HTML and derives clean title", async () => {
    const md = `# Launch Plan

We are shipping **Ajaia Docs** with *markdown* support.

- Fast authoring
- Safe sanitization

<script>window.evil = true</script>
`;

    const result = await parseImportedFile({
      fileName: "q3_launch-plan.md",
      buffer: Buffer.from(md, "utf-8"),
    });

    expect(result.title).toBe("q3 launch plan");
    expect(result.contentHtml).toContain("<h1>Launch Plan</h1>");
    expect(result.contentHtml).toContain("<strong>Ajaia Docs</strong>");
    expect(result.contentHtml).toContain("<li>Fast authoring</li>");
    expect(result.contentHtml).not.toContain("<script>");
  });

  it("converts .txt files into escaped HTML paragraphs preserving line breaks", async () => {
    const txt = "Line one with <tags>\nLine two\n\nSecond paragraph.";
    const result = await parseImportedFile({
      fileName: "meeting_notes.txt",
      buffer: Buffer.from(txt, "utf-8"),
    });

    expect(result.title).toBe("meeting notes");
    expect(result.contentHtml).toContain("&lt;tags&gt;");
    expect(result.contentHtml).toContain("<br />");
    expect(result.contentHtml).toContain("<p>Second paragraph.</p>");
  });

  it("rejects unsupported import extensions and oversized files", async () => {
    await expect(
      parseImportedFile({
        fileName: "archive.zip",
        buffer: Buffer.from("PK\x03\x04"),
      })
    ).rejects.toThrow(FileValidationError);

    await expect(
      parseImportedFile({
        fileName: "huge.txt",
        buffer: Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, "a"),
      })
    ).rejects.toThrow(/5 MB/i);

    await expect(
      parseImportedFile({
        fileName: "corrupt.docx",
        buffer: Buffer.from("not a real docx zip file"),
      })
    ).rejects.toThrow(/Unable to parse \.docx/i);
  });
});

describe("validateAttachmentFile", () => {
  it("accepts allowed attachment types and blocks disallowed or empty files", () => {
    const ok = validateAttachmentFile({
      fileName: "../secret/roadmap.pdf",
      sizeBytes: 2048,
      mimeType: "application/pdf",
    });
    expect(ok.safeFileName).toBe("roadmap.pdf");
    expect(ok.mimeType).toBe("application/pdf");

    expect(() =>
      validateAttachmentFile({
        fileName: "payload.sh",
        sizeBytes: 120,
      })
    ).toThrow(FileValidationError);

    expect(() =>
      validateAttachmentFile({
        fileName: "empty.png",
        sizeBytes: 0,
      })
    ).toThrow(FileValidationError);
  });
});
