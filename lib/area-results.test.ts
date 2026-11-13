import test, { type TestContext } from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { areaParamOf, areaResultsState, cancelsAreaWrite, urlSyncAction, type LinkClick } from "./area-results.ts";
import { polygonFromParam, type GeoPolygon } from "./geo.ts";
import { translate } from "./i18n/dict.ts";

const A: GeoPolygon = { type: "Polygon", coordinates: [[[49.8, 40.35], [49.9, 40.35], [49.9, 40.42], [49.8, 40.42], [49.8, 40.35]]] };
const B: GeoPolygon = { type: "Polygon", coordinates: [[[49.7, 40.3], [49.75, 40.3], [49.75, 40.33], [49.7, 40.3]]] };

test("areaResultsState: no area selected -> empty (whatever the server rendered)", () => {
  assert.equal(areaResultsState("", ""), "empty");
  assert.equal(areaResultsState("", areaParamOf(A)), "empty"); // cleared on the client: hide the old results at once
});

test("areaResultsState: results only when they belong to the selected area", () => {
  assert.equal(areaResultsState(areaParamOf(A), areaParamOf(A)), "ready");
  assert.equal(areaResultsState(areaParamOf(A), ""), "pending");             // first area drawn, server not done yet
  assert.equal(areaResultsState(areaParamOf(B), areaParamOf(A)), "pending"); // new area: never show the previous area's results
});

test("areaParamOf: '' without a polygon; round-trips through the URL parser (client and server values compare equal)", () => {
  assert.equal(areaParamOf(null), ""); assert.equal(areaParamOf(undefined), "");
  for (const p of [A, B]) {
    const param = areaParamOf(p); const parsed = polygonFromParam(param);
    assert.ok(parsed.ok); if (parsed.ok) assert.equal(areaParamOf(parsed.polygon), param);
  }
});

test("empty-state texts exist in az, ru and en", () => {
  assert.equal(translate("az", "map.empty.title"), "Ərazinizi seçin");
  assert.equal(translate("az", "map.empty.body"), "Xəritədə maraqlandığınız ərazini çəkin. Həmin ərazidəki elanlar burada görünəcək.");
  for (const lang of ["ru", "en"] as const) for (const key of ["map.empty.title", "map.empty.body"]) {
    const v = translate(lang, key); assert.ok(v && v !== key && v !== translate("az", key), `${lang} ${key}`);
  }
});

