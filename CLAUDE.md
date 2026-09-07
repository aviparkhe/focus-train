# Focus Train — project context

Everything a session needs to pick this up cold; Claude Code loads this file
automatically. Written 2026-09-07, at the end of the session that built it.

---

## 1. What this is

A pomodoro timer where a focus session is one leg of an Amtrak-style train
journey across a stylised map of the United States. Board a service, let it run
to the next city to earn points, stop early and the ride is logged as incomplete
— honestly, with no scolding.

Built in one session from [`focus-train-design-doc.md`](focus-train-design-doc.md),
which the user supplied. **That doc is the contract.** Several of its rules are
non-obvious and load-bearing; §4 below lists the ones a fresh session is most
likely to break by accident.

## 2. Where everything is

| | |
|---|---|
| Local | `/Users/avi/Desktop/focus train app` |
| Repo | https://github.com/aviparkhe/focus-train (**public**, branch `main`) |
| Live | https://aviparkhe.github.io/focus-train/ (Pages, `main` / root) |
| Local test server | `python3 -m http.server 8777` in the project dir |

Files: `index.html` (the entire app, ~1,708 lines), `README.md`,
`focus-train-design-doc.md` (the original spec), `improve.md` (roadmap),
`CLAUDE.md` (this file), `.gitignore`, `.nojekyll`.

**Git identity is set repo-locally, not globally** — `avi` /
`87142762+aviparkhe@users.noreply.github.com`. The noreply address is deliberate:
the repo is public and this keeps the user's personal Gmail out of permanent
commit metadata. Don't "fix" it to the real address without being asked.

`.gitignore` excludes `focus-train-*.json` so an exported ride history never
lands in the public repo by accident.

## 3. How the session went (so you don't re-litigate settled decisions)

1. Read the design doc, built v1: single `index.html`, **fictional transit map**
   (invented lines like "Coastal Line", stations like "Kestrel Bay") in a
   metro/subway visual style — 45°/90° geometry, thick strokes, rounded joins.
2. User redirected on three points, and this is the current design:
   - **Make it a real US map** with real cities, from an explicit allow-list.
   - **Amtrak-style continental network, not a metro/transit diagram.**
   - **Add multiple themes**, not just dark-with-yellow.
3. Rebuilt the map layer and added theming via targeted edits.
4. Wrote `improve.md` (roadmap) while the user test-ran the app.
5. Initialised git, pushed, enabled GitHub Pages, verified the live deploy.

The user's city allow-list (do not add cities outside it without asking):
Seattle, Portland, San Francisco, Los Angeles, Phoenix, Salt Lake City,
Las Vegas, Dallas, Houston, St. Louis, Detroit, Chicago, Minneapolis, Denver,
Omaha, New Orleans, Nashville, Atlanta, Charlotte, Washington DC, Philadelphia,
New York, Boston. All 23 are on the map; 18 are served by a route and 5
(Las Vegas, Phoenix, Nashville, Detroit, Minneapolis) are deliberately drawn as
plain unserved dots, which is roughly true of the real network.

## 4. Rules that must not be broken

These come from the design doc and are the whole reason the app works. Each one
is easy to "helpfully" undo.

- **The timer is timestamp-based, never tick-accumulated.** Elapsed is always
  `Date.now() - startedAt`. `requestAnimationFrame` only triggers repaints; it
  never adds up time. Browsers throttle background tabs hard, and this app runs
  in a background tab essentially 100% of the time.
- **Never penalise leaving the tab.** There is no Page Visibility "cheat
  detection" and there must not be — the user is *supposed* to be working in
  another app. Focus is measured solely by whether the ride was allowed to
  finish. The `visibilitychange` handler only re-syncs the display.
- **Completion and layover-end each get their own `setTimeout`.** A throttled
  tab's repaint poll is not a reliable clock; the timers are.
- **`rides[]` is the single source of truth.** Points, streaks, counts and the
  heatmap are recomputed from the log on every load (`computeStats()`), never
  trusted from stored counters. `stats` is a cache only.
- **Preset routes live in code, not in storage.** Only `customRoutes` is
  persisted. Seeding presets into `localStorage` would freeze existing installs
  on an old route list.
- **Deep-merge stored state over `DEFAULTS` on load.** This is what lets new
  settings keys ship without migrations.
- **`activeRide` is persisted.** On load: still inside its window → resume in
  place (they refreshed); window already passed → log **incomplete**. The second
  case is the honest default and closes the "start a 90, shut the laptop, claim
  the points tomorrow" exploit.
