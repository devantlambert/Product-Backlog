# Roadmap hand-off package

This package lets another Claude rebuild the roadmap tool from scratch.

## What's inside

| File | What it is |
|---|---|
| `SPEC.md` | The full specification: roles, stages, backlog, budgets, dependencies, the forecasting engine, releases, deliverables, alerts, screens, the data model and acceptance checks. |
| `reference-prototype.html` | The working prototype. Open it in any browser to click through it. It uses fictional sample data and saves only to that browser. |
| `README.md` | This file, including the prompt to give your work Claude. |

## How to use it

1. Give your work Claude `SPEC.md` and `reference-prototype.html`. Attach them, or add them to a project.
2. Paste the prompt below, and fill in the parts in brackets.
3. Before anything gets built, check the questions Claude comes back with.

## Prompt to paste

> I want you to rebuild a product roadmap tool for our team. I've attached two files:
>
> - `SPEC.md` is the source of truth for how it should behave.
> - `reference-prototype.html` is a working single-file prototype of the same thing. Open it to see the behaviour and layout. Where the two disagree, follow the spec.
>
> Build it for our environment:
> - Stack and hosting: [e.g. our internal stack, or "suggest one"]
> - Sign-in and roles: [e.g. company SSO; who the editors are; which groups map to Executives, Marketing, Support and Customer success]
> - Alerts delivery: [e.g. email, Slack or Teams channel]
> - Design system: [our design system or component library]. Don't copy the prototype's visual style; it's a personal style.
> - Data: start with an empty backlog and our real team capacity: [number of developers], [% roadmap time], [UAT weeks].
>
> Keep the parts that make it work, exactly as the spec describes:
> - sizing in developer weeks, never dollars
> - the forecast falling back to the budget when there's no estimate
> - dependencies written as a sentence, with any stage and an optional wait in days
> - the weekly capacity simulation
> - quarterly releases with a team runway and per-team activities that viewer teams can update themselves
> - the five deliverables, with overdue rules based on stage
> - stage alerts by role subscription
>
> Before writing code, give me back:
> 1. a short plan,
> 2. the data model for our database,
> 3. any questions where our environment changes the spec.
>
> When it's built, run through the acceptance checks in section 13 of the spec and tell me which ones pass.

## Notes

- The package contains no company information. All the names and projects in the prototype are fictional.
- The prototype's settings, sample projects and releases live only in the browser that opens it. "Reset sample data" in the footer restores them.