test("/properties fetches nothing without an area and gates every listing element", () => {
  const page = fs.readFileSync("app/(site)/properties/page.tsx", "utf8");
  assert.ok(!page.includes("listPublished"), "the unfiltered listing query must not run on this page");
  assert.equal(page.match(/listMapProperties\(/g)?.length, 1);
  assert.ok(/if \(polygon\) \{\s*mapResult = await listMapProperties\(f, polygon\);/.test(page), "the only fetch is inside if (polygon)");
  assert.ok(page.includes("<AreaProvider serverParam={areaParam}>"));
  const results = page.slice(page.indexOf("<AreaResults>"), page.indexOf("</AreaResults>"));
  for (const s of ['t("list.count"', "<PropertyCard", 'aria-label={t("page.aria")}', "<ClearAreaLink"]) assert.ok(results.includes(s), `${s} is inside AreaResults`);
  assert.ok(!page.includes("contactPhone"));
});

test("PropertyMap: markers follow the area gate and every area change is published", () => {
  const c = fs.readFileSync("components/PropertyMap.tsx", "utf8");
  assert.ok(c.includes('areaResultsState(areaSelection.clientParam, areaSelection.serverParam) === "ready"'));
  assert.ok(c.includes("if (!showMarkers) return;") && c.includes("}, [items, status, showMarkers]);"));
  assert.ok(c.includes("publishRef.current?.(param);"), "commit() publishes draw / edit / clear immediately");
  assert.ok(!c.includes("contactPhone"));
  const r = fs.readFileSync("components/AreaResults.tsx", "utf8");
  assert.ok(r.includes("useState(serverParam)"), "starts from the server value (no hydration mismatch)");
  assert.ok(!r.includes("contactPhone"));
});

test("urlSyncAction: server rendered the map's area -> in-sync", () => {
  const a = areaParamOf(A);
  assert.equal(urlSyncAction(a, a, new Set([a]), true), "in-sync");
  assert.equal(urlSyncAction("", "", new Set(), false), "in-sync");
});

test("urlSyncAction: late echo of an older own write while a newer write is outstanding -> keep the map's area", () => {
  const a = areaParamOf(A), b = areaParamOf(B);
  assert.equal(urlSyncAction(a, b, new Set([a, b]), true), "ignore-echo"); // drew A, then B; A's response arrives first
  assert.equal(urlSyncAction(a, "", new Set([a, ""]), true), "ignore-echo"); // drew A, then cleared quickly
});

test("urlSyncAction: old own write with nothing outstanding -> apply (never stuck on 'Updating…')", () => {
  const a = areaParamOf(A), b = areaParamOf(B);
  // B's navigation was superseded (e.g. Back) and the URL holds A, which the map wrote earlier: B's response never comes.
  assert.equal(urlSyncAction(a, b, new Set([a, b]), false), "apply");
  const state = areaResultsState(a, a); // after apply the map holds the server's area: results ready, map and list agree
  assert.equal(state, "ready");
});

test("urlSyncAction: real URL changes are applied even while an own write is pending", () => {
  const a = areaParamOf(A), b = areaParamOf(B);
  assert.equal(urlSyncAction("", b, new Set([b]), true), "apply");  // Reset / Buy-Rent link: no area
  assert.equal(urlSyncAction(a, b, new Set([b]), false), "apply");  // shared or hand-edited link
});

test("review fixes: one translated 'limit' notice, pointer-events follow showMarkers, URL sync waits for own navigation", () => {
  const page = fs.readFileSync("app/(site)/properties/page.tsx", "utf8");
  assert.equal(page.match(/mapResult\.truncated &&/g)?.length, 1);
  assert.ok(page.includes('t("map.area.truncated", { n: MAP_LIMIT })') && !page.includes("1000 elanla"));
  const c = fs.readFileSync("components/PropertyMap.tsx", "utf8");
  assert.ok(c.includes("}, [ui, items, status, showMarkers]);"));
  assert.ok(c.includes('if (status !== "ready" || updating) return;') && c.includes("}, [initialParam, status, updating]);"));
  assert.ok(c.includes("urlSyncAction(initialParam, paramRef.current, writtenRef.current, urlPendingRef.current)"));
});

/**
 * Model of PropertyMap's URL sync (commit -> 350 ms delayed write -> server render -> urlSyncAction -> applyExternal),
 * driven with mock timers. Uses the real urlSyncAction / areaResultsState; `cancelOnApply` mirrors the Reset-race fix.
 */
function urlSyncModel(t: TestContext, cancelOnApply: boolean) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const s = { url: "", map: "", client: "", written: new Set<string>(), pending: false, timer: null as ReturnType<typeof setTimeout> | null, writes: [] as string[] };
  const serverRenders = (param: string) => { // a navigation commits: the URL -> map effect runs
    s.url = param;
    const action = urlSyncAction(s.url, s.map, s.written, s.pending);
    if (action === "in-sync") s.written.clear();
    else if (action === "apply") applyExternal(param);
  };
  const applyExternal = (param: string) => {
    if (cancelOnApply) { if (s.timer) clearTimeout(s.timer); s.timer = null; s.pending = false; }
    s.written.clear(); s.map = param; s.client = param;
  };
  const commit = (param: string) => { // draw / edit / clear on the map
    s.map = param; s.written.add(param); s.client = param;
    if (s.timer) clearTimeout(s.timer);
    s.pending = true;
    s.timer = setTimeout(() => { s.timer = null; s.pending = false; s.writes.push(param); serverRenders(param); }, 350);
  };
  return { s, commit, serverRenders };
}

test("Reset during the pending 350 ms write wins: the old area is not written back", (t) => {
  const b = areaParamOf(B);
  const { s, commit, serverRenders } = urlSyncModel(t, true);
  commit(b);                 // user finishes drawing B: URL write scheduled for +350 ms
  t.mock.timers.tick(100);
  serverRenders("");         // Reset (or Buy/Rent link) lands at +100 ms: no area
  t.mock.timers.tick(1000);  // the delayed write would have fired at +350 ms
  assert.deepEqual(s.writes, [], "the cancelled write never runs");
  assert.equal(s.url, ""); assert.equal(s.map, ""); assert.equal(s.pending, false);
  assert.equal(areaResultsState(s.client, s.url), "empty"); // map, URL and results agree: no area, no listings
});

test("control: without cancelling, the delayed write puts the reset area back (the fixed bug)", (t) => {
  const b = areaParamOf(B);
  const { s, commit, serverRenders } = urlSyncModel(t, false);
  commit(b); t.mock.timers.tick(100); serverRenders(""); t.mock.timers.tick(1000);
  assert.deepEqual(s.writes, [b]); assert.equal(s.url, b); assert.equal(s.map, b);
});

test("normal drawing is unaffected: the delayed write runs and results become ready", (t) => {
  const a = areaParamOf(A), b = areaParamOf(B);
  const { s, commit } = urlSyncModel(t, true);
  commit(a); t.mock.timers.tick(200); commit(b); t.mock.timers.tick(350); // edit within the delay: only B is written
  assert.deepEqual(s.writes, [b]); assert.equal(s.url, b); assert.equal(areaResultsState(s.client, s.url), "ready");
});

test("PropertyMap.applyExternal cancels the pending URL write before applying the outside area", () => {
  const c = fs.readFileSync("components/PropertyMap.tsx", "utf8");
  const body = c.slice(c.indexOf("applyExternal(polygon) {"), c.indexOf("if (!draw) return;", c.indexOf("applyExternal(polygon) {")));
  assert.ok(/if \(urlTimer\) \{\s*clearTimeout\(urlTimer\);\s*urlTimer = null;\s*\}\s*urlPendingRef\.current = false;/.test(body));
});

/**
 * Model of the PropertySearch <-> PropertyMap signal ("vh:area-sync") with navigation latency. Navigations follow the
 * App Router rule "the latest started navigation wins" (older results are discarded). Uses the real urlSyncAction /
 * areaResultsState; `signal: false` models the old behaviour (the form navigates without telling the map).
 */
function formSyncModel(t: TestContext, opts: { signal: boolean; ready?: boolean; url?: string }) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const ready = opts.ready ?? true;
  const s = {
    url: opts.url ?? "", map: ready ? opts.url ?? "" : "", client: opts.url ?? "", written: new Set<string>(), pending: false,
    timer: null as ReturnType<typeof setTimeout> | null, seq: 0, navs: [] as { kind: string; poly: string }[],
  };
  const applyExternal = (param: string) => { if (s.timer) clearTimeout(s.timer); s.timer = null; s.pending = false; s.map = param; s.client = param; };
  const serverRenders = (param: string) => {
    s.url = param;
    if (!ready) { s.client = param; return; }
    const action = urlSyncAction(s.url, s.map, s.written, s.pending);
    if (action === "in-sync") s.written.clear();
    else if (action === "apply") { s.written.clear(); applyExternal(param); }
  };
  const navigate = (kind: string, poly: string, latency: number) => {
    const id = ++s.seq; s.navs.push({ kind, poly });
    setTimeout(() => { if (id === s.seq) serverRenders(poly); }, latency);
  };
  const commit = (param: string, latency = 50) => { // draw / edit / clear on the map
    s.map = param; s.written.add(param); s.client = param;
    if (s.timer) clearTimeout(s.timer);
    s.pending = true;
    s.timer = setTimeout(() => { s.timer = null; s.pending = false; navigate("map-write", param, latency); }, 350);
  };
  const onAreaSync = (detail: { reason: "reset" | "submit"; poly?: string }) => { // mirrors PropertyMap's listener
    if (s.timer) clearTimeout(s.timer);
    s.timer = null; s.pending = false;
    if (!ready) return;
    if (detail.reason === "reset") applyExternal(""); else detail.poly = s.map;
  };
  const reset = (latency: number) => { if (opts.signal) onAreaSync({ reason: "reset" }); navigate("reset", "", latency); };
  const submit = (latency: number) => {
    const detail: { reason: "submit"; poly?: string } = { reason: "submit" };
    if (opts.signal) onAreaSync(detail);
    navigate("submit", detail.poly ?? s.url, latency); // no answer: the server's area (initial.polygon), as before
  };
  // Advance in small steps: a timer scheduled inside another timer callback (the delayed write starting its
  // navigation) only runs in a later mock tick.
  const tick = (ms: number) => { for (let left = ms; left > 0; left -= 10) t.mock.timers.tick(Math.min(10, left)); };
  // "Ərazini sil" link above the results (ClearAreaLink): hides the results at once, then navigates without "poly".
  const removeLink = (latency: number) => { s.client = ""; navigate("remove-link", "", latency); };
  // Browser Back/Forward, shared or reloaded link: an outside navigation to `poly`.
  const browse = (poly: string, latency: number) => navigate("browse", poly, latency);
  // A same-site link click (mirrors PropertyMap's capture listener): the real cancelsAreaWrite decides whether the
  // pending write is dropped; then the link navigates to its destination area. `cancel: false` = the old behaviour.
  const linkClick = (click: Partial<LinkClick> & { href: string }, poly: string, latency: number, cancel = true) => {
    const info: LinkClick = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false,
      target: "", download: false, currentHref: HERE, ...click }; // current page: /properties with the area in the URL
    if (cancel && s.timer && cancelsAreaWrite(info)) { clearTimeout(s.timer); s.timer = null; s.pending = false; }
    if (cancelsAreaWrite(info)) navigate("link", poly, latency); // non-navigating clicks start no navigation
  };
  return { s, commit, reset, submit, tick, removeLink, browse, linkClick };
}

