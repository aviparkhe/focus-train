# Focus Train — project context

Everything a session needs to pick this up cold; Claude Code loads this file
automatically. Written 2026-09-07 at the end of the session that built it, and
updated later that day by the session that split the file and added the
multi-tab guard, focus rings and ambient sound.

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
| Local test server | `python3 -m http.server 8777` in the project dir — **not running**; started only on demand |

**The live Pages URL is the canonical home for ride data.** The `localhost:8777`
history was migrated there and then deliberately cleared, and that server was
stopped, so there is exactly one copy and no chance of two divergent histories.
If you start a local server again it will have empty storage — that is correct.
A snapshot of the real history sits in `focus-train-backup-2026-09-07.json`
(gitignored, never committed).

Files: `index.html` (76 lines — markup only), `app.js` (~1,560 lines, the whole
app), `styles.css` (~430 lines), `README.md`,
`focus-train-design-doc.md` (the original spec), `CLAUDE.md` (this file — the
roadmap lives in §7; `improve.md` was folded into it and deleted), `manifest.webmanifest`, `icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`, `.gitignore`, `.nojekyll`.

**Installable.** The manifest plus icons make Chrome's "Install page as app" and
Safari's "Add to Dock" produce a real standalone Dock app. Icons are generated
from the wordmark glyph — the generating script is not kept; regenerate with PIL
if the mark changes. `applyTheme()` also rewrites the `theme-color` meta from the
computed `--ink`, so the installed window chrome follows the active theme; keep
that in step if the theme tokens are reworked.

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
4. Wrote a roadmap (later folded into §7) while the user test-ran the app.
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
- **The ridden-track record and all mileage derive from `rides[]`** — no schema
  change, nothing stored. `riddenLegs()` is memoised on `db.rides.length`, so an
  import or a reset rebuilds it without an explicit invalidation.
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
- **Exactly one tab drives the clock** (§2b). `complete()` and `endBreak()` are
  guarded by `driving`, and only the driving tab runs the timers. Removing a
  guard brings back double-counted rides and inflated points.
- **Ownership is settled by asking, never by a heartbeat.** A hidden tab's timers
  are throttled to ~1/min, so a heartbeat from the driving tab reads as dead and
  a second tab claims alongside it. Message *delivery* is not throttled that way,
  so `who?`/`iam` is the test that holds. Don't "improve" this into a heartbeat.
- **The camera has exactly one writer.** `paint()` only ever sets `cam.tgt`;
  `camStep()` eases `cur → tgt` and is the only thing that touches the
  `viewBox`. Do not reintroduce per-call transitions in `board()`/`complete()` —
  they fight over the same four numbers.
- **The camera glide is time-based, not per-frame** — same rule as the ride
  clock. A per-frame lerp settles in under a second foregrounded and takes ~50 s
  in a throttled tab.
- **Everything except `#land` is counter-scaled by `--k`** so it holds a constant
  *screen* size at 10–20× zoom. Each CSS variant needs its own scaled rule
  (`.lbl.plain` outranks `.lbl`), and the rules must sit *after* the base ones.
  Label offsets are map units, so `scaleMap()` re-anchors them in JS.
- **Ambient events are queued on the AudioContext clock, never fired by a timer**
  (§6b `pump()`). Same hazard as the ride timer, same answer: `setInterval` only
  queues 8 s ahead; it never makes a sound itself. Each layer carries its own
  queue pointer.
- **`canSound()` gates every bed.** Ambience is a mixer — any number of scapes
  run at once — so exactly one tab may build layers: whichever drives the clock
  while a ride or layover is running, any tab when everything is idle. Without
  it a mirroring tab quietly builds a second full graph.
- Respect `prefers-reduced-motion`.

## 5. Architecture

Three files — `index.html` (markup and the pre-paint theme script), `app.js`,
`styles.css` — loaded with a plain `<link>` and `<script src>`. Vanilla JS,
inline SVG. No build step, no npm, no framework, no dependencies, no backend.
Keep it that way. `app.js` is a classic script, not a module, so everything in
it stays reachable from the console — which is how this app is tested (§6).

`app.js` is divided into numbered sections. Current map (line numbers drift
— grep the section banners):

