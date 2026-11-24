import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";
import { handleApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repo = getRepository();
    const users = await repo.listUsers();
    return NextResponse.json({
      ok: true,
      storageBackend: repo.backend,
      userCount: users.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
