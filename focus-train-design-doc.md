# Focus Train — Design Doc v1

A pomodoro timer where staying focused = riding a train route to its destination. Inspired by ElevenLabs' FocusTrain. Scoped to build in ~30 min with Claude Code, deploy as a static site, no backend.

---

## 1. Core Concept

Instead of watching a countdown, the user picks a **train route** that matches how long they want to focus. Starting the timer = "boarding" the train. The train animates along its route in real time as the session runs. Finish the full session = arrive at the destination, earn points. Stop early = the ride is logged as **incomplete** (no shaming language in UI, just an honest record).

---

## 2. MVP Feature Scope

### A. Timer engine
- Standard pomodoro loop: work session → short break → repeat → long break every 4th cycle.
- Work duration is **set by which route you pick** (see below), not a separate dial — this keeps the train metaphor meaningful.
- A "Charter" option lets the user enter a fully custom duration when no preset route fits; this still shows a (shorter, straight-line) route animation so it's consistent.
- **v1 rule: any manual stop before the timer hits zero = incomplete.** One pause grace period is a nice-to-have; don't build it in the first pass.

> **⚠️ Critical implementation note — timestamp-based, not tick-based.**
> Do **not** compute remaining time by decrementing a counter inside `setInterval`. Browsers throttle timers in background tabs (often to once per second or slower, and much worse when the window is fully occluded). Since the whole point of this app is that the user is heads-down in another app, the timer will be running in a background tab essentially 100% of the time — a tick-based countdown will drift badly and report wrong session lengths.
>
> Instead: store `startedAt` as a timestamp, and on every render compute `elapsed = Date.now() - startedAt`. `setInterval` is only used to trigger repaints, never to accumulate time. Completion is decided by comparing timestamps, not by the counter reaching zero.

> **⚠️ Do NOT penalize tab switching or window blur.**
> There's a tempting "cheat detection" feature here using the Page Visibility API — mark the ride incomplete if the user leaves the tab. **This would make the app unusable.** The user is *supposed* to be working in VS Code, a Google Doc, or a PDF while the timer runs. Leaving the tab is the expected behavior, not cheating. Focus is measured by "did you let the ride finish," full stop. Recording this explicitly so it doesn't get "helpfully" added later.

### B. Session completion signal (don't skip this)
If the user is heads-down in another app, they will not see the arrival animation. A focus timer you can't perceive finishing is functionally broken.

- **Completion chime**: synthesize a short, soft tone with the Web Audio API (a couple of oscillator notes, ~10 lines, no audio asset needed). This is not the same as the deferred ambient-sound feature — it's core usability and ships in v1.
  - Audio must be initialized on a user gesture (the "board train" click) to satisfy browser autoplay policy. Create/resume the `AudioContext` there.
- **Browser notification** (optional, nice): request `Notification` permission on first ride, fire one on arrival and on break-end. Degrade silently if denied.

### C. Train route map (the hook)
- **Stylized, not geographically accurate** — think transit-map aesthetic: a handful of nodes (cities) connected by curved SVG line routes, similar to a subway map, not a real US outline.
- 4–6 preset routes at v1, each mapped to a duration bucket, e.g.:
  - **Short Hop** — 25 min (e.g. "Boston → Portland")
  - **Regional** — 45 min (e.g. "Sacramento → SF")
  - **Express** — 60 min
  - **Long Haul** — 90 min
  - **Charter** — custom duration, generic straight route
- Picking a route "buys a ticket" and shows the route highlighted on the map.
- During the session, a train moves along the SVG path, position = % of session elapsed (use `path.getPointAtLength()` against `path.getTotalLength()`). Clock still shown, but secondary.
- **Train character:** low-poly / minimalist — essentially a rounded rectangle (the "body") with maybe one smaller rectangle or two small circles for a window/wheels accent. No detailed illustration, just a simple geometric shape that reads clearly as "train" at a glance and is cheap to animate smoothly along the path.
- Arrival animation plays on successful completion.
- **During breaks:** the train sits at the station it just reached ("layover"), with the break timer counting down. It doesn't reverse or reset. Next work session departs from that station toward the next one. Defining this now so the metaphor doesn't get improvised into something incoherent.
- **Desktop-first.** Don't invest in a responsive mobile layout for v1; a transit map on a phone screen is cramped and this is a Mac app in practice. Just don't let it break horribly if the window narrows.

