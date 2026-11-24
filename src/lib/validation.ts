import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty.")
    .max(120, "Title must be 120 characters or fewer.")
    .optional(),
  contentHtml: z
    .string()
    .max(500_000, "Document content exceeds the 500 KB text limit.")
    .optional(),
});

export const updateDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty.")
      .max(120, "Title must be 120 characters or fewer.")
      .optional(),
    contentHtml: z
      .string()
      .max(500_000, "Document content exceeds the 500 KB text limit.")
      .optional(),
  })
  .refine((data) => data.title !== undefined || data.contentHtml !== undefined, {
    message: "Provide at least a title or content update.",
  });

export const shareDocumentSchema = z.object({
  email: z.string().trim().email("Enter a valid team email address.").optional(),
  userId: z.string().trim().min(1).optional(),
  role: z.enum(["viewer", "editor"]),
}).refine((data) => Boolean(data.email || data.userId), {
  message: "Select a collaborator or enter an email address.",
});

export const switchUserSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  email: z.string().trim().email("Enter a valid email address.").optional(),
}).refine((data) => Boolean(data.userId || data.email), {
  message: "Provide a userId or email to sign in.",
});