test("Reset while the 350 ms write is pending: area cleared at once and never written back", (t) => {
  const b = areaParamOf(B);
  const { s, commit, reset, tick } = formSyncModel(t, { signal: true });
  commit(b); tick(100);
  reset(50); // plain /properties: Reset lands on the URL it is already on
  assert.equal(areaResultsState(s.client, s.url), "empty", "hidden immediately, before Reset's response");
  tick(2000);
  assert.deepEqual(s.navs.map((n) => n.kind), ["reset"], "the delayed write never navigates");
  assert.equal(s.url, ""); assert.equal(s.map, ""); assert.equal(areaResultsState(s.client, s.url), "empty");
});

test("Reset slower than the pending write: Reset still wins", (t) => {
  const a = areaParamOf(A), b = areaParamOf(B);
  const { s, commit, reset, tick } = formSyncModel(t, { signal: true, url: a });
  commit(b); tick(100);
  reset(2000); // the response arrives long after the write would have fired (+350 ms)
  tick(400);
  assert.equal(s.map, ""); assert.equal(areaResultsState(s.client, s.url), "empty", "no stale results while Reset loads");
  tick(3000);
  assert.deepEqual(s.navs.map((n) => n.kind), ["reset"]);
  assert.equal(s.url, ""); assert.equal(s.map, ""); assert.equal(areaResultsState(s.client, s.url), "empty");
});

