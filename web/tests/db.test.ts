import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { startFakeRest } from "./fake-rest.ts";
import { databaseStore } from "../lib/store.ts";

// Needs a Postgres with supabase/migrations applied. Set TEST_DATABASE_URL to run.
const DB = process.env.TEST_DATABASE_URL;
const strip = (o: unknown) => JSON.parse(JSON.stringify(o, (k, v) => (k === "_k" ? undefined : v)));

function sample() {
  return {
    v: 3, nextId: 3, nextRelId: 2,
    capacity: { devs: 10, roadmapPct: 75, uatWeeks: 1 },
    subs: { product: ["review"] },
    projects: [
      { id: 2, name: "Second", stage: "dev", progress: 40, owner: "Priya S.", budget: 20.5, spent: 5, committed: true, estimate: 18, maxDevs: 3, summary: "S", releaseId: 1,
        deliverables: { ps: { status: "done", link: "https://x" } }, deps: [{ id: 1, on: "released", then: "start", lag: 90 }],
        history: [{ date: "2026-10-01", to: "discovery" }, { date: "2026-11-01", from: "discovery", to: "dev", by: "Product (you)" }] },
      { id: 1, name: "First", stage: "intake", progress: 0, owner: "Jordan K.", budget: 0, spent: 0, committed: false, estimate: 6, maxDevs: 2, summary: "", deliverables: {}, deps: [], history: [] },
    ],
    releases: [{ id: 1, name: "Q4 2026 release", theme: "T", date: "2026-12-17", status: "locked",
      activities: [{ id: 1, team: "QA", name: "UAT sign-off", off: -10, status: "todo", owner: "Tom H.", link: "" }],
      updates: [{ date: "2026-11-02", by: "Product (you)", msg: "Moved" }] }],
    alerts: [{ date: "2026-11-02", pid: 2, stage: "dev", roles: ["exec"], by: "Product (you)" }],
  };
}

let rest: Awaited<ReturnType<typeof startFakeRest>>;
const session = { user: { id: "u1", email: "dev@example.com" } } as never;
const open = async () => databaseStore(createClient(rest.url, "anon-key", { auth: { persistSession: false } }), session, "product", () => {}, () => true);

before(async () => {
  if (!DB) return;
  rest = await startFakeRest(DB);
  await rest.pool.query("truncate public.projects, public.releases, public.alerts, public.settings cascade");
});
after(async () => rest && (await rest.close()));

test("saves to the database and loads back the same state", { skip: !DB }, async () => {
  const first = await open();
  assert.equal(first.initial, null);
  const S = sample();
  first.save(S);
  await first.flushed();
  const second = await open();
  assert.deepEqual(strip(second.initial), strip(S));
});

test("edits, re-ranks and deletes reach the database", { skip: !DB }, async () => {
  const store = await open();
  const S = store.initial;
  S.projects.reverse(); // re-rank
  S.projects.find((p: { id: number }) => p.id === 2).stage = "uat";
  S.projects.find((p: { id: number }) => p.id === 2).history.push({ date: "2026-11-12", from: "dev", to: "uat", by: "x" });
  S.alerts.unshift({ date: "2026-11-12", pid: 2, stage: "uat", roles: ["marketing"], by: "x" });
  S.releases[0].activities[0].status = "done";
  store.save(S);
  await store.flushed();
  let again = (await open()).initial;
  assert.deepEqual(strip(again), strip(S));

  const s2 = await open();
  s2.initial.projects = s2.initial.projects.filter((p: { id: number }) => p.id !== 1);
  s2.initial.projects[0].deps = [];
  s2.save(s2.initial);
  await s2.flushed();
  again = (await open()).initial;
  assert.deepEqual(again.projects.map((p: { id: number }) => p.id), [2]);
  const { rows } = await rest.pool.query("select count(*)::int as n from public.dependencies");
  assert.equal(rows[0].n, 0);
});

test("a viewer's saves are ignored", { skip: !DB }, async () => {
  const viewer = await databaseStore(createClient(rest.url, "anon-key", { auth: { persistSession: false } }), null, null, () => {}, () => true);
  assert.equal(viewer.canEdit(), false);
  const S = viewer.initial;
  S.projects[0].name = "Changed by a viewer";
  viewer.save(S);
  await viewer.flushed();
  assert.notEqual((await open()).initial.projects[0].name, "Changed by a viewer");
});
