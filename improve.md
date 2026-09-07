# Focus Train — improvement plan

Scoped so that implementation is mostly mechanical. Every item names the exact
function it hooks into, in the numbered sections of the `<script>` in `index.html` (§1–§14; see
`handoff.md` for the full section map).

**Standing constraints:** no build step, no npm, no framework. Everything below
holds to that. Ambient audio is synthesized, not downloaded.

**Do this first — split the file.** `index.html` is ~78 KB / 1,708 lines. Sound
and camera add roughly 350 lines. The design doc (§6 Tech Stack) already sanctions the split
at this point: `index.html` + `app.js` + `styles.css`, still no build step, still
deploys identically. Do it as one mechanical move *before* the features, or the
diffs below get painful to review.

---

## 1. Ambient sound

### 1.1 Synthesis, not sample files

Samples would mean a `sounds/` folder, ~10–20 MB of loops, licensing, seam-free
loop points, and a loading state. Synthesis needs none of that and keeps the
zero-asset deploy. The trade is realism: **noise-based textures (rain, fire,
ocean, wind, thunder) synthesize convincingly; human voices do not.** A café is
therefore built as room tone + crockery transients, not babble — it reads as
"a room with people in it," which is the useful part anyway.

The `AudioContext` and the gesture-gated `ensureAudio()` already exist (§6), so
the hard browser-policy work is done.

### 1.2 Architecture

New section **§6b `Soundscape`**, after `chime()`. One shared noise buffer, one
graph per scape, crossfaded.

```js
let bus = null;              // GainNode -> destination, master ambient level
let scape = null;            // { id, nodes:[], gain, stop() }
let noiseBuf = null;         // one 8s stereo white-noise buffer, made once

function noise(){ ... }                    // lazily fill + cache noiseBuf
function noiseSrc(rate=1){ ... }           // looping AudioBufferSourceNode
function playScape(id){ ... }              // crossfade 0.8s: ramp old out, new in
function stopScape(fade=1.2){ ... }
function setAmbientVolume(v){ ... }        // bus.gain, 0..1, curve v^1.6
```

Chimes stay on their own path straight to `destination`, so an arrival always
cuts through. Duck the ambient bus ~6 dB for 2 s under a chime (one
`setTargetAtTime` down, one back).

### 1.3 The trap: event scheduling in a background tab

Fire crackles, thunder claps and cup clinks are discrete events. The obvious
implementation — `setInterval(() => crackle(), 400)` — **fails exactly where this
app lives**, because a hidden tab throttles timers to ~1/s or worse, so the fire
stutters the moment the user switches to their editor. This is the same hazard
the design doc calls out for the timer, and it needs the same answer.

Use a **lookahead scheduler**: a slow timer that schedules events on the
`AudioContext` clock well ahead of time.

```js
const LOOKAHEAD = 8;                       // seconds of events queued ahead
let nextEventAt = 0;
function pump(){                           // called every ~2s AND on visibilitychange
  const horizon = actx.currentTime + LOOKAHEAD;
  while(nextEventAt < horizon){
    scape.event(nextEventAt);              // schedules oscillators/noise at an exact time
    nextEventAt += scape.gap();            // randomised interval
  }
}
```

Even if the pump timer is throttled to once every 5 s, audio stays seamless
because 8 s are already queued on the audio clock. Reuse the existing
`visibilitychange` handler (§13) to pump on return.

### 1.4 Scape recipes

All are white noise (`noiseSrc()`) into filters unless noted. `evt` = discrete
events via the scheduler above.

