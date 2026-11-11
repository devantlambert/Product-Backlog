# Roadmap: product specification

This is the full specification for a product roadmap tool. It is a single source of truth for an organization's product work: one ranked backlog, stage tracking, budgets, dependencies, forecasts based on capacity, quarterly releases, team deliverables and stage alerts.

A working reference prototype comes with this spec (`reference-prototype.html`). It is a single HTML file with fictional sample data that saves to the browser's local storage. Where this spec and the prototype disagree, this spec wins.

---

## 1. Users and permissions

There are two kinds of users: editors and viewers.

| Role | Can edit | Home screen focus |
|---|---|---|
| Product lead | Everything | Needs attention list, next release |
| Head of development | Everything | Capacity |
| Executives | Nothing | Portfolio budget, what ships next, anything at risk |
| Marketing | Only their own release activities | Upcoming launches, status of marketing hand-offs |
| Support | Only their own release activities | What is about to ship, whether system docs are ready |
| Customer success | Only their own release activities | What is about to ship, so customers can be briefed |

- Viewers never see edit controls. They see read-only text, tags and links instead.
- Each viewer team can update the status, owner and link of release activities that belong to its team (see section 7).
- The prototype has a "Viewing as" switcher to demo each role. In the real app, a user's role comes from their account.

## 2. Stages

There are seven stages, in this order:

| Id | Name | Notes |
|---|---|---|
| intake | Intake | New idea |
| discovery | Discovery | |
| ready | Ready for Dev | |
| dev | In Development | **Active.** "Start" in dependency rules means a project enters this stage. |
| uat | UAT | **Active** |
| released | Released | **Done.** "Finish" in dependency rules means a project reaches this stage. |
| review | Post-release Review | **Done** |

- Moving a project into an active stage automatically makes it Committed (section 3).
- Moving a project to Released or Post-release Review sets its progress to 100%.
- Every stage change is logged in the project's history: date, from, to, and who made the change.
- Every stage change also creates an alert (section 9).
- The stage can be changed from the project panel, from a dropdown in the backlog row, or by dragging a card on the Stages board.

## 3. Backlog

The backlog is one table with three sections:

1. **Committed.** Work being built or planned for the near term. It is forecast first.
2. **Everything else.** Ideas and future work.
3. **Shipped.** Released and in post-release review. This section is not ranked.

Columns, in order:

1. Rank (with a select checkbox and a drag handle)
2. Project (name, owner, and a "waits for X to ship" note)
3. Stage
4. Budget
5. Estimate
6. Budget health
7. Depends on
8. Forecast start
9. Forecast release
10. Release
11. Deliverables

Ranking:

- Editors drag a row to re-rank it, or to move it between Committed and Everything else.
- The arrow keys on the drag handle do the same for keyboard users.
- Dragging is turned off while filters are applied, because the visible order isn't the full order.

Filters (they persist per browser):

- Section: All, Committed, Everything else, Shipped
- Stage
- Forecast start window
- Forecast release window
- Budget health
- Release

Bulk action: tick projects, then choose "Add to release". The options are an existing release or a new quarterly release.

The table should use the full page width so all columns fit on a 1280px-wide screen.

## 4. Budget and estimate

- **All sizing is in developer weeks. There are no dollar figures anywhere.** Values round to 0.5 weeks.
- **Budget** is how much the organization is willing to spend.
- **Estimate** is development's sizing.
- **Spent to date** is the actual effort so far.
- Budget health compares spend with budget:
  - No budget
  - No spend yet
  - Under 90% used (good)
  - 90% or more used (warning)
  - Over budget (bad; shown as "Over by N wk")
- **Forecast size = estimate, falling back to budget when there is no estimate.** The project panel says when the forecast is using the budget.
- A project with neither an estimate nor a budget can't be forecast. It shows "Add an estimate or a budget to forecast" instead of invented dates.
- Each project also has a maximum team size (max devs at once).
- In-flight projects have a progress %. Only the remaining work is forecast.

## 5. Dependencies

A dependency is written as a sentence:

> This project can't **[start | finish]** until **[project]** **[stage condition]** plus **[N] days**.

- **start** means this project enters In Development.
- **finish** means this project is released.
- **Stage condition** can be any of: reaches Discovery, reaches Ready for Dev, starts development, reaches UAT, is released, reaches Post-release Review.
- **plus N days** is an optional wait. For example, "can't start until Project A is released plus 90 days, so we can collect feedback".
- The form puts all the fields on one row. There is no separate "type" field.
- The classic types are labels derived from the combination. They appear as small tags next to saved dependencies:
  - FS: start, after the other is released
  - SS: start, after the other starts development
  - FF: finish, after the other is released
  - SF: finish, after the other starts development
  - Any other combination is labelled "Start at UAT", "Finish at Discovery", and so on.
  - A wait adds "+90d" to the tag.
- In dependency sentences, the chosen parameters are shown in **bold**.
- The project panel lists two things:
  - "This project waits on": its own dependencies.
  - "Projects waiting on this one": the reverse.
  - Editors can remove a dependency from either list.
