"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepareForUpload, RAW_INPUT_MAX_BYTES } from "@/lib/client/compress";
import { getSessionId, pushRecent } from "@/lib/client/session";
import type { ResultResponse } from "@/lib/types";

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

type Phase = "idle" | "uploading" | "analyzing" | "done";

export function ImageDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const accept = useCallback((f: File | null | undefined) => {
    setError(null);
    if (!f) return;
    if (!ACCEPT.includes(f.type)) {
      setError("PNG / JPEG / WebP の画像を選んでください（SVG・PDFは非対応）");
      return;
    }
    if (f.size > RAW_INPUT_MAX_BYTES) {
      setError("画像は 30MB 以下にしてください（アップロード前に自動で縮小します）");
      return;
    }
    setFile(f);
  }, []);

  // Preview URL lifecycle: derive from the file, revoke on change/unmount.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Clipboard paste is first-class: listen on the whole document.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (phase !== "idle") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            accept(new File([f], f.name || `pasted-${Date.now()}.${item.type.split("/")[1] ?? "png"}`, { type: f.type }));
            return;
          }
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [accept, phase]);

  // Elapsed-time ticker while analyzing
  useEffect(() => {
    if (phase !== "analyzing" && phase !== "uploading") return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const analyze = async () => {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    setNote(null);
    try {
      // Vercel rejects bodies over 4.5 MB; shrink large images client-side first.
      const prepared = await prepareForUpload(file);
      if (prepared.changed) {
        setNote(`大きな画像のため ${prepared.width}×${prepared.height}・${(prepared.file.size / 1024 / 1024).toFixed(1)} MB に縮小して送信しました`);
      }
      const form = new FormData();
      form.append("image", prepared.file, prepared.file.name);
      const session = getSessionId();
      if (session) form.append("session", session);
      setPhase("analyzing");
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as Partial<ResultResponse> & { error?: string };
      if (!res.ok || !body.final || !body.submission) {
        throw new Error(body.error ?? `解析に失敗しました (HTTP ${res.status})`);
      }
      pushRecent({
        id: body.submission.id,
        kmi: body.final.kmi,
        grade: body.final.grade,
        at: new Date().toISOString(),
      });
      setPhase("done");
      router.push(`/results/${body.submission.id}`);
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "解析に失敗しました");
    }
  };

  const busy = phase === "uploading" || phase === "analyzing";

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="画像をドロップまたはクリックして選択"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (busy) return;
          accept(e.dataTransfer.files?.[0]);
        }}
        className={[
          "relative flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition",
          dragging ? "border-accent bg-accent-soft" : "border-border bg-card hover:border-indigo",
          busy ? "cursor-wait opacity-80" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="選択した画像のプレビュー" className="max-h-96 max-w-full rounded-lg object-contain shadow" />
        ) : (
          <div className="space-y-2">
            <p className="text-lg font-medium">画像をここにドロップ / ペースト</p>
            <p className="text-sm text-muted">
              クリックしてファイルを選択、または <kbd className="rounded border border-border px-1">Ctrl</kbd>+
              <kbd className="rounded border border-border px-1">V</kbd> で貼り付け
            </p>
            <p className="text-xs text-muted">PNG / JPEG / WebP（大きな画像は送信前に自動で縮小します）</p>
          </div>
        )}
      </div>

      {file && (
        <p className="text-sm text-muted">
          {file.name}（{(file.size / 1024).toFixed(0)} KB）
          {!busy && (
            <button
              type="button"
              className="ml-3 underline hover:text-foreground"
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              取り消す
            </button>
          )}
        </p>
      )}

      {note && <p className="text-sm text-muted">{note}</p>}

      {error && (
        <p role="alert" className="rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={!file || busy}
          onClick={analyze}
          className="rounded-full bg-accent px-8 py-3 text-lg font-bold text-white shadow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "解析中…" : "解析する"}
        </button>
        {busy && (
          <p className="text-sm text-muted" aria-live="polite">
            複数のVision LLMとJudgeが順に分析しています（{elapsed}秒経過・通常1〜3分）
          </p>
        )}
      </div>
    </div>
  );
}
