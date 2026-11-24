import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { BadRequestError } from "@/lib/db/errors";
import { validateAttachmentFile } from "@/lib/file-parser";
import { handleApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new BadRequestError("Select a file to attach.");
    }

    const { safeFileName, mimeType } = validateAttachmentFile({
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const repo = getRepository();
    const attachment = await repo.addAttachment(id, user.id, {
      fileName: safeFileName,
      mimeType,
      sizeBytes: buffer.byteLength,
      contentBase64: buffer.toString("base64"),
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