### D. Points & progress
- Points awarded **only on full completion** — roughly proportional to route length (e.g. 1 pt/min).
- Early stop → 0 points, ride logged as incomplete (this is the "memory" requirement — see data model).
- **Stat definitions — be explicit, these are ambiguous by default:**
  - `currentStreak` = consecutive *completed rides*, reset to 0 by any incomplete ride. (Not day-based.)
  - Daily activity heatmap groups rides by **local calendar day**, derived from the stored UTC timestamp at render time. Storing UTC and grouping by local day is correct; grouping by the raw UTC date string will put late-evening Pacific sessions on the wrong day.
- **Stats are derived, not authoritative.** `rides[]` is the single source of truth. Recompute `totalPoints`, streaks, and counts from the ride log on load rather than trusting incrementally-updated counters — otherwise any bug or interrupted write permanently corrupts the numbers with no way to recover. Cache them in `stats` if you like, but always be able to rebuild.
- No login/accounts for v1 — single-browser, single-user, local only.

### E. Settings
- Adjust break lengths and long-break interval.
- Add/edit **custom** routes (see data model note — presets are not user-editable in v1).
- Export / import data as a JSON file (see §5).

---

## 3. Explicitly Out of Scope for v1 (build later)

- **Ambient sounds** (rain, cafe, ocean, white/brown noise) — deferred per your call; add as a v2 pass once you've got real audio assets or a synthesis approach sorted. *(The completion chime in §2B is separate and ships now.)*
- Geographically accurate US map / real Amtrak route data.
- Any backend, auth, or cross-device sync.
- Leaderboards or social features.
- Pause grace periods, ride "insurance," or any other softening of the completion rule.

---

## 4. Data Model (localStorage)

```json
{
  "schemaVersion": 1,
  "settings": {
    "breakMinutes": 5,
    "longBreakMinutes": 15,
    "roundsUntilLongBreak": 4,
    "chimeEnabled": true
  },
  "customRoutes": [
    { "id": "custom-abc", "name": "Charter", "minutes": 35 }
  ],
  "activeRide": {
    "id": "uuid",
    "routeId": "short-hop",
    "plannedMinutes": 25,
    "startedAt": "2026-09-07T14:00:00Z"
  },
  "rides": [
    {
      "id": "uuid",
      "routeId": "short-hop",
      "plannedMinutes": 25,
      "actualSeconds": 1500,
      "completed": true,
      "pointsEarned": 25,
      "startedAt": "2026-09-07T14:00:00Z",
      "endedAt": "2026-09-07T14:25:00Z"
    }
  ],
  "stats": { "totalPoints": 0, "currentStreak": 0, "longestStreak": 0 }
}
```

`rides` is the append-only log — this is what gives you "memory" across sessions and lets you honestly track incomplete rides, not just successes.

### Four schema decisions that matter later

**1. Preset routes live in code, not in storage.**
The original draft seeded all routes into `localStorage`. That's a trap: the moment you ship route #7 in a new version, every existing install keeps reading its stale stored copy and the new route never appears. Presets are a `const` array in the JS (source of truth); storage holds only `customRoutes`. Merge the two at render time.

**2. `schemaVersion` + merge-with-defaults on load.**
When you add ambient sounds in v2, old saved data won't have `settings.soundId` and naive code will read `undefined` and break. On load: parse stored JSON, deep-merge over a `DEFAULTS` object, so missing keys always get sane values. The version number gives you a migration hook if you ever need a real one.

**3. `activeRide` handles the closed-tab case.**
If the user closes or reloads mid-session, the in-progress ride currently just vanishes — no completion, no incomplete record, silently unlogged. Persist `activeRide` on start. On load:
- If `Date.now()` is still **before** the planned end → resume the ride in place (they probably just refreshed). Elapsed comes from `startedAt`, so this is free.
- If the planned end has **already passed** → log it as **incomplete**. You can't verify they were actually working, and this is the honest default. It also closes the obvious exploit (start a 90-minute ride, close the laptop, come back tomorrow, claim the points).
- Clear `activeRide` whenever a ride resolves either way.

