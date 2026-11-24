import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { handleApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; attachmentId: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id, attachmentId } = await context.params;
    const user = await getSessionUser();
    const repo = getRepository();
    const attachment = await repo.getAttachmentForUser(
      id,
      attachmentId,
      user.id
    );

    const bytes = Buffer.from(attachment.contentBase64, "base64");
    const safeDownloadName = attachment.fileName.replace(/["\r\n]/g, "_");

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename="${safeDownloadName}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id, attachmentId } = await context.params;
    const user = await getSessionUser();
    const repo = getRepository();
    await repo.deleteAttachment(id, attachmentId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
