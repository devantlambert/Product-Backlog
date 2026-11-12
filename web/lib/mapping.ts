/**
 * Turns the app's in-memory state into database rows and back.
 *
 * The screens still run on one state object (the same shape as the
 * prototype). The database keeps it as normal tables so it can be queried,
 * secured row by row and edited by more than one person. Any field a table
 * has no column for goes into its `extra` column, so new fields survive a
 * round trip before they get a column of their own.
 */

export type Row = Record<string, unknown>;
export type Tables = {
  projects: Row[];
  dependencies: Row[];
  stage_history: Row[];
  releases: Row[];
  release_activities: Row[];
  release_updates: Row[];
  alerts: Row[];
  settings: Row[];
};
export const TABLES = [
  "projects",
  "dependencies",
  "stage_history",
  "releases",
  "release_activities",
  "release_updates",
  "alerts",
  "settings",
] as const;
export type TableName = (typeof TABLES)[number];

/** The columns that make up each table's primary key. */
export const KEYS: Record<TableName, string[]> = {
  projects: ["id"],
  dependencies: ["project_id", "on_project_id", "on_stage", "then_kind"],
  stage_history: ["key"],
  releases: ["id"],
  release_activities: ["release_id", "id"],
  release_updates: ["key"],
  alerts: ["key"],
  settings: ["key"],
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type State = any;

const PROJECT_COLS: Record<string, string> = {
  id: "id",
  name: "name",
  stage: "stage",
  committed: "committed",
  owner: "owner",
  summary: "summary",
  budget: "budget",
  estimate: "estimate",
  spent: "spent",
  maxDevs: "max_devs",
  progress: "progress",
  releaseId: "release_id",
  deliverables: "deliverables",
};
const RELEASE_COLS: Record<string, string> = { id: "id", name: "name", theme: "theme", date: "date", status: "status" };
const ACT_COLS: Record<string, string> = {
  id: "id",
  team: "team",
  name: "name",
  off: "offset_days",
  status: "status",
  owner: "owner",
  link: "link",
};

/** Lists without their own ids get a stable random key the first time they are saved. */
function keyOf(item: any): string {
  if (!item._k) {
    Object.defineProperty(item, "_k", {
      value: globalThis.crypto.randomUUID(),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return item._k;
}

function split(obj: any, cols: Record<string, string>, skip: string[] = []) {
  const row: Row = {};
  const extra: Row = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (skip.includes(k)) continue;
    if (k in cols) row[cols[k]] = v ?? null;
    else extra[k] = v;
  }
  for (const c of Object.values(cols)) if (!(c in row)) row[c] = null;
  row.extra = extra;
  return row;
}
function join(row: Row, cols: Record<string, string>) {
  const obj: any = { ...((row.extra as Row) ?? {}) };
  for (const [k, c] of Object.entries(cols)) if (row[c] !== null && row[c] !== undefined) obj[k] = row[c];
  return obj;
}

export function toRows(S: State): Tables {
  const t: Tables = {
    projects: [],
    dependencies: [],
    stage_history: [],
    releases: [],
    release_activities: [],
    release_updates: [],
    alerts: [],
    settings: [],
  };
  S.projects.forEach((p: any, rank: number) => {
    const row = split(p, PROJECT_COLS, ["deps", "history"]);
    row.rank = rank;
    t.projects.push(row);
    for (const d of p.deps ?? []) {
      t.dependencies.push({
        project_id: p.id,
        on_project_id: d.id,
        on_stage: d.on,
        then_kind: d.then,
        lag_days: +d.lag || 0,
      });
    }
    (p.history ?? []).forEach((h: any, seq: number) => {
      t.stage_history.push({
        key: keyOf(h),
        project_id: p.id,
        seq,
        date: h.date,
        from_stage: h.from ?? null,
        to_stage: h.to,
        by_name: h.by ?? null,
      });
    });
  });
  for (const r of S.releases ?? []) {
    t.releases.push(split(r, RELEASE_COLS, ["activities", "updates"]));
    for (const a of r.activities ?? []) t.release_activities.push({ ...split(a, ACT_COLS), release_id: r.id });
    (r.updates ?? []).forEach((u: any, seq: number) => {
      t.release_updates.push({ key: keyOf(u), release_id: r.id, seq, date: u.date, by_name: u.by ?? null, msg: u.msg });
    });
  }
  // newest first in the app; seq counts from the newest so order survives a reload
  (S.alerts ?? []).forEach((a: any, seq: number) => {
    const { _k, ...body } = a;
    void _k;
    t.alerts.push({ key: keyOf(a), seq, date: a.date, body });
  });
  t.settings.push(
    { key: "capacity", value: S.capacity },
    { key: "subs", value: S.subs },
    { key: "counters", value: { v: S.v, nextId: S.nextId, nextRelId: S.nextRelId } },
  );
  // a deep copy, so later edits to the live state can't change rows already taken
  return JSON.parse(JSON.stringify(t));
}

export function fromRows(t: Tables): State | null {
  if (!t.projects.length && !t.settings.length) return null;
  const setting = (k: string) => t.settings.find((s) => s.key === k)?.value as any;
  const counters = setting("counters") ?? {};
  const bySeq = (a: Row, b: Row) => (a.seq as number) - (b.seq as number);
  const withKey = (obj: any, k: unknown) => {
    Object.defineProperty(obj, "_k", { value: k, enumerable: true, writable: true, configurable: true });
    return obj;
  };

  const projects = [...t.projects]
    .sort((a, b) => (a.rank as number) - (b.rank as number))
    .map((row) => {
      const p = join(row, PROJECT_COLS);
      p.deps = t.dependencies
        .filter((d) => d.project_id === row.id)
        .map((d) => {
          const dep: any = { id: d.on_project_id, on: d.on_stage, then: d.then_kind };
          if (d.lag_days) dep.lag = d.lag_days;
          return dep;
        });
      p.history = t.stage_history
        .filter((h) => h.project_id === row.id)
        .sort(bySeq)
        .map((h) => {
          const e: any = { date: h.date, to: h.to_stage };
          if (h.from_stage) e.from = h.from_stage;
          if (h.by_name) e.by = h.by_name;
          return withKey(e, h.key);
        });
      return p;
    });
  const releases = [...t.releases]
    .sort((a, b) => (a.id as number) - (b.id as number))
    .map((row) => {
      const r = join(row, RELEASE_COLS);
      r.activities = t.release_activities
        .filter((a) => a.release_id === row.id)
        .sort((a, b) => (a.id as number) - (b.id as number))
        .map((a) => join(a, ACT_COLS));
      r.updates = t.release_updates
        .filter((u) => u.release_id === row.id)
        .sort(bySeq)
        .map((u) => withKey({ date: u.date, by: u.by_name, msg: u.msg }, u.key));
      return r;
    });
  const alerts = [...t.alerts].sort(bySeq).map((a) => withKey({ ...(a.body as Row) }, a.key));
  return {
    v: counters.v ?? 3,
    nextId: counters.nextId ?? Math.max(0, ...projects.map((p: any) => p.id)) + 1,
    nextRelId: counters.nextRelId ?? Math.max(0, ...releases.map((r: any) => r.id)) + 1,
    capacity: setting("capacity") ?? { devs: 10, roadmapPct: 75, uatWeeks: 1 },
    subs: setting("subs") ?? {},
    projects,
    releases,
    alerts,
  };
}

export const rowKey = (table: TableName, row: Row) => KEYS[table].map((k) => String(row[k])).join("|");

/** What to write and delete to move the database from `before` to `after`. */
export function diff(before: Tables, after: Tables) {
  const out: { table: TableName; upsert: Row[]; remove: Row[] }[] = [];
  for (const table of TABLES) {
    const prev = new Map(before[table].map((r) => [rowKey(table, r), JSON.stringify(r)]));
    const next = new Map(after[table].map((r) => [rowKey(table, r), r]));
    const upsert = [...next.entries()].filter(([k, r]) => prev.get(k) !== JSON.stringify(r)).map(([, r]) => r);
    const remove = before[table].filter((r) => !next.has(rowKey(table, r)));
    if (upsert.length || remove.length) out.push({ table, upsert, remove });
  }
  return out;
}