- Adding a dependency that would create a cycle is refused. So is adding an exact duplicate.
- Deleting a project removes every dependency that points at it.

Data shape: `{ id: <project id>, on: <stage id>, then: 'start' | 'finish', lag?: <days> }`

## 6. Forecasting engine

The forecast is a weekly simulation that starts at the Monday of the current week.

**Settings (Capacity page):**

- Number of developers
- % of their time available for roadmap work
- UAT and release lead time in weeks, which is the gap between development finishing and release (default 1)

Weekly capacity = developers × roadmap %, in developer weeks.

**Order:**

1. In-flight projects (In Development, UAT).
2. Then the ranked list: Committed first, then Everything else, each in rank order.

**Each week:**

1. Hand out capacity in order. A project takes at most `min(remaining capacity, max team size, remaining work)`.
2. A project may not take capacity until every **start**-type dependency is met by that week.
3. When a project's development is done, it becomes "finished" in the first week when every **finish**-type dependency would be met by its release date (finish week + 1 + UAT weeks).
4. Repeat until every project is placed, or up to a 5-year horizon.

**When a dependency is met** (`depWeek`):

- If the other project is already at or past the stage, the condition is met now.
  - With a wait, count the days from the date the other project actually reached that stage (taken from its history), then convert to a week.
- If the stage is at or before In Development, it is met in the other project's forecast start week.
- If the stage is UAT, it is met in the other project's finish week + 1.
- If the stage is Released or later, it is met in its finish week + 1 + UAT weeks.
- A wait adds `ceil(days / 7)` weeks.

**Outputs per project:**

- Forecast start week
- Development finish week
- Release week: `finish + 1 + UAT weeks`
- Flags:
  - in flight
  - waiting on (the dependency that set the start date)
  - release held by a dependency
  - can't be scheduled
  - no size

Every screen reads from one forecast pass, so all dates agree everywhere.

## 7. Releases

A release bundles projects into a dated ship event, normally one per quarter.

- **Default target date:** 14 days before the quarter ends. Name: "Q1 2027 release".
- **Fields:** name, theme (one line), date, status, and a list of team updates.
- **Statuses:** Planning, Scope locked, Released.
- A project belongs to at most one release. Shipped projects can't be added.

**Releases page:**

- Release cards: date, countdown, status, readiness bar, and counts of projects at risk and activities overdue.
- "Suggested bundles": unreleased projects grouped by the quarter their forecast release falls in. One click adds a group to that quarter's release, creating the release if needed.
- "Not in a release yet".

**Release page:**

- **Header:** name, theme, date and status. Editors can edit them inline.
- **Projects table:** each project's stage, forecast ready date and its gap from the release date:
  - "Ready N days early" (good)
  - "Ready N days before" when the gap is under 7 days (tight)
  - "Ready N days late" (at risk)
  - Hand-off statuses for the UAT workbook, marketing hand-off and system docs.
- **Release runway:** one row per team, with every activity drawn as a square on a time axis relative to the release date. There are lines for the release date and today.
  - Square colour shows status: done, in progress, not started, blocked, overdue.
  - **Hovering or focusing a square shows a tooltip** with the activity name, due date (marked if overdue), who is responsible, and status.
- **Team activity cards:** each activity shows its status, due date, owner and a link. A link field gets an **Open** button that opens the link in a new tab.
- **Team updates:** a short message log. Posting one also sends an alert.
- **Delete release:** asks for confirmation first.
- **Alerts:** changing the release date or status posts an alert and a team update automatically.

**Default activity template.** Each new release gets these activities. The offset is in days relative to the release date.

| Team | Activity | Offset |
|---|---|---|
| Release management | Publish the release calendar | -42 |
| Product | Lock the release scope | -35 |
| Marketing | Draft the launch plan | -35 |
| Development | Code freeze | -21 |
| Documentation | Finish system documentation | -14 |
| Development | Build the release candidate | -14 |
| Product | Draft release notes | -14 |
| QA | UAT sign-off for every project | -10 |
| Marketing | Marketing materials ready | -10 |
| Customer Success | Brief customers on what is coming | -10 |
| Documentation | Update help centre articles | -7 |
| Support | Train the support team | -7 |
| Release management | Confirm the rollback plan | -5 |
| Customer Success | Notify key accounts | -3 |
| Product | Go or no-go meeting | -2 |
| Development | Deploy to production | 0 |
| Marketing | Publish the announcement | 0 |
| Release management | Post-release health check | +3 |

- Due date = release date + offset.
- An activity is overdue when it isn't done and its due date has passed.
- Each team has a default owner.

## 8. Project deliverables

Every project has five deliverables. Each has a status (Not started, In progress, Done, Not needed) and a link.

| Deliverable | Team | Needed by |
|---|---|---|
| Problem Statement | Product | Ready for Dev |
| System Documentation | Development | UAT |
| UAT Workbook | QA and Product | UAT |
| Marketing Hand-off | Marketing | Released |
| Post-release Analysis | Product and Analytics | During Post-release Review |

