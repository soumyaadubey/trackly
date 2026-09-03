/**
 * The width every page's chrome and list content lines up on.
 *
 * A constant rather than a literal repeated in each file. When the landing
 * page was widened by hand, the shared footer kept the old measure and its top
 * rule stopped several hundred pixels short of the content above it — the kind
 * of drift that only shows up once someone looks at the rendered page.
 *
 * Tailwind scans source text for class names it needs to generate, so the
 * literal has to appear somewhere; this file is that somewhere.
 *
 * Narrower measures are deliberate and stay local to the pages that use them:
 * forms sit at `max-w-xl` and legal prose at `max-w-2xl`, because a text input
 * or a paragraph stretched to 1152px is harder to use, not easier.
 */
export const PAGE_MEASURE = "max-w-6xl";
