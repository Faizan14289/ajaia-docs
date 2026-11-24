import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, getSessionUser } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { NotFoundError } from "@/lib/db/errors";
import { handleApiError } from "@/lib/http";
import { switchUserSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repo = getRepository();
    const [currentUser, users] = await Promise.all([
      getSessionUser(),
      repo.listUsers(),
    ]);

    return NextResponse.json({
      currentUser,
      users,
      storageBackend: repo.backend,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = switchUserSchema.parse(body);
    const repo = getRepository();

    const user = parsed.userId
      ? await repo.findUserById(parsed.userId)
      : await repo.findUserByEmail(parsed.email ?? "");

    if (!user) {
      throw new NotFoundError(
        "No seeded workspace account matched that email or user ID."
      );
    }

    const users = await repo.listUsers();
    const res = NextResponse.json({
      currentUser: user,
      users,
      storageBackend: repo.backend,
    });
    attachSessionCookie(res, user.id);
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
