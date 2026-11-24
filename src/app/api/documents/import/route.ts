import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { BadRequestError } from "@/lib/db/errors";
import { parseImportedFile } from "@/lib/file-parser";
import { handleApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const formData = await req.formData();
    const file = formData.get("file");
    const targetDocId = formData.get("documentId");

    if (!(file instanceof File)) {
      throw new BadRequestError("Please attach a .txt, .md, or .docx file to import.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = await parseImportedFile({
      fileName: file.name,
      buffer,
    });

    const repo = getRepository();

    if (typeof targetDocId === "string" && targetDocId.trim().length > 0) {
      const existing = await repo.getDocumentForUser(targetDocId.trim(), user.id);
      const separator =
        existing.contentHtml && existing.contentHtml !== "<p></p>"
          ? "<hr />"
          : "";
      const mergedHtml = `${existing.contentHtml}${separator}${parsed.contentHtml}`;
      const updated = await repo.updateDocument(existing.id, user.id, {
        contentHtml: mergedHtml,
      });
      return NextResponse.json({
        document: updated,
        importedFrom: file.name,
        warnings: parsed.warnings,
      });
    }

    const created = await repo.createDocument(user.id, {
      title: parsed.title,
      contentHtml: parsed.contentHtml,
    });

    return NextResponse.json(
      {
        document: created,
        importedFrom: file.name,
        warnings: parsed.warnings,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
