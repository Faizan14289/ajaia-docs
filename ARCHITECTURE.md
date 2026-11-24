# Architecture Note — Ajaia Docs

## 1. Product Priorities & Scoping Decisions

With a 4–6 hour timebox, trying to imitate all of Google Docs (CRDT multi-cursor presence, pagination, comments, full OAuth, S3 object storage) produces brittle, shallow features. Instead, I prioritized **depth and reliability across five high-signal product pillars**:

1. **Coherent, calm rich-text editing:** Built on **Tiptap (ProseMirror)** rather than raw `contentEditable` so headings, lists, marks, undo/redo, and Markdown shortcuts behave predictably across browsers.
2. **Real server-side authorization (Owner / Editor / Viewer):** UI read-only states are paired with strict server-side permission checks in the repository layer. A `Viewer` cannot bypass the UI with a direct `PATCH`, `DELETE`, or file upload request.
3. **Product-relevant file handling:** Supported both **document import** (`.txt`, `.md`, `.docx` → editable rich text, either as a new doc or appended to a draft) and **document attachments** (supporting PDFs, images, CSVs, etc. up to 5 MB) so the upload workflow maps directly to real team workflows.
4. **Production persistence + zero-config local evaluation:** Implemented a clean `WorkspaceRepository` abstraction backed by **PostgreSQL (`pg`)** whenever `DATABASE_URL` is configured (Neon / Supabase / Vercel Postgres) and an **atomic local JSON file store** (write-to-temp + rename) when `DATABASE_URL` is unset. Reviewers can deploy to Vercel + Postgres *or* run `npm install && npm run dev` locally with zero external setup.
5. **Effortless sharing evaluation:** Included 4 seeded workspace accounts and a cookie-backed 1-click Account Switcher right in the dashboard and editor header so reviewers can verify Owner → Viewer → Editor transitions live on the same document URL without tedious sign-in flows.

---

## 2. System Architecture

```text
Browser (Next.js App Router + React 19 + Tiptap v3)
   │
   │  REST JSON / Multipart FormData + HttpOnly Session Cookie
   ▼
Next.js Route Handlers (src/app/api/**)
   ├── Zod Request Validation (src/lib/validation.ts)
   ├── File Parsing & Validation (mammoth / marked / size & extension checks)
   ├── Server-Side XSS Sanitization (zero-dep allowlist HTML sanitizer)
   └── Auth Session Resolution (src/lib/auth.ts)
   │
   ▼
WorkspaceRepository Interface (src/lib/db/index.ts)
   ├── Central Authorization Enforcement (owner | editor | viewer | 403)
   ├── PostgresWorkspaceRepository (pg Pool + auto DDL + idempotent seed)
   └── FileWorkspaceRepository (atomic local store / :memory: for tests)
```

### Relational Schema (`src/lib/db/schema.sql`)
- `users`: Seeded workspace team members (`id`, `name`, `email`, `role_title`, `avatar_color`, `initials`).
- `documents`: Owned documents (`id`, `title`, `content_html`, `owner_id`, `updated_by`, `created_at`, `updated_at`).
- `document_shares`: Explicit sharing grants with `UNIQUE (document_id, user_id)` and `CHECK (role IN ('viewer', 'editor'))`, cascading on document delete.
- `document_attachments`: Associated files (`id`, `document_id`, `uploaded_by`, `file_name`, `mime_type`, `size_bytes`, `content_base64`, `created_at`), cascading on document delete.

---

## 3. Key Tradeoffs & Intentional Scope Cuts

| Area | Decision Made | Tradeoff / Rationale |
| --- | --- | --- |
| **Authentication** | Seeded accounts + `HttpOnly` cookie session switcher | Avoids spending 1–2 hours on password hashing/OAuth/email verification while keeping real server-side user identity and instant sharing QA. |
| **Collaboration Model** | Debounced autosave (800 ms) + last-write-wins HTTP `PATCH` | Real-time CRDT sync (Yjs/Hocuspocus) requires WebSocket infrastructure and conflict UX beyond a 4–6h budget. Debounced save + explicit `Cmd/Ctrl+S` + retry state delivers dependable single-editor and async team editing. |
| **Rich-Text Storage** | Sanitized HTML (zero-dependency allowlist sanitizer) | Portable across Tiptap, `.md`/`.docx` imports, and future exports; strict tag/attribute allowlist eliminates stored XSS (`<script>`, `onerror`, `javascript:` URLs) with zero Node-version ESM friction on Serverless. |
| **Attachment Storage** | Bounded (`5 MB`) base64 column in Postgres / local store | Works out of the box on stateless Vercel Serverless Functions without requiring reviewers to provision or pay for S3/R2 buckets. Clearly bounded in UI and API. |
| **Database Driver** | Direct parameterized `pg` queries + auto-bootstrap DDL | Zero ORM binary-engine cold-start issues on Vercel Serverless or Node 25, full SQL clarity, and identical domain contracts across Postgres and file-store backends. |

---

## 4. What I Would Build Next (With Another 2–4 Hours)

1. **Optimistic Concurrency & Version History:** Add a `version` column (`If-Match` / conflict detection) so two simultaneous editors never silently overwrite each other, plus automatic `document_revisions` snapshots with diff/restore.
2. **Export to Markdown & Print-Ready PDF:** One-click download of any document as clean `.md` or print-styled PDF.
3. **Real-Time Presence & Collaboration:** Layer a Yjs provider or lightweight polling/SSE presence indicator showing active collaborators viewing/editing a document.
4. **External Object Storage & Real Auth:** Move attachment binaries to S3/Vercel Blob via presigned URLs for larger files (50 MB+) and swap the seeded session switcher for NextAuth/Clerk SSO.
