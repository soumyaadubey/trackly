import { describe, expect, it } from "vitest";
import {
  clampOffsets,
  computeDrawRect,
  coverScale,
  maxOffset,
  outputExtensionFor,
  outputTypeFor,
  type CropInput,
} from "./avatar-crop";

const BOX = 240;

function input(over: Partial<CropInput> = {}): CropInput {
  return {
    naturalWidth: 1000,
    naturalHeight: 1000,
    boxSize: BOX,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    ...over,
  };
}

describe("coverScale", () => {
  it("scales the shorter side to fill the box", () => {
    expect(coverScale(1000, 500, 240)).toBe(240 / 500); // landscape: height fills
    expect(coverScale(500, 1000, 240)).toBe(240 / 500); // portrait: width fills
    expect(coverScale(240, 240, 240)).toBe(1);
  });

  it("does not divide by zero on a degenerate image", () => {
    expect(coverScale(0, 0, 240)).toBe(1);
  });
});

describe("maxOffset", () => {
  it("is zero when the image exactly fills the box", () => {
    expect(maxOffset(240, 240)).toBe(0);
  });

  it("is half the overhang otherwise", () => {
    expect(maxOffset(400, 240)).toBe(80);
  });

  it("never goes negative for an undersized image", () => {
    expect(maxOffset(100, 240)).toBe(0);
  });
});

describe("clampOffsets", () => {
  it("pins a square image at zoom 1 — there is nothing to pan", () => {
    const r = clampOffsets(input({ offsetX: 500, offsetY: -500 }));
    expect(r).toEqual({ offsetX: 0, offsetY: 0 });
  });

  it("allows panning along the long axis of a landscape image", () => {
    // 1000x500 at box 240 -> scale 0.48 -> drawn 480x240. Slack is 120 wide, 0 tall.
    const r = clampOffsets(input({ naturalWidth: 1000, naturalHeight: 500, offsetX: 999, offsetY: 999 }));
    expect(r.offsetX).toBe(120);
    expect(r.offsetY).toBe(0);
  });

  it("allows more panning as zoom increases", () => {
    const atOne = clampOffsets(input({ offsetX: 9999 })).offsetX;
    const atTwo = clampOffsets(input({ zoom: 2, offsetX: 9999 })).offsetX;
    expect(atOne).toBe(0);
    expect(atTwo).toBe(120); // 240*2 drawn, 240 box -> slack 120
  });

  it("clamps symmetrically", () => {
    const pos = clampOffsets(input({ zoom: 2, offsetX: 9999 })).offsetX;
    const neg = clampOffsets(input({ zoom: 2, offsetX: -9999 })).offsetX;
    expect(neg).toBe(-pos);
  });

  it("treats NaN as centred rather than propagating it into the canvas", () => {
    expect(clampOffsets(input({ offsetX: Number.NaN })).offsetX).toBe(0);
  });
});

describe("computeDrawRect", () => {
  it("fills the whole canvas for a centred square image at zoom 1", () => {
    const r = computeDrawRect(input(), 512);
    expect(r).toEqual({ dx: 0, dy: 0, dw: 512, dh: 512 });
  });

  it("centres the overhang of a landscape image", () => {
    // 1000x500 -> drawn 480x240 in a 240 box; at output 512 that is 1024x512,
    // so it should start half a canvas-width to the left.
    const r = computeDrawRect(input({ naturalWidth: 1000, naturalHeight: 500 }), 512);
    expect(r.dw).toBeCloseTo(1024);
    expect(r.dh).toBeCloseTo(512);
    expect(r.dx).toBeCloseTo(-256);
    expect(r.dy).toBeCloseTo(0);
  });

  it("always covers the canvas, whatever the pan and zoom", () => {
    const cases: Partial<CropInput>[] = [
      { naturalWidth: 1600, naturalHeight: 900, zoom: 1 },
      { naturalWidth: 900, naturalHeight: 1600, zoom: 1.7, offsetX: 40, offsetY: -80 },
      { naturalWidth: 300, naturalHeight: 4000, zoom: 3, offsetY: 9999 },
      { naturalWidth: 4000, naturalHeight: 300, zoom: 1.2, offsetX: -9999 },
      { naturalWidth: 240, naturalHeight: 240, zoom: 1 },
    ];
    for (const c of cases) {
      const r = computeDrawRect(input(c), 512);
      // No gap on any edge — this is the property the clamping exists for.
      expect(r.dx).toBeLessThanOrEqual(0.001);
      expect(r.dy).toBeLessThanOrEqual(0.001);
      expect(r.dx + r.dw).toBeGreaterThanOrEqual(512 - 0.001);
      expect(r.dy + r.dh).toBeGreaterThanOrEqual(512 - 0.001);
    }
  });

  it("scales linearly with output size", () => {
    const a = computeDrawRect(input({ naturalWidth: 800, naturalHeight: 600, zoom: 1.5 }), 256);
    const b = computeDrawRect(input({ naturalWidth: 800, naturalHeight: 600, zoom: 1.5 }), 512);
    expect(b.dx).toBeCloseTo(a.dx * 2);
    expect(b.dw).toBeCloseTo(a.dw * 2);
  });
});

describe("outputTypeFor", () => {
  it("keeps alpha-capable sources as PNG", () => {
    expect(outputTypeFor("image/png")).toBe("image/png");
    // A GIF cannot stay animated through a re-encode; PNG is the lossless landing.
    expect(outputTypeFor("image/gif")).toBe("image/png");
  });

  it("encodes photographic sources as JPEG", () => {
    expect(outputTypeFor("image/jpeg")).toBe("image/jpeg");
    expect(outputTypeFor("image/webp")).toBe("image/jpeg");
  });

  it("produces an extension the storage policy accepts", () => {
    // The bucket policy only allows jpg|jpeg|png|gif|webp on the object name.
    expect(["png", "jpg"]).toContain(outputExtensionFor(outputTypeFor("image/png")));
    expect(["png", "jpg"]).toContain(outputExtensionFor(outputTypeFor("image/webp")));
  });
});
