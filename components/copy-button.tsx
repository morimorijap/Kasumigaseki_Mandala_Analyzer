"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label,
  copiedLabel = "コピーしました",
}: {
  text: string | (() => string);
  label: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-indigo"
      onClick={async (e) => {
        // Usable inside <summary> without toggling the <details>.
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