test("control: without the signal, a slow Reset is overridden by the pending write (the fixed bug)", (t) => {
  const a = areaParamOf(A), b = areaParamOf(B);
  const { s, commit, reset, tick } = formSyncModel(t, { signal: false, url: a });
  commit(b); tick(100); reset(2000); tick(5000);
  assert.equal(s.url, b, "the later map write wins and the reset area comes back");
});

test("filter submit while an area write is pending keeps the latest area; URL, map and results agree", (t) => {
  const a = areaParamOf(A), b = areaParamOf(B);
  const { s, commit, submit, tick } = formSyncModel(t, { signal: true, url: a });
  commit(b); tick(100);
  submit(800); // slower than the pending write
  assert.deepEqual(s.navs, [{ kind: "submit", poly: b }], "the submit carries B, not the server's A");
  tick(2000);
  assert.deepEqual(s.navs.map((n) => n.kind), ["submit"], "the cancelled write does not override the new filters");
  assert.equal(s.url, b); assert.equal(s.map, b); assert.equal(areaResultsState(s.client, s.url), "ready");
});

test("filter submit after a pending clear sends no area; a map that is not ready keeps the server's area", (t) => {
  const a = areaParamOf(A);
  const m1 = formSyncModel(t, { signal: true, url: a });
  m1.commit(""); m1.tick(50); m1.submit(100); m1.tick(1000);
  assert.deepEqual(m1.s.navs, [{ kind: "submit", poly: "" }]); assert.equal(areaResultsState(m1.s.client, m1.s.url), "empty");
  t.mock.timers.reset();
  const m2 = formSyncModel(t, { signal: true, url: a, ready: false });
  m2.submit(100); m2.tick(1000);
  assert.deepEqual(m2.s.navs, [{ kind: "submit", poly: a }], "a map that is not ready does not drop the URL's area");
});