| Id | Name | Graph |
|---|---|---|
| `rain` | Rainfall | noise → lowpass 1.8 kHz Q .4 → highpass 300 Hz → gain. Slow LFO (0.05 Hz) on lowpass freq ±300 Hz for breathing. |
| `window` | Rain on a window | `rain` at 60%, plus `evt` droplets: 8 ms noise burst → bandpass 1.2–3 kHz, random gain, ~14/s. |
| `fire` | Fire crackling | brown noise (noise → lowpass 220 Hz, gain ×3) for the bed, plus `evt` crackles: 4 ms noise → bandpass 900–4500 Hz, exp decay 40–90 ms, Poisson gap ~120 ms, occasional 3-crackle bursts. |
| `ocean` | Ocean waves | noise → lowpass 900 Hz. Amplitude swell: `gain.setValueCurveAtTime` over an 11–16 s wave, randomised, with the lowpass opening on the crest. Queue the next wave from the scheduler. |
| `thunder` | Distant thunder | `rain` bed + `evt` every 25–70 s: noise → lowpass 180 Hz, 2.5–5 s exp decay, slight pitch fall via `playbackRate`, panned randomly. |
| `cafe` | Café | pink-ish bed (noise → lowpass 1.1 kHz + highpass 180 Hz) at low gain; `evt` crockery: 6 ms triangle 1.4–3.2 kHz, 60 ms decay, ~1 per 4 s; occasional chair scrape (noise → bandpass 400 Hz, 300 ms). |
| `espresso` | Coffee bar | `cafe` bed + a cycle: grinder (sawtooth 90 Hz + noise → lowpass 700 Hz, 4 s) → steam wand (noise → highpass 4 kHz, 6 s, gain envelope) → 40–90 s silence. |
| `wind` | Wind | noise → bandpass 400 Hz Q 1.2, with LFO on both frequency (0.03 Hz, ±250 Hz) and gain — the gusting is the whole effect. |
| `night` | Crickets | very low noise bed + `evt` chirp pairs: 4.5 kHz sine, 12 ms, ×2, every 0.4–0.9 s, slightly detuned per "insect" (run 3 at different rates). |
| `rails` | **Aboard the train** | The one to build first — it is the app's own sound. Bed: brown noise → lowpass 140 Hz (bogie rumble). `evt`: rail-joint clack pairs, 6 ms noise → bandpass 250 Hz, "da-dum" 90 ms apart, every ~1.4 s; sway the bed gain with a 0.08 Hz LFO. Optional: gate the clack rate off ride progress. |

Normalise per-scape gain by hand in a constant table (`SCAPE_GAIN`) — brown noise
is perceptually far louder than bandpassed white and will blow the ears off
anyone who switches from `cafe` to `fire` at the same bus level.

### 1.5 Settings, schema, UI

Schema addition — exactly the case the design doc's merge-on-load anticipated,
so old saves need no migration:

```js
settings: { ..., soundId:"none", soundVolume:0.5, soundDuringBreak:true }
```

- **Settings panel** (§11 `renderSettings`): a new `<h4>Ambient</h4>` section above
  Signals — a grid of scape chips reusing the `.th` button style from the theme
  picker, plus a range input for volume. Selecting a scape while idle previews it
  for 4 s so the user can audition without starting a ride.
- **Ride console** (§10 `renderRide`): a small speaker icon that cycles
  mute/unmute, so it is reachable without opening Settings.

### 1.6 Integration points

| Where | Change |
|---|---|
| `board()` §7 | after `ensureAudio()`, `playScape(db.settings.soundId)` with a 2 s fade-in |
| `complete()` §7 | fade ambient to 0 over 1.5 s *before* `chime("arrive")` so the bell lands in silence; restart after the layover if `soundDuringBreak` |
| `stopRide()` §7 | `stopScape()` |
| `endBreak()` §7 | `stopScape()` if the layover was silent |
| §13 visibility | call `pump()` on return |
| `renderSettings()` §11 | the Ambient section |

### 1.7 Risks

- **Autoplay**: only ever start from a click. Already the pattern; do not regress it.
- **CPU**: one noise source + 3–4 biquads is negligible. Scheduled events create
  and discard nodes — call `stop()` and let GC take them; do not accumulate refs.
- **Safari**: `AudioContext` suspends aggressively on hidden tabs on iOS. Desktop
  Safari is fine; note it, do not fight it.
- Keep total added weight under ~200 lines. If a scape needs more than ~15 lines
  it is too ambitious for synthesis — cut it.

---

## 2. Ride camera — making the train visibly move

### 2.1 The problem, measured

At the national view, average travel per service:

