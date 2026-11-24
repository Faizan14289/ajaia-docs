import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRepository } from "./db";
import { DEFAULT_USER_ID } from "./seed-data";
import type { User } from "./types";

export const SESSION_COOKIE_NAME = "ajaia_session_user";

export async function getSessionUser(): Promise<User> {
  const repo = getRepository();
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (requestedId) {
    const found = await repo.findUserById(requestedId);
    if (found) return found;
  }

  const fallback = await repo.findUserById(DEFAULT_USER_ID);
  if (fallback) return fallback;

  const users = await repo.listUsers();
  if (users.length === 0) {
    throw new Error("No workspace users available.");
  }
  return users[0];
}

export function attachSessionCookie(res: NextResponse, userId: string): void {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: userId,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
