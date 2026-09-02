/**
 * Decode the handful of entities that actually show up in page titles. Titles
 * came back with raw "&amp;" before this, so "Foo &amp; Bar" landed in the
 * field verbatim.
 */
export function decodeEntities(input: string): string {
  // Not the full HTML entity table — just the ones that actually turn up in
  // page titles. Devpost's title alone uses &amp; and &middot;, and with only
  // the first five here it came through as "New &amp; upcoming hackathons
  // &middot; Devpost". Anything unrecognised is left alone rather than mangled.
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    middot: "·",
    bull: "•",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    lsquo: "‘",
    rsquo: "’",
    ldquo: "“",
    rdquo: "”",
    laquo: "«",
    raquo: "»",
    times: "×",
    divide: "÷",
    deg: "°",
    copy: "©",
    reg: "®",
    trade: "™",
    euro: "€",
    pound: "£",
    yen: "¥",
    cent: "¢",
    sect: "§",
    para: "¶",
    dagger: "†",
    permil: "‰",
    prime: "′",
    frac12: "½",
    frac14: "¼",
    frac34: "¾",
    plusmn: "±",
    ne: "≠",
    le: "≤",
    ge: "≥",
    rarr: "→",
    larr: "←",
    harr: "↔",
    "#39": "'",
  };
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/g, (whole, entity: string) => {
    // Named entities are case-sensitive in HTML. Try the literal name first,
    // then fold case, which covers the common sloppy markup.
    if (entity in named) return named[entity];
    const key = entity.toLowerCase();
    if (key in named) return named[key];
    if (key.startsWith("#x")) {
      const code = parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (key.startsWith("#")) {
      const code = parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return whole;
  });
}
