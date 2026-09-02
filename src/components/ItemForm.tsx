"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  KIND_CONFIG,
  KIND_ROUTE,
  MAX_NOTES_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MAX_TITLE_LENGTH,
  type Item,
  type Kind,
} from "@/lib/items";
import type { SaveState } from "@/app/(app)/items/actions";

type Props = {
  kind: Kind;
  action: (prevState: SaveState, formData: FormData) => Promise<SaveState>;
  initial?: Item;
  submitLabel: string;
};

const initialState: SaveState = { error: null };

/**
 * A cheap "is the user finished typing a link" check for inline validation.
 *
 * This used to reject anything containing a comma, which fails valid URLs like
 * https://example.com/a,b. Parsing it properly is both more accurate and
 * shorter — the only thing the heuristic still has to add is requiring a dot in
 * the host, since `new URL("https://foo")` is technically valid but is almost
 * always a half-typed address.
 */
function looksLikeUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/\s/.test(v)) return false;
  try {
    const parsed = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return /\.[a-z]{2,}$/i.test(parsed.hostname) || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

export default function ItemForm({ kind, action, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const autofillAbort = useRef<AbortController | null>(null);
  const [touched, setTouched] = useState<{ url: boolean; title: boolean }>({
    url: false,
    title: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const config = KIND_CONFIG[kind];

  // Don't leave a request running against an unmounted form.
  useEffect(() => () => autofillAbort.current?.abort(), []);

  const urlInvalid = url.trim() !== "" && !looksLikeUrl(url);
  const urlMissing = url.trim() === "";
  const titleMissing = title.trim() === "";

  const showUrlError = (touched.url || submitAttempted) && (urlInvalid || urlMissing);
  const showTitleError = (touched.title || submitAttempted) && titleMissing;

  const errorCount = useMemo(
    () => [showUrlError, showTitleError].filter(Boolean).length,
    [showUrlError, showTitleError],
  );

  /**
   * Fetch the linked page's <title>.
   *
   * `overwrite` separates the two callers. The button is an explicit request,
   * so it replaces whatever is in the field. The URL field's onBlur is not —
   * it used to call setTitle unconditionally, so going back to fix a typo in
   * the URL silently destroyed a title the user had already typed.
   */
  async function autofillTitle({ overwrite }: { overwrite: boolean }) {
    if (!url.trim() || urlInvalid) return;
    if (!overwrite && title.trim() !== "") return;

    // Cancel any request still in flight. Two quick edits could otherwise land
    // out of order and apply the older page's title over the newer one.
    autofillAbort.current?.abort();
    const controller = new AbortController();
    autofillAbort.current = controller;

    setFetchingTitle(true);
    setAutofillError(null);
    try {
      const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const res = await fetch(`/api/fetch-title?url=${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`fetch-title responded ${res.status}`);
      }
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (data.title) {
        setTitle(data.title);
      } else {
        setAutofillError("Couldn't read a title from that page — type one in.");
      }
    } catch (err) {
      // Previously this was try/finally with no catch, and onBlur called it
      // without awaiting: a failure became an unhandled rejection and the user
      // saw nothing at all.
      if ((err as Error)?.name === "AbortError") return;
      setAutofillError("Couldn't reach that page — type a title in instead.");
    } finally {
      if (autofillAbort.current === controller) {
        autofillAbort.current = null;
        setFetchingTitle(false);
      }
    }
  }

  function addTag() {
    const t = tagInput.trim().slice(0, MAX_TAG_LENGTH);
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) {
      setTags([...tags, t]);
    }
    setTagInput("");
  }

  return (
    <div className="rounded p-7" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
      <form
        action={formAction}
        onSubmit={(e) => {
          setSubmitAttempted(true);
          if (urlInvalid || urlMissing || titleMissing) e.preventDefault();
        }}
        className="space-y-5.5"
      >
        <div>
          <label htmlFor="url" className="field-label block">
            Link
          </label>
          <div className="flex gap-2">
            <input
              id="url"
              name="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => {
                setTouched((t) => ({ ...t, url: true }));
                void autofillTitle({ overwrite: false });
              }}
              placeholder="https://example.com"
              maxLength={2048}
              className={`field-input flex-1 ${showUrlError ? "invalid" : ""}`}
            />
            <button
              type="button"
              onClick={() => void autofillTitle({ overwrite: true })}
              disabled={fetchingTitle || urlInvalid || !url.trim()}
              className="pill-btn-secondary shrink-0 whitespace-nowrap text-[13px]"
            >
              {fetchingTitle ? "Fetching…" : "Autofill title"}
            </button>
          </div>
          {showUrlError && (
            <p className="field-error mt-1.5">
              {urlMissing
                ? "A link is required."
                : "This doesn't look like a link yet — check for a typo."}
            </p>
          )}
          {!showUrlError && autofillError && (
            <p className="field-error mt-1.5" role="status">
              {autofillError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="title" className="field-label block">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            maxLength={MAX_TITLE_LENGTH}
            className={`field-input ${showTitleError ? "invalid" : ""}`}
          />
          {showTitleError && (
            <p className="field-error mt-1.5">
              Give it a name — even a rough one. It&apos;s the only thing you
              can&apos;t skip.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4.5">
          <div>
            <label htmlFor="status" className="field-label block">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={initial?.status ?? "saved"}
              className="field-input"
            >
              {config.statuses.map((s) => (
                <option key={s} value={s}>
                  {config.statusLabels[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="deadline" className="field-label block">
              Deadline
            </label>
            <input
              id="deadline"
              name="deadline"
              type="date"
              defaultValue={initial?.deadline ?? ""}
              className="field-input"
            />
          </div>
        </div>

        <div>
          <span className="field-label block">Tags</span>
          <div
            className="flex flex-wrap items-center gap-1.5 rounded"
            style={{ border: "1px solid var(--input-border)", background: "var(--paper)", padding: "9px 11px" }}
          >
            {tags.map((tag) => (
              <span key={tag} className="tag-chip flex items-center gap-1.5">
                {tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  aria-label={`Remove tag ${tag}`}
                  style={{ color: "var(--ink-faint)" }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                  setTags(tags.slice(0, -1));
                }
              }}
              onBlur={addTag}
              maxLength={MAX_TAG_LENGTH}
              disabled={tags.length >= MAX_TAGS}
              placeholder={
                tags.length === 0
                  ? "Add a tag…"
                  : tags.length >= MAX_TAGS
                    ? `${MAX_TAGS} tags is the limit`
                    : ""
              }
              className="min-w-[100px] flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--ink)" }}
            />
          </div>
          <input type="hidden" name="tags" value={tags.join(",")} />
        </div>

        <div>
          <label htmlFor="notes" className="field-label block">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={MAX_NOTES_LENGTH}
            defaultValue={initial?.notes ?? ""}
            className="field-input font-serif"
            style={{ fontSize: 15, lineHeight: 1.6 }}
          />
        </div>

        {state.error && <p className="field-error">{state.error}</p>}

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="pill-btn-primary text-[14px]"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
          <Link href={KIND_ROUTE[kind]} className="pill-btn-secondary text-[14px]">
            Cancel
          </Link>
          {errorCount > 0 && (submitAttempted || touched.url || touched.title) && (
            <span className="font-serif ml-1 text-[13px] italic" style={{ color: "var(--ink-faint)" }}>
              {errorCount === 1 ? "One thing to fix first." : `${errorCount} things to fix first.`}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
