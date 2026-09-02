import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps an ordinary in-app path", () => {
    expect(safeNext("/courses")).toBe("/courses");
    expect(safeNext("/items/abc-123/edit")).toBe("/items/abc-123/edit");
  });

  it("keeps the query string, which is the whole point of preserving the link", () => {
    expect(safeNext("/courses?view=archive")).toBe("/courses?view=archive");
    expect(safeNext("/opportunities?q=hack&page=2")).toBe("/opportunities?q=hack&page=2");
  });

  it("falls back when there is nothing to go back to", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext("/x", "/opportunities")).toBe("/x");
    expect(safeNext(null, "/opportunities")).toBe("/opportunities");
  });

  describe("refuses anything that could leave the site", () => {
    // Each of these is a way an open redirect gets shipped by accident.
    const hostile = [
      ["absolute url", "https://evil.test/phish"],
      ["absolute, http", "http://evil.test"],
      ["protocol-relative", "//evil.test"],
      ["protocol-relative, encoded", "%2F%2Fevil.test"],
      ["backslash pair", "/\\evil.test"],
      ["backslash, encoded", "%2F%5Cevil.test"],
      ["bare relative", "evil.test"],
      ["scheme-ish", "javascript:alert(1)"],
      ["data url", "data:text/html,<script>"],
      ["encoded absolute", "https%3A%2F%2Fevil.test"],
      ["whitespace-prefixed absolute", "  https://evil.test"],
      ["newline injection", "/ok%0D%0ALocation:%20https://evil.test"],
      ["null byte", "/ok%00.evil.test"],
    ] as const;

    for (const [label, input] of hostile) {
      it(label, () => {
        expect(safeNext(input)).toBe("/");
      });
    }
  });

  it("survives a malformed percent-encoding instead of throwing", () => {
    expect(safeNext("%E0%A4%A")).toBe("/");
    expect(safeNext("%")).toBe("/");
  });

  it("normalises to a path plus search, dropping any fragment", () => {
    expect(safeNext("/courses#section")).toBe("/courses");
  });
});