test("normal drawing and editing still write the latest area and show its results", (t) => {
  const a = areaParamOf(A), b = areaParamOf(B);
  const { s, commit, tick } = formSyncModel(t, { signal: true });
  commit(a); tick(200); commit(b); // edit within the delay: only B is written
  tick(350); assert.equal(areaResultsState(s.client, s.url), "pending");
  tick(100);
  assert.deepEqual(s.navs, [{ kind: "map-write", poly: b }]); assert.equal(s.url, b); assert.equal(areaResultsState(s.client, s.url), "ready");
  commit(a); tick(500); // a later edit
  assert.equal(s.url, a); assert.equal(areaResultsState(s.client, s.url), "ready");
});

test("PropertySearch and PropertyMap use the same area-sync signal, in the right order", () => {
  const form = fs.readFileSync("components/PropertySearch.tsx", "utf8"), map = fs.readFileSync("components/PropertyMap.tsx", "utf8");
  const name = (c: string) => /const AREA_SYNC_EVENT = "([^"]+)"/.exec(c)?.[1];
  assert.ok(name(form) && name(form) === name(map));
  const reset = form.slice(form.indexOf("function reset()"), form.indexOf("\n", form.indexOf("function reset()")));
  assert.ok(reset.includes('syncMapArea("reset")') && reset.indexOf('syncMapArea("reset")') < reset.indexOf('r.push("/properties")'));
  const submit = form.slice(form.indexOf("function submit("), form.indexOf("function reset()"));
  assert.ok(submit.indexOf('setErr("")') > -1 && submit.indexOf('setErr("")') < submit.indexOf('syncMapArea("submit")'), "only after validation passed");
  assert.ok(submit.includes('syncMapArea("submit") ?? (initial.polygon ? polygonToParam(initial.polygon) : "")'));
  assert.ok(map.includes("window.addEventListener(AREA_SYNC_EVENT, onAreaSync);") && map.includes("window.removeEventListener(AREA_SYNC_EVENT, onAreaSync);"));
  assert.ok(map.includes("if (apiRef.current !== api) return;") && map.includes('if (detail.reason === "reset") api.applyExternal(null);') && map.includes("else detail.poly = paramRef.current;"));
});

/* Regression: "Ərazini sil" (toolbar Clear and the Remove-area link) must hide every marker and card. Markers use the
   same gate as the cards (PropertyMap: showMarkers === areaResultsState(...) === "ready"), so "results shown" below
   means markers AND cards. */
const shown = (s: { client: string; url: string }) => areaResultsState(s.client, s.url) === "ready";

test("regression 1: selecting an area shows its matching results", (t) => {
  const a = areaParamOf(A);
  const { s, commit, tick } = formSyncModel(t, { signal: true });
  assert.equal(shown(s), false, "no area: no markers, no cards");
  commit(a); tick(200);
  assert.equal(shown(s), false, "while the area's results load: nothing stale");
  tick(300);
  assert.equal(s.url, a); assert.equal(shown(s), true);
});

test("regression 2: clearing the area hides all markers and cards at once (toolbar Clear and Remove-area link)", (t) => {
  const a = areaParamOf(A);
  const m1 = formSyncModel(t, { signal: true, url: a });           // results for A are on screen
  assert.equal(shown(m1.s), true);
  m1.commit("");                                                    // toolbar "Ərazini sil"
  assert.equal(shown(m1.s), false, "hidden before the URL changes");
  m1.tick(1000);
  assert.equal(m1.s.url, ""); assert.equal(m1.s.map, ""); assert.equal(shown(m1.s), false);
  t.mock.timers.reset();
  const m2 = formSyncModel(t, { signal: true, url: a });
  m2.removeLink(800);                                               // results-bar "Ərazini sil" link, slow response
  assert.equal(shown(m2.s), false, "hidden before the server answers");
  m2.tick(2000);
  assert.equal(m2.s.url, ""); assert.equal(m2.s.map, ""); assert.equal(shown(m2.s), false, "map cleared too: URL, map and list agree");
});

