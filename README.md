# Ajaia Docs

A lightweight collaborative document workspace built for the **Ajaia LLC — AI-Native Full Stack Developer Assignment**.

Ajaia Docs focuses on a high-craft core product slice: clean rich-text editing, product-relevant file import and document attachments, clear ownership vs. shared boundaries with role-based permissions (**Owner**, **Editor**, **Viewer**), and durable persistence backed by PostgreSQL (with an automatic zero-config local file store for instant offline evaluation).

---

## Live Deployment

- **Live URL:** https://ajaia-docs-murex-pi.vercel.app
- **Health Check:** https://ajaia-docs-murex-pi.vercel.app/api/health

---

## Core Capabilities

### 1. Document Creation & Rich-Text Editing
- Create blank documents or start from quick templates (*Meeting Notes*, *Product Brief*).
- Inline document renaming from both the dashboard and editor header.
- Rich-text editing powered by **Tiptap (ProseMirror)** supporting:
  - Headings (`H1`, `H2`, `H3`) and normal paragraph text
  - **Bold**, *Italic*, <u>Underline</u>, ~~Strikethrough~~, and `Inline Code`
  - Bulleted lists, numbered lists, blockquotes, and horizontal dividers
  - Undo / Redo, Markdown input shortcuts (`# `, `- `, `1. `), and live word/character counts
- Debounced autosave (800 ms) with explicit `Save` button (`Cmd/Ctrl+S`), clear save state indicators (`Saved`, `Saving…`, `Unsaved`, `Error — Retry`), and server-side HTML sanitization.

### 2. File Upload (Dual Workflow)
All file limits and allowed formats are validated on both client and server and surfaced directly in the UI:

| Workflow | Supported File Types | Max Size | Behavior |
| --- | --- | --- | --- |
| **Import as Document / Append into Draft** | `.txt`, `.md`, `.docx` | `5 MB` | Parses Markdown (`marked`), Word documents (`mammoth`), or plain text into sanitized, editable rich text. Can create a new document or append into an existing editable draft. |
| **Document Attachments** | `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.txt`, `.md`, `.docx`, `.csv` | `5 MB` | Attaches reference files directly to a document. Downloadable by any collaborator (including Viewers); upload and deletion restricted to Owners and Editors. |

### 3. Sharing & Role-Based Permissions (Stretch Feature Included)
- Clear visual separation between **My Documents** (Owned) and **Shared with Me** (with explicit owner attribution and `Editor` / `View only` pills).
- **Owner** can grant access to teammates as `Editor` or `Viewer`, upgrade/downgrade roles live, revoke access, and delete documents.
- **Editor** can edit content, rename, import into the draft, and manage attachments, but cannot modify sharing or delete the document.
- **Viewer** sees a read-only banner and disabled formatting toolbar; all mutation endpoints (`PATCH`, `DELETE`, attachment uploads, sharing) are strictly enforced server-side with `403 Forbidden`.

---

## Seeded Test Accounts (No Password Required)

Use the **Account Switcher** in the top-right corner of the dashboard or editor to switch users in one click (backed by an `HttpOnly` session cookie):

| User | Email | Role | Pre-Seeded Access Highlights |
| --- | --- | --- | --- |
| **Faizan Ali** *(default)* | `faizan@ajaia.io` | Full-Stack Engineer | Owns 2 docs (*Q3 Internal Workspace Launch Brief*, *API & Persistence Architecture Notes*); `Editor` on Maya's Design System; `Viewer` on Sofia's Onboarding Runbook |
| **Maya Lin** | `maya@ajaia.io` | Product Designer | Owns *Design System & Typography Guidelines*; `Editor` on Faizan's Launch Brief and Sofia's Runbook |
| **Devon Brooks** | `devon@ajaia.io` | Engineering Lead | `Viewer` on Faizan's Launch Brief and Maya's Design System; blocked (`403`) from private docs |
| **Sofia Patel** | `sofia@ajaia.io` | Operations Lead | Owns *Customer Onboarding Runbook (Read-Only)* |

---

## Local Setup & Run Instructions

### Prerequisites
- **Node.js 20+** and **npm 10+**

### Option A: Zero-Config Local Run (Fastest)
No database setup required — when `DATABASE_URL` is unset, Ajaia Docs automatically persists data to an atomic local JSON store (`./data/ajaia-docs-store.json`) and seeds the 4 team accounts and starter documents on first boot.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Option B: Run with PostgreSQL (Neon, Supabase, Vercel Postgres, or Local Postgres)
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Set `DATABASE_URL` in `.env.local`:
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/ajaia_docs?sslmode=require
   ```
3. Start the server:
   ```bash
   npm run dev
   ```
   The PostgreSQL schema ([src/lib/db/schema.sql](src/lib/db/schema.sql)) and idempotent starter seed data are applied automatically on first connection.

---

## Scripts & Quality Verification

```bash
npm test            # Run Vitest automated test suite (persistence, RBAC, file import & validation)
npx tsc --noEmit    # TypeScript strict type-checking
npm run lint        # ESLint check
npm run build       # Production Next.js build
npm run start       # Run production server locally
```

---

## Deploying to Vercel + PostgreSQL

1. Push this repository to GitHub.
2. Import the repository in **Vercel** (framework preset: **Next.js**, root directory: `.`).
3. Provision a free PostgreSQL database via **Vercel Marketplace (Neon or Supabase)** or connect an existing Postgres instance by setting the `DATABASE_URL` environment variable in Vercel Project Settings.
4. Deploy. On the first request (e.g., `/api/health`), tables and seed records initialize automatically. Verify `/api/health` returns `"storageBackend": "postgres"`.

---

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── documents/               # CRUD, file import, sharing, and attachments REST APIs
│   │   ├── health/                  # Storage & liveness check
│   │   └── session/                 # Cookie-backed account switcher
│   ├── docs/[id]/page.tsx           # Document editor route
│   ├── layout.tsx & globals.css     # App shell & editorial Tiptap typography
│   └── page.tsx                     # Workspace dashboard route
├── components/
│   ├── WorkspaceDashboard.tsx       # Owned vs Shared workspace + templates + search
│   ├── DocumentEditorView.tsx       # Editor header, autosave, role banner, modals
│   ├── RichTextEditor.tsx           # Tiptap v3 editor + sticky toolbar
│   ├── ShareModal.tsx               # Collaborator management & role switcher
│   ├── ImportModal.tsx              # Drag-and-drop .txt / .md / .docx importer
│   ├── AttachmentsDrawer.tsx        # Document attachment upload/download panel
│   └── UserSwitcher.tsx             # 1-click seeded account switcher
└── lib/
    ├── db/                          # Repository interface, Postgres & atomic file-store impls
    ├── __tests__/                   # Vitest unit & integration test suites
    ├── auth.ts                      # HttpOnly session cookie helpers
    ├── file-parser.ts               # .txt, .md, .docx parser & attachment validator
    ├── sanitize.ts                  # Server-side HTML allowlist sanitizer & excerpt helper
    ├── seed-data.ts                 # Realistic team accounts & starter docs
    └── validation.ts                # Zod API payload schemas
```
