"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import type { User } from "@/lib/types";

interface UserSwitcherProps {
  currentUser: User;
  users: User[];
  onSwitch: (userId: string) => Promise<void>;
  compact?: boolean;
}

export function UserSwitcher({
  currentUser,
  users,
  onSwitch,
  compact = false,
}: UserSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function handleSelect(userId: string) {
    if (userId === currentUser.id) {
      setOpen(false);
      return;
    }
    setSwitchingId(userId);
    try {
      await onSwitch(userId);
      setOpen(false);
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left shadow-2xs transition hover:border-gray-300 hover:bg-gray-50 cursor-pointer ${
          compact ? "max-w-[210px]" : "w-full"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch seeded workspace account to test sharing and roles"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: currentUser.avatarColor }}
        >
          {currentUser.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-gray-900">
            {currentUser.name}
          </div>
          {!compact && (
            <div className="truncate text-[11px] text-gray-500">
              {currentUser.email}
            </div>
          )}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 bg-gray-50/80 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Users className="h-3.5 w-3.5 text-indigo-600" />
              Switch Workspace Account
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Demo team accounts to verify ownership, sharing &amp; Viewer/Editor roles.
            </p>
          </div>
          <div className="p-1.5" role="listbox">
            {users.map((user) => {
              const isActive = user.id === currentUser.id;
              const isLoading = switchingId === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  disabled={switchingId !== null}
                  onClick={() => handleSelect(user.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition cursor-pointer ${
                    isActive
                      ? "bg-indigo-50/80 text-indigo-950"
                      : "hover:bg-gray-100/80 text-gray-800"
                  }`}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {user.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold">
                        {user.name}
                      </span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                        {user.roleTitle}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-gray-500">
                      {user.email}
                    </div>
                  </div>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                  {isLoading && (
                    <span className="text-[11px] font-medium text-indigo-600">
                      …
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
