# AI-Native Workflow Note

## 1. AI Tools Used
- **Antigravity (Gemini coding agent):** Used as my primary engineering copilot inside the workspace for architecture planning, Next.js 16 / Tiptap v3 scaffolding, dual-backend repository implementation, test generation, and automated live browser QA.

---

## 2. Where AI Materially Sped Up Delivery
- **Eliminating boilerplate across vertical slices:** Generating the strongly typed domain layer (`types.ts`), Zod schemas (`validation.ts`), 8 Next.js App Router API routes, and consistent error-mapping (`http.ts`) in minutes left more time to refine editor ergonomics and permission edge cases.
- **Dual-backend repository parity:** Writing both `PostgresWorkspaceRepository` (parameterized SQL, auto-DDL, transactional seeding) and `FileWorkspaceRepository` (atomic temp-file rename + `:memory:` test mode) against a shared `WorkspaceRepository` interface allowed fast offline tests and zero-config local evaluation without sacrificing production Postgres support.
- **Comprehensive authorization & file-parsing test coverage:** Quickly drafting a thorough Vitest matrix covering unauthorized reads, Viewer-vs-Editor mutation boundaries, share revocation, disk-restart persistence, and malformed `.docx`/XSS `.md` inputs.

---

## 3. What AI-Generated Output I Changed, Rejected, or Caught
Practical AI usage means treating generated code and framework defaults skeptically:

1. **Rejected Next.js 16 scaffold defaults (`cacheComponents: true` & dark-mode paper override):** `create-next-app` enabled `cacheComponents: true` (which alters route-handler dynamic behavior and React `<Activity>` state caching) and a `prefers-color-scheme: dark` root override that turned document paper dark. I inspected the bundled Next.js 16 docs, disabled `cacheComponents` for predictable dynamic auth/document state, and enforced an intentional light paper canvas in `globals.css`.
2. **Prevented Tiptap v3 duplicate-extension bugs:** Before registering `@tiptap/extension-underline` alongside `@tiptap/starter-kit`, I inspected the installed v3 type definitions and verified `StarterKit` v3 already bundles `underline` by default—avoiding runtime duplicate extension warnings.
3. **Refactored React 19 Compiler effect patterns:** Initial `useEffect` data-fetching code triggered `react-hooks/set-state-in-effect` ESLint errors under React 19's compiler rules. I refactored dashboard and editor loaders into clean cancellable async fetches (`active` guard) with separate event-handler refreshes.
4. **Caught and fixed real UI bugs via live browser inspection:** Automated visual verification against the running production server revealed two subtle issues that static tests missed:
   - The View-Only banner placed raw text nodes and `<strong>` tags directly inside an `inline-flex` container, wrapping words into awkward vertical columns. Wrapping the copy in a single `<span>` beside the icon fixed the layout cleanly.
   - `extractPlainTextExcerpt()` initially stripped HTML tags without inserting spaces between closing block tags (`</h1><p>`) and left `&amp;` HTML entities un-decoded on dashboard cards. I updated `src/lib/sanitize.ts` to add block spacing, decode common entities, and added a dedicated Vitest regression test.

---

## 4. How I Verified Correctness, UX Quality, and Reliability
- **Automated Tests (`npm test`):** 7 Vitest specs verifying persistence across restarts, XSS sanitization, entity-decoded excerpts, `.md`/`.txt`/corrupt `.docx` parsing, attachment validation, and the full Owner/Editor/Viewer/Unauthorized RBAC matrix.
- **Static Quality Gates:** Ran `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors, 0 warnings), and `npm run build` (clean production Turbopack build).
- **Live End-to-End Browser Verification:** Loaded the compiled production build in a real browser to verify dashboard separation (`My Documents` vs `Shared with Me`), Tiptap formatting controls, Share modal role controls, Attachments drawer downloads, View-Only banner/disabled toolbar, and live in-place account switching (`Faizan` → `Sofia` → `Faizan`) with zero console or network errors.
- **Live HTTP API Smoke Verification:** Verified `/api/health`, multipart `.md` upload via `POST /api/documents/import`, server-side `403 Forbidden` rejection when a `Viewer` sends a direct `PATCH`, and `200 OK` after switching cookies to the document owner.
