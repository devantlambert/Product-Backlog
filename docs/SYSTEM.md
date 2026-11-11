# Roadmap by Dev: system documentation

This document explains how the Roadmap prototype is built, for a developer, another
LLM, or Devan coming back to it later. It describes the code as it is. For what the
product should do (the source of truth for a rebuild), read `handoff/SPEC.md`.

## What it is

A clickable prototype of a product roadmap tool: a ranked backlog, stages, budgets
and estimates in developer weeks, dependencies, a capacity-based forecast, releases
with a team runway, per-project deliverables, role-based views and stage alerts.

Everything is in one file, `prototype/index.html`. There is no build step, no
framework, no server and no database. It runs in any modern browser, uses fictional
sample data, and saves edits to that browser's `localStorage`.

## Repository layout

```
Product-Backlog/
├── README.md               what the tool does, in product terms
├── prototype/
│   └── index.html          the whole app: CSS, HTML shell and JavaScript
├── handoff/
│   ├── README.md           how to hand the spec to another Claude, with a prompt
│   └── SPEC.md             full product specification and acceptance checks
└── docs/
    └── SYSTEM.md           this file
```

The same prototype is published on Devan's portfolio site at
`public/roadmap/index.html` in the `portfolio-site` repo, with a small doctype and
`<meta>` wrapper added. When the prototype changes, copy it there again.

## The single file, top to bottom

| Part | Where | What it holds |
|---|---|---|
| Header comment and `<head>` | first ~30 lines | File overview, Google Fonts link for IBM Plex Sans and Mono. |
| `<style>` | next ~320 lines | Dev brand tokens (light and dark), then styles grouped by screen: app header, home, backlog table, board, timeline, capacity, alerts, drawer, filters, releases. |
| Body shell | ~20 lines before `<script>` | `header.top` (logo, `#nav`, `#role` picker), `main#main` (views render here), footer with "Reset sample data", `#scrim`, `aside#drawer`, `#toast`, `#tip`. |
| `<script>` | the rest (from about line 370) | All behaviour, in the sections below. |

### Script sections, in order

Each section starts with a `// ---------- name ----------` banner.

1. **Reference data**: `STAGES`, `DONE`, `ACTIVE`, `DELIVS`, `DSTATUS`, `ROLES`,
   `DEP_TYPES`, backlog filter options, `VIEWS`.
2. **Sample data**: `seed()` builds 14 fictional projects, capacity, subscriptions
   and an alert feed. Dates are relative to today so the sample never goes stale.
3. **Releases model**: release statuses, teams, `ACT_TEMPLATE` (the standard
   18-activity runway), date helpers, `seedReleases()`.
4. **State**: loads `S` from `localStorage`, upgrades older saves, `save()`, role.
5. **Helpers**: escaping, formatting (`fmt` gives `10-Nov-2026`), week maths,
   `ranked()`, budget pills, deliverable state, cycle detection.
6. **Forecast engine**: `forecast()`, `depWeek()`, `msWeek()`, `relW()`.
7. **Alerts / stage changes**: `setStage()`.
8. **Views**: `vHome`, `vBacklog`, `vBoard`, `vTimeline`, `vCapacity`, `vAlerts`.
9. **Release helpers and views**: `projRisk`, `relStats`, `suggestBundles`,
   `vReleases`, `vRelease`.
10. **Project drawer**: `drawer()`.
11. **Render and routing**: `route()`, `render()`.
12. **Events**: one `click`, one `change` and a few `keydown` listeners on `document`.
13. **Drag and drop**: backlog re-ranking (`placeProject`, `moveBy`) and the stage board.

## Data model

All state is one object, `S`, saved as JSON under the key `roadmap-prototype-v3`.

```js
S = {
  v: 3,                 // data version; a saved blob with another v is replaced by seed()
  nextId: 15,           // next project id
  nextRelId: 3,         // next release id
  capacity: { devs: 10, roadmapPct: 75, uatWeeks: 1 },
  projects: [ Project, ... ],   // ARRAY ORDER IS THE BACKLOG RANK
  releases: [ Release, ... ],
  subs:   { product: ['review'], dev: ['ready'], exec: ['dev','released'], ... },
  alerts: [ Alert, ... ]        // newest first
}
```

**Project**

