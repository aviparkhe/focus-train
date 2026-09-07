# Focus Train

A pomodoro timer where a focus session is a train leg. Pick a line, board it, and
the train runs toward the next station in real time. Let it arrive and you earn
points; stop early and the ride is logged as incomplete — honestly, with no
scolding.

Built to the spec in [`focus-train-design-doc.md`](focus-train-design-doc.md). One
self-contained `index.html`: vanilla JS, inline SVG, no build step, no
dependencies, no backend.

| File | What it is |
| --- | --- |
| [`index.html`](index.html) | The whole app — markup, styles and logic in one file |
| [`focus-train-design-doc.md`](focus-train-design-doc.md) | The original spec this was built to |
| [`improve.md`](improve.md) | Roadmap: ambient audio, ride camera, and known defects |
| [`handoff.md`](handoff.md) | Full context: architecture, invariants, decisions and gotchas |

## Run it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000     # → http://localhost:8000
```

## Deploy

**GitHub Pages** — push this folder to a repo, then Settings → Pages → deploy from
branch root. **Vercel** — `vercel deploy` from this folder.

Once deployed, **pick one URL and stay on it.** `localStorage` is scoped per
origin, so history saved at `localhost` will not follow you to a Pages URL. Use
Settings → Export / Import to carry data across origins.

For an app-like window: Safari → Share → *Add to Dock*, or Chrome → *Cast, Save
and Share* → *Install page as app*.

## How it works

**Services and legs.** Five long-distance services on a stylised map of the
continental US, each with a per-leg duration:

| Service | Leg | Route |
| --- | --- | --- |
| Northeast Regional | 25 min | Washington · Philadelphia · New York · Boston |
| Crescent | 45 min | New Orleans · Atlanta · Charlotte · Washington · New York |
| Texas Eagle | 60 min | Houston · Dallas · St. Louis · Chicago |
| Coast Starlight | 75 min | Seattle · Portland · San Francisco · Los Angeles |
| California Zephyr | 90 min | Chicago · Omaha · Denver · Salt Lake City · San Francisco |

Each work session runs *one leg*. During the layover the train sits at the city it
just reached; the next session departs from there. Reach the end of the line and
the following ride starts a fresh run from the origin. Charter runs a dead-straight
transcontinental special at any duration you type, and named charters can be saved
in Settings.

Las Vegas, Phoenix, Nashville, Detroit and Minneapolis appear on the map but no
service calls at them — which is honest, and is roughly how the real network looks.

**The map.** City coordinates are real latitude/longitude, projected at draw time
(equirectangular with a conic-style bow). The coastline, borders and Lake Michigan
are a coarse polygon; the lake is a true hole via `fill-rule="evenodd"`, so Chicago
sits on a shore. Routes are Catmull-Rom curves computed across the whole service and
emitted one leg at a time, which is what keeps the line continuous through each city
instead of kinking at every stop. Every city and every metre of route track is
checked to fall on land.

**Themes.** Seven, switchable in Settings and remembered: Night Service, Daybreak,
Blueprint, Sequoia, Ember, Terminal and Alpine. Everything — map, chrome, heatmap,
charts — is driven off one token set, and the saved theme is applied in the `<head>`
before first paint so there is no flash.

**Points.** 1 point per planned minute, awarded only on a completed ride.
`currentStreak` counts consecutive completed *rides* (not days) and any incomplete
ride resets it to zero.

**Notable implementation choices** (all per the design doc):

- *Timestamps, never ticks.* Elapsed time is always `Date.now() - startedAt`.
  `requestAnimationFrame` only triggers repaints; it never accumulates time.
  Completion and layover end each get their own `setTimeout` so they still fire on
  schedule in a throttled background tab.
- *Leaving the tab is not cheating.* There is deliberately no Page Visibility
  penalty. You are supposed to be working in another app. The only thing measured
  is whether the ride was allowed to finish.
- *Arrival is audible.* A short two-note bell is synthesized with the Web Audio
  API. The `AudioContext` is created on the boarding click to satisfy autoplay
  policy, so arrivals are heard even when the tab is hidden. Browser
  notifications are optional and degrade silently.
- *`rides[]` is the only source of truth.* Points, streaks, counts and the
  activity heatmap are recomputed from the ride log on load, so a bad write can
  never permanently corrupt the numbers. The heatmap groups by **local** calendar
  day derived from stored UTC timestamps.
- *Presets live in code, not storage.* Only `customRoutes` is persisted, so
  shipping a new line reaches existing installs. Stored state is deep-merged over
  `DEFAULTS` on load, and `schemaVersion` leaves room for a real migration.
- *Closing the tab mid-ride is handled.* An in-progress ride is persisted. Reopen
  before its planned end and it resumes in place; reopen after and it is logged
  incomplete — which is the honest default and closes the "start a 90, shut the
  laptop, claim the points tomorrow" exploit.
- `prefers-reduced-motion` is respected: no easing or pulse, and the train updates
  once a second instead of per frame.

## Data

Everything lives in `localStorage` under `focus-train-v1` — one browser, one
origin, no accounts. That is the whole storage story, and it is more fragile than
it looks: clearing site data erases it, and Safari can evict it on its own.
**Export from Settings before you need it.**

## Deliberately not built (v1)

Ambient sounds, real geography or Amtrak data, any backend or sync, leaderboards,
and pause grace periods / ride insurance. Ride-log pruning is also skipped on
purpose — ~200 bytes a ride against a ~5 MB budget is roughly 25,000 rides.
