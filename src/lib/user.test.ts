import { describe, expect, it } from "vitest";
import { displayName, initialsFor } from "./user";

describe("initialsFor", () => {
  it("uses first and last name initials when present", () => {
    expect(initialsFor("Ada", "Lovelace", "ada@example.com")).toBe("AL");
  });

  it("falls back to the email's first letter with no name", () => {
    expect(initialsFor("", "", "ada@example.com")).toBe("A");
  });

  it("returns '?' when nothing is available", () => {
    expect(initialsFor("", "", "")).toBe("?");
  });
});

describe("displayName", () => {
  it("joins first and last name", () => {
    expect(displayName("Ada", "Lovelace", "ada@example.com")).toBe("Ada Lovelace");
  });

  it("falls back to email when no name is set", () => {
    expect(displayName("", "", "ada@example.com")).toBe("ada@example.com");
  });
});