test("regression 3: clearing while the area's URL update is pending never brings its results back", (t) => {
  const a = areaParamOf(A), b = areaParamOf(B);
  const { s, commit, tick } = formSyncModel(t, { signal: true, url: a });
  commit(b); tick(100);                                             // drew B: its URL write is still pending
  commit("");                                                       // cleared within the 350 ms delay
  assert.equal(shown(s), false);
  for (let i = 0; i < 20; i++) { tick(100); assert.equal(shown(s), false, `never shown at +${(i + 1) * 100} ms`); }
  assert.deepEqual(s.navs.map((n) => n.poly), [""], "only the clear is written; B is never written");
  assert.equal(s.url, ""); assert.equal(s.map, "");
});

test("regression 4: Back/Forward never leaves stale results visible", (t) => {
  const a = areaParamOf(A);
  const { s, commit, tick, browse } = formSyncModel(t, { signal: true, url: a });
  commit(""); tick(500);                                            // cleared: URL without poly
  assert.equal(shown(s), false);
  browse(a, 300);                                                   // Back to the URL with the area
  assert.equal(shown(s), false, "nothing shown until the area's results arrive");
  tick(400);
  assert.equal(s.map, a); assert.equal(shown(s), true, "area and its results restored together");
  browse("", 300);                                                  // Forward to the cleared URL
  tick(400);
  assert.equal(s.map, ""); assert.equal(shown(s), false, "no markers or cards without an area");
});

test("regression guard: without an area the page renders no listings at all (the committed code fetched all listings)", () => {
  const page = fs.readFileSync("app/(site)/properties/page.tsx", "utf8");
  assert.ok(!page.includes("listPublished") && !page.includes("Promise.all"), "no unfiltered fallback query");
  assert.ok(page.includes("let mapResult = NO_AREA;") && page.includes("<PropertyMap items={mapResult.items}"), "markers come only from the area query");
  const map = fs.readFileSync("components/PropertyMap.tsx", "utf8");
  assert.ok(map.includes("if (!showMarkers) return;"), "markers are drawn only for the selected area's results");
});

/* M1: a same-site link clicked while the map's 350 ms URL write is pending must win. */
const HERE = "https://vizoohome.az/properties?transaction=sale&poly=40.35000,49.80000~40.35000,49.90000~40.42000,49.90000";
const click = (over: Partial<LinkClick> & { href: string | null }): LinkClick => ({
  button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, target: "", download: false,
  currentHref: HERE, ...over,
});

test("cancelsAreaWrite: same-site page navigations cancel the pending write", () => {
  for (const href of [
    "https://vizoohome.az/properties?transaction=rent",       // header Buy/Rent
    "https://vizoohome.az/properties?transaction=sale",       // "Ərazini sil" (same path, no poly)
    "https://vizoohome.az/properties",                         // no-results Reset
    "https://vizoohome.az/properties/some-flat",               // a listing card
    "/properties?transaction=rent&page=2",                     // relative href (pagination)
  ]) assert.equal(cancelsAreaWrite(click({ href })), true, href);
  assert.equal(cancelsAreaWrite(click({ href: "/saved", target: "_self" })), true);
});

test("cancelsAreaWrite: external, new-tab, download, modified and non-navigating clicks are left alone", () => {
  const cases: [string, Partial<LinkClick> & { href: string | null }][] = [
    ["not a link", { href: null }],
    ["external site", { href: "https://wa.me/994000000000" }],
    ["other protocol", { href: "mailto:info@vizoohome.az" }],
    ["tel link", { href: "tel:+994000000000" }],
    ["new tab", { href: "/properties?transaction=rent", target: "_blank" }],
    ["download", { href: "/brochure.pdf", download: true }],
    ["Ctrl", { href: "/properties?transaction=rent", ctrlKey: true }],
    ["Cmd", { href: "/properties?transaction=rent", metaKey: true }],
    ["Shift", { href: "/properties?transaction=rent", shiftKey: true }],
    ["Alt", { href: "/properties?transaction=rent", altKey: true }],
    ["middle button", { href: "/properties?transaction=rent", button: 1 }],
    ["already prevented", { href: "/properties?transaction=rent", defaultPrevented: true }],
    ["hash only (skip link)", { href: `${HERE}#main` }],
    ["same page URL", { href: HERE }],
    ["unparsable href", { href: "http://[bad" }],
  ];
  for (const [name, over] of cases) assert.equal(cancelsAreaWrite(click(over)), false, name);
});