| Field | Meaning |
|---|---|
| `id`, `name`, `owner`, `summary` | Identity and text. |
| `stage` | One of `intake`, `discovery`, `ready`, `dev`, `uat`, `released`, `review`. |
| `committed` | `true` = Committed section, `false` = Everything else. Entering `dev` or `uat` forces `true`. |
| `budget`, `estimate`, `spent` | Developer weeks. Never dollars. |
| `progress` | Percent of development done. Only used while in `dev` or `uat`. |
| `maxDevs` | Most developers it can use in a week. |
| `deps` | `[{ id, on, then, lag }]`, see Dependencies. |
| `deliverables` | `{ ps, sys, uat, mkt, pra }`, each `{ status: none|prog|done|na, link }`. |
| `history` | `[{ date, from, to, by }]` stage changes, oldest first. Used for "reached on" dates and the timeline's past bars. |
| `releaseId` | Id of the release it's bundled into, or `null`. |

**Release**: `{ id, name, date: 'YYYY-MM-DD', status: planning|locked|released, theme, activities: [Activity], updates: [{date, by, msg}] }`

**Activity**: `{ id, team, name, off, status: todo|prog|done|blocked, owner, link }`.
`off` is days relative to the release date (negative = before), so moving the
release date moves every due date with it.

**Alert**: stage alert `{ date, pid, stage, roles, by }` or release alert
`{ kind: 'release', date, rid, msg, roles, by }`.

Other `localStorage` keys: `roadmap-prototype-v3-role` (who is viewing) and
`roadmap-filters` (backlog filters).

## Rendering model

The app uses a deliberately simple pattern instead of a framework:

1. Every screen is a function (`vHome`, `vBacklog`, ...) that reads `S`, calls
   `forecast()` and returns an HTML string. Views never change state.
2. `render()` picks the view for the current `view`, writes it into `#main`, then
   calls `drawer()` to draw or hide the project panel.
3. Every user change goes through a document-level event listener. The listener
   identifies what was touched by its `data-*` attribute, updates `S`, calls
   `save()` and then `render()`.
4. After a re-render, inputs that were being edited get focus back by id, and the
   timeline keeps its scroll position.

All user text is passed through `esc()` before it goes into HTML.

### Routing

The URL hash is the router (`route()` runs on load and on `hashchange`):

| Hash | Shows |
|---|---|
| `#home`, `#backlog`, `#board`, `#timeline`, `#releases`, `#capacity`, `#alerts` | that view |
| `#release-<id>` | one release (`vRelease`) |
| `#project-<id>` | opens the drawer for that project over the current view |

With no hash, the role's home view is shown.

### Event attributes

| Attribute | Handled in | Does |
|---|---|---|
| `data-open="<id>"` | click | open the project drawer |
| `data-stage-to`, `data-bstage` | click / change | change stage via `setStage()` |
| `data-act="..."` | click | named actions: `close`, `add`, `delete`, `reset`, `adddep`, `newrel`, `relsend`, `reldel`, `bulkrm`, `bulkclear`, `clearbf`, `tltoday` |
| `data-f="<field>"` | change | edit a project field in the drawer |
| `data-dep="<key>"` | change | edit the add-dependency form (`depDraft`) |
| `data-dl`, `data-k` | change | edit a deliverable's status or link |
| `data-cap` | change | edit capacity inputs |
| `data-sub`, `data-stage` | change | toggle an alert subscription |
| `data-bf`, `data-bfsec` | change / click | backlog filters |
| `data-pick`, `data-bulk` | change | bulk select and add to a release |
| `data-rf` | change | edit a release's name, theme, date, status (date and status changes post an update) |
| `data-act-id`, `data-ak` | change | edit a release activity |
| `data-rowdrag`, `data-rowdrop`, `data-secdrop`, `data-grip` | drag / keydown | re-rank the backlog |
| `data-drag`, `data-col` | drag | move a card between stage columns |

## The forecast engine

`forecast()` is the core of the tool. It is a week-by-week simulation and is
cheap enough that every view calls it on every render.

**Inputs**: capacity per week = `devs x roadmapPct / 100` developer weeks. Each open
project's size is its `estimate`, or its `budget` when there is no estimate
(flagged `fromBudget`). Projects with neither can't be forecast (`noSize`).
In-flight projects only need what's left: `size x (1 - progress/100)`.

**Priority order**: projects in `dev` or `uat` first, then the rest in backlog rank
(which is the order of `S.projects`, committed before everything else).

**Each week `w`** (week 0 = the current week, starting Monday; up to 260 weeks):

1. Walk the priority list with the week's capacity.
2. A project that hasn't started waits until every `then: 'start'` dependency is
   met (`depWeek(F, d) <= w`).
3. It takes `min(capacity left, maxDevs, work remaining)`. Its `start` is the first
   week it gets any; `done` is the week its remaining work reaches zero.
4. A project whose development is done gets `finish = w` once every
   `then: 'finish'` dependency would be met by its release week. This step repeats
   until nothing changes, so chains resolve in the same week.
