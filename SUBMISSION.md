# Submission Inventory — Ajaia LLC Full Stack Assignment

**Candidate:** Faizan Ali (`faizali2152@gmail.com`)  
**Project:** Ajaia Docs — Lightweight Collaborative Document Workspace

---

## Included Deliverables

| Deliverable | Location | Description |
| --- | --- | --- |
| **Source Code** | `src/`, `package.json`, `next.config.ts`, `vitest.config.mts` | Full-stack Next.js (App Router, TypeScript) + Tiptap rich-text editor + PostgreSQL/File repository |
| **Setup & Run Guide** | `README.md` | Local zero-config run, PostgreSQL setup, file-upload limits, seeded accounts, and Vercel deployment steps |
| **Architecture Note** | `ARCHITECTURE.md` | Prioritization decisions, relational schema, tradeoffs, and next 2–4h roadmap |
| **AI Workflow Note** | `AI_WORKFLOW.md` | AI tools used, acceleration areas, generated output changed/rejected, and verification strategy |
| **Walkthrough Video URL** | `WALKTHROUGH_VIDEO_URL.txt` | Link to the 3–5 minute product & engineering walkthrough |
| **Environment Template** | `.env.example` | `DATABASE_URL` template for PostgreSQL deployment |

---

## Live Product URL & Test Credentials

- **Live URL:** https://ajaia-docs-murex-pi.vercel.app
- **GitHub Repository:** https://github.com/Faizan14289/ajaia-docs
- **Walkthrough Video (Loom — also in `WALKTHROUGH_VIDEO_URL.txt`):**
  - Part 1: https://www.loom.com/share/7f3b308b2e154f138e6d85f33d89ca74
  - Part 2: https://www.loom.com/share/d198306903e3465b80bbd286845b5104
  - Part 3: https://www.loom.com/share/04180f48d06d47b1bbb615bdd1d336df
- **No sign-up required:** Use the **Account Switcher** in the top-right header to switch between seeded team accounts with one click:
  - **Faizan Ali** (`faizan@ajaia.io`) — Default active user; owns 2 docs, Editor on 1 shared doc, Viewer on 1 shared doc
  - **Maya Lin** (`maya@ajaia.io`) — Owns *Design System & Typography Guidelines*; Editor on Faizan's *Q3 Launch Brief*
  - **Devon Brooks** (`devon@ajaia.io`) — Viewer on Faizan's *Q3 Launch Brief*; no access to Faizan's private doc
  - **Sofia Patel** (`sofia@ajaia.io`) — Owns *Customer Onboarding Runbook (Read-Only)*

### Suggested 60-Second Reviewer Flow
1. Open the dashboard and note the clear split between **My Documents** and **Shared with Me** (with `Owner`, `Shared · Editor`, and `Shared · View only` badges).
2. Open **Q3 Internal Workspace Launch Brief**, edit text using headings/bold/italic/underline/lists, rename the title, wait for `Saved` (or press `Cmd/Ctrl+S`), and refresh the browser to verify persistence.
3. Click **Files** to inspect/download the seeded attachment or attach a new file (`.pdf`, `.png`, `.txt`, `.md`, `.docx`, `.csv` up to 5 MB).
4. Return to the dashboard and click **Import File** to upload a `.txt`, `.md`, or `.docx` file and convert it into a new editable document.
5. Open **Customer Onboarding Runbook (Read-Only)** as Faizan Ali (`View-Only` banner + disabled toolbar), then switch accounts in the top-right to **Sofia Patel** (`Owner`) to watch editing controls unlock live.
6. Switch back to **Faizan Ali**, open **API & Persistence Architecture Notes** (private), click **Share**, grant **Devon Brooks** `Viewer` or `Editor` access, and switch to Devon to confirm it appears in Devon's **Shared with Me** list with the exact assigned role.

---

## Honest Scope & Completion Status

### What Is Working End-to-End
- Document creation (blank + 2 templates), inline rename, rich-text editing (headings H1–H3, bold, italic, underline, strikethrough, inline code, bulleted/numbered lists, blockquote, divider, undo/redo), debounced autosave + `Cmd/Ctrl+S`, and full persistence across refreshes and restarts.
- File import (`.txt`, `.md`, `.docx` up to 5 MB) into new editable documents or appended into existing drafts, plus document attachments (upload, download, delete) with client + server validation.
- Sharing model with Owner, Editor, and Viewer roles, visible separation between owned and shared documents, collaborator role updates/revocation, and strict server-side `403` enforcement.
- PostgreSQL persistence (`DATABASE_URL`) with auto-schema initialization and idempotent seeding, plus automatic zero-config local file-store fallback when `DATABASE_URL` is omitted.
- Automated Vitest suite (`npm test` — 7 tests passing), strict TypeScript (`tsc --noEmit`), clean ESLint (`npm run lint`), and production build (`npm run build`).

### What Was Intentionally Deprioritized / Scoped Out
- Real-time multi-cursor simultaneous editing (CRDT / WebSockets) — replaced with reliable debounced autosave and clear save-state feedback.
- Full OAuth/password authentication & user registration — replaced with seeded workspace accounts and an `HttpOnly` cookie session switcher to keep sharing flows fast to evaluate.
- External object storage (S3/R2) for large binaries — attachments are bounded at 5 MB and persisted directly in PostgreSQL / local store so reviewers need zero paid external services.
- Inline commenting, suggestion mode, and document version history.

### What I Would Build Next With Another 2–4 Hours
1. **Optimistic locking (`version` checks) + document version history** with one-click snapshot restore.
2. **Export to Markdown and print-ready PDF** from the editor header.
3. **Lightweight real-time presence indicators** (active viewers/editors on a document) and live polling/SSE updates.
4. **Object storage (Vercel Blob / S3 presigned URLs)** for larger attachments and production OAuth authentication.
