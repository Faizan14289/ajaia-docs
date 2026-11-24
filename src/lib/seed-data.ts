import type {
  DocumentAttachmentFull,
  DocumentRecord,
  DocumentShareRecord,
  User,
} from "./types";

export const DEFAULT_USER_ID = "user_faizan";

export const SEED_USERS: User[] = [
  {
    id: "user_faizan",
    name: "Faizan Ali",
    email: "faizan@ajaia.io",
    roleTitle: "Full-Stack Engineer",
    avatarColor: "#4F46E5",
    initials: "FA",
  },
  {
    id: "user_maya",
    name: "Maya Lin",
    email: "maya@ajaia.io",
    roleTitle: "Product Designer",
    avatarColor: "#059669",
    initials: "ML",
  },
  {
    id: "user_devon",
    name: "Devon Brooks",
    email: "devon@ajaia.io",
    roleTitle: "Engineering Lead",
    avatarColor: "#D97706",
    initials: "DB",
  },
  {
    id: "user_sofia",
    name: "Sofia Patel",
    email: "sofia@ajaia.io",
    roleTitle: "Operations Lead",
    avatarColor: "#E11D48",
    initials: "SP",
  },
];

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

export const SEED_DOCUMENTS: DocumentRecord[] = [
  {
    id: "doc_q3_launch",
    title: "Q3 Internal Workspace Launch Brief",
    ownerId: "user_faizan",
    updatedBy: "user_faizan",
    createdAt: hoursAgo(48),
    updatedAt: hoursAgo(1.5),
    contentHtml: `<h1>Q3 Internal Workspace Launch Brief</h1>
<p>This brief aligns engineering, design, and operations on the initial rollout of <strong>Ajaia Docs</strong> — our lightweight internal document editor built for <em>fast, structured collaboration</em>.</p>
<h2>Core Launch Goals</h2>
<ul>
  <li><strong>Zero-friction authoring:</strong> Clean rich-text formatting with headings, lists, and keyboard shortcuts.</li>
  <li><strong>Document portability:</strong> Import existing <code>.md</code>, <code>.txt</code>, and <code>.docx</code> drafts directly into the workspace.</li>
  <li><strong>Explicit access control:</strong> Clear ownership boundaries with <u>Viewer</u> and <u>Editor</u> sharing roles.</li>
</ul>
<h2>Rollout Checklist</h2>
<ol>
  <li>Complete pilot testing with Product &amp; Design squads.</li>
  <li>Verify PostgreSQL persistence and attachment downloads in staging.</li>
  <li>Publish onboarding guide and open general workspace access.</li>
</ol>
<blockquote><p>"Prioritize depth in core editing, persistence, and clear permissions over sprawling half-finished features."</p></blockquote>`,
  },
  {
    id: "doc_arch_notes",
    title: "API & Persistence Architecture Notes",
    ownerId: "user_faizan",
    updatedBy: "user_faizan",
    createdAt: hoursAgo(26),
    updatedAt: hoursAgo(4),
    contentHtml: `<h1>API &amp; Persistence Architecture Notes</h1>
<p>Draft working notes on how Ajaia Docs handles storage, sanitization, and permission checks across every API boundary.</p>
<h2>Key Guardrails</h2>
<ul>
  <li>All rich-text HTML is sanitized server-side with an explicit tag allowlist before persisting.</li>
  <li>Every mutation route validates <code>owner</code> vs <code>editor</code> vs <code>viewer</code> server-side — never trusting UI state alone.</li>
  <li>PostgreSQL is used in production via <code>DATABASE_URL</code>, with an automatic atomic file-store fallback for zero-config local evaluation.</li>
</ul>
<p><em>Tip: Click the <strong>Share</strong> button in the top-right to grant Maya or Devon access to this private draft.</em></p>`,
  },
  {
    id: "doc_design_system",
    title: "Design System & Typography Guidelines",
    ownerId: "user_maya",
    updatedBy: "user_maya",
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(6),
    contentHtml: `<h1>Design System &amp; Typography Guidelines</h1>
<p>Shared reference for Ajaia's internal productivity surfaces. You have <strong>Editor</strong> access to this document, so feel free to refine tokens or add component notes.</p>
<h2>Visual Principles</h2>
<ul>
  <li><strong>Paper-first canvas:</strong> Subtle cool-neutral workspace chrome (<code>#F7F8FA</code>) framing a crisp white reading surface.</li>
  <li><strong>Purposeful hierarchy:</strong> Clear typographic contrast between H1, H2, H3, and body copy at comfortable line-length.</li>
  <li><strong>Calm status signaling:</strong> Non-intrusive autosave states and explicit <u>Owner / Editor / Viewer</u> pills.</li>
</ul>
<h3>Next Review Items</h3>
<ol>
  <li>Finalize keyboard focus ring contrast across toolbar controls.</li>
  <li>Confirm mobile sheet layout for smaller laptop viewports.</li>
</ol>`,
  },
  {
    id: "doc_onboarding_runbook",
    title: "Customer Onboarding Runbook (Read-Only)",
    ownerId: "user_sofia",
    updatedBy: "user_sofia",
    createdAt: hoursAgo(96),
    updatedAt: hoursAgo(12),
    contentHtml: `<h1>Customer Onboarding Runbook</h1>
<p>Standard operating procedure for onboarding new Ajaia workspace customers. This document is shared with you in <strong>View-Only</strong> mode to preserve operational sign-off integrity.</p>
<h2>Phase 1: Kickoff &amp; Provisioning</h2>
<ol>
  <li>Provision team workspace and verify SSO domain mapping.</li>
  <li>Import legacy SOP documents (<code>.docx</code> / <code>.md</code>) into the shared library.</li>
  <li>Assign workspace owners and audit initial <em>Viewer</em> vs <em>Editor</em> roles.</li>
</ol>
<h2>Phase 2: Week-One Check-In</h2>
<ul>
  <li>Review active document creation metrics and team feedback.</li>
  <li>Confirm attachment limits (5 MB max per file) meet customer workflows.</li>
</ul>`,
  },
];

