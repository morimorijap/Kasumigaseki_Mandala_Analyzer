"use client";

import { CopyButton } from "./copy-button";

export function ShareLink({ path }: { path: string }) {
  return <CopyButton text={() => `${window.location.origin}${path}`} label="結果URLをコピー" />;
}