| Service | Leg (map units) | Miles | px/min at national view |
|---|---|---|---|
| Northeast Regional | 36.8 | 131 | **1.5** |
| Crescent | 79.8 | 296 | **1.8** |
| Texas Eagle | 96.4 | 345 | **1.6** |
| Coast Starlight | 97.6 | 343 | **1.3** |
| California Zephyr | 129.6 | 472 | **1.4** |

Roughly **1.5 px/min**. The train is, correctly, stationary to the eye. A gentle
zoom does not fix this: clamping the camera to a still-map-like 260-unit window
only reaches 5–6 px/min. **Visible motion requires deep zoom** — 10× to 40×.

### 2.2 Recommendation: constant apparent speed + strip view

Size the window so apparent speed is the same on every service, and let the map
gracefully become a route strip when the zoom gets deep.

```js
const PACE = 30;                                  // px/min, user-tunable
function cameraFor(route, li, frac){
  const path = legPaths[drawnId][li];
  const legU = path.getTotalLength();
  const stageW = stage.clientWidth;
  let w = legU * stageW / (PACE * routeMinutes(route));   // window width, user units
  w = Math.min(NATIONAL_W, Math.max(28, w));
  const p = path.getPointAtLength(legU * frac);
  return { w, cx:p.x, cy:p.y };                   // + aspect-matched height
}
```

Resulting zoom: ~22× on Philadelphia→New York, ~11× on Salt Lake→San Francisco —
both landing at a constant, perceptible ~1 px per 2 seconds.

**Zoom tiers**, so deep zoom still looks deliberate:

| Window width | Mode | Treatment |
|---|---|---|
| > 600u | National | as today |
| 260–600u | Regional | land visible, other services dimmed further |
| < 260u | **Strip** | fade `#land` toward 0 and lift the background — at 20× the coarse coastline is one meaningless diagonal, so drop it. What remains is the route line, its cities and the train: an Amtrak route strip diagram, which is a real artifact and looks intentional. |

Drive it with one CSS custom property so the transition is free:
`map.style.setProperty("--zoom", k)` and `#land{opacity:clamp(0,(var(--k) - 0.27)*4,1)}`.

### 2.3 The counter-scaling problem

SVG scales everything with the viewBox, so at 20× the city labels become 200 px
tall. Everything except the land must be counter-scaled.

Set `k = viewBoxWidth / NATIONAL_W` on each camera update and drive sizes from it:

```css
#map{ --k:1 }
.lbl { font-size:calc(10.5px * var(--k)); stroke-width:calc(3.2px * var(--k)) }
.dot { r:calc(3.6px * var(--k)); stroke-width:calc(1.6px * var(--k)) }
.rail{ stroke-width:calc(3.2px * var(--k)) }        /* or vector-effect:non-scaling-stroke */
#train{ transform:scale(var(--kt)) }                /* kt = k^0.6 — grows a little */
```

`r` and `stroke-width` are settable from CSS on modern browsers. The train
deliberately does *not* counter-scale fully: at `k^0.6` it grows somewhat when
zoomed, which is what you want.

### 2.4 Pulling into the station

Over the final 8% of a leg, lerp the camera target from train-centred to
destination-centred and widen `w` by ~1.4×. The train then visibly *arrives* at
a named city instead of the city sliding in from the edge. Cheap, and it makes
the arrival chime land on something.

### 2.5 Integration points

| Where | Change |
|---|---|
| `buildMap()` §5 | stash `NATIONAL_VIEWBOX` and `NATIONAL_W` after fitting |
| `paint()` §9 | after computing `p`/`frac`, compute the camera and write `viewBox` + `--k` |
| `board()` / `complete()` / `stopRide()` §7 | kick a 1.2 s eased transition between national and ride framing — one `requestAnimationFrame` lerp over the 4 viewBox numbers, `easeInOutCubic` |
| `renderSettings()` §11 | `settings.camera`: `"follow"` \| `"network"`, and a pace slider |
| §13 reduced motion | if `RM.matches`, jump rather than ease and update the camera once per second (`paint()` already runs at 1 Hz there) |

Add a **toggle in the ride console** too — some people will want the whole
network on screen while they work. Default to follow.

### 2.6 Caveat worth accepting

At strip zoom the user loses the national context during a ride. That is the
correct trade — the national map's job is choosing a service, the strip's job is
showing motion — but it is why the toggle is not optional.