export const SEED_SHARES: DocumentShareRecord[] = [
  {
    id: "share_q3_maya",
    documentId: "doc_q3_launch",
    userId: "user_maya",
    role: "editor",
    createdAt: hoursAgo(30),
  },
  {
    id: "share_q3_devon",
    documentId: "doc_q3_launch",
    userId: "user_devon",
    role: "viewer",
    createdAt: hoursAgo(20),
  },
  {
    id: "share_design_faizan",
    documentId: "doc_design_system",
    userId: "user_faizan",
    role: "editor",
    createdAt: hoursAgo(50),
  },
  {
    id: "share_design_devon",
    documentId: "doc_design_system",
    userId: "user_devon",
    role: "viewer",
    createdAt: hoursAgo(40),
  },
  {
    id: "share_runbook_faizan",
    documentId: "doc_onboarding_runbook",
    userId: "user_faizan",
    role: "viewer",
    createdAt: hoursAgo(60),
  },
  {
    id: "share_runbook_maya",
    documentId: "doc_onboarding_runbook",
    userId: "user_maya",
    role: "editor",
    createdAt: hoursAgo(55),
  },
];

export const SEED_ATTACHMENTS: DocumentAttachmentFull[] = [
  {
    id: "att_launch_checklist",
    documentId: "doc_q3_launch",
    uploadedBy: "user_faizan",
    uploaderName: "Faizan Ali",
    fileName: "launch-readiness-checklist.md",
    mimeType: "text/markdown",
    sizeBytes: 248,
    createdAt: hoursAgo(3),
    contentBase64: Buffer.from(
      "# Launch Readiness Checklist\n\n- [x] Rich-text formatting verified\n- [x] File import (.txt, .md, .docx) tested\n- [x] Role-based sharing (Viewer/Editor) enforced\n- [x] Postgres persistence verified\n",
      "utf-8"
    ).toString("base64"),
  },
];
