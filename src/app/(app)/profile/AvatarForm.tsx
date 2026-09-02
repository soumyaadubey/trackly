"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { updateAvatar, type ProfileState } from "./actions";
import {
  clampOffsets,
  computeDrawRect,
  coverScale,
  outputExtensionFor,
  outputTypeFor,
} from "@/lib/avatar-crop";
import { ALLOWED_AVATAR_TYPES, AVATAR_TYPES_LABEL, MAX_AVATAR_BYTES } from "@/lib/avatar";

const initialState: ProfileState = { error: null, success: false };

/**
 * Side of the square crop viewport, in CSS pixels. Only on screen while a photo
 * is actually being framed — the idle panel shows AVATAR_SIZE instead, so the
 * Photo section stays the same height as Name and Email rather than towering
 * over them.
 */
const BOX = 200;
/** The resting avatar preview. */
const AVATAR_SIZE = 72;
/** Side of the stored image. Square, so avatars are never distorted by CSS. */
const OUTPUT = 512;
const MAX_ZOOM = 3;

export default function AvatarForm({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null;
  initials: string;
}) {
  const [state, formAction, pending] = useActionState(updateAvatar, initialState);

  const [src, setSrc] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<string>("image/jpeg");
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [localError, setLocalError] = useState<string | null>(null);
  // The freshly cropped image, shown until the server-rendered avatarUrl catches up.
  const [preview, setPreview] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Object URLs are held in refs, not revoked from an effect keyed on the URL.
  //
  // The obvious `useEffect(() => () => revoke(src), [src])` is a trap: React
  // StrictMode (on by default in Next dev) runs every effect mount → cleanup →
  // mount, so the cleanup revoked the blob immediately after it was created.
  // The <img> then pointed at a dead URL, onLoad never fired, and the editor
  // rendered an empty box with Save disabled.
  const srcUrlRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  function revokeSrc() {
    if (srcUrlRef.current) {
      URL.revokeObjectURL(srcUrlRef.current);
      srcUrlRef.current = null;
    }
  }

  // Mount-only, so StrictMode's simulated remount happens while both refs are
  // still null and cannot revoke anything real.
  useEffect(() => {
    return () => {
      if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function reset() {
    revokeSrc();
    setSrc(null);
    setNatural({ width: 0, height: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function onPick(file: File | undefined) {
    setLocalError(null);
    if (!file) return;

    // Mirrors the server action and the bucket, so the user finds out here
    // rather than after a round-trip.
    if (!(ALLOWED_AVATAR_TYPES as readonly string[]).includes(file.type)) {
      setLocalError(`That file type isn't supported. Use ${AVATAR_TYPES_LABEL}.`);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setLocalError("That image is over 2MB. Pick a smaller one.");
      return;
    }

    revokeSrc();
    const url = URL.createObjectURL(file);

    // Decode first, then render. Learning the dimensions up front means the
    // <img> is never mounted at zero size and the editor does not depend on a
    // load event firing on an element React may have already reconciled. It
    // also gives a real failure path for a file that is not a decodable image.
    const probe = new Image();
    probe.onload = () => {
      srcUrlRef.current = url;
      setNatural({ width: probe.naturalWidth, height: probe.naturalHeight });
      setSourceType(file.type);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setSrc(url);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setLocalError("That file couldn't be read as an image.");
    };
    probe.src = url;
  }

  function clampNow(next: { x: number; y: number }, nextZoom = zoom) {
    const { offsetX, offsetY } = clampOffsets({
      naturalWidth: natural.width,
      naturalHeight: natural.height,
      boxSize: BOX,
      zoom: nextZoom,
      offsetX: next.x,
      offsetY: next.y,
    });
    return { x: offsetX, y: offsetY };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!src) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragging.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragging.current;
    if (!d) return;
    setOffset(
      clampNow({
        x: d.originX + (e.clientX - d.startX),
        y: d.originY + (e.clientY - d.startY),
      }),
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    dragging.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  /**
   * Arrow keys pan the image while the crop area is focused.
   *
   * This started life as four on-screen nudge buttons, which no real avatar
   * cropper has — they were visual clutter standing in for something the crop
   * area should just do itself. Shift moves in larger steps.
   */
  function onKeyDown(e: React.KeyboardEvent) {
    if (!src) return;
    const step = e.shiftKey ? 20 : 5;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[e.key];
    if (!move) return;
    e.preventDefault();
    setOffset((o) => clampNow({ x: o.x + move[0], y: o.y + move[1] }));
  }

  function onZoom(next: number) {
    const clamped = Math.min(MAX_ZOOM, Math.max(1, next));
    setZoom(clamped);
    setOffset((o) => clampNow(o, clamped));
  }

  // Scroll-to-zoom has to be a manual listener: React registers `wheel` as a
  // passive listener, so preventDefault() inside an onWheel prop is ignored and
  // the page scrolls behind the cropper. Deps include zoom and the natural size
  // so the handler never closes over stale values.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !src) return;
    function handle(e: WheelEvent) {
      e.preventDefault();
      onZoom(zoom - e.deltaY * 0.002);
    }
    el.addEventListener("wheel", handle, { passive: false });
    return () => el.removeEventListener("wheel", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, zoom, natural.width, natural.height]);

  async function save() {
    const img = imgRef.current;
    if (!img || !src) return;
    setLocalError(null);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setLocalError("Couldn't process that image in this browser.");
      return;
    }

    const type = outputTypeFor(sourceType);
    if (type === "image/jpeg") {
      // JPEG has no alpha; without this, transparent areas render black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    }

    const rect = computeDrawRect(
      {
        naturalWidth: natural.width,
        naturalHeight: natural.height,
        boxSize: BOX,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
      },
      OUTPUT,
    );
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, rect.dx, rect.dy, rect.dw, rect.dh);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, 0.92),
    );
    if (!blob) {
      setLocalError("Couldn't process that image. Try a different file.");
      return;
    }

    const cropped = new File([blob], `avatar.${outputExtensionFor(type)}`, { type });
    const data = new FormData();
    data.set("avatar", cropped);

    // Close the editor and show the crop straight away, rather than waiting for
    // an effect to notice the action succeeded. The server's copy replaces this
    // on the next render; until then the user sees what they just chose instead
    // of the old avatar.
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(blob);
    setPreview(previewUrlRef.current);
    reset();

    startTransition(() => formAction(data));
  }

  const scale = coverScale(natural.width, natural.height, BOX) * zoom;
  const editing = Boolean(src);

  return (
    <div className="space-y-4">
      <div className={`flex gap-5 ${editing ? "items-start" : "items-center"}`}>
        {editing ? (
          <div
            ref={boxRef}
            className="avatar-crop-box shrink-0"
            style={{ width: BOX, height: BOX, borderRadius: 12 }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            tabIndex={0}
            role="application"
            aria-label="Reposition photo. Arrow keys to move."
          >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={src!}
                alt=""
                draggable={false}
                // Dimensions are already known from the decode in onPick, so
                // this is only a backstop for a URL going bad underneath us.
                onError={() => {
                  setLocalError("That image couldn't be displayed. Try another file.");
                  reset();
                }}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: natural.width * scale,
                  height: natural.height * scale,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  maxWidth: "none",
                  userSelect: "none",
                }}
              />
            {/* Shows the circle the avatar will actually be seen through. */}
            <div className="avatar-crop-mask" aria-hidden />
          </div>
        ) : (
          <div
            className="shrink-0 overflow-hidden rounded-full"
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              border: "1px solid var(--border)",
            }}
          >
            {(preview ?? avatarUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(preview ?? avatarUrl)!} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="avatar-circle flex h-full w-full items-center justify-center text-xl font-medium">
                {initials}
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          {/* The native control renders "Choose file / No file chosen" in the
              browser's own styling, which sits oddly in a designed page. The
              input is hidden and the label is the button. */}
          <input
            id="avatar-file"
            type="file"
            name="avatar"
            accept={ALLOWED_AVATAR_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => {
              onPick(e.target.files?.[0]);
              // Allow re-picking the same file after a cancel.
              e.target.value = "";
            }}
          />
          <label htmlFor="avatar-file" className="pill-btn-secondary inline-block cursor-pointer text-[13px]">
            {editing || preview || avatarUrl ? "Choose a different photo" : "Choose a photo"}
          </label>

          {editing && (
            <div className="space-y-2.5">
              <div>
                <label htmlFor="avatar-zoom" className="field-label block">
                  Zoom
                </label>
                <input
                  id="avatar-zoom"
                  type="range"
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => onZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <p className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
                Drag to reposition. Scroll to zoom.
              </p>
            </div>
          )}

          {!editing && (
            <p className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
              {AVATAR_TYPES_LABEL}. Up to 2MB.
            </p>
          )}

          <div className="flex items-center gap-3">
            {editing && (
              <>
                <button
                  type="button"
                  onClick={save}
                  disabled={pending || natural.width === 0}
                  className="pill-btn-primary text-[13px]"
                >
                  {pending ? "Uploading…" : "Save photo"}
                </button>
                <button type="button" onClick={reset} className="pill-btn-secondary text-[13px]">
                  Cancel
                </button>
              </>
            )}
            {localError && <p className="field-error">{localError}</p>}
            {!localError && state.error && <p className="field-error">{state.error}</p>}
            {!localError && state.success && !editing && (
              <p className="text-sm" style={{ color: "var(--ink)" }}>
                Updated.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
