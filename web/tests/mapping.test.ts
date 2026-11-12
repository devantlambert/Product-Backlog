import { test } from "node:test";
import assert from "node:assert/strict";
import { toRows, fromRows, diff } from "../lib/mapping.ts";

const strip = (o: unknown) => JSON.parse(JSON.stringify(o, (k, v) => (k === "_k" ? undefined : v)));

function sample() {
  return {
    v: 3,
    nextId: 4,
    nextRelId: 2,
    capacity: { devs: 10, roadmapPct: 75, uatWeeks: 1 },
    subs: { product: ["review"], dev: ["ready"] },
    projects: [
      {
        id: 2, name: "Second", stage: "dev", progress: 40, owner: "Priya S.", budget: 20, spent: 5, committed: true,
        estimate: 18, maxDevs: 3, summary: "S", releaseId: 1, futureField: "kept",
        deliverables: { ps: { status: "done", link: "https://x" } },
        deps: [{ id: 1, on: "released", then: "start", lag: 90 }],
        history: [{ date: "2026-10-01", to: "discovery" }, { date: "2026-11-01", from: "discovery", to: "dev", by: "Product (you)" }],
      },
      {
        id: 1, name: "First", stage: "intake", progress: 0, owner: "Jordan K.", budget: 0, spent: 0, committed: false,
        estimate: 6, maxDevs: 2, summary: "", releaseId: null, deliverables: {}, deps: [], history: [],
      },
    ],
    releases: [
      { id: 1, name: "Q4 2026 release", theme: "T", date: "2026-12-17", status: "locked",
        activities: [{ id: 1, team: "QA", name: "UAT sign-off", off: -10, status: "todo", owner: "Tom H.", link: "" }],
        updates: [{ date: "2026-11-02", by: "Product (you)", msg: "Moved" }] },
    ],
    alerts: [
      { date: "2026-11-02", pid: 2, stage: "dev", roles: ["exec"], by: "Product (you)" },
      { kind: "release", date: "2026-11-01", rid: 1, msg: "m", roles: ["marketing"] },
    ],
  };
}

test("state survives a round trip through the tables", () => {
  const S = sample();
  const back = fromRows(toRows(S));
  const exp = strip(S);
  exp.projects[1].releaseId = undefined; // null columns are dropped on the way back
  assert.deepEqual(strip(back), strip(exp));
});

test("rank follows array order", () => {
  const rows = toRows(sample());
  assert.deepEqual(rows.projects.map((p) => [p.id, p.rank]), [[2, 0], [1, 1]]);
});

test("a reload followed by no edits writes nothing", () => {
  const S = sample();
  const loaded = fromRows(toRows(S));
  assert.deepEqual(diff(toRows(loaded), toRows(loaded)), []);
});

test("list items keep their keys across saves, so only real changes are written", () => {
  const S = sample();
  const first = toRows(S);
  S.projects[0].history.push({ date: "2026-11-12", from: "dev", to: "uat", by: "x" } as never);
  S.alerts.unshift({ date: "2026-11-12", pid: 2, stage: "uat", roles: ["marketing"], by: "x" } as never);
  const changes = diff(first, toRows(S));
  const hist = changes.find((c) => c.table === "stage_history")!;
  assert.equal(hist.upsert.length, 1);
  assert.equal(hist.remove.length, 0);
  const alerts = changes.find((c) => c.table === "alerts")!;
  // the new alert, plus the two older ones whose position moved down by one
  assert.equal(alerts.upsert.length, 3);
  assert.equal(alerts.remove.length, 0);
});

test("deleting a project removes it and its dependencies", () => {
  const S = sample();
  const before = toRows(S);
  S.projects = S.projects.filter((p) => p.id !== 2);
  const changes = diff(before, toRows(S));
  assert.equal(changes.find((c) => c.table === "projects")!.remove.length, 1);
  assert.equal(changes.find((c) => c.table === "dependencies")!.remove.length, 1);
});