5. Record `used[w]`. Stop once every project has a finish or can't be sized.

**Outputs**: `F[id]` with `start`, `done`, `finish` week numbers and flags
(`inflight`, `unsched`, `waitingOn` (the dependency that set its start),
`heldBy` (the finish dependency that delayed its release)). The release week is
`relW(f) = finish + 1 + uatWeeks`. Week numbers become dates with `wkDate(w)`.

### Dependencies

A dependency is a sentence: *this project can't **start | finish** until **project X**
**reaches stage S**, plus **N days***. Stored as `{ id, then, on, lag }`.

- "Start" means entering In Development. "Finish" means being released.
- `msWeek()` gives the week project X reaches stage S: its forecast start for stages
  up to In Development, `finish + 1` for UAT, `finish + 1 + uatWeeks` for Released
  and later. `-Infinity` means it's already there; `null` means not yet known.
- `depWeek()` adds the lag in whole weeks. If X already passed the stage, the lag is
  counted from the date in X's history when it got there (`reachedOn()`).
- FS / SS / FF / SF are presets for common `on` + `then` pairs; any other stage is a
  "custom stage" gate. The drawer hides projects that would create a cycle
  (`wouldCycle()`).

## Screens

| View | Function | Notes |
|---|---|---|
| Home | `vHome` | Stage pipeline, then role-specific panels: Needs attention (editors), Committed work budget (C-Suite), Upcoming launches with deliverable status (Marketing, Support, CS), Next to ship, Next release, Your alerts. |
| Backlog | `vBacklog` | Committed / Everything else / Shipped sections, filters, bulk add to release, drag or arrow-key ranking (off while filters are on). |
| Stages | `vBoard` | Kanban by stage; drag a card to change stage. |
| Timeline | `vTimeline` | Gantt of week columns: past bars from history, forecast bars for open work, dependency arrows (SVG), release lines, this-week line. Middle-mouse drag pans. |
| Releases | `vReleases` | Release cards, projects not in a release, suggested quarterly bundles. |
| Release | `vRelease` | Editable header, KPIs, projects vs the date, runway swimlane, activities by team, team updates. |
| Capacity | `vCapacity` | Developers, roadmap share, UAT weeks; weekly capacity use chart. |
| Alerts | `vAlerts` | Role x stage subscription matrix and alert history. |
| Project drawer | `drawer` | Stage stepper, facts (forecast, owner, release, section, budget, estimate, spent, health, team size, progress), summary, dependencies both ways, deliverables, history, delete. |

## Rules worth knowing

- **Roles**: Product and Head of Development edit everything. C-Suite, Marketing,
  Support and Customer Success are read-only, except their own alert row and their
  own team's activities on a release (`canTeam()`).
- **Stage changes** (`setStage()`) add a history entry, move a project entering
  development into Committed, and post an alert to every subscribed role.
- **Deliverables** are late when not done and the project has reached the
  deliverable's `lateAt` stage (Problem Statement at Ready for Dev, System
  Documentation and UAT Workbook at UAT, Marketing Hand-off at Released, Post-release
  Analysis during Post-release Review).
- **Budget health**: no budget, no spend yet, under 90% used, 90% or more used, over.
- **Release readiness**: a project is late for a release when its forecast release
  date falls after the release date, and "tight" when within 7 days before it.
- **Writing style** in the UI follows the Dev brand: sentence case, no exclamation
  marks, Canadian spelling, dates as `10-Nov-2026`.

## Styling

The CSS starts with the Dev brand tokens (paper neutrals, slate blue Roadmap accent
`#3A5BA0`, dark `#8FA8DD`, IBM Plex Sans 400/600, 8px radius, 4px tags, borders not
shadows). Dark mode follows the system unless `data-theme` is set on `<html>`. Stage
colours are CSS variables `--s-<stageId>` used through `--sc` on chips, bars and
columns.

## Known quirks

- One branch in the click handler is disabled with `&& false`: the old up/down rank
  buttons, replaced by drag and drop and arrow keys. It's dead code.
- Everything is client-side: two browsers have two separate copies of the data.
  "Reset sample data" in the footer restores the seed.
- The forecast horizon is 260 weeks; anything that can't be placed by then shows as
  "can't be scheduled".

## Moving to a real app

The planned next step is Next.js + Supabase on Vercel. In that build, `S` becomes
database tables (projects, dependencies, deliverables, history, releases,
activities, subscriptions, alerts), `ROLES` comes from sign-in, alerts go out by
email or Slack, and `forecast()` can be lifted almost unchanged into a shared module
since it only reads plain data. `handoff/SPEC.md` section 11 lists the minimum data
model and section 13 the acceptance checks.