test("M1: header Buy/Rent clicked right after drawing wins, even when its page loads slowly", (t) => {
  const a = areaParamOf(A), b = areaParamOf(B);
  const { s, commit, tick, linkClick } = formSyncModel(t, { signal: true, url: a });
  commit(b); tick(100);                                             // B's URL write pending (fires at +350 ms)
  linkClick({ href: "/properties?transaction=rent" }, "", 2000);    // destination has no area
  tick(3000);
  assert.deepEqual(s.navs.map((n) => n.kind), ["link"], "the map's write never navigates");
  assert.equal(s.url, ""); assert.equal(s.map, ""); assert.equal(shown(s), false, "destination decides: no area, no listings");
});

test("M1: 'Ərazini sil' link right after an edit: hidden at once, area not restored, URL/map/list agree", (t) => {
  const a = areaParamOf(A), b = areaParamOf(B);
  const { s, commit, tick, linkClick } = formSyncModel(t, { signal: true, url: a });
  commit(b); tick(100);
  // One click: ClearAreaLink's handler hides the results, and the capture listener sees a same-site link navigation.
  s.client = "";
  linkClick({ href: "/properties?transaction=sale" }, "", 1500);
  assert.equal(shown(s), false);
  tick(3000);
  assert.deepEqual(s.navs.map((n) => n.kind), ["link"]);
  assert.equal(s.url, ""); assert.equal(s.map, ""); assert.equal(shown(s), false);
});

test("M1: a link whose destination keeps an area makes the map follow that area (destination decides)", (t) => {
  const a = areaParamOf(A), b = areaParamOf(B);
  const { s, commit, tick, linkClick } = formSyncModel(t, { signal: true, url: a });
  commit(b); tick(100);
  linkClick({ href: "/properties?transaction=sale&page=2" }, a, 1000); // e.g. pagination rendered for area A
  tick(400); assert.equal(shown(s), false, "B's results were never rendered: nothing stale");
  tick(2000);
  assert.equal(s.url, a); assert.equal(s.map, a); assert.equal(shown(s), true);
});

test("M1 control: without cancelling, the pending write overrides the link (the fixed bug)", (t) => {
  const a = areaParamOf(A), b = areaParamOf(B);
  const { s, commit, tick, linkClick } = formSyncModel(t, { signal: true, url: a });
  commit(b); tick(100); linkClick({ href: "/properties?transaction=rent" }, "", 2000, false); tick(3000);
  assert.equal(s.url, b, "the later map write wins and the link's navigation is lost");
});

test("M1: non-navigating clicks keep the pending write (the drawn area is still written)", (t) => {
  const b = areaParamOf(B);
  for (const over of [{ href: `${HERE}#main` }, { href: "/properties?transaction=rent", ctrlKey: true }, { href: "https://wa.me/1" }]) {
    const m = formSyncModel(t, { signal: true });
    m.commit(b); m.tick(100); m.linkClick(over, "", 500); m.tick(1000);
    assert.equal(m.s.url, b, JSON.stringify(over)); assert.equal(shown(m.s), true);
    t.mock.timers.reset();
  }
});

test("M1: PropertyMap registers the link listener in the capture phase, removes it, and never clears the area there", () => {
  const map = fs.readFileSync("components/PropertyMap.tsx", "utf8");
  assert.ok(map.includes('window.addEventListener("click", onLinkClick, true);') && map.includes('window.removeEventListener("click", onLinkClick, true);'));
  const body = map.slice(map.indexOf("function onLinkClick("), map.indexOf('window.addEventListener("click", onLinkClick, true);'));
  assert.ok(body.includes("cancelsAreaWrite(") && body.includes("clearTimeout(urlTimer);") && body.includes("urlPendingRef.current = false;"));
  assert.ok(!/applyExternal|commit\(|publishRef|setArea/.test(body), "the destination page decides the area");
});