| § | Contents | Key functions |
|---|---|---|
| 1 | Constants, projection, geography, services, themes | `project()`, `US_OUTLINE`, `LAKE_MICHIGAN`, `CITIES`, `ROUTES`, `CHARTER`, `THEMES`, `DEFAULTS` |
| 2 | Storage | `clone`, `deepMerge`, `load`, `save` |
| 2b | Multi-tab guard | `takeDrive`, `dropDrive`, `probeDrive`, `ensureDriver`, `post` |
| 3 | Derived stats | `computeStats`, `dayKey`, `dailyMinutes` |
| 4 | Route helpers, distance, ridden track | `allRoutes`, `routeById`, `standingAt`, `legIndex`, `stopName`, `routeMinutes`, `haversine`, `legMiles`, `routeMiles`, `lifetimeMiles`, `riddenLegs`, `clampMin` |
| 5 | Map geometry & drawing | `routeGeometry`, `el`, `buildMap` |
| 6 | Audio | `ensureAudio`, `tone`, `chime`, `notify`, `askNotify` |
| 6b | Soundscape | `SCAPE_BUILD`, `SCAPE_GAIN`, `applyMix`, `startLayer`, `endLayer`, `stopAmbient`, `canSound`, `pump`, `duckAmbient` |
| 7 | Ride lifecycle | `phase`, `rideEnd`, `select`, `board`, `scheduleCompletion`, `scheduleBreakEnd`, `complete`, `stopRide`, `skipBreak`, `endBreak`, `resolveActiveRide`, `resolveOnLoad` |
| 8 | Formatting | `fmtClock`, `fmtDur`, `esc`, `showToast` |
| 9 | Render — map | `renderMap`, `paint` |
| 9b | Ride camera | `cameraFor`, `camStep`, `applyCam`, `scaleMap`, `setCamTarget`, `NATIONAL`, `NATIONAL_W` |
| 10 | Render — console | `nextStopText`, `renderConsole`, `renderBoard`, `renderRide`, `updateClock`, `renderHeader`, `renderAll`, `applyTheme` |
| 11 | Panels — journey log, ambience, settings | `openPanel`, `closePanels`, `renderStats`, `renderAmbience`, `renderSettings` |
| 12 | Export / import | `exportData`, `importData` |
| 13 | Paint loop + visibility | `loop`, `startLoop`, `stopLoop` |
| 14 | Boot | |

### Data model (`localStorage` key `focus-train-v1`)

