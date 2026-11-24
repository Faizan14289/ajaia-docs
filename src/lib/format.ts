export const IMPORT_ACCEPT = ".txt,.md,.docx";
export const IMPORT_SUPPORTED_LABEL = ".txt, .md, or .docx (max 5 MB)";

export const ATTACHMENT_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.docx,.csv";
export const ATTACHMENT_SUPPORTED_LABEL =
  ".pdf, .png, .jpg, .webp, .txt, .md, .docx, .csv (max 5 MB)";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (diffSeconds < 15) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const DOCUMENT_TEMPLATES = [
  {
    id: "meeting_notes",
    label: "Meeting Notes",
    description: "Agenda, key decisions, and action items",
    title: "Weekly Team Sync — Notes",
    contentHtml: `<h1>Weekly Team Sync</h1>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()} &nbsp;·&nbsp; <strong>Facilitator:</strong> Team Lead</p>
<h2>Agenda</h2>
<ul>
  <li>Review sprint progress and blockers</li>
  <li>Walk through upcoming milestones</li>
</ul>
<h2>Key Decisions</h2>
<ul>
  <li><em>Record decisions agreed upon during the call.</em></li>
</ul>
<h2>Action Items</h2>
<ol>
  <li>Owner — Action item and target date</li>
</ol>`,
  },
  {
    id: "product_spec",
    label: "Product Brief",
    description: "Problem statement, goals, and rollout plan",
    title: "New Feature Product Brief",
    contentHtml: `<h1>Product Brief</h1>
<p>Summarize the user problem and why solving it matters now.</p>
<h2>Goals &amp; Non-Goals</h2>
<ul>
  <li><strong>Goal:</strong> Define the core measurable outcome.</li>
  <li><strong>Non-Goal:</strong> Explicitly state what is deferred from v1.</li>
</ul>
<h2>Implementation Plan</h2>
<ol>
  <li>Milestone 1 — Core workflow</li>
  <li>Milestone 2 — QA &amp; launch readiness</li>
</ol>`,
  },
] as const;
