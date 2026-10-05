// In-memory PostgREST contract fixture. This does not verify real SQL/RLS policies.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

export function createItemsFixture() {
  let items = [];
  let failRestore = false;
  let failReadAt = 0;
  let reads = 0;
  const timestamp = "2025-01-02T03:04:05+00:00";
  return {
    seed(owner, count) {
      items = Array.from({ length: count }, (_, i) => ({
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        user_id: owner, kind: "opportunity", title: `Pagination ${String(i + 1).padStart(4, "0")}`,
        url: "https://example.com", status: "saved", tags: ["fixture"],
        deadline: i < 13 ? "2026-12-01" : null, notes: "Saved notes",
        created_at: timestamp, updated_at: timestamp,
      }));
      reads = 0; failReadAt = 0;
    },
    get rows() { return items; },
    failRestore(value) { failRestore = value; },
    failReadAfter(n) { reads = 0; failReadAt = n; },
    handle(req, res, url, body, owner) {
      function reply(data, status = 200, count = null) {
        res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store",
          ...(count === null ? {} : { "Content-Range": `0-${Math.max(0, (Array.isArray(data) ? data.length : 1) - 1)}/${count}` }) });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify(data));
      }
      if (!owner) return reply({ message: "Unauthorized" }, 401);
      let matching = items.filter((item) => item.user_id === owner);
      for (const [key, value] of url.searchParams) {
        if (value.startsWith("eq.")) matching = matching.filter((item) => String(item[key]) === value.slice(3));
        if (value.startsWith("gt.")) matching = matching.filter((item) => item[key] > value.slice(3));
        if (value === "not.is.null") matching = matching.filter((item) => item[key] !== null);
        if (value.startsWith("in.(")) matching = matching.filter((item) => value.slice(4, -1).split(",").includes(item[key]));
        if (key === "tags" && value.startsWith("cs.")) matching = matching.filter((item) => item.tags.includes(value.slice(4, -1)));
      }
      if (req.method === "POST") {
        if (failRestore) return reply({ code: "XX000", message: "Fixture restore outage" }, 500);
        assert.equal(body.user_id, owner);
        if (items.some((item) => item.id === body.id)) return reply({ code: "23505", message: "Duplicate" }, 409);
        items.push(body);
        return reply(null, 201);
      }
      if (req.method === "DELETE") {
        items = items.filter((item) => !matching.includes(item));
        return reply(req.headers.accept?.includes("vnd.pgrst.object") ? matching[0] ?? null : matching);
      }
      if (req.method === "GET") {
        reads++;
        if (reads === failReadAt) return reply({ code: "XX000", message: "Fixture batch outage" }, 500);
      }
      const order = (url.searchParams.get("order") || "id.asc").split(",");
      matching.sort((a, b) => {
        for (const field of order) {
          const [key, direction, nulls] = field.split(".");
          if (a[key] === b[key]) continue;
          if (a[key] === null) return nulls === "nullsfirst" ? -1 : 1;
          if (b[key] === null) return nulls === "nullsfirst" ? 1 : -1;
          return String(a[key]).localeCompare(String(b[key])) * (direction === "desc" ? -1 : 1);
        }
        return 0;
      });
      const count = matching.length;
      const offset = Number(url.searchParams.get("offset") || 0);
      if (offset && offset >= count) return reply({ code: "PGRST103", message: "Out of range" }, 416, count);
      // Deliberately below the export's requested batch size.
      const limit = Math.min(Number(url.searchParams.get("limit") || 123), 123);
      matching = matching.slice(offset, offset + limit);
      const select = url.searchParams.get("select");
      if (select && select !== "*") matching = matching.map((row) => Object.fromEntries(select.split(",").map((key) => [key, row[key]])));
      return reply(req.headers.accept?.includes("vnd.pgrst.object") ? matching[0] ?? null : matching, 200, count);
    },
  };
}

export async function checkItemsBrowser(page, fixture, owner, origin) {
  fixture.seed(owner, 26);
  await page.goto(`${origin}/opportunities?view=active&status=saved&tag=fixture&page=2`);
  await page.getByRole("button", { name: "Delete Pagination 0026", exact: true }).waitFor();
  const original = { ...fixture.rows[25], title: "Updated in another tab" };
  Object.assign(fixture.rows[25], original);
  // Delete the stale rendered row; the undo snapshot must come from the database.
  await page.getByRole("button", { name: "Delete Pagination 0026", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/opportunities" && !url.searchParams.has("page"));
  for (const [key, value] of Object.entries({ view: "active", status: "saved", tag: "fixture" })) {
    assert.equal(new URL(page.url()).searchParams.get(key), value);
  }
  const undo = page.getByRole("region", { name: "Recently deleted items" });
  await undo.getByText("Deleted “Updated in another tab”.", { exact: true }).waitFor();
  assert.equal(fixture.rows.length, 25);
  fixture.failRestore(true);
  await undo.getByRole("button", { name: "Undo", exact: true }).click();
  await undo.getByRole("alert").waitFor();
  fixture.failRestore(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await undo.getByRole("button", { name: "Undo", exact: true }).focus();
  assert.equal(await undo.getByRole("button", { name: "Undo", exact: true }).evaluate((el) => el === document.activeElement), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mkdir(".next/test-artifacts", { recursive: true });
  await page.screenshot({ path: ".next/test-artifacts/items-undo-mobile.png", fullPage: true });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[aria-label="Recently deleted items"]'));
  assert.deepEqual(fixture.rows.find((item) => item.id === original.id), original);
  await page.getByRole("link", { name: "Next →", exact: true }).click();
  await page.getByRole("button", { name: "Delete Updated in another tab", exact: true }).waitFor();
  console.log("PASS last-page deletion, filter-preserving redirect, persistent undo, retry, keyboard/mobile, timestamps and latest fields");

  // More than the default Supabase row cap, with a smaller fixture cap too.
  fixture.seed(owner, 1207);
  fixture.rows.forEach((item) => { item.deadline = "2026-12-01"; });
  fixture.rows[0].title = '=SUM(1,2) "日本語"';
  const csv = await page.request.get(`${origin}/api/export`);
  assert.equal(csv.status(), 200);
  const text = await csv.text();
  assert.equal(text.trim().split("\r\n").length, 1208);
  assert.ok(text.includes("Pagination 1207"));
  assert.ok(text.includes("'=SUM(1,2)"));
  assert.ok(text.includes('""日本語""'));
  const calendar = await page.request.get(`${origin}/api/calendar`);
  assert.equal(calendar.status(), 200);
  assert.equal(((await calendar.text()).match(/BEGIN:VEVENT/g) || []).length, 1207);
  fixture.failReadAfter(2);
  const failed = await page.request.get(`${origin}/api/export`);
  assert.equal(failed.status(), 500);
  assert.ok((await failed.json()).error);
  fixture.failReadAfter(0);
  fixture.seed(owner, 0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${origin}/profile`);
  console.log("PASS 1,207-row CSV/ICS downloads, formula/Unicode escaping, and no partial download on later-batch failure");
}
