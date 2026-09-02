import { describe, expect, it } from "vitest";
import { decodeEntities } from "./html";

describe("decodeEntities", () => {
  it("decodes the basics", () => {
    expect(decodeEntities("Foo &amp; Bar")).toBe("Foo & Bar");
    expect(decodeEntities("&lt;script&gt;")).toBe("<script>");
    expect(decodeEntities("&quot;quoted&quot;")).toBe('"quoted"');
  });

  it("decodes a real Devpost title", () => {
    // The exact string that came back partially decoded before the entity
    // table was widened: &middot; was left as literal text in the field.
    expect(decodeEntities("New &amp; upcoming hackathons &middot; Devpost")).toBe(
      "New & upcoming hackathons · Devpost",
    );
  });

  it("decodes punctuation that actually appears in page titles", () => {
    expect(decodeEntities("A &ndash; B &mdash; C")).toBe("A – B — C");
    expect(decodeEntities("Don&rsquo;t Stop")).toBe("Don’t Stop");
    expect(decodeEntities("&ldquo;Quoted&rdquo;")).toBe("“Quoted”");
    expect(decodeEntities("Loading&hellip;")).toBe("Loading…");
    expect(decodeEntities("Acme&trade; &copy; 2026")).toBe("Acme™ © 2026");
  });

  it("decodes numeric entities, decimal and hex", () => {
    expect(decodeEntities("&#65;&#66;&#67;")).toBe("ABC");
    expect(decodeEntities("&#x41;&#x42;")).toBe("AB");
    expect(decodeEntities("caf&#233;")).toBe("café");
    expect(decodeEntities("&#8212;")).toBe("—");
  });

  it("handles an entity name's own case before folding it", () => {
    expect(decodeEntities("&amp;")).toBe("&");
    expect(decodeEntities("&AMP;")).toBe("&");
  });

  it("leaves anything it does not recognise alone rather than mangling it", () => {
    expect(decodeEntities("&notarealentity;")).toBe("&notarealentity;");
    expect(decodeEntities("100% & rising")).toBe("100% & rising");
    expect(decodeEntities("a & b")).toBe("a & b");
  });

  it("does not choke on a bare ampersand or an unterminated entity", () => {
    expect(decodeEntities("R&D")).toBe("R&D");
    expect(decodeEntities("&amp")).toBe("&amp");
    expect(decodeEntities("")).toBe("");
  });

  it("decodes several entities in one string", () => {
    expect(decodeEntities("&lt;a&gt; &amp; &lt;b&gt; &middot; end")).toBe("<a> & <b> · end");
  });
});