- A deliverable is **overdue** when the project has reached its "needed by" stage and the deliverable isn't Done or Not needed.
- The backlog's Deliverables column shows five small squares in the order above: green for done, amber for in progress, red for overdue, empty for not started, faded for not needed. Hovering a square shows its name and status.
- Link fields get an **Open** button.

## 9. Alerts

- Each role subscribes to the stages it cares about. The subscriptions form a role × stage matrix on the Alerts page. Each role can change its own row, and editors can change any row.
- Sample defaults:

  | Role | Alerted when a project reaches |
  |---|---|
  | Product | Post-release Review |
  | Head of development | Ready for Dev |
  | Executives | In Development, Released |
  | Marketing | UAT, Released |
  | Support | UAT, Released |
  | Customer success | Released, Post-release Review |

- When a project changes stage, an alert is created for every role subscribed to the new stage. A confirmation shows who was alerted, or says nobody is subscribed.
- Release changes (date, status, team updates) alert every role.
- The Alerts page shows a feed filtered to the current role.
- In the real app, alerts should also go out by email or chat.

## 10. Other screens

- **Home:**
  - A pipeline strip with project counts per stage.
  - "Shipping in the next 12 weeks".
  - A next-release panel.
  - A panel specific to each role. Editors get "Needs attention":
    - overdue deliverables
    - no estimate (and whether the forecast is using the budget)
    - no budget
    - over budget
    - estimate over budget
    - can't be scheduled
- **Stages board:**
  - Seven columns. Drag a card to change its stage.
  - Uses the full width; on a 1280px screen all seven columns fit.
- **Timeline:**
  - A Gantt-style chart with one row per ranked project.
  - Development bars are coloured by stage. UAT and release show as a pale bar. In-flight work is striped and starts at the date development actually began.
  - Shipped projects appear in their own section at the bottom, using their real dates from history.
  - Dotted dependency lines run from the middle of one bar to the middle of the next, from the point the dependency is met.
  - Dashed lines mark planned release dates. A red line marks this week.
  - The chart reaches at least 6 months into the past. It opens on this week and has a "Jump to this week" button.
  - Holding the middle mouse button and dragging pans the chart.
- **Capacity:** developers, roadmap %, and UAT weeks settings, plus a weekly utilization chart showing when capacity frees up.
- **Project panel** (a wide side panel, about 1120px):
  - A stage stepper with all seven stages visible.
  - Facts: owner, committed or not, budget, estimate, spent, max team, progress.
  - Summary.
  - The dependency form and both dependency lists.
  - Deliverables table.
  - Release picker.
  - Forecast summary.
  - Stage history.
  - Delete, which asks for confirmation.

## 11. Data model (minimum)

```
Project   { id, name, stage, committed, rank (array order), owner, summary,
            budget, estimate, spent, maxDevs, progress,
            deps: Dependency[], releaseId?,
            deliverables: { ps|sys|uat|mkt|pra: { status, link } },
            history: [{ date, from, to, by }] }
Dependency{ id, on, then, lag? }
Release   { id, name, theme, date, status,
            activities: [{ id, team, name, off, status, owner, link }],
            updates: [{ date, by, msg }] }
Capacity  { devs, roadmapPct, uatWeeks }
Subs      { [roleId]: stageId[] }
Alert     { date, by, roles[], pid?, stage?, rid?, kind?, msg? }
```

Rank is the order of projects within Committed and Everything else. Store it as an explicit sort key in a database.

## 12. Writing and formatting rules

- Sentence case everywhere. No exclamation marks.
- Write dates as `11-Nov-2026` and use non-breaking hyphens so dates never wrap. Show week sizes as `12 wk`.
- Write empty states as plain sentences, such as "Nothing. This project can start whenever capacity allows."
- Apply **your organization's own design system**. The prototype uses a personal visual style that shouldn't be copied.
- Support dark mode.
- The layout must work at phone width with no sideways page scroll. Wide tables may scroll inside their own box.
- Accessibility:
  - Every drag action has a keyboard alternative.
  - Tooltips also appear on keyboard focus.
  - Controls have labels.

## 13. Acceptance checks

1. A new project with a budget of 10 and no estimate is forecast as 10 developer weeks, and the panel says it is using the budget.
2. "B can't start until A is released plus 90 days" moves B's start to A's release week + 13 weeks.
3. An SS dependency lets B start in the same week A starts.
4. A cycle (A waits on B, B waits on A) is refused.
5. Dragging a row from Everything else into Committed re-forecasts it ahead of the rest of Everything else.
6. Moving a project to UAT from the backlog dropdown logs history, alerts Marketing and Support (with the default subscriptions), and marks it Committed.
7. A Marketing viewer can change the status of Marketing's release activities, but not other teams' activities and not projects.
8. Changing a release date posts a team update and an alert.
9. Hovering a runway square shows the activity name, due date, owner and status.
10. The backlog fits all 11 columns at 1280px wide with no sideways scroll.
