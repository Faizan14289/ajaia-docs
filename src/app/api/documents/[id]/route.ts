import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { updateDocumentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    const repo = getRepository();
    const document = await repo.getDocumentForUser(id, user.id);
    return NextResponse.json({ document, currentUser: user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    const body = await req.json();
    const parsed = updateDocumentSchema.parse(body);
    const repo = getRepository();
    const document = await repo.updateDocument(id, user.id, parsed);
    return NextResponse.json({ document });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    const repo = getRepository();
    await repo.deleteDocument(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
