import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { createDocumentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    const repo = getRepository();
    const documents = await repo.listDocumentsForUser(user.id);
    return NextResponse.json({
      documents,
      currentUser: user,
      storageBackend: repo.backend,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const body = await req.json().catch(() => ({}));
    const parsed = createDocumentSchema.parse(body);
    const repo = getRepository();
    const document = await repo.createDocument(user.id, parsed);
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