- **Heatmap groups by local calendar day** derived from stored UTC, not by the
  raw UTC date string.
- **Any manual stop before zero is incomplete.** No pause, no grace period, no
  ride insurance — the doc rules these out explicitly.
- **Audio must be created on the boarding click** (autoplay policy), which is why
  `ensureAudio()` is called from `board()`.
- Respect `prefers-reduced-motion`.

## 5. Architecture

Single self-contained `index.html`: vanilla JS, inline SVG, inline CSS. No build
step, no npm, no framework, no dependencies, no backend. Keep it that way.

The `<script>` is divided into numbered sections. Current map (line numbers drift
— grep the section banners):

| § | Contents | Key functions |
|---|---|---|
| 1 | Constants, projection, geography, services, themes | `project()`, `US_OUTLINE`, `LAKE_MICHIGAN`, `CITIES`, `ROUTES`, `CHARTER`, `THEMES`, `DEFAULTS` |
| 2 | Storage | `clone`, `deepMerge`, `load`, `save` |
| 3 | Derived stats | `computeStats`, `dayKey`, `dailyMinutes` |
| 4 | Route helpers | `allRoutes`, `routeById`, `standingAt`, `legIndex`, `stopName`, `routeMinutes`, `clampMin` |
| 5 | Map geometry & drawing | `routeGeometry`, `el`, `buildMap` |
| 6 | Audio | `ensureAudio`, `tone`, `chime`, `notify`, `askNotify` |
| 7 | Ride lifecycle | `phase`, `rideEnd`, `select`, `board`, `scheduleCompletion`, `scheduleBreakEnd`, `complete`, `stopRide`, `skipBreak`, `endBreak`, `resolveOnLoad` |
| 8 | Formatting | `fmtClock`, `fmtDur`, `esc`, `showToast` |
| 9 | Render — map | `renderMap`, `paint` |
| 10 | Render — console | `nextStopText`, `renderConsole`, `renderBoard`, `renderRide`, `updateClock`, `renderHeader`, `renderAll`, `applyTheme` |
| 11 | Panels | `openPanel`, `closePanels`, `renderStats`, `renderSettings` |
| 12 | Export / import | `exportData`, `importData` |
| 13 | Paint loop + visibility | `loop`, `startLoop`, `stopLoop` |
| 14 | Boot | |

### Data model (`localStorage` key `focus-train-v1`)

```js
{ schemaVersion:1,
  settings:{ breakMinutes, longBreakMinutes, roundsUntilLongBreak,
             chimeEnabled, notifyEnabled, charterMinutes, theme },
  customRoutes:[{id,name,minutes}],
  activeRide:{id,routeId,legIndex,plannedMinutes,startedAt} | null,
  activeBreak:{kind,routeId,endsAt} | null,
  journey:{ [routeId]: cityIndexStandingAt },
  round: <completed legs since last long break>,
  rides:[{id,routeId,legIndex,plannedMinutes,actualSeconds,
          completed,pointsEarned,startedAt,endedAt,unverified?}],
  stats:{ ... }   // cache; always rebuildable from rides[]
}
```

### Journey semantics — subtle, got this wrong once already

- `db.journey[routeId]` is the **city index the train is standing at**, 0-based.
- `standingAt(route)` clamps it to a valid index; `paint()` uses it to park the
  train (at the terminus it parks at the *far end* of the last leg).
- `legIndex(route)` is which leg the **next** ride runs. At the end of the line it
  returns 0 — **the wrap happens on departure, not on arrival**, so the train
  visibly waits at the terminus instead of teleporting home mid-layover.
- `complete()` sets `journey = legIndex + 1` with no wrap.
- An incomplete ride does **not** advance the journey.

### Map rendering

- Cities are real lat/lon; `project()` is equirectangular with a small conic-style
  bow (`PROJ.bow`) applied symmetrically about lon −96.
- `US_OUTLINE` is a coarse lat/lon polygon. `LAKE_MICHIGAN` is a second subpath
  with `fill-rule="evenodd"`, making it a true hole so Chicago sits on a shore.
  The lake is deliberately **exaggerated** — at true scale it renders as a
  hairline crack.
- Routes are Catmull-Rom curves. `routeGeometry()` computes control points across
  the **whole** service, then emits one path per leg. Doing it route-wide is what
  keeps the curve continuous through each city instead of kinking at every stop.
  Per-leg paths are required because progress uses `stroke-dasharray` on the
  active leg.
