import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { BadRequestError } from "@/lib/db/errors";
import { handleApiError } from "@/lib/http";
import { shareDocumentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    const body = await req.json();
    const parsed = shareDocumentSchema.parse(body);
    const repo = getRepository();

    const shares = await repo.upsertShare(id, user.id, {
      targetUserId: parsed.userId,
      targetEmail: parsed.email,
      role: parsed.role,
    });

    return NextResponse.json({ shares });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    let targetUserId = req.nextUrl.searchParams.get("userId")?.trim() || "";

    if (!targetUserId) {
      const body = await req.json().catch(() => null);
      if (body && typeof body.userId === "string") {
        targetUserId = body.userId.trim();
      }
    }

    if (!targetUserId) {
      throw new BadRequestError("Specify a userId to revoke access.");
    }

    const repo = getRepository();
    const shares = await repo.removeShare(id, user.id, targetUserId);
    return NextResponse.json({ shares });
  } catch (error) {
    return handleApiError(error);
  }
}