**4. Ride log growth is a non-issue.**
~200 bytes per ride against a ~5MB localStorage budget is roughly 25,000 rides. Don't build pruning or pagination. Noting it so nobody wastes build time on it.

---

## 5. Data Durability (small feature, saves the whole project)

`localStorage` is the only copy of your history, and it's more fragile than it looks — clearing browser data wipes it, it doesn't follow you to another browser or machine, and Safari's storage policies can evict script-writable storage for sites you haven't visited in a while. Losing a year of streak data to a routine cache clear would be genuinely annoying.

- Add **Export** (dump state to a downloaded `.json`) and **Import** (file picker, validate, replace) buttons in settings. This is maybe 15 lines and it's your entire backup story until you build a backend.
- Do the export before you need it.

---

## 6. Tech Stack

- **Single self-contained `index.html`** — vanilla JS + inline SVG + CSS, no build step, no framework, no dependencies.
- Fastest path to "build in 30 min, deploy immediately": one file, no `npm install`, no bundler config for Claude Code to get wrong.
- `localStorage` for all persistence — no backend at all for v1.
- **Migration path when it outgrows one file** (likely once ambient audio lands): split into `index.html` + `app.js` + `styles.css`. Still no build step, still deploys the same way. Don't pre-split now; just don't write anything that assumes single-file.

---

## 7. Visual Direction

- Dark, cozy "night train" theme — deep navy/charcoal background, warm amber/gold accent for the train and progress states, soft glow rather than hard borders.
- Minimal chrome: the map + timer should dominate the screen; settings and stats tucked behind simple icon buttons.
- Smooth, subtle motion (train easing along the path, gentle pulse on the timer) — avoid anything flashy or game-like; the goal is calm focus, not stimulation.
- Respect `prefers-reduced-motion` for the train animation — cheap to add, and this app is animation-forward.

---

## 8. Deploy Recommendation

Single static HTML file, zero backend, so:

- **GitHub Pages** — fits since you're already working out of GitHub/VS Code. Push the file to a repo, flip on Pages in repo settings, done. Free, and it lives next to your other projects.
- **Vercel** — fastest path: `vercel deploy` from the folder gives a live HTTPS URL in ~10 seconds, no repo or settings screens.

My call: **GitHub Pages**, since you're already in that workflow. If you want it live in the next 60 seconds while building, Vercel's CLI is hard to beat.

**Note on the "app window" question:** this runs in a browser, not as a native Mac app. Once deployed you can get most of the native feel by using Safari's "Add to Dock" (opens chrome-less in its own window) or Chrome's "Install/Create Shortcut → Open as window." No build changes required.

**Storage caveat:** `localStorage` is scoped per origin. If you test at `file://` or `localhost` and then deploy to a Pages URL, your local history will **not** follow you — different origin, different storage. Do your throwaway testing wherever, but once you deploy, pick one URL and stick with it. (Or use the export/import from §5 to carry data over.)

---

## 9. Build Order (for the Claude Code session)

1. Layout skeleton: timer display + route picker (plain list first, map later).
2. Timer logic — **timestamp-based** (§2A), start/stop, work→break cycling, completion vs. incomplete.
3. `localStorage` layer: `DEFAULTS` + merge-on-load, `rides` append, `activeRide` resume/expire handling.
4. Completion chime (Web Audio) + arrival state.
5. Stats view, derived from `rides[]`.
6. SVG route map + animated train tied to elapsed %.
7. Export/import buttons.
8. Visual polish pass (theme, animation, spacing).
9. Deploy.

Steps 1–4 are the actual working app; if you run out of your 30 minutes, everything from 5 on is safely additive.

Ambient audio, real geography, and any backend are deliberately deferred. With the schema versioning, code-side presets, and derived stats above in place, adding them later shouldn't require restructuring anything.