```js
{ schemaVersion:1,
  settings:{ breakMinutes, longBreakMinutes, roundsUntilLongBreak,
             chimeEnabled, notifyEnabled, charterMinutes, theme,
             soundMix, soundVolume, soundMuted, soundDuringBreak,
             camera, pace },
             // soundMix is { scapeId: 0..1 } and every entry plays at once
             // camera "follow"|"network"; pace is px/min of apparent speed
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

Eight themes as CSS custom-property sets on `:root[data-theme="…"]`, deliberately
balanced **four dark** (`night` — default, `blueprint`, `ember`, `terminal`) and
**four light** (`daybreak`, `timetable`, `alpine`, `porcelain`), and shown in the
settings picker as two labelled columns. Each entry in `THEMES` carries
`mode:"dark"|"light"`, which is what splits the columns — keep it in step, and
keep the counts even if you add one. `sequoia` was retired to make room; a save
still naming it falls through `applyTheme()` to `night`.
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

## 7. Roadmap

`improve.md` used to hold this and has been deleted — everything still live from
it is below. It was a plan for work that is now done; keeping it around meant two
documents disagreeing about what was built.

### 7.1 What that roadmap delivered (all shipped, 2026-09-07)

Ambient sound (§6b), the ride camera (§9b), the multi-tab guard (§2b),
`:focus-visible` + `aria-live`, the ridden-track record, real mileage, and the
tab-title countdown. The file split (`index.html` + `app.js` + `styles.css`)
came first and was mechanical. Details of each live in §4 (rules), §5
(architecture) and §9 (gotchas) of this file.

### 7.2 Hard-won lessons from that work — do not re-derive these

- **`SCAPE_GAIN` values are empirical**, measured as RMS off an analyser spliced
  in as `bus → analyser → destination`. The first pass ran from `rails` 0.373 to
  `night` 0.004 — a 90x spread. Re-measure rather than reason if a scape's graph
  changes; peak *and* mean over >=3.5 s, and >=9 s for `ocean` and `thunder`,
  whose content is a slow swell and a rare clap.
- **`GainNode.gain.value` read straight after scheduling a ramp is not a usable
  probe** — it does not reflect pending automation. Measure the output.
- **The lookahead scheduler was verified by killing the pump outright**: after
  6 s with no JS running there were still 2.2 s of events queued on the audio
  clock. `pump()` snaps `nextAt` forward when behind — without it a tab frozen
  for five minutes wakes and dumps five minutes of crackles at once.
- **Camera: measure apparent speed along the path (2D distance), not horizontal
  displacement.** A near-vertical leg like Seattle→Portland reads as ~0 px/min
  if you only difference `x`.
- **Window *height* is the camera's real constraint, not width.** The stage is
  ~2.4:1, so a vertical leg loses context long before a horizontal one of the
  same length. That is why the camera pulls out from the origin as well as in to
  the destination.
- **Do not verify CSS scaling with `getComputedStyle`** after mutating a custom
  property from the automation console — it returns stale values and will tell
  you the whole approach failed when it works. Screenshot it instead.
- **Counter-scaling rules must sit *after* the base rules and restate every
  variant** — `.lbl.plain` outranks `.lbl` and was missed on the first pass.

### 7.3 Still open from the old roadmap

Small, all deriving from `rides[]`, no schema change unless noted:

- **Stats worth adding** (`renderStats()` §11): by-service bars in each line's
  colour; a 24-bucket time-of-day histogram of ride starts ("when do I actually
  focus" is the most actionable thing this data holds); completion rate by
  duration (do 90-minute rides actually get finished?).
- **A note on an incomplete ride** — on `stopRide()`, offer an optional one-line
  input and store `note` on the ride. Additive field; merge-on-load handles it.
  Turns the log from a record of failure into something diagnostic, which is in
  the spirit of the no-shaming rule.
- **Service completion** — count end-to-end traversals per service (`journey`
  wraps) and show "Crescent x3" in the journey log.
- **Smaller:** decide deliberately whether `round` should advance after an
  incomplete ride (currently untouched — defensible, but comment it); an export
  nudge after 50 rides with no export; `navigator.wakeLock` during a ride, off
  by default; a canvas favicon progress arc.

### 7.3b Standing layout constraints

- The narrow-window layout (<1000px) stacks the console and squeezes the map.
  Desktop-first is per the design doc; it just shouldn't break, and it doesn't.
- **The ticket column is height-constrained.** `--console` is a fixed height and
  the stage takes the rest, so the ticket never gets more room on a taller
  window — added content clips instead of growing. The Board button is pinned
  outside a scrollable `.tk-body` for exactly this reason: the charter ticket
  carries an extra duration field and used to push the button off the bottom.
  **Check the charter ticket, not just a scheduled service, after touching that
  column** — it is the tallest case.

### 7.4 Next session's goals (from the user, end of 2026-09-07)

Roughly in the order given, not necessarily in priority order:

1. **Make it look nicer** — the map and especially the train. The train is
   currently a rounded rect with two window dots, which reads fine at national
   scale but is the most-looked-at object on screen during a ride now that the
   camera zooms to ~10x. Keep to §8's taste constraints: no purple gradients,
   no generic glassmorphism.
2. **More routes.** Note the standing rule in §3: the city allow-list is the
   user's, and **cities outside it need asking first**. New routes between
   existing cities need no permission.
3. **Productivity checking** — detecting whether the user wanders off to
   YouTube and so on. **Read §7.5 before touching this**; it conflicts with a
   load-bearing rule and is not straightforwardly possible.
4. **More gamification** — a store: buy different trains, unlock routes, spend
   points. Possibly reframe points as dollars. This is the first feature that
   would make points a *currency* rather than a score, so it needs a spend
   ledger; `rides[]` stays the source of truth for what was *earned*, and a
   separate record tracks what was spent. Do not start mutating a stored
   points counter — that breaks the rule in §4.
5. **Better ambient realism.** Synthesis-only is a standing constraint (zero
   assets, no `sounds/` folder). The honest ceiling is noise-based texture;
   see §7.2 on measurement before retuning anything.

### 7.5 The productivity-checking idea — read before building

The user raised this themselves as "not sure if this is a good idea but worth
exploring", so it is genuinely open — but two things have to be said plainly.

**It contradicts a load-bearing rule.** §4: *never penalise leaving the tab*,
and the design doc rules out cheat detection explicitly. The whole model is that
focus is measured solely by whether the ride was allowed to finish, and that the
user is *supposed* to be working in another app. A naive Page Visibility
implementation would invert the app's premise.

**A plain web page cannot do it anyway.** Nothing in `index.html` can see what
other tabs or apps are doing. Real implementations need a browser extension with
host permissions, or an OS-level agent — either of which is a different product
with a real privacy surface, and neither of which fits the zero-asset,
no-backend, single-page constraint in §5.

If it goes ahead, the version worth building is **self-reported and
non-punitive** — the user classifies their own ride afterwards, or the app
surfaces patterns it already has (time of day, completion rate by duration, per
§7.3) and lets them draw the conclusion. That keeps the no-shaming principle and
needs no new permissions. Confirm the direction with the user before writing
code; do not quietly ship surveillance because a bullet point asked for it.

### 7.6 Further out: plane mode

A second network — **plane routes, international**, switched to via a tab
alongside the train map. A four-round pomodoro becomes something like
JFK → LAX → SIN → DEL → DXB.

Logged as explicitly further out than §7.4. What it would touch:

- **The projection.** `project()` (§1) is equirectangular with a bow tuned for
  the continental US about lon -96, and `US_OUTLINE` is a coarse US polygon.
  A world map needs a different projection and a different outline; the bow
  would have to become mode-dependent rather than global.
- **Route geometry.** Flights are great-circle arcs, not Catmull-Rom curves
  through via points — a genuinely different `routeGeometry()`, and one that has
  to handle crossing the antimeridian.
- **The city allow-list** grows a lot and internationally, so it needs the user.
- **Distance** already works — `haversine()` (§4) is geodesic and needs no
  change; leg lengths just get much larger.
- **The camera** should carry over unchanged in principle: constant apparent
  speed is projection-independent, but `NATIONAL_W` and the `--k` normalisation
  are named and tuned for one map and would need to become per-mode.
- Storage would need `journey` and `rides[]` keyed per network, or route ids
  namespaced, so train and plane progress do not collide.

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

- `localStorage` is **per origin**. `localhost:8777`, the Pages URL and a
  `file://` copy each have separate, independent storage. Use Settings →
  Export/Import to move history between them.
