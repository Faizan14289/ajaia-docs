import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./db/errors";
import { FileValidationError } from "./file-parser";

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError || error instanceof FileValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    const firstMessage =
      error.issues[0]?.message || "Invalid request payload.";
    return NextResponse.json(
      { error: firstMessage, issues: error.issues },
      { status: 400 }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Malformed JSON request body." },
      { status: 400 }
    );
  }

  console.error("[API Error]", error);
  return NextResponse.json(
    { error: "An unexpected server error occurred. Please try again." },
    { status: 500 }
  );
}
