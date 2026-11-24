"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Lock,
  Shield,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import type {
  DocumentAccessRole,
  DocumentShareWithUser,
  ShareRole,
  User,
} from "@/lib/types";

interface ShareModalProps {
  documentId: string;
  documentTitle: string;
  owner: User;
  accessRole: DocumentAccessRole;
  shares: DocumentShareWithUser[];
  allUsers: User[];
  onClose: () => void;
  onSharesUpdated: (shares: DocumentShareWithUser[]) => void;
}

export function ShareModal({
  documentId,
  documentTitle,
  owner,
  accessRole,
  shares,
  allUsers,
  onClose,
  onSharesUpdated,
}: ShareModalProps) {
  const isOwner = accessRole === "owner";
  const sharedUserIds = new Set(shares.map((s) => s.userId));
  const availableTeammates = allUsers.filter(
    (u) => u.id !== owner.id && !sharedUserIds.has(u.id)
  );

  const [selectedUserId, setSelectedUserId] = useState<string>(
    availableTeammates[0]?.id ?? ""
  );
  const [emailInput, setEmailInput] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGrantAccess(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = emailInput.trim()
      ? { email: emailInput.trim(), role }
      : { userId: selectedUserId, role };

    if (!payload.email && !payload.userId) {
      setError("Choose a teammate or enter a workspace email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to share document.");
        return;
      }
      onSharesUpdated(data.shares);
      setEmailInput("");
      const nextSharedIds = new Set(
        (data.shares as DocumentShareWithUser[]).map((s) => s.userId)
      );
      const nextAvail = allUsers.find(
        (u) => u.id !== owner.id && !nextSharedIds.has(u.id)
      );
      setSelectedUserId(nextAvail?.id ?? "");
    } catch {
      setError("Network error while updating sharing permissions.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateRole(userId: string, nextRole: ShareRole) {
    setError(null);
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/documents/${documentId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to update collaborator role.");
        return;
      }
      onSharesUpdated(data.shares);
    } catch {
      setError("Network error while changing role.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRevoke(userId: string) {
    setError(null);
    setBusyUserId(userId);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/shares?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to remove collaborator.");
        return;
      }
      onSharesUpdated(data.shares);
    } catch {
      setError("Network error while revoking access.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/docs/${documentId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${documentTitle}`}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div className="min-w-0 pr-4">
            <h2 className="truncate text-base font-semibold text-gray-900">
              Share &ldquo;{documentTitle}&rdquo;
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {isOwner
                ? "Grant teammates Viewer (read-only) or Editor access."
                : "Only the document owner can add or modify collaborators."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
            aria-label="Close share dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {isOwner ? (
            <form onSubmit={handleGrantAccess} className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                {availableTeammates.length > 0 ? (
                  <select
                    value={selectedUserId}
                    onChange={(e) => {
                      setSelectedUserId(e.target.value);
                      setEmailInput("");
                    }}
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    aria-label="Select workspace teammate"
                  >
                    {availableTeammates.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="All seeded teammates already have access"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                )}

                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as ShareRole)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  aria-label="Select access role"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (availableTeammates.length === 0 && !emailInput.trim())
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-2xs transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  {submitting ? "Sharing…" : "Share"}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                <strong>Editor</strong> can edit text, rename, and upload attachments.{" "}
                <strong>Viewer</strong> can read and download attachments only.
              </p>
            </form>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900">
              <Lock className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                You are viewing collaborators as{" "}
                <strong className="capitalize">{accessRole}</strong>. Ask{" "}
                <strong>{owner.name}</strong> to change permissions.
              </span>
            </div>
          )}

          <div>
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Shield className="h-3.5 w-3.5" />
              People with access ({1 + shares.length})
            </div>

            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200/90 bg-gray-50/40">
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: owner.avatarColor }}
                  >
                    {owner.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {owner.name}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {owner.email}
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                  Owner
                </span>
              </div>

              {shares.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-gray-500">
                  Private document — not shared with anyone else yet.
                </div>
              ) : (
                shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: share.user.avatarColor }}
                      >
                        {share.user.initials}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {share.user.name}
                        </div>
                        <div className="truncate text-xs text-gray-500">
                          {share.user.email}
                        </div>
                      </div>
                    </div>

                    {isOwner ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={share.role}
                          disabled={busyUserId === share.userId}
                          onChange={(e) =>
                            handleUpdateRole(
                              share.userId,
                              e.target.value as ShareRole
                            )
                          }
                          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 focus:border-indigo-500 focus:outline-none"
                          aria-label={`Change role for ${share.user.name}`}
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          type="button"
                          disabled={busyUserId === share.userId}
                          onClick={() => handleRevoke(share.userId)}
                          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          title={`Revoke access for ${share.user.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          share.role === "editor"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {share.role}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/70 px-6 py-3.5">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Link copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-gray-500" />
                Copy document link
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