- **Never wrap two independent string edits in one `assert s != o`.** It cost a
  bad deploy this session: the manifest shipped but its `<link>` tag did not,
  because the second anchor did not match and the first edit's success satisfied
  the assertion. Assert each replacement, and check the anchor is present *and*
  unique. Then verify against what is actually **served**, not what was committed.
- `git ls-remote --exit-code <url>` returns failure on an **empty** repo (no
  refs), which looks identical to "repo doesn't exist". Don't use `--exit-code`
  to probe for a freshly created repo.
- GitHub Pages deploys take ~1–4 minutes, and a redeploy keeps serving the old
  build until it finishes — a 404 or stale HTML right after a push is normal, not
  a misconfiguration. Check Actions → "pages build and deployment" before
  debugging. Chrome may also hold a cached copy; `location.reload(true)`.
- The Bash tool blocks foreground `sleep`, so a shell poll loop spins instantly
  and reports a false negative. Poll from a `python3` heredoc using `time.sleep`.
- `resize_window` via browser automation silently does nothing when Chrome is
  macOS-fullscreen. To test a narrow viewport, load the page in a sized `<iframe>`
  instead — media queries evaluate against the iframe viewport.
- There is **no `gh` CLI and no Homebrew** on this machine. There *is* a
  system-wide `osxkeychain` credential helper with a working GitHub credential,
  so `git push` over HTTPS works without prompting.