---

## 3. Other improvements, ranked

### 3.1 Light up track you have actually ridden ★ best value
The map is currently a picker; it should be a record. Derive from `rides[]` — no
schema change — the set of `routeId:legIndex` pairs ever completed, and render
those segments brighter/thicker with a faint accent tint permanently. After a
month the map *is* your history, and finishing a service becomes a visible goal.

```js
function riddenLegs(){                   // memoise, invalidate on ride push
  const s = new Set();
  for(const r of db.rides) if(r.completed) s.add(r.routeId + ":" + r.legIndex);
  return s;
}
```
Hook: `renderMap()` §9, add `.rail.ridden`. ~15 lines.

### 3.2 Miles
Every city has real coordinates, so haversine is free. Show "472 miles" on the
ticket, "301 miles to go" in the ride console (it changes every few seconds,
which conveys motion that pixels cannot), and lifetime miles in the journey log.
Far more evocative than an abstract point total. ~20 lines, no schema change.

### 3.3 Countdown in the tab title ★ cheap, high value
The user is in another app by design; the tab strip is the one piece of this UI
they still see. `document.title = "12:34 · Philadelphia"` during a ride, restore
on idle. Update it inside `updateClock()` §10 — about 4 lines, and it makes the
timer glanceable without switching apps.

### 3.4 Multi-tab guard — a real bug
Two tabs open both write `activeRide` and both log an arrival: the ride is
double-counted and points are inflated. Fix with `BroadcastChannel("focus-train")`:
post on every `save()`, and on receipt re-`load()` and `renderAll()` if the
message came from another tab. If a ride is active in one tab, the other shows a
read-only "riding in another tab" state. ~25 lines. Worth doing before adding
anything else that writes state.

### 3.5 Focus-visible styling — accessibility gap
The departures rows are real `<button>`s and keyboard-reachable, but there is no
visible focus ring, so keyboard users cannot see where they are. Add one rule:
`:focus-visible{outline:2px solid var(--accent);outline-offset:2px}`. Also add
`aria-live="polite"` on `#toast` so arrivals are announced. Two lines, no excuse
not to.

### 3.6 Stats worth adding
All derive from `rides[]`, all in `renderStats()` §11:
- **By service** — a small horizontal bar per line, in that line's colour.
- **Time of day** — 24-bucket histogram of ride starts. Answers "when do I
  actually focus," which is the most actionable thing this data holds.
- **Completion rate by duration** — do 90-minute rides actually get finished?
  Likely the most useful self-knowledge in the app, and it argues for or against
  the user's service choice.

### 3.7 A note on an incomplete ride
The doc is firm about no shaming, and a one-line note turns the log from a
record of failure into something diagnostic. On `stopRide()`, offer an optional
input; store `note` on the ride. Additive field, merge-on-load handles it.

### 3.8 Service completion
Count end-to-end traversals per service (`journey` wraps). Show "Crescent ×3" in
the journey log. Gives long-horizon structure that streaks do not.

### 3.9 Smaller items
- **`round` after an incomplete ride** — currently the long-layover counter is
  untouched by a stop. Defensible, but decide deliberately and comment it.
- **Export nudge** — after 50 rides with no export, one quiet line in Settings.
- **Wake lock** — `navigator.wakeLock` during a ride, off by default, for people
  reading rather than typing.
- **Favicon progress arc** — draw the ride's progress into a canvas favicon. Fun,
  ~20 lines, purely optional.

---

## 4. Suggested order

1. Split into `index.html` + `app.js` + `styles.css` (mechanical, do it first).
2. Multi-tab guard (§3.4) — it is a correctness bug and everything else writes state.
3. Focus rings + `aria-live` (§3.5) — two minutes.
4. Ambient sound (§1), starting with `rails`, `rain`, `fire`.
5. Ride camera (§2).
6. Ridden-track record (§3.1) and miles (§3.2).
7. Tab-title countdown (§3.3), then the stats additions (§3.6).

Items 2–3 and 6–7 are all small and independent; 4 and 5 are the substantial ones
and are fully independent of each other, so they can be done in either order.