- Charter has `straight:true` → straight `L` segments, rendered dashed, and it is
  hidden entirely unless selected.
- Label placement per city via `la` (`above`/`below`/`left`/`right`) plus optional
  `dx`/`dy`. The Northeast Corridor is cramped and its offsets are hand-tuned.

### Theming

Seven themes as CSS custom-property sets on `:root[data-theme="…"]`: `night`
(default), `daybreak`, `blueprint`, `sequoia`, `ember`, `terminal`, `alpine`.
Everything — map, chrome, heatmap, buttons — reads from those tokens; there
should be **no hardcoded colours** outside the theme blocks except the five route
line colours (mid-tone by design so they read on both light and dark grounds).
A small inline script in `<head>` applies the saved theme before first paint to
avoid a flash.

## 6. How this was verified (reuse it)

Testing was done by driving the real app in Chrome, not by reading code. The
pattern that worked, and is cheap to repeat:

- Serve locally, open in Chrome, then execute JS **in the page context** — the
  script is a classic `<script>`, so `db`, `board()`, `paint()`, `complete()`,
  `legPaths`, `project()` etc. are all reachable from the console.
- Force time rather than waiting: `db.activeRide.startedAt = new
  Date(Date.now() - 26*60000).toISOString(); paint();` drives a 25-minute ride to
  completion instantly.
- Geometry is checked, not eyeballed: `land.isPointInFill(pt)` against the SVG
  land path confirms every city is on land, and sampling each route path every 4
  units confirms no track runs over water. Both caught real bugs (Detroit was in
  Lake St. Clair; the Coast Starlight was 9% out in the Pacific).
- At least one test should run in **real time** (a 3-second ride and 2-second
  layover) to exercise the actual `setTimeout` path rather than the paint-loop
  fallback.

Always clear `localStorage.removeItem("focus-train-v1")` after seeding test data.

## 7. Known issues and next steps

`improve.md` is the roadmap and is written to make implementation cheap — it
names exact functions and sections. Headlines:

- **Ambient sound** — synthesized (not sample files) to keep the zero-asset
  deploy. Includes the background-tab scheduling trap and per-scape filter graphs.
- **Ride camera** — the train moves ~1.5 px/min at national view, i.e. visually
  static. Measured; the fix needs deep zoom plus a "route strip" mode.
- **Two genuine defects, not enhancements:**
  - Two open tabs both write `activeRide` and both log an arrival → double-counted
    rides and inflated points. Needs a `BroadcastChannel` guard.
  - No `:focus-visible` styling, so keyboard users can't see focus on the
    departures board (the rows are real `<button>`s and are reachable).
- Best-value idea: light up track already ridden, derived from `rides[]` with no
  schema change — turns the map into a record of your history.

Also open: the narrow-window layout (<1000px) stacks the console and squeezes the
map. Desktop-first is per the design doc; it just shouldn't break, and it doesn't.

## 8. Working preferences (from the user, this session)

- **Do not rewrite whole files.** Make targeted edits only. Never delete-and-recreate
  a file to change part of it.
- **Subagents:** don't spawn unless they genuinely help; use `sonnet` for basic
  subagent tasks rather than opus.
- Desktop-first; don't invest in mobile layout.
- Avoid designs that look AI-generated — no purple gradients, no generic
  glassmorphism card grids. The current look (transit-map typography, hairline
  rules, departure-board table, film grain) is deliberate.

## 9. Gotchas discovered

- `localStorage` is **per origin**. History at `localhost:8777` does not follow to
  the Pages URL. Use Settings → Export/Import to move it.
- `git ls-remote --exit-code <url>` returns failure on an **empty** repo (no
  refs), which looks identical to "repo doesn't exist". Don't use `--exit-code`
  to probe for a freshly created repo.
- GitHub Pages' first deploy takes ~2–4 minutes; polling with a short timeout
  will report 404 and look like a misconfiguration.
- `resize_window` via browser automation silently does nothing when Chrome is
  macOS-fullscreen. To test a narrow viewport, load the page in a sized `<iframe>`
  instead — media queries evaluate against the iframe viewport.
- There is **no `gh` CLI and no Homebrew** on this machine. There *is* a
  system-wide `osxkeychain` credential helper with a working GitHub credential,
  so `git push` over HTTPS works without prompting.
