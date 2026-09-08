"use strict";
/* ═══════════════════════════════════════════════════════════════
   1. Constants & route data  (presets live in code, never storage)
   ═══════════════════════════════════════════════════════════════ */
const SCHEMA = 1;
const KEY = "focus-train-v1";
/* Equirectangular with a conic-style bow — enough to read as "the United
   States" without dragging in a real projection library. */
const PROJ = { lon0:-125, lat0:49.5, kx:14.4, ky:20, x0:82, y0:55, lonC:-96, bow:16 };
function project(ll){
  const u = (ll[0] - PROJ.lonC) / 29;
  return [ (ll[0] - PROJ.lon0) * PROJ.kx + PROJ.x0,
           (PROJ.lat0 - ll[1]) * PROJ.ky + PROJ.y0 + PROJ.bow * u * u ];
}

/* Coarse continental outline: the two coasts, the Mexican and Canadian
   borders, and enough of the Great Lakes to place Chicago and Detroit. */
const US_OUTLINE = [
  /* Pacific coast, north to south */
  [-124.7,48.4],[-124.1,46.9],[-124.0,45.5],[-124.4,43.3],[-124.2,41.8],
  [-123.8,39.8],[-122.9,38.3],[-122.4,37.2],[-121.3,35.8],[-120.6,34.5],
  [-118.5,34.0],[-117.3,32.6],
  /* Mexican border */
  [-114.7,32.7],[-111.1,31.3],[-108.2,31.3],[-106.5,31.8],[-105.0,30.7],
  [-104.0,29.3],[-102.8,29.8],[-101.4,29.8],[-99.9,28.0],[-97.4,25.9],
  /* Gulf coast and Florida */
  [-97.2,27.5],[-96.0,28.4],[-94.7,29.4],[-93.3,29.8],[-91.6,29.2],
  [-89.3,29.1],[-88.9,30.3],[-87.5,30.3],[-85.6,29.9],[-84.3,30.0],
  [-83.2,29.2],[-82.8,27.9],[-82.1,26.6],[-81.2,25.2],[-80.4,25.4],
  /* Atlantic coast, south to north */
  [-80.1,26.9],[-80.6,28.5],[-81.3,30.4],[-81.5,31.0],[-80.8,32.1],
  [-79.2,33.2],[-77.9,34.0],[-75.7,35.2],[-76.3,36.0],[-75.9,37.1],
  [-75.2,38.3],[-74.4,39.4],[-74.0,40.5],[-72.0,41.3],[-70.0,41.6],
  [-70.6,42.7],[-70.2,43.6],[-68.9,44.3],[-67.0,44.8],
  /* Canadian border: Maine, the St Lawrence, Ontario, Erie */
  [-67.8,47.1],[-69.2,47.5],[-70.3,46.0],[-71.5,45.1],[-74.7,45.0],
  [-76.2,44.2],[-76.9,43.6],[-79.0,43.3],[-80.5,42.4],[-82.6,41.7],
  /* up Michigan's Lake Huron shore to the Straits */
  [-82.75,42.0],[-82.4,43.3],[-83.0,44.3],[-83.6,45.2],[-84.6,45.9],
  /* the Upper Peninsula along Lake Superior */
  [-85.2,46.2],[-86.6,46.5],[-88.4,46.9],[-88.5,47.4],[-90.4,46.7],[-92.1,46.8],
  /* Minnesota up to the 49th parallel, then west to Puget Sound */
  [-92.3,48.3],[-95.2,49.0],[-104.0,49.0],[-116.0,49.0],[-122.8,49.0],
  [-122.5,48.2],[-124.7,48.4]
];

/* Lake Michigan, drawn as a hole in the landmass (evenodd fill). At true
   scale it reads as a hairline crack, so it is opened up a little — this is
   a stylised map, and the lake is what puts Chicago on a shore. */
const LAKE_MICHIGAN = [
  [-87.55,41.90],[-88.25,42.90],[-88.15,44.00],[-87.35,44.95],[-87.60,45.35],
  [-85.70,45.90],[-85.15,45.10],[-85.85,44.10],[-86.10,43.10],[-85.90,42.10],
  [-87.00,41.85]
];


/* `la` places the label; dx/dy nudge it where the corridor gets crowded. */
const CITIES = {
  sea:{n:"Seattle",        ll:[-122.33,47.61], la:"left"},
  pdx:{n:"Portland",       ll:[-122.68,45.52], la:"left"},
  sfo:{n:"San Francisco",  ll:[-122.42,37.77], la:"left"},
  lax:{n:"Los Angeles",    ll:[-118.24,34.05], la:"left"},
  las:{n:"Las Vegas",      ll:[-115.14,36.17], la:"right"},
  phx:{n:"Phoenix",        ll:[-112.07,33.45], la:"below"},
  slc:{n:"Salt Lake City", ll:[-111.89,40.76], la:"above"},
  den:{n:"Denver",         ll:[-104.99,39.74], la:"above"},
  oma:{n:"Omaha",          ll:[ -95.94,41.26], la:"below"},
  msp:{n:"Minneapolis",    ll:[ -93.27,44.98], la:"above"},
  chi:{n:"Chicago",        ll:[ -87.63,41.88], la:"above"},
  det:{n:"Detroit",        ll:[ -83.05,42.33], la:"right"},
  stl:{n:"St. Louis",      ll:[ -90.20,38.63], la:"left"},
  dfw:{n:"Dallas",         ll:[ -96.80,32.78], la:"left"},
  hou:{n:"Houston",        ll:[ -95.37,29.76], la:"below"},
  msy:{n:"New Orleans",    ll:[ -90.07,29.95], la:"right"},
  bna:{n:"Nashville",      ll:[ -86.78,36.16], la:"above"},
  atl:{n:"Atlanta",        ll:[ -84.39,33.75], la:"right"},
  clt:{n:"Charlotte",      ll:[ -80.84,35.23], la:"right"},
  was:{n:"Washington",     ll:[ -77.04,38.91], la:"left",  dx:-7, dy:7},
  phl:{n:"Philadelphia",   ll:[ -75.16,39.95], la:"left",  dx:-7, dy:-4},
  nyc:{n:"New York",       ll:[ -74.01,40.71], la:"right", dy:5},
  bos:{n:"Boston",         ll:[ -71.06,42.36], la:"right"}
};

/* Long-distance services. One work session runs one leg; `via` bows a leg
   along the ground the line actually covers. */
const ROUTES = [
  {
    id:"regional", name:"Northeast Regional", service:"Corridor", minutes:25, color:"#c2564c",
    stops:[ {c:"was"}, {c:"phl"}, {c:"nyc"}, {c:"bos", via:[[-72.7,41.4]]} ]
  },
  {
    id:"crescent", name:"Crescent", service:"Overnight", minutes:45, color:"#4d8a63",
    stops:[ {c:"msy"}, {c:"atl", via:[[-86.8,32.4]]}, {c:"clt", via:[[-82.5,34.6]]},
            {c:"was", via:[[-78.5,37.3]]}, {c:"nyc"} ]
  },
  {
    id:"eagle", name:"Texas Eagle", service:"Long haul", minutes:60, color:"#bb8438",
    stops:[ {c:"hou"}, {c:"dfw"}, {c:"stl", via:[[-94.0,35.4]]}, {c:"chi", via:[[-89.0,40.2]]} ]
  },
  {
    id:"starlight", name:"Coast Starlight", service:"Long haul", minutes:75, color:"#4a7fae",
    /* inland through the Willamette and Central valleys, as it really runs */
    stops:[ {c:"sea"}, {c:"pdx"},
            {c:"sfo", via:[[-122.8,44.1],[-122.0,41.0],[-121.6,38.6]]},
            {c:"lax", via:[[-121.3,36.6],[-120.4,35.0]]} ]
  },
  {
    id:"zephyr", name:"California Zephyr", service:"Transcon", minutes:90, color:"#8f6aa0",
    stops:[ {c:"chi"}, {c:"oma", via:[[-91.5,41.5]]}, {c:"den"},
            {c:"slc", via:[[-107.6,41.3]]}, {c:"sfo", via:[[-117.0,39.6]]} ]
  }
];

/* Charter — any duration you like, run as a dead-straight special. */
const CHARTER = {
  id:"charter", name:"Charter", service:"Special", minutes:35, color:"#8b929b",
  charter:true, straight:true,
  stops:[ {c:"lax"}, {c:"den"}, {c:"chi"}, {c:"nyc"} ]
};

/* Four dark, four light, shown in two columns. `sequoia` was retired to keep
   the balance — it was the closest duplicate of `night` (both near-black with
   an amber accent). A save still holding it falls back to `night`. */
const THEMES = [
  { id:"night",     n:"Night Service", bg:"#0b0f14", ac:"#e6a340", mode:"dark"  },
  { id:"blueprint", n:"Blueprint",     bg:"#0a1420", ac:"#54c6d8", mode:"dark"  },
  { id:"ember",     n:"Ember",         bg:"#100d0c", ac:"#d26a45", mode:"dark"  },
  { id:"terminal",  n:"Terminal",      bg:"#050806", ac:"#46d47c", mode:"dark"  },
  { id:"daybreak",  n:"Daybreak",      bg:"#f4f0e7", ac:"#b3452e", mode:"light" },
  { id:"timetable", n:"Timetable",     bg:"#f1ebdd", ac:"#2f6a4a", mode:"light" },
  { id:"alpine",    n:"Alpine",        bg:"#eef1f4", ac:"#2c6e9e", mode:"light" },
  { id:"porcelain", n:"Porcelain",     bg:"#f6f6f4", ac:"#3f4a55", mode:"light" }
];

const DEFAULTS = {
  schemaVersion: SCHEMA,
  settings:{ breakMinutes:5, longBreakMinutes:15, roundsUntilLongBreak:4,
             chimeEnabled:true, notifyEnabled:false, charterMinutes:35, theme:"night",
             /* every fader starts just off the stop, so the mixer makes sound
                the moment it is opened without ten beds arriving at once; push
                up what you want. Zeroes are stored explicitly or a silenced
                scape would come back at the default on the next reload. */
             soundMix:{ rails:0.15, rain:0.15, window:0.15, thunder:0.15, ocean:0.15,
                        wind:0.15, fire:0.15, night:0.15, cafe:0.15, espresso:0.15 },
             soundVolume:0.5, soundMuted:false, soundDuringBreak:true,
             camera:"follow", pace:15 },
  customRoutes: [],
  activeRide: null,
  activeBreak: null,
  journey: {},     // routeId -> leg index the train is departing from
  round: 0,        // completed work legs since the last long break
  rides: [],
  stats: { totalPoints:0, currentStreak:0, longestStreak:0 }
};

const RM = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ═══════════════════════════════════════════════════════════════
   2. Storage — merge over defaults, never trust stored derived data
   ═══════════════════════════════════════════════════════════════ */
function clone(o){ return JSON.parse(JSON.stringify(o)); }

function deepMerge(base, over){
  const out = clone(base);
  if(!over || typeof over !== "object") return out;
  for(const k of Object.keys(over)){
    const v = over[k];
    if(v === undefined) continue;
    if(v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])){
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

let db = clone(DEFAULTS);

function load(){
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch(e){ /* storage blocked */ }
  if(!raw){ db = clone(DEFAULTS); return; }
  let parsed;
  try { parsed = JSON.parse(raw); } catch(e){ parsed = null; }
  db = deepMerge(DEFAULTS, parsed || {});
  if(!Array.isArray(db.rides)) db.rides = [];
  if(!Array.isArray(db.customRoutes)) db.customRoutes = [];
  /* Ambience used to be one scape at a time; fold an old `soundId` into the
     mix as a single layer, then drop it so this runs exactly once. */
  const st = db.settings;
  if(!st.soundMix || typeof st.soundMix !== "object" || Array.isArray(st.soundMix)) st.soundMix = {};
  if(st.soundId){
    if(st.soundId !== "none") st.soundMix[st.soundId] = 1;
    delete st.soundId;
  }
  db.schemaVersion = SCHEMA;
  riddenCache = null;
}

function save(){
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch(e){ console.warn("Focus Train: could not persist state", e); }
  post("state");   /* §2b: other tabs re-load rather than render stale state */
}

const uid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2,8));

/* ═══════════════════════════════════════════════════════════════
   2b. Multi-tab guard — exactly one tab drives the clock
   ═══════════════════════════════════════════════════════════════
   With two tabs open, each used to run its own completion timer and
   each log an arrival: the ride was double-counted and points were
   inflated. So one tab holds the *drive* — it owns the timers and is
   the only tab allowed to complete a ride or end a layover. The rest
   mirror it read-only and re-load on every write.

   Ownership is settled by asking, not by a heartbeat. This app lives
   in a background tab, where timers are throttled to roughly once a
   minute; a heartbeat from the driving tab would look dead and a
   second tab would claim the drive alongside it. Message delivery is
   not throttled that way, so "who is driving?" / "I am" is the test
   that actually holds up here. */
const TAB_ID = uid();
const BOOT_AT = Date.now();   /* was this tab open to see the ride end? */
const chan = ("BroadcastChannel" in self) ? new BroadcastChannel("focus-train") : null;
let driving   = false;   /* does this tab own the clock? */
let mirroring = false;   /* confirmed: another tab owns it */
let probeTimer = null;   /* pending claim, cancelled if someone answers */
let lastProbe = 0;

function post(type){ if(chan) try{ chan.postMessage({ type, from: TAB_ID }); }catch(e){} }

/* `authoritative` = the user boarded here, so this tab wins outright.
   A claim picked up after a silent probe is contended and can collide. */
function takeDrive(authoritative){
  clearTimeout(probeTimer); probeTimer = null;
  driving = true; mirroring = false;
  post(authoritative ? "own" : "claim");
  resolveActiveRide();          /* a window that elapsed while no tab was driving */
  scheduleCompletion();
  scheduleBreakEnd();
}

function dropDrive(){
  clearTimeout(probeTimer); probeTimer = null;
  clearTimeout(completionTimer);
  clearTimeout(breakTimer);
  driving = false; mirroring = true;
}

/* Ask whether anyone is driving; claim the drive if nobody answers. */
function probeDrive(){
  if(driving || probeTimer) return;
  if(!chan){ takeDrive(true); renderAll(); return; }   /* no channel: necessarily alone */
  lastProbe = Date.now();
  post("who");
  /* jitter, so two tabs probing together rarely claim in the same instant */
  probeTimer = setTimeout(() => { probeTimer = null; takeDrive(false); renderAll(); },
                          350 + Math.random()*150);
}

/* The driving tab was closed or crashed and the window is past due.
   Cheap enough to call from the paint loop; rate-limited to one probe
   every 3 s so a genuinely silent network of tabs does not spin. */
function ensureDriver(){
  if(driving || !chan) return;
  const overdue = (db.activeRide  && Date.now() > rideEnd(db.activeRide) + 2000)
               || (db.activeBreak && Date.now() > Date.parse(db.activeBreak.endsAt) + 2000);
  if(overdue && Date.now() - lastProbe > 3000) probeDrive();
}

if(chan) chan.onmessage = (e) => {
  const m = e.data || {};
  if(!m.type || m.from === TAB_ID) return;
  switch(m.type){
    case "who":     if(driving) post("iam"); break;
    case "iam":     dropDrive(); renderAll(); break;
    case "own":     dropDrive(); load(); renderAll(); break;   /* a user boarded there */
    /* Two tabs can claim in the same instant — both probed, neither answered.
       Settle it rather than have both stand down and leave the clock
       unattended: lowest tab id keeps the drive and re-asserts, and the
       re-assert is authoritative so the other tab yields for good. */
    case "claim":
      if(driving && TAB_ID < m.from){ post("own"); break; }
      dropDrive(); load(); renderAll();
      break;
    case "state":
      load();
      if(driving){ scheduleCompletion(); scheduleBreakEnd(); }
      /* If this tab is the one actually making the sound, follow a mix edited
         in another tab. Only ever re-applied where beds are already running —
         never enough to start audio in a tab that should be silent. */
      if(Object.keys(layers).length) applyMix(0.4);
      renderAll();
      break;
    case "release": if(!driving) probeDrive(); break;
  }
};

/* Hand the drive on cleanly when this tab goes away. Stand down *before*
   announcing it: an unloading tab can still answer the "who is driving?"
   that its own release provokes, and then no tab picks the drive up. */
window.addEventListener("pagehide", () => {
  if(!driving) return;
  driving = false;
  post("release");
});

/* ═══════════════════════════════════════════════════════════════
   3. Derived stats — rides[] is the single source of truth
   ═══════════════════════════════════════════════════════════════ */
function computeStats(){
  const rides = db.rides.slice().sort((a,b)=> Date.parse(a.startedAt) - Date.parse(b.startedAt));
  let total = 0, longest = 0, run = 0, completed = 0, seconds = 0;
  for(const r of rides){
    total += r.pointsEarned || 0;
    seconds += r.actualSeconds || 0;
    if(r.completed){ completed++; run++; if(run > longest) longest = run; }
    else run = 0;
  }
  let current = 0;
  for(let i = rides.length - 1; i >= 0; i--){
    if(rides[i].completed) current++; else break;
  }
  const s = { totalPoints:total, currentStreak:current, longestStreak:longest,
              completed, attempted:rides.length, seconds };
  db.stats = { totalPoints:total, currentStreak:current, longestStreak:longest };
  return s;
}

/* Local-calendar-day buckets from stored UTC timestamps. */
function dayKey(d){
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function dailyMinutes(){
  const map = new Map();
  for(const r of db.rides){
    const k = dayKey(new Date(r.startedAt));
    map.set(k, (map.get(k) || 0) + (r.actualSeconds || 0)/60);
  }
  return map;
}

/* ═══════════════════════════════════════════════════════════════
   4. Route helpers
   ═══════════════════════════════════════════════════════════════ */
function allRoutes(){
  return ROUTES.concat(
    db.customRoutes.map(c => ({ ...CHARTER, id:c.id, name:c.name, minutes:c.minutes, custom:true })),
    [CHARTER]
  );
}
function routeById(id){ return allRoutes().find(r => r.id === id) || null; }

/* Index of the city the train is currently standing at (0 .. last). */
function standingAt(route){
  const j = db.journey[route.id] || 0;
  return Math.min(Math.max(0, j), route.stops.length - 1);
}
/* Which leg does the next ride run? At the end of the line a fresh run
   starts from the origin — the wrap happens on departure, not on arrival,
   so the train visibly waits at the terminus. */
function legIndex(route){
  const j = standingAt(route);
  return j >= route.stops.length - 1 ? 0 : j;
}
function stopName(route, i){
  return CITIES[route.stops[Math.min(Math.max(0,i), route.stops.length-1)].c].n;
}
function routeMinutes(route){
  if(route.id === "charter") return clampMin(db.settings.charterMinutes);
  return route.minutes;
}
/* Every city carries real coordinates, so distance is free — and "301 miles
   to go" conveys motion that 1.5 px a minute cannot. `ll` is [lon, lat]. */
function haversine(a, b){
  const R = 3958.8, rad = Math.PI/180;
  const dLat = (b[1]-a[1])*rad, dLon = (b[0]-a[0])*rad;
  const h = Math.sin(dLat/2)**2 +
            Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1, Math.sqrt(h)));
}
/* Follows the via points the track is actually drawn through, so the number
   matches the line on the map rather than the great circle. */
function legMiles(route, i){
  const a = route && route.stops && route.stops[i], b = route && route.stops && route.stops[i+1];
  if(!a || !b) return 0;
  const pts = [CITIES[a.c].ll].concat(b.via || [], [CITIES[b.c].ll]);
  let m = 0;
  for(let j = 1; j < pts.length; j++) m += haversine(pts[j-1], pts[j]);
  return m;
}
function routeMiles(route){
  let m = 0;
  for(let i = 0; i < route.stops.length - 1; i++) m += legMiles(route, i);
  return m;
}
function fmtMiles(m){ return Math.round(m).toLocaleString(); }

/* Legs actually completed, as "routeId:legIndex". The map stops being just a
   picker and becomes a record of where you have been. Keyed on rides.length
   so an import or a reset rebuilds it without an explicit invalidation. */
let riddenCache = null, riddenAt = -1;
function riddenLegs(){
  if(riddenCache && riddenAt === db.rides.length) return riddenCache;
  riddenAt = db.rides.length;
  const set = new Set();
  for(const r of db.rides) if(r.completed) set.add(r.routeId + ":" + r.legIndex);
  return (riddenCache = set);
}
function lifetimeMiles(){
  let m = 0;
  for(const r of db.rides){
    if(!r.completed) continue;
    const route = routeById(r.routeId);
    if(route) m += legMiles(route, r.legIndex);
  }
  return m;
}

function clampMin(m){
  m = Math.round(Number(m) || 0);
  return Math.min(240, Math.max(1, m));
}

/* ═══════════════════════════════════════════════════════════════
   5. Map geometry — real coordinates, projected at draw time
   ═══════════════════════════════════════════════════════════════ */
const f2 = n => Math.round(n*100)/100;

/* Catmull-Rom control points computed across the WHOLE route, then emitted
   one leg at a time. Doing it route-wide is what keeps the curve continuous
   through each city instead of kinking at every stop. */
function routeGeometry(route){
  const pts = [], stopAt = [];
  route.stops.forEach(st => {
    (st.via || []).forEach(v => pts.push(project(v)));
    stopAt.push(pts.length);
    pts.push(project(CITIES[st.c].ll));
  });

  const seg = [];
  for(let i = 0; i < pts.length - 1; i++){
    const p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || pts[i+1];
    seg.push({
      c1:[ p1[0] + (p2[0]-p0[0])/6, p1[1] + (p2[1]-p0[1])/6 ],
      c2:[ p2[0] - (p3[0]-p1[0])/6, p2[1] - (p3[1]-p1[1])/6 ],
      to:p2
    });
  }

  const legs = [];
  for(let i = 0; i < stopAt.length - 1; i++){
    const a = stopAt[i], b = stopAt[i+1];
    let d = `M ${f2(pts[a][0])} ${f2(pts[a][1])}`;
    for(let j = a; j < b; j++){
      d += route.straight
        ? ` L ${f2(seg[j].to[0])} ${f2(seg[j].to[1])}`
        : ` C ${f2(seg[j].c1[0])} ${f2(seg[j].c1[1])} ${f2(seg[j].c2[0])} ${f2(seg[j].c2[1])} ${f2(seg[j].to[0])} ${f2(seg[j].to[1])}`;
    }
    legs.push(d);
  }
  return legs;
}

const SVGNS = "http://www.w3.org/2000/svg";
function el(tag, attrs){
  const n = document.createElementNS(SVGNS, tag);
  for(const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

const map = document.getElementById("map");
const stage = document.querySelector(".stage");   /* the map's box; the camera sizes against it */
const legPaths = {};          // routeId -> [<path> per leg]

function buildMap(){
  map.textContent = "";
  const land = US_OUTLINE.map(project);
  const gLand = el("g",{}), gRail = el("g",{}), gTrav = el("g",{}),
        gDot  = el("g",{}), gLbl  = el("g",{}), gHit = el("g",{});

  const ring = pts => "M " + pts.map(q => f2(q[0]) + " " + f2(q[1])).join(" L ") + " Z";
  gLand.appendChild(el("path",{
    id:"land", "fill-rule":"evenodd",
    d: ring(land) + " " + ring(LAKE_MICHIGAN.map(project))
  }));

  const served = new Set();
  for(const route of ROUTES.concat([CHARTER])){
    const paths = [];
    routeGeometry(route).forEach((d, i) => {
      gHit.appendChild(el("path",{ d, class:"hit", "data-route":route.id }));
      const rail = el("path",{ d, stroke:route.color, "data-route":route.id, "data-leg":i,
                               class:"rail" + (route.straight ? " dash" : "") });
      gRail.appendChild(rail);
      paths.push(rail);
    });
    legPaths[route.id] = paths;
    if(!route.charter) route.stops.forEach(st => served.add(st.c));
  }

  /* Every city gets drawn. The ones no service calls at stay plain — which
     is honest, and is what the real national map looks like. */
  for(const id in CITIES){
    const c = CITIES[id], p = project(c.ll), isServed = served.has(id);
    gDot.appendChild(el("circle",{
      cx:f2(p[0]), cy:f2(p[1]), r: isServed ? 3.6 : 2.2,
      class:"dot" + (isServed ? "" : " plain"), "data-city":id
    }));
    const t = el("text",{ class:"lbl" + (isServed ? "" : " plain"), "data-city":id });
    t.textContent = c.n;
    const o = c.la || "below", dx = c.dx || 0, dy = c.dy || 0;
    let ox, oy, anchor;
    if(o === "above"){ ox = dx;     oy = -9 + dy;  anchor = "middle"; }
    else if(o === "below"){ ox = dx;     oy = 16 + dy;  anchor = "middle"; }
    else if(o === "left"){  ox = -8 + dx; oy = 3.5 + dy; anchor = "end"; }
    else {                  ox = 8 + dx;  oy = 3.5 + dy; anchor = "start"; }
    t.setAttribute("text-anchor", anchor);
    /* the anchor point and its offset, kept apart so scaleMap() can re-apply
       the offset against the current zoom */
    t.__p = p; t.__ox = ox; t.__oy = oy;
    t.setAttribute("x", f2(p[0]+ox)); t.setAttribute("y", f2(p[1]+oy));
    gLbl.appendChild(t);
  }

  gTrav.appendChild(el("path",{ class:"trav", id:"trav", d:"", opacity:"0" }));
  gTrav.appendChild(el("circle",{ id:"pulse", r:"6", cx:"-999", cy:"-999", opacity:"0" }));

  const train = el("g",{ id:"train", opacity:"0" });
  train.appendChild(el("rect",{ x:-14, y:-7, width:28, height:14, rx:5, class:"body" }));
  train.appendChild(el("rect",{ x:2.5, y:-3.4, width:6, height:6.8, rx:2, class:"win" }));
  train.appendChild(el("circle",{ cx:-7, cy:0, r:1.8, class:"win" }));
  train.appendChild(el("circle",{ cx:-1.6, cy:0, r:1.8, class:"win" }));

  /* Labels paint last: zoomed in, the train is big enough to swallow a city
     name, and the name is the more useful of the two. */
  map.append(gLand, gRail, gTrav, gDot, gHit, train, gLbl);

  /* Fit the viewBox to whatever the projection actually produced. */
  const xs = land.map(p=>p[0]), ys = land.map(p=>p[1]);
  NATIONAL = [ +f2(Math.min(...xs)-64), +f2(Math.min(...ys)-26),
               +f2(Math.max(...xs)-Math.min(...xs)+128),
               +f2(Math.max(...ys)-Math.min(...ys)+56) ];
  NATIONAL_W = NATIONAL[2];
  cam.cur = NATIONAL.slice();
  cam.tgt = NATIONAL.slice();
  applyCam();

  gHit.addEventListener("click", e => {
    const id = e.target.getAttribute("data-route");
    if(!id || phase() !== "idle") return;
    if(id === "charter" && sel && sel.custom) return;   // keep the custom route selected
    select(id);
  });
}

/* ═══════════════════════════════════════════════════════════════
   6. Audio — created on the boarding gesture (autoplay policy)
   ═══════════════════════════════════════════════════════════════ */
let actx = null;
function ensureAudio(){
  try{
    if(!actx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      actx = new AC();
    }
    if(actx.state === "suspended") actx.resume();
  }catch(e){ actx = null; }
}
function tone(freq, at, dur, peak){
  if(!actx) return;
  const t0 = actx.currentTime + at;
  const osc = actx.createOscillator();
  const g = actx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(actx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}
function chime(kind){
  if(!db.settings.chimeEnabled || !actx) return;
  duckAmbient();
  if(kind === "arrive"){          // warm two-note bell
    tone(523.25, 0,    1.9, 0.16); tone(783.99, 0,    1.9, 0.09);
    tone(659.25, 0.20, 2.2, 0.14); tone(987.77, 0.20, 2.2, 0.07);
  } else if(kind === "break"){    // softer, rising — layover over
    tone(392.00, 0,    1.3, 0.11); tone(587.33, 0.16, 1.6, 0.10);
  } else if(kind === "depart"){   // low, brief
    tone(196.00, 0,    0.45, 0.09); tone(261.63, 0.05, 0.5, 0.05);
  }
}
function notify(title, body){
  if(!db.settings.notifyEnabled) return;
  try{
    if(typeof Notification !== "undefined" && Notification.permission === "granted"){
      new Notification(title, { body, silent:true });
    }
  }catch(e){ /* degrade silently */ }
}
function askNotify(){
  try{
    if(typeof Notification === "undefined") return Promise.resolve("denied");
    if(Notification.permission !== "default") return Promise.resolve(Notification.permission);
    return Notification.requestPermission();
  }catch(e){ return Promise.resolve("denied"); }
}


/* ═══════════════════════════════════════════════════════════════
   6b. Soundscape — ambient beds, synthesized, never sampled
   ═══════════════════════════════════════════════════════════════
   Sample files would mean a sounds/ folder, tens of megabytes, loop
   seams and a loading state. Noise-based textures synthesize well
   enough that none of that is worth it — which is also why the café
   is room tone and crockery rather than babble: voices do not
   synthesize, and "a room with people in it" is the useful part.

   One shared noise buffer feeds every bed. Each scape owns a gain
   node, so switching scapes crossfades instead of cutting. Chimes
   deliberately bypass the ambient bus straight to destination, and
   the bus ducks under them, so an arrival always cuts through. */
let bus = null;          /* master ambient gain -> destination */
let layers = Object.create(null);   /* id -> { id, gain, nodes[], event(t), gap(), nextAt } */
let noiseBuf = null;     /* one 8 s stereo white-noise buffer, made once */
let pumpTimer = null;
let mixerOpen = false;    /* the Ambience panel is up, so the mix is audible while idle */
const LOOKAHEAD = 8;     /* seconds of discrete events queued on the audio clock */

/* Brown noise is perceptually far louder than bandpassed white, so
   per-scape levels are trimmed by hand rather than left at parity. */
const SCAPE_GAIN = { rails:0.42, rain:0.43, window:0.70, fire:0.34, ocean:0.70,
                     thunder:0.42, cafe:1.45, espresso:1.60, wind:1.25, night:5.00 };

/* Order is the mixer's order: the app's own sound first, then weather,
   then rooms. No "silence" entry — a slider at zero is silence. */
const SCAPES = [
  { id:"rails",    n:"Aboard",      d:"Bogie rumble and rail joints" },
  { id:"rain",     n:"Rainfall",    d:"Steady, breathing" },
  { id:"window",   n:"On a window", d:"Rain plus droplets" },
  { id:"thunder",  n:"Thunder",     d:"Rain with distant rumbles" },
  { id:"ocean",    n:"Ocean",       d:"Long swells" },
  { id:"wind",     n:"Wind",        d:"Gusting" },
  { id:"fire",     n:"Fireside",    d:"Embers and crackle" },
  { id:"night",    n:"Crickets",    d:"Sparse chirps" },
  { id:"cafe",     n:"Café",        d:"Room tone and crockery" },
  { id:"espresso", n:"Coffee bar",  d:"Café, plus grinder and steam" }
];

function noise(){
  if(noiseBuf) return noiseBuf;
  const n = Math.floor(actx.sampleRate * 8);
  noiseBuf = actx.createBuffer(2, n, actx.sampleRate);
  for(let ch = 0; ch < 2; ch++){
    const d = noiseBuf.getChannelData(ch);
    for(let i = 0; i < n; i++) d[i] = Math.random()*2 - 1;
  }
  return noiseBuf;
}
/* A looping slice of that buffer, started at an exact time on the audio
   clock and from a random offset so repeats never line up audibly. */
function noiseSrc(rate, when){
  const s = actx.createBufferSource();
  s.buffer = noise(); s.loop = true;
  s.playbackRate.value = rate || 1;
  s.start(when || 0, Math.random()*7);
  return s;
}
function biq(type, freq, q){
  const f = actx.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  if(q != null) f.Q.value = q;
  return f;
}
function gn(v){ const g = actx.createGain(); g.gain.value = v; return g; }
/* Slow oscillator wired into an AudioParam — the breathing in every bed. */
function lfo(param, rate, depth, base){
  param.value = base;
  const o = actx.createOscillator(), g = gn(depth);
  o.frequency.value = rate;
  o.connect(g); g.connect(param); o.start();
  return [o];
}
/* A short filtered noise burst at an exact time — the atom of every
   discrete event: crackles, droplets, rail joints, chair scrapes. */
function burst(t, o){
  const s = noiseSrc(o.rate || 1, t), f = biq(o.type || "bandpass", o.freq, o.q), g = actx.createGain();
  const dur = o.dur || 0.05;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.peak || 0.3, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(o.to);
  s.stop(t + dur + 0.05);
}

/* Each builder wires a bed into `g` and may return an `event(t)` that
   schedules one discrete sound, plus `gap()` for the time until the
   next one. Anything with a stop() goes in `nodes` so it can be torn
   down; scheduled one-shots stop themselves and are left to GC. */
const SCAPE_BUILD = {
  rain(g){
    const s = noiseSrc(1, 0), lp = biq("lowpass", 1800, 0.4), hp = biq("highpass", 300);
    s.connect(hp); hp.connect(lp); lp.connect(g);
    return { nodes:[s].concat(lfo(lp.frequency, 0.05, 300, 1800)) };
  },
  window(g){
    const sub = gn(0.6); sub.connect(g);
    const bed = SCAPE_BUILD.rain(sub);
    return { nodes: bed.nodes,
      event(t){ burst(t, { to:g, freq:1200 + Math.random()*1800, q:6, dur:0.012, peak:0.10 }); },
      gap(){ return 0.04 + Math.random()*0.10; } };
  },
  fire(g){
    const s = noiseSrc(1, 0), lp = biq("lowpass", 220), amp = gn(3);
    s.connect(lp); lp.connect(amp); amp.connect(g);
    return { nodes:[s],
      event(t){
        const n = Math.random() < 0.18 ? 3 : 1;        /* occasional triple */
        for(let i = 0; i < n; i++)
          burst(t + i*0.045, { to:g, freq:900 + Math.random()*3600, q:3,
                               dur:0.04 + Math.random()*0.05, peak:0.22 });
      },
      /* Poisson gaps: crackles clump the way a real fire's do */
      gap(){ return 0.05 - Math.log(1 - Math.random())*0.12; } };
  },
  ocean(g){
    const s = noiseSrc(1, 0), lp = biq("lowpass", 900), amp = gn(0.0001);
    s.connect(lp); lp.connect(amp); amp.connect(g);
    let wave = 0;
    return { nodes:[s],
      /* one swell per event; the filter opens on the crest */
      event(t){
        wave = 11 + Math.random()*5;
        amp.gain.setValueAtTime(0.06, t);
        amp.gain.linearRampToValueAtTime(0.85, t + wave*0.35);
        amp.gain.linearRampToValueAtTime(0.06, t + wave);
        lp.frequency.setValueAtTime(500, t);
        lp.frequency.linearRampToValueAtTime(1600, t + wave*0.35);
        lp.frequency.linearRampToValueAtTime(500, t + wave);
      },
      gap(){ return wave; } };
  },
  thunder(g){
    const bed = SCAPE_BUILD.rain(g);
    return { nodes: bed.nodes,
      event(t){
        const dur = 2.5 + Math.random()*2.5;
        const s = noiseSrc(0.75, t), lp = biq("lowpass", 180), amp = actx.createGain();
        const pan = actx.createStereoPanner ? actx.createStereoPanner() : null;
        if(pan) pan.pan.value = Math.random()*1.6 - 0.8;
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(0.9, t + 0.25);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.playbackRate.setValueAtTime(0.75, t);            /* the pitch falls away */
        s.playbackRate.linearRampToValueAtTime(0.45, t + dur);
        s.connect(lp); lp.connect(amp);
        if(pan){ amp.connect(pan); pan.connect(g); } else amp.connect(g);
        s.stop(t + dur + 0.1);
      },
      gap(){ return 25 + Math.random()*45; } };
  },
  wind(g){
    const s = noiseSrc(1, 0), bp = biq("bandpass", 400, 1.2), amp = gn(0.5);
    s.connect(bp); bp.connect(amp); amp.connect(g);
    /* the gusting *is* the effect: frequency and level both drift */
    return { nodes:[s].concat(lfo(bp.frequency, 0.03, 250, 400))
                      .concat(lfo(amp.gain, 0.05, 0.35, 0.5)) };
  },
  cafe(g){
    const s = noiseSrc(1, 0), hp = biq("highpass", 180), lp = biq("lowpass", 1100), amp = gn(0.35);
    s.connect(hp); hp.connect(lp); lp.connect(amp); amp.connect(g);
    return { nodes:[s],
      event(t){
        if(Math.random() < 0.15){                          /* a chair going back */
          burst(t, { to:g, freq:400, q:2, dur:0.3, peak:0.12 });
          return;
        }
        const o = actx.createOscillator(), a = actx.createGain();
        o.type = "triangle";
        o.frequency.value = 1400 + Math.random()*1800;
        a.gain.setValueAtTime(0.0001, t);
        a.gain.exponentialRampToValueAtTime(0.10, t + 0.004);
        a.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(a); a.connect(g);
        o.start(t); o.stop(t + 0.1);
      },
      gap(){ return 2 + Math.random()*4; } };
  },
  espresso(g){
    const bed = SCAPE_BUILD.cafe(g);
    let step = 0;                                           /* grind → steam → quiet */
    return { nodes: bed.nodes,
      event(t){
        if(step === 0){
          const o = actx.createOscillator(), s = noiseSrc(1, t), lp = biq("lowpass", 700), a = actx.createGain();
          o.type = "sawtooth"; o.frequency.value = 90;
          o.connect(lp); s.connect(lp); lp.connect(a); a.connect(g);
          a.gain.setValueAtTime(0.0001, t);
          a.gain.exponentialRampToValueAtTime(0.25, t + 0.3);
          a.gain.setValueAtTime(0.25, t + 3.5);
          a.gain.exponentialRampToValueAtTime(0.0001, t + 4);
          o.start(t); o.stop(t + 4.1); s.stop(t + 4.1);
        } else if(step === 1){
          const s = noiseSrc(1, t), hp = biq("highpass", 4000), a = actx.createGain();
          a.gain.setValueAtTime(0.0001, t);
          a.gain.exponentialRampToValueAtTime(0.22, t + 0.5);
          a.gain.setValueAtTime(0.22, t + 5);
          a.gain.exponentialRampToValueAtTime(0.0001, t + 6);
          s.connect(hp); hp.connect(a); a.connect(g);
          s.stop(t + 6.1);
        } else bed.event(t);
        step = (step + 1) % 3;
      },
      gap(){ return step === 0 ? 40 + Math.random()*50 : step === 1 ? 4.5 : 6.5; } };
  },
  night(g){
    const s = noiseSrc(1, 0), lp = biq("lowpass", 500), amp = gn(0.06);
    s.connect(lp); lp.connect(amp); amp.connect(g);
    return { nodes:[s],
      /* chirp pairs, detuned per insect */
      event(t){
        const f = 4300 + Math.random()*500;
        for(let i = 0; i < 2; i++){
          const o = actx.createOscillator(), a = actx.createGain(), t0 = t + i*0.03;
          o.frequency.value = f;
          a.gain.setValueAtTime(0.0001, t0);
          a.gain.exponentialRampToValueAtTime(0.05, t0 + 0.003);
          a.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
          o.connect(a); a.connect(g);
          o.start(t0); o.stop(t0 + 0.05);
        }
      },
      gap(){ return 0.4 + Math.random()*0.5; } };
  },
  rails(g){
    const s = noiseSrc(1, 0), lp = biq("lowpass", 140), amp = gn(2.6);
    s.connect(lp); lp.connect(amp); amp.connect(g);
    return { nodes:[s].concat(lfo(amp.gain, 0.08, 0.9, 2.6)),
      /* the "da-dum" of a bogie crossing a rail joint */
      event(t){
        burst(t,        { to:g, freq:250, q:1.4, dur:0.05, peak:0.50, rate:0.6 });
        burst(t + 0.09, { to:g, freq:250, q:1.4, dur:0.05, peak:0.42, rate:0.6 });
      },
      gap(){ return 1.3 + Math.random()*0.2; } };
  }
};

function ensureBus(){
  if(!actx) return null;
  if(!bus){ bus = actx.createGain(); bus.gain.value = 0; bus.connect(actx.destination); }
  return bus;
}
function ambientLevel(){
  if(db.settings.soundMuted) return 0.0001;
  const v = Math.max(0, Math.min(1, Number(db.settings.soundVolume)));
  return Math.max(0.0001, Math.pow(v, 1.6));
}
function setAmbientVolume(ramp){
  if(!bus || !actx) return;
  const t = holdNow(bus.gain);
  bus.gain.linearRampToValueAtTime(ambientLevel(), t + (ramp == null ? 0.15 : ramp));
}
/* Hold a param at whatever it is right now, so a new ramp starts from the
   audible value rather than from wherever the last schedule was headed. */
function holdNow(param){
  const t = actx.currentTime;
  if(param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
  else { param.cancelScheduledValues(t); param.setValueAtTime(Math.max(0.0001, param.value), t); }
  return t;
}

function mixOf(id){
  const m = db.settings.soundMix || {};
  const v = Number(m[id]);
  return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}
/* Is anything in the mix turned up at all? */
function mixActive(){
  return Object.keys(SCAPE_BUILD).some(id => mixOf(id) > 0);
}
/* The user's 0–1 slider scaled by the scape's hand-tuned normalisation, so
   50% of fire and 50% of rain are actually comparable in loudness. */
function layerGain(id){ return Math.max(0.0001, (SCAPE_GAIN[id] || 0.5) * mixOf(id)); }

function startLayer(id, fade){
  const build = SCAPE_BUILD[id];
  if(!build) return;
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(layerGain(id), actx.currentTime + fade);
  g.connect(bus);
  const s = build(g);
  const L = { id:id, gain:g, nodes:s.nodes || [], event:s.event, gap:s.gap, nextAt:0 };
  L.nextAt = actx.currentTime + (L.gap ? L.gap() : 0);
  layers[id] = L;
}
function rampLayer(L, to, fade){
  const t = holdNow(L.gain.gain);
  L.gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, to), t + fade);
}
function endLayer(id, fade){
  const L = layers[id];
  if(!L) return;
  delete layers[id];
  rampLayer(L, 0.0001, fade);
  /* tear-down may be late in a throttled tab; it is silent by then anyway */
  setTimeout(() => {
    L.nodes.forEach(n => { try{ n.stop(); }catch(e){} });
    try{ L.gain.disconnect(); }catch(e){}
  }, fade*1000 + 300);
}

/* Bring the running layers into line with settings.soundMix: start what has
   just come off zero, fade out what has gone to zero, ride the rest to their
   new level. Every slider move calls this, so it stays cheap and idempotent —
   and it is the only thing that ever starts or stops a bed. */
/* Which tab is allowed to make sound: while a ride or layover is running it
   is whichever tab drives the clock (§2b), so a mirroring tab never builds a
   second, competing mix. With nothing running, any tab may audition. */
function canSound(){ return phase() === "idle" || driving; }

function applyMix(fade){
  if(!canSound()) return;
  ensureAudio();
  if(!actx) return;
  fade = fade == null ? 0.6 : fade;
  ensureBus();
  for(const id of Object.keys(SCAPE_BUILD)){
    const want = mixOf(id), have = layers[id];
    if(want > 0 && !have)      startLayer(id, fade);
    else if(want > 0 && have)  rampLayer(have, layerGain(id), fade);
    else if(want <= 0 && have) endLayer(id, fade);
  }
  setAmbientVolume(0.1);
  startPump();
}
function stopAmbient(fade){
  if(!actx) return;
  fade = fade == null ? 1.2 : fade;
  for(const id of Object.keys(layers)) endLayer(id, fade);
  stopPump();
}

/* The trap this app is built around, again: a hidden tab throttles
   timers to ~1/s or worse, so `setInterval(crackle, 400)` would stutter
   the moment the user switches to their editor — which is where they
   are supposed to be. So the timer never makes a sound; it only queues
   events LOOKAHEAD seconds ahead on the AudioContext clock, which does
   not throttle. Even at one pump every 5 s the audio stays seamless.
   Each layer carries its own queue pointer, so mixed beds stay independent. */
function pump(){
  if(!actx) return;
  const now = actx.currentTime, horizon = now + LOOKAHEAD;
  for(const id of Object.keys(layers)){
    const L = layers[id];
    if(!L.event) continue;
    if(L.nextAt < now) L.nextAt = now + 0.05;   /* after a long throttle, don't dump the backlog */
    let guard = 0;
    while(L.nextAt < horizon && guard++ < 500){
      L.event(L.nextAt);
      L.nextAt += Math.max(0.02, L.gap());
    }
  }
}
function startPump(){
  stopPump();
  if(Object.keys(layers).some(id => !!layers[id].event)){
    pump();
    pumpTimer = setInterval(pump, 2000);
  }
}
function stopPump(){ if(pumpTimer) clearInterval(pumpTimer); pumpTimer = null; }

/* Duck the bed ~6 dB for two seconds so an arrival bell lands clear. */
function duckAmbient(){
  if(!bus || !actx || !Object.keys(layers).length) return;
  const lvl = ambientLevel(), t = holdNow(bus.gain);
  bus.gain.linearRampToValueAtTime(lvl*0.5, t + 0.12);
  bus.gain.setValueAtTime(lvl*0.5, t + 2);
  bus.gain.linearRampToValueAtTime(lvl, t + 3);
}

/* ═══════════════════════════════════════════════════════════════
   7. Ride lifecycle — everything measured from timestamps
   ═══════════════════════════════════════════════════════════════ */
let sel = null;               // selected route object
let completionTimer = null;   // fires close to the real end even in a throttled tab
let breakTimer = null;        // ditto for the end of a layover
let arrivalUntil = 0;         // ms; arrival flourish window
let layoverDone = false;      // "layover complete, ready to depart" banner

function phase(){
  if(db.activeRide) return "work";
  if(db.activeBreak && Date.now() < Date.parse(db.activeBreak.endsAt)) return "break";
  return "idle";
}
function rideEnd(r){ return Date.parse(r.startedAt) + r.plannedMinutes*60000; }

function select(id){
  const r = routeById(id);
  if(!r) return;
  sel = r;
  renderMap();
  renderConsole();
}

function board(){
  if(!sel || phase() === "work") return;
  ensureAudio();
  if(db.settings.notifyEnabled) askNotify();

  const mins = routeMinutes(sel);
  db.activeBreak = null;
  layoverDone = false;
  db.activeRide = {
    id: uid(), routeId: sel.id, legIndex: legIndex(sel),
    plannedMinutes: mins, startedAt: new Date().toISOString()
  };
  takeDrive(true);      /* claim the clock before any other tab can */
  applyMix(2);          /* ...which is also what lets this tab make sound */
  save();
  chime("depart");
  renderAll();
}

function scheduleCompletion(){
  clearTimeout(completionTimer);
  if(!db.activeRide) return;
  const ms = rideEnd(db.activeRide) - Date.now();
  completionTimer = setTimeout(() => { if(db.activeRide && Date.now() >= rideEnd(db.activeRide)) complete(); },
                               Math.max(0, ms));
}

/* A hidden tab throttles the repaint poll to a crawl, so the layover gets
   its own timer too — otherwise the "back to work" chime lands late. */
function scheduleBreakEnd(){
  clearTimeout(breakTimer);
  if(!db.activeBreak) return;
  const ms = Date.parse(db.activeBreak.endsAt) - Date.now();
  breakTimer = setTimeout(() => {
    if(db.activeBreak && Date.now() >= Date.parse(db.activeBreak.endsAt)) endBreak();
  }, Math.max(0, ms));
}

function complete(){
  const r = db.activeRide;
  if(!r || !driving) return;   /* §2b: only the driving tab logs the arrival */
  const route = routeById(r.routeId);
  const end = rideEnd(r);
  db.rides.push({
    id:r.id, routeId:r.routeId, legIndex:r.legIndex, plannedMinutes:r.plannedMinutes,
    actualSeconds: r.plannedMinutes*60, completed:true, pointsEarned:r.plannedMinutes,
    startedAt:r.startedAt, endedAt:new Date(end).toISOString()
  });
  /* advance the journey to the station just reached — no reset, no reversing */
  db.journey[r.routeId] = r.legIndex + 1;
  db.round += 1;

  const long = db.round % Math.max(1, db.settings.roundsUntilLongBreak) === 0;
  const mins = long ? db.settings.longBreakMinutes : db.settings.breakMinutes;
  db.activeRide = null;
  db.activeBreak = mins > 0
    ? { kind: long ? "long" : "short", routeId: r.routeId,
        endsAt: new Date(Date.now() + mins*60000).toISOString() }
    : null;
  layoverDone = db.activeBreak ? false : true;
  computeStats();
  save();

  const station = route ? stopName(route, r.legIndex + 1) : "destination";
  arrivalUntil = Date.now() + 5200;
  cam.holdUntil = Date.now() + 2000;   /* stay at the station for the flourish */
  /* the bell wants silence around it, so the bed clears first and only
     comes back once the arrival has landed — and only if the layover
     is meant to have sound at all */
  const resumeScape = db.activeBreak && db.settings.soundDuringBreak && mixActive();
  stopAmbient(1.5);
  if(resumeScape) setTimeout(() => { if(phase() === "break") applyMix(2); }, 3000);
  chime("arrive");
  notify("Arrived — " + station, `+${r.plannedMinutes} points. ${db.activeBreak ? (long?"Long layover":"Layover")+" "+mins+" min." : ""}`);
  showToast(`<b>Arrived</b><s>/</s>${station}<s>/</s><b>+${r.plannedMinutes} pts</b>`);
  scheduleBreakEnd();
  if(route) sel = route;
  renderAll();
}

function stopRide(){
  const r = db.activeRide;
  if(!r) return;
  clearTimeout(completionTimer);
  clearTimeout(breakTimer);
  const elapsed = Math.max(0, Math.round((Date.now() - Date.parse(r.startedAt))/1000));
  db.rides.push({
    id:r.id, routeId:r.routeId, legIndex:r.legIndex, plannedMinutes:r.plannedMinutes,
    actualSeconds: elapsed, completed:false, pointsEarned:0,
    startedAt:r.startedAt, endedAt:new Date().toISOString()
  });
  db.activeRide = null;
  db.activeBreak = null;
  layoverDone = false;
  stopAmbient();
  computeStats();
  save();
  showToast(`<s>Ride ended at</s><b>${fmtClock(elapsed)}</b><s>— logged incomplete</s>`);
  renderAll();
}

function skipBreak(){
  clearTimeout(breakTimer);
  db.activeBreak = null;
  layoverDone = true;
  save();
  renderAll();
}

function endBreak(){
  if(!driving) return;         /* §2b: the driving tab ends the layover for everyone */
  clearTimeout(breakTimer);
  db.activeBreak = null;
  layoverDone = true;
  stopAmbient();
  save();
  chime("break");
  notify("Layover over", "Ready to depart when you are.");
  renderAll();
}

/* Closed-tab handling, per the data-model note. Called only by the tab
   holding the drive (§2b) — otherwise a second tab opened in the seconds
   after a ride's window closes would log it incomplete out from under the
   tab that is about to log the arrival. */
function resolveActiveRide(){
  const r = db.activeRide;
  if(!r) return;
  if(Date.now() < rideEnd(r)) return;   /* still inside the window — they refreshed */
  /* This tab was already open when the ride's window closed, so the ride was
     genuinely allowed to run to the end — it just lost the tab that was
     driving the clock. Log the arrival it earned. Only a tab that opened
     *after* the window closed has no idea what happened, and that is the case
     the honest default is for: laptop shut mid-ride, points not claimable. */
  if(BOOT_AT < rideEnd(r)){ complete(); return; }
  db.rides.push({
    id:r.id, routeId:r.routeId, legIndex:r.legIndex, plannedMinutes:r.plannedMinutes,
    actualSeconds: r.plannedMinutes*60, completed:false, pointsEarned:0,
    startedAt:r.startedAt, endedAt:new Date(rideEnd(r)).toISOString(), unverified:true
  });
  db.activeRide = null;
  computeStats();
  save();
}

function resolveOnLoad(){
  if(db.activeBreak && Date.now() >= Date.parse(db.activeBreak.endsAt)) db.activeBreak = null;
  computeStats();
  save();
}

/* ═══════════════════════════════════════════════════════════════
   8. Formatting
   ═══════════════════════════════════════════════════════════════ */
function fmtClock(sec){
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60;
  return (h ? h + ":" + String(m).padStart(2,"0") : String(m)) + ":" + String(s).padStart(2,"0");
}
function fmtDur(sec){
  const m = Math.round(sec/60);
  if(m < 60) return m + "m";
  return Math.floor(m/60) + "h " + String(m%60).padStart(2,"0") + "m";
}
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

let toastTimer = null;
function showToast(html){
  const t = document.getElementById("toast");
  t.innerHTML = html;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 5200);
}

/* ═══════════════════════════════════════════════════════════════
   9. Render — map
   ═══════════════════════════════════════════════════════════════ */
function renderMap(){
  const activeId = db.activeRide ? db.activeRide.routeId
                 : db.activeBreak ? db.activeBreak.routeId
                 : (sel ? sel.id : null);
  const activeRoute = activeId ? routeById(activeId) : null;
  const drawnId = activeRoute && activeRoute.custom ? "charter" : activeId;

  const ridden = riddenLegs();
  map.querySelectorAll(".rail").forEach(p => {
    const id = p.getAttribute("data-route");
    p.classList.toggle("sel", id === drawnId);
    p.classList.toggle("mute", !!drawnId && id !== drawnId);
    p.classList.toggle("off", id === "charter" && drawnId !== "charter");
    /* track you have actually finished stays lit, so the map becomes a record */
    p.classList.toggle("ridden", ridden.has(id + ":" + p.getAttribute("data-leg")));
  });
  /* Cities are shared between services, so highlighting keys off the city,
     not the line: on = called at by this service, done = already reached. */
  const onLine = new Set(), reachedCities = new Set();
  if(activeRoute){
    const reached = db.activeRide ? db.activeRide.legIndex : standingAt(activeRoute);
    activeRoute.stops.forEach((st, i) => {
      onLine.add(st.c);
      if(i <= reached) reachedCities.add(st.c);
    });
  }
  map.querySelectorAll(".dot").forEach(c => {
    const id = c.getAttribute("data-city");
    c.classList.toggle("on", onLine.has(id));
    c.classList.toggle("done", reachedCities.has(id));
  });
  map.querySelectorAll(".lbl").forEach(t => {
    const id = t.getAttribute("data-city");
    t.classList.toggle("on", onLine.has(id));
    t.classList.toggle("mute", !!activeRoute && !onLine.has(id));
  });
  paint();
}

/* Fast path: train position, travelled line, clock. */
const trainEl = () => document.getElementById("train");
const travEl  = () => document.getElementById("trav");
const pulseEl = () => document.getElementById("pulse");

function paint(){
  ensureDriver();              /* §2b: pick up a drive whose tab vanished */
  const ph = phase();
  const train = trainEl(), trav = travEl(), pulse = pulseEl();
  if(!train) return;

  const activeRoute = db.activeRide ? routeById(db.activeRide.routeId)
                    : db.activeBreak ? routeById(db.activeBreak.routeId)
                    : (sel || null);
  const drawnId = activeRoute && activeRoute.custom ? "charter" : (activeRoute ? activeRoute.id : null);
  const paths = drawnId ? legPaths[drawnId] : null;

  if(!activeRoute || !paths){
    train.setAttribute("opacity","0");
    trav.setAttribute("opacity","0");
    pulse.setAttribute("opacity","0");
    setCamTarget(NATIONAL.slice());
    camStep();
    updateClock();
    return;
  }

  let li, frac;
  if(ph === "work"){
    const r = db.activeRide;
    const total = r.plannedMinutes*60000;
    li = Math.min(r.legIndex, paths.length-1);
    frac = Math.min(1, Math.max(0, (Date.now() - Date.parse(r.startedAt)) / total));
    if(Date.now() >= rideEnd(r)){ complete(); return; }
  } else {
    /* Standing at a station — during a layover the train sits where it
       arrived; at the terminus it sits at the far end of the last leg. */
    const j = standingAt(activeRoute);
    if(j >= paths.length){ li = paths.length - 1; frac = 1; }
    else { li = j; frac = 0; }
  }

  const path = paths[li];
  const L = path.getTotalLength();
  const at = Math.min(L, Math.max(0, L*frac));
  const p = path.getPointAtLength(at);
  const p2 = path.getPointAtLength(Math.min(L, at + 2.5));
  const p1 = path.getPointAtLength(Math.max(0, at - 2.5));
  const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

  /* the train grows a little when zoomed rather than counter-scaling flat */
  const kt = Math.pow(Math.max(0.02, cam.cur[2] / NATIONAL_W), 0.75);
  train.setAttribute("transform",
    `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${ang.toFixed(2)}) scale(${kt.toFixed(3)})`);
  train.setAttribute("opacity","1");

  trav.setAttribute("d", path.getAttribute("d"));
  trav.setAttribute("stroke-dasharray", L);
  trav.setAttribute("stroke-dashoffset", (L - at).toFixed(2));
  trav.setAttribute("opacity", at > 0.5 ? "1" : "0");

  /* arrival flourish */
  const now = Date.now();
  if(now < arrivalUntil && ph !== "work"){
    const t = 1 - (arrivalUntil - now)/5200;
    const r0 = 7 + (t % 0.34)/0.34 * 26;
    pulse.setAttribute("cx", p.x); pulse.setAttribute("cy", p.y);
    pulse.setAttribute("r", r0.toFixed(1));
    pulse.setAttribute("opacity", (0.5 * (1 - (t % 0.34)/0.34) * (1 - t)).toFixed(3));
  } else {
    pulse.setAttribute("opacity","0");
  }

  /* Follow only while actually riding; a layover pulls back to the network so
     you can pick the next service. */
  setCamTarget(db.settings.camera === "follow" && ph === "work"
    ? cameraFor(activeRoute, paths, li, frac)
    : NATIONAL.slice());
  camStep();
  updateClock();
}


/* ═══════════════════════════════════════════════════════════════
   9b. Ride camera — making the train visibly move
   ═══════════════════════════════════════════════════════════════
   At national view the train covers ~1.5 px/min: correctly, but
   invisibly, stationary. Visible motion needs deep zoom, so the
   window is sized to hold apparent speed constant across services
   instead of holding the scale constant:

       w = legLength x stageWidth / (pace x rideMinutes)

   At the default 15 px/min every service lands near 10x, which is
   well past the point where the coarse national coastline means
   anything — so the land fades out (CSS, off `--k`) and what is left
   is the route, its cities and the train: a route strip diagram,
   which is a real artifact rather than a broken map. That is the
   trade, and it is why `settings.camera` can be set to "network".

   ONE writer. paint() only ever sets cam.tgt; camStep() eases
   cur -> tgt and is the only thing that touches the viewBox. The
   roadmap had paint() writing the viewBox *and* board()/complete()
   kicking their own transitions, which would fight over the same
   four numbers. */
let NATIONAL = null, NATIONAL_W = 0;
const cam = { cur:null, tgt:null, holdUntil:0, last:0 };
let lastK = -1;

function stageAspect(){
  const r = stage.getBoundingClientRect();
  return (r.width > 0 && r.height > 0) ? r.width / r.height : 16/9;
}

/* Window for the active leg, centred on the train, with a pull-in to the
   destination over the last stretch so the train arrives *at* a named city
   instead of the city sliding in from the edge. */
function cameraFor(route, paths, li, frac){
  const path = paths[Math.min(li, paths.length-1)];
  const legU = path.getTotalLength();
  const mins = Math.max(1, routeMinutes(route));
  const pace = Math.max(2, Number(db.settings.pace) || DEFAULTS.settings.pace);
  const sw = stage.getBoundingClientRect().width || 1200;

  let w = legU * sw / (pace * mins);
  const p = path.getPointAtLength(legU * Math.min(1, Math.max(0, frac)));
  let cx = p.x, cy = p.y;

  /* The window is usually narrower than the leg, so for most of a long ride
     no city is on screen. Frame the origin as you pull out and the
     destination as you pull in, so departure and arrival both land on a named
     place and only the anonymous middle is pure strip. */
  if(frac < 0.08){
    const t = ease(1 - frac/0.08);
    const o = path.getPointAtLength(0);
    cx += (o.x - cx) * t;
    cy += (o.y - cy) * t;
    w *= 1 + 0.4*t;
  } else if(frac > 0.92){
    const t = ease((frac - 0.92) / 0.08);
    const d = path.getPointAtLength(legU);
    cx += (d.x - cx) * t;
    cy += (d.y - cy) * t;
    w *= 1 + 0.4*t;
  }
  w = Math.min(NATIONAL_W, Math.max(24, w));
  const h = w / stageAspect();
  return [cx - w/2, cy - h/2, w, h];
}

function ease(t){ t = Math.min(1, Math.max(0, t)); return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

/* Label offsets are in map units, so at 10x a label 16u under its dot would
   sit 160px away. Re-anchor them whenever the zoom changes materially. */
function scaleMap(k){
  if(Math.abs(k - lastK) < 0.004) return;
  lastK = k;
  document.documentElement.style.setProperty("--k", k.toFixed(4));
  document.documentElement.style.setProperty("--kt", Math.pow(k, 0.75).toFixed(4));
  map.querySelectorAll(".lbl").forEach(t => {
    if(!t.__p) return;
    t.setAttribute("x", (t.__p[0] + t.__ox*k).toFixed(2));
    t.setAttribute("y", (t.__p[1] + t.__oy*k).toFixed(2));
  });
}

function applyCam(){
  const c = cam.cur;
  map.setAttribute("viewBox", c.map(n => n.toFixed(2)).join(" "));
  scaleMap(c[2] / NATIONAL_W);
}

function setCamTarget(v){ cam.tgt = v; }

/* Eased follow. Reduced motion jumps instead, and paint() is already
   throttled to 1 Hz there, so the camera simply keeps up. */
function camStep(){
  if(!cam.cur || !cam.tgt) return;
  if(Date.now() < cam.holdUntil) return;      /* arrival flourish: hold the frame */
  /* Same rule as the ride clock: never trust frame cadence. A per-frame
     lerp would take ~50 s to settle in a throttled background tab and under
     a second in a foreground one; smoothing against elapsed time makes the
     glide the same length either way. */
  const now = Date.now();
  const dt = Math.min(400, Math.max(1, now - (cam.last || now)));
  cam.last = now;
  const f = RM.matches ? 1 : 1 - Math.pow(1 - 0.12, dt/16.7);
  let moved = false;
  for(let i = 0; i < 4; i++){
    const d = cam.tgt[i] - cam.cur[i];
    if(Math.abs(d) < 0.01) continue;
    cam.cur[i] += d * f;
    moved = true;
  }
  if(moved) applyCam();
}

/* ═══════════════════════════════════════════════════════════════
   10. Render — console
   ═══════════════════════════════════════════════════════════════ */
const consoleEl = document.getElementById("console");

function nextStopText(route){
  const i = legIndex(route);
  return { from: stopName(route, i), to: stopName(route, i+1), i };
}

function renderConsole(){
  const ph = phase();
  if(ph === "work" || ph === "break") renderRide(ph);
  else renderBoard();
  updateClock();
}

function renderBoard(){
  const routes = allRoutes();
  if(!sel) sel = routes[0];
  const rows = routes.map(r => {
    const { from, to } = nextStopText(r);
    const mins = routeMinutes(r);
    const isSel = sel && sel.id === r.id;
    return `<button class="row${isSel?" sel":""}" data-id="${r.id}">
      <span class="bar" style="--c:${r.color}"></span>
      <span class="svc">${esc(r.service)}</span>
      <span class="ln">${esc(r.name)}</span>
      <span class="to"><em>${esc(from)}</em> → ${esc(to)}</span>
      <span class="dur">${mins} min</span>
      <span class="pt">${mins} pt</span>
    </button>`;
  }).join("");

  const r = sel;
  const { from, to } = nextStopText(r);
  const mins = routeMinutes(r);
  const untilLong = Math.max(1, db.settings.roundsUntilLongBreak - (db.round % Math.max(1, db.settings.roundsUntilLongBreak)));

  consoleEl.innerHTML = `
    <div class="board">
      <h2>Departures</h2>
      <div class="rows">${rows}</div>
    </div>
    <div class="stub">
      <h2>${layoverDone ? "Layover complete" : "Ticket"}</h2>
      <div class="tk-body">
      <div class="tk-line">${esc(r.name)}</div>
      <div class="tk-od">
        <div class="c"><div class="k">From</div><div class="v">${esc(from)}</div></div>
        <svg class="arw" width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M0 5h16M12 1l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div class="c"><div class="k">To</div><div class="v">${esc(to)}</div></div>
      </div>
      ${r.id === "charter" ? `<div class="tk-min">
          <label for="chMin">Duration</label>
          <input id="chMin" type="number" min="1" max="240" step="1" value="${mins}">
          <span class="k" style="font-family:var(--mono);font-size:10px;letter-spacing:.16em;color:var(--dim-2)">MIN</span>
        </div>` : ""}
      <div class="grow"></div>
      <div class="tk-meta">
        <div>Ride<b>${mins} min</b></div>
        <div>Distance<b>${fmtMiles(legMiles(r, nextStopText(r).i))} mi</b></div>
        <div>Reward<b>${mins} pts</b></div>
        <div>Long break<b>in ${untilLong}</b></div>
      </div>
      </div>
      <button class="btn" id="btnBoard">Board train</button>
    </div>`;

  consoleEl.querySelectorAll(".row").forEach(b => b.addEventListener("click", () => select(b.dataset.id)));
  const ci = document.getElementById("chMin");
  if(ci) ci.addEventListener("input", () => {
    db.settings.charterMinutes = clampMin(ci.value);
    save();
    const m = db.settings.charterMinutes;
    consoleEl.querySelectorAll(".tk-meta b")[0].textContent = m + " min";
    consoleEl.querySelectorAll(".tk-meta b")[1].textContent = m + " pts";
    const row = consoleEl.querySelector('.row[data-id="charter"]');
    if(row){ row.querySelector(".dur").textContent = m + " min"; row.querySelector(".pt").textContent = m + " pt"; }
  });
  document.getElementById("btnBoard").addEventListener("click", board);
}

function renderRide(ph){
  const working = ph === "work";
  const src = working ? db.activeRide : db.activeBreak;
  const route = routeById(src.routeId) || sel;
  const li = working ? db.activeRide.legIndex : Math.max(0, (db.journey[route.id] || 0) - 1);
  const from = stopName(route, li), to = stopName(route, li+1);
  const brkKind = working ? "" : (db.activeBreak.kind === "long" ? "Long layover" : "Layover");

  consoleEl.innerHTML = `
    <div class="ride">
      <div>
        <div class="od">
          <div><div class="k">${working ? "Departed" : "Standing at"}</div><div class="v">${esc(working ? from : to)}</div></div>
          ${working ? `<svg class="arw" width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="#5b646e" stroke-width="1.3">
            <path d="M0 5h16M12 1l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div><div class="k">Arriving</div><div class="v to">${esc(to)}</div></div>` : ""}
        </div>
        <div class="prog"><i id="progBar"></i></div>
        <div class="pmeta">
          <span>${esc(route.name)}</span>
          <span id="pmRight"></span>
        </div>
      </div>
      <div class="clockwrap">
        <div>
          <div class="clock${working ? " pulsing" : " brk"}" id="clock">--:--</div>
          <div class="clocklab" id="clockLab">${working ? "Time to arrival" : brkKind}</div>
        </div>
        <div class="actions">
          ${!mirroring
            ? `<button class="spk" id="btnCam"
                 title="${db.settings.camera === "follow" ? "Show the whole network" : "Follow the train"}"
                 aria-label="${db.settings.camera === "follow" ? "Show the whole network" : "Follow the train"}">
                 <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor"
                      stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   ${db.settings.camera === "follow"
                     ? `<path d="M2 6.5V2.5h4M16 6.5V2.5h-4M2 11.5v4h4M16 11.5v4h-4"/><circle cx="9" cy="9" r="2"/>`
                     : `<path d="M6.5 2.5h-4v4M11.5 2.5h4v4M6.5 15.5h-4v-4M11.5 15.5h4v-4"/><circle cx="9" cy="9" r="2"/>`}
                 </svg></button>`
            : ""}
          ${!mirroring && mixActive()
            ? `<button class="spk${db.settings.soundMuted?" off":""}" id="btnSpk"
                 title="${db.settings.soundMuted?"Unmute":"Mute"} ambience"
                 aria-label="${db.settings.soundMuted?"Unmute":"Mute"} ambience"
                 aria-pressed="${!!db.settings.soundMuted}">
                 <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor"
                      stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <path d="M4.2 6.9H2.2v4.2h2L7.6 14V4L4.2 6.9Z"/>
                   ${db.settings.soundMuted
                     ? `<path d="M10.9 7.1l4 3.8M14.9 7.1l-4 3.8"/>`
                     : `<path d="M10.6 6.6a3.4 3.4 0 0 1 0 4.8"/><path d="M13 4.2a6.8 6.8 0 0 1 0 9.6"/>`}
                 </svg></button>`
            : ""}
          ${mirroring
            ? `<div class="mirror">${working ? "Riding" : "Standing"} in another tab</div>`
            : working
            ? `<button class="btn danger" id="btnStop">End ride</button>`
            : `<button class="btn ghost" id="btnEnd">Stop here</button>
               <button class="btn" id="btnSkip">Depart early</button>`}
        </div>
      </div>
    </div>`;

  const camBtn = document.getElementById("btnCam");
  if(camBtn) camBtn.addEventListener("click", () => {
    db.settings.camera = db.settings.camera === "follow" ? "network" : "follow";
    save(); renderConsole(); paint();
  });

  const spk = document.getElementById("btnSpk");
  if(spk) spk.addEventListener("click", () => {
    db.settings.soundMuted = !db.settings.soundMuted;
    setAmbientVolume(0.15);
    save(); renderConsole();
  });

  const stop = document.getElementById("btnStop");
  if(stop){
    let armed = false, t = null;
    stop.addEventListener("click", () => {
      if(!armed){
        armed = true; stop.textContent = "Confirm — no points";
        t = setTimeout(() => { armed = false; stop.textContent = "End ride"; }, 3500);
      } else { clearTimeout(t); stopRide(); }
    });
  }
  /* Depart early: cut the layover short and roll straight into the next leg. */
  const skip = document.getElementById("btnSkip");
  if(skip) skip.addEventListener("click", () => { clearTimeout(breakTimer); db.activeBreak = null; layoverDone = true; save(); board(); });
  /* Stop here: end the layover and go back to the departure board. */
  const endb = document.getElementById("btnEnd");
  if(endb) endb.addEventListener("click", () => { clearTimeout(breakTimer); db.activeBreak = null; layoverDone = false; stopAmbient(); save(); renderAll(); });
}

/* Only touches document.title when it actually changes — this runs every
   frame, and writing the title is not free. */
const BASE_TITLE = "Focus Train";
let titleNow = BASE_TITLE;
function setTitle(t){
  t = t || BASE_TITLE;
  if(t === titleNow) return;
  titleNow = t;
  document.title = t;
}

function updateClock(){
  const c = document.getElementById("clock");
  const ph = phase();
  if(!c){ setTitle(BASE_TITLE); return; }   /* idle board is showing */
  if(ph === "work"){
    const r = db.activeRide;
    const total = r.plannedMinutes*60000;
    const left = rideEnd(r) - Date.now();
    c.textContent = fmtClock(left/1000);
    const frac = Math.min(1, Math.max(0, 1 - left/total));
    const bar = document.getElementById("progBar");
    if(bar) bar.style.width = (frac*100).toFixed(2) + "%";
    const pm = document.getElementById("pmRight");
    const route = routeById(r.routeId);
    if(pm){
      /* miles remaining moves every few seconds — motion the pixels cannot show */
      const togo = route ? legMiles(route, r.legIndex) * (1 - frac) : 0;
      pm.textContent = (route ? fmtMiles(togo) + " miles to go" + esc(" · ") : "")
                     + Math.round(frac*100) + "%";
    }
    /* The tab strip is the one piece of this UI you still see from another
       app, so the countdown goes in the title. */
    setTitle(fmtClock(left/1000) + " · " + (route ? stopName(route, r.legIndex + 1) : "en route"));
  } else if(ph === "break"){
    const b = db.activeBreak;
    const endMs = Date.parse(b.endsAt);
    const left = endMs - Date.now();
    if(left <= 0){ endBreak(); return; }
    c.textContent = fmtClock(left/1000);
    const totalMs = (b.kind === "long" ? db.settings.longBreakMinutes : db.settings.breakMinutes)*60000;
    const bar = document.getElementById("progBar");
    if(bar) bar.style.width = (Math.min(1, 1 - left/totalMs)*100).toFixed(2) + "%";
    const pm = document.getElementById("pmRight");
    if(pm) pm.textContent = "At rest";
    setTitle(fmtClock(left/1000) + " · layover");
  }
}

function renderHeader(){
  const s = computeStats();
  document.getElementById("hPts").textContent = s.totalPoints.toLocaleString();
  document.getElementById("hStreak").textContent = s.currentStreak;
  document.getElementById("hRides").textContent = s.completed;
}

function renderAll(){
  renderHeader();
  renderMap();
  renderConsole();
  if(statsOpen) renderStats();
}

function applyTheme(id){
  if(!THEMES.some(t => t.id === id)) id = "night";
  db.settings.theme = id;
  document.documentElement.setAttribute("data-theme", id);
  /* keeps the installed app's window chrome in step with the chosen theme */
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content",
    getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#0b0f14");
  save();
}

/* ═══════════════════════════════════════════════════════════════
   11. Panels — journey log & settings
   ═══════════════════════════════════════════════════════════════ */
const scrim = document.getElementById("scrim");
const statsPanel = document.getElementById("statsPanel");
const setPanel = document.getElementById("setPanel");
const ambPanel = document.getElementById("ambPanel");
const PANELS = [statsPanel, setPanel, ambPanel];
let statsOpen = false;

function openPanel(p){
  closePanels();
  p.classList.add("on"); p.setAttribute("aria-hidden","false");
  scrim.classList.add("on");
  if(p === statsPanel){ statsOpen = true; renderStats(); }
  else if(p === ambPanel){
    /* Opening the panel is itself the gesture that unlocks audio, so the mix
       can go live here: while idle you hear exactly what you are building. */
    mixerOpen = true;
    renderAmbience();
    if(phase() === "idle" && mixActive()) applyMix(0.5);
  }
  else renderSettings();
}
function closePanels(){
  PANELS.forEach(p => { p.classList.remove("on"); p.setAttribute("aria-hidden","true"); });
  scrim.classList.remove("on");
  statsOpen = false;
  /* the idle audition belongs to the open panel; a real ride keeps playing */
  if(mixerOpen && phase() === "idle") stopAmbient(0.8);
  mixerOpen = false;
}
scrim.addEventListener("click", closePanels);
document.addEventListener("keydown", e => { if(e.key === "Escape") closePanels(); });
document.getElementById("bStats").addEventListener("click", () => openPanel(statsPanel));
document.getElementById("bSet").addEventListener("click", () => openPanel(setPanel));
document.getElementById("bAmb").addEventListener("click", () => openPanel(ambPanel));

function renderStats(){
  const s = computeStats();
  const rate = s.attempted ? Math.round(s.completed/s.attempted*100) : 0;

  /* heatmap: 20 weeks of local calendar days, weeks as columns */
  const daily = dailyMinutes();
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today);
  start.setDate(start.getDate() - (19*7 + today.getDay()));
  const cols = [];
  let months = [];
  let lastMonth = -1, lastLabelAt = -9;
  for(let w = 0; w < 20; w++){
    let cells = "";
    let colMonth = null;
    for(let d = 0; d < 7; d++){
      const day = new Date(start);
      day.setDate(start.getDate() + w*7 + d);
      if(d === 0) colMonth = day.getMonth();
      if(day > today){ cells += `<div class="hc fut"></div>`; continue; }
      const m = daily.get(dayKey(day)) || 0;
      const lv = m >= 120 ? " l4" : m >= 60 ? " l3" : m >= 25 ? " l2" : m > 0 ? " l1" : "";
      cells += `<div class="hc${lv}" title="${day.toLocaleDateString()} — ${Math.round(m)} min"></div>`;
    }
    /* label a month only where there is room for the word to sit */
    if(colMonth !== lastMonth && w - lastLabelAt >= 3 && w <= 19){
      months.push(`<span style="width:11px;flex:0 0 11px">${new Date(2000, colMonth, 1).toLocaleString(undefined,{month:"short"})}</span>`);
      lastLabelAt = w;
    } else {
      months.push(`<span style="width:11px;flex:0 0 11px"></span>`);
    }
    lastMonth = colMonth;
    cols.push(`<div class="hcol">${cells}</div>`);
  }

  const recent = db.rides.slice(-14).reverse().map(r => {
    const route = routeById(r.routeId);
    const nm = route ? route.name : "Charter";
    const d = new Date(r.startedAt);
    const when = d.toLocaleDateString(undefined,{month:"short",day:"numeric"}) + " · " +
                 d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
    return `<div class="li ${r.completed?"ok":"no"}">
      <span class="mk"></span>
      <span class="nm">${esc(nm)} <span style="color:var(--dim-2)">${r.plannedMinutes}m</span></span>
      <span class="dt">${when}</span>
      <span class="rs">${r.completed ? "+"+r.pointsEarned+" pts" : "incomplete"}</span>
    </div>`;
  }).join("");

  document.getElementById("statsBody").innerHTML = `
    <div class="sect">
      <div class="grid2">
        <div class="cell acc"><div class="k">Total points</div><div class="v">${s.totalPoints.toLocaleString()}</div></div>
        <div class="cell"><div class="k">Time on the rails</div><div class="v">${fmtDur(s.seconds)}</div></div>
        <div class="cell"><div class="k">Current streak</div><div class="v">${s.currentStreak}<small>rides</small></div></div>
        <div class="cell"><div class="k">Longest streak</div><div class="v">${s.longestStreak}<small>rides</small></div></div>
        <div class="cell"><div class="k">Arrivals</div><div class="v">${s.completed}<small>/ ${s.attempted}</small></div></div>
        <div class="cell"><div class="k">Arrival rate</div><div class="v">${rate}<small>%</small></div></div>
        <div class="cell wide"><div class="k">Miles ridden</div><div class="v">${fmtMiles(lifetimeMiles())}<small>miles</small></div></div>
      </div>
    </div>

    <div class="sect">
      <h4>Daily activity</h4>
      <div class="hmon">${months.join("")}</div>
      <div class="heat">${cols.join("")}</div>
      <div class="hlegend">
        <span>Less</span>
        <div class="hc"></div><div class="hc l1"></div><div class="hc l2"></div>
        <div class="hc l3"></div><div class="hc l4"></div>
        <span>More</span>
      </div>
    </div>

    <div class="sect">
      <h4>Recent rides</h4>
      <div class="log">${recent || `<div class="empty">No rides logged yet.<br>Pick a service and board.</div>`}</div>
    </div>`;
}

/* The mixer. Every scape has its own fader and they all run at once, so
   "fire at 75%, rain at 25%, café at 37%" is a thing you can actually build.
   Sliders re-render nothing while being dragged — innerHTML mid-drag would
   drop the pointer capture — so `input` only touches the readout and the row
   class, and the panel is only rebuilt on discrete actions. */
function renderAmbience(){
  const st = db.settings;
  const pct = id => Math.round(mixOf(id)*100);
  const rows = SCAPES.map(sc => {
    const v = pct(sc.id);
    return `<div class="mixrow${v > 0 ? " on" : ""}" data-row="${sc.id}">
      <div class="mixlab">${esc(sc.n)}<s>${esc(sc.d)}</s></div>
      <input class="mixsl" type="range" min="0" max="100" step="1" value="${v}"
             data-mix="${sc.id}" aria-label="${esc(sc.n)} level">
      <div class="mixpct" data-pct="${sc.id}">${v > 0 ? v + "%" : "—"}</div>
    </div>`;
  }).join("");

  document.getElementById("ambBody").innerHTML = `
    <div class="sect">
      <h4>Output</h4>
      <div class="field">
        <div class="lab">Master volume</div>
        <input type="range" id="aVol" min="0" max="100" step="1" value="${Math.round(st.soundVolume*100)}"
               aria-label="Master ambient volume">
      </div>
      <div class="field">
        <div class="lab">Play during layovers<s>Otherwise the mix stops when you arrive</s></div>
        <button class="tog${st.soundDuringBreak?" on":""}" id="aDuring" role="switch"
                aria-checked="${!!st.soundDuringBreak}"></button>
      </div>
    </div>

    <div class="sect">
      <h4>Mix</h4>
      <div class="mix">${rows}</div>
      <div class="btnrow" style="margin-top:12px">
        <button class="btn ghost" id="aClear">Silence all</button>
      </div>
      <p class="note">Every bed is synthesized in the browser — no files, nothing to download.
        Slide any number of them up and they play together; while this panel is open and no
        train is running, you hear the mix as you build it.</p>
    </div>`;

  const live = fade => {
    /* audible while riding here, or while auditioning with the panel open.
       In a tab that is only mirroring someone else's ride this changes the
       stored mix and the driving tab picks it up — see the "state" handler. */
    if(phase() !== "idle" || mixerOpen) applyMix(fade);
  };

  document.querySelectorAll("[data-mix]").forEach(sl => {
    const id = sl.getAttribute("data-mix");
    sl.addEventListener("input", () => {
      const v = Math.max(0, Math.min(100, Math.round(Number(sl.value))));
      db.settings.soundMix[id] = v/100;
      if(v > 0) db.settings.soundMuted = false;
      const out = document.querySelector(`[data-pct="${id}"]`);
      if(out) out.textContent = v > 0 ? v + "%" : "—";
      const row = document.querySelector(`[data-row="${id}"]`);
      if(row) row.classList.toggle("on", v > 0);
      live(0.25);
    });
    /* persist on release, not on every pixel of the drag */
    sl.addEventListener("change", () => { save(); renderConsole(); });
  });

  const vol = document.getElementById("aVol");
  vol.addEventListener("input", () => {
    db.settings.soundVolume = Math.max(0, Math.min(1, Number(vol.value)/100));
    db.settings.soundMuted = false;
    setAmbientVolume(0.08);
  });
  vol.addEventListener("change", () => { save(); renderConsole(); });

  document.getElementById("aDuring").addEventListener("click", () => {
    db.settings.soundDuringBreak = !db.settings.soundDuringBreak;
    save(); renderAmbience();
  });

  document.getElementById("aClear").addEventListener("click", () => {
    /* explicit zeroes, not an empty object — an absent key inherits 50% */
    db.settings.soundMix = {};
    SCAPES.forEach(sc => { db.settings.soundMix[sc.id] = 0; });
    stopAmbient(0.5);
    save(); renderAmbience(); renderConsole();
  });
}

function renderSettings(){
  const st = db.settings;
  const custom = db.customRoutes.map(c => `
    <div class="crow">
      <span>${esc(c.name)}</span>
      <span class="mins">${c.minutes} min</span>
      <button class="xb" data-del="${c.id}" title="Remove">✕</button>
    </div>`).join("");

  document.getElementById("setBody").innerHTML = `
    <div class="sect">
      <h4>Theme</h4>
      <div class="themecols">
        ${["dark","light"].map(mode => `<div class="themecol">
          <h5>${mode === "dark" ? "Dark" : "Light"}</h5>
          ${THEMES.filter(t => t.mode === mode).map(t =>
            `<button class="th${st.theme === t.id ? " on" : ""}" data-set-theme="${t.id}"
              style="--sw-bg:${t.bg};--sw-ac:${t.ac}"><span class="sw"></span>${esc(t.n)}</button>`).join("")}
        </div>`).join("")}
      </div>
    </div>

    <div class="sect">
      <h4>Timing</h4>
      <div class="field">
        <div class="lab">Layover<s>Short break after each arrival</s></div>
        <input type="number" min="0" max="60" id="sBreak" value="${st.breakMinutes}">
      </div>
      <div class="field">
        <div class="lab">Long layover<s>Every ${st.roundsUntilLongBreak} arrivals</s></div>
        <input type="number" min="0" max="120" id="sLong" value="${st.longBreakMinutes}">
      </div>
      <div class="field">
        <div class="lab">Arrivals until long layover</div>
        <input type="number" min="1" max="12" id="sRounds" value="${st.roundsUntilLongBreak}">
      </div>
    </div>

    <div class="sect">
      <h4>Ride camera</h4>
      <div class="field">
        <div class="lab">Follow the train<s>Zooms in so the train visibly moves. Off shows the whole network.</s></div>
        <button class="tog${st.camera === "follow" ? " on" : ""}" id="tCam" role="switch"
                aria-checked="${st.camera === "follow"}"></button>
      </div>
      <div class="field">
        <div class="lab">Pace<s>${st.pace} px per minute, whatever the service</s></div>
        <input type="range" id="sPace" min="5" max="40" step="1" value="${st.pace}" aria-label="Camera pace">
      </div>
      <p class="note">At national scale the train covers about 1.5 px a minute — correctly, but
        invisibly, stationary. The camera sizes the view so every service moves at the same
        readable speed, which means zooming past the point where the coastline says anything;
        it fades out and the map becomes a route strip.</p>
    </div>

    <div class="sect">
      <h4>Signals</h4>
      <div class="field">
        <div class="lab">Arrival chime<s>Plays even when this tab is in the background</s></div>
        <button class="tog${st.chimeEnabled?" on":""}" id="tChime" role="switch" aria-checked="${!!st.chimeEnabled}"></button>
      </div>
      <div class="field">
        <div class="lab">Browser notifications<s>${typeof Notification === "undefined" ? "Not supported in this browser" : "Permission: " + Notification.permission}</s></div>
        <button class="tog${st.notifyEnabled?" on":""}" id="tNotify" role="switch" aria-checked="${!!st.notifyEnabled}"></button>
      </div>
    </div>

    <div class="sect">
      <h4>Charter services</h4>
      ${custom || `<div class="empty">No charter services saved.</div>`}
      <div class="addrow">
        <input type="text" id="cName" placeholder="Service name" maxlength="28">
        <input type="number" id="cMin" placeholder="min" min="1" max="240">
        <button id="cAdd">Add</button>
      </div>
      <p class="note">Charters run the straight transcontinental path and appear on the departure board. Scheduled services ship with the app and update when it does.</p>
    </div>

    <div class="sect">
      <h4>Data</h4>
      <div class="btnrow">
        <button class="btn ghost" id="dExport">Export JSON</button>
        <button class="btn ghost" id="dImport">Import</button>
      </div>
      <div class="btnrow" style="margin-top:8px">
        <button class="btn danger" id="dReset">Erase all history</button>
      </div>
      <input type="file" id="fileIn" accept="application/json,.json" hidden>
      <p class="note">Your history lives only in this browser, at this exact URL. Clearing site data erases it. Export now and again — it is the whole backup story.</p>
    </div>`;

  document.querySelectorAll("[data-set-theme]").forEach(b =>
    b.addEventListener("click", () => { applyTheme(b.getAttribute("data-set-theme")); renderSettings(); }));

  const num = (id, key, min, max) => {
    const n = document.getElementById(id);
    n.addEventListener("change", () => {
      let v = Math.round(Number(n.value));
      if(!isFinite(v)) v = DEFAULTS.settings[key];
      v = Math.min(max, Math.max(min, v));
      n.value = v; db.settings[key] = v; save(); renderSettings(); renderConsole();
    });
  };
  num("sBreak","breakMinutes",0,60);
  num("sLong","longBreakMinutes",0,120);
  num("sRounds","roundsUntilLongBreak",1,12);

  document.getElementById("tCam").addEventListener("click", () => {
    db.settings.camera = db.settings.camera === "follow" ? "network" : "follow";
    save(); renderSettings(); renderConsole(); paint();
  });
  const pace = document.getElementById("sPace");
  pace.addEventListener("input", () => {
    db.settings.pace = Math.max(5, Math.min(40, Math.round(Number(pace.value))));
    pace.previousElementSibling.querySelector("s").textContent =
      db.settings.pace + " px per minute, whatever the service";
    paint();
  });
  pace.addEventListener("change", () => save());

  document.getElementById("tChime").addEventListener("click", () => {
    db.settings.chimeEnabled = !db.settings.chimeEnabled;
    if(db.settings.chimeEnabled){ ensureAudio(); chime("depart"); }
    save(); renderSettings();
  });
  document.getElementById("tNotify").addEventListener("click", () => {
    if(!db.settings.notifyEnabled){
      askNotify().then(p => {
        db.settings.notifyEnabled = (p === "granted");
        save(); renderSettings();
      });
    } else { db.settings.notifyEnabled = false; save(); renderSettings(); }
  });

  document.getElementById("cAdd").addEventListener("click", () => {
    const nm = document.getElementById("cName").value.trim();
    const mn = clampMin(document.getElementById("cMin").value);
    if(!nm || !document.getElementById("cMin").value) return;
    db.customRoutes.push({ id:"custom-"+uid(), name:nm, minutes:mn });
    save(); renderSettings(); renderConsole();
  });
  document.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
    const id = b.getAttribute("data-del");
    db.customRoutes = db.customRoutes.filter(c => c.id !== id);
    delete db.journey[id];
    if(sel && sel.id === id) sel = ROUTES[0];
    save(); renderSettings(); renderAll();
  }));

  document.getElementById("dExport").addEventListener("click", exportData);
  document.getElementById("dImport").addEventListener("click", () => document.getElementById("fileIn").click());
  document.getElementById("fileIn").addEventListener("change", importData);
  document.getElementById("dReset").addEventListener("click", e => {
    const b = e.currentTarget;
    if(b.dataset.armed){
      const keepTheme = db.settings.theme;
      db = clone(DEFAULTS); db.settings.theme = keepTheme;
      sel = ROUTES[0]; save(); closePanels(); renderAll();
      showToast("<s>History erased</s>");
    } else {
      b.dataset.armed = "1"; b.textContent = "Confirm — this cannot be undone";
      setTimeout(() => { delete b.dataset.armed; b.textContent = "Erase all history"; }, 4000);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   12. Export / import
   ═══════════════════════════════════════════════════════════════ */
function exportData(){
  const blob = new Blob([JSON.stringify(db, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = `focus-train-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function importData(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    let parsed;
    try { parsed = JSON.parse(rd.result); } catch(err){ showToast("<s>Import failed — not valid JSON</s>"); return; }
    if(!parsed || typeof parsed !== "object" || !Array.isArray(parsed.rides)){
      showToast("<s>Import failed — no ride log found</s>"); return;
    }
    db = deepMerge(DEFAULTS, parsed);
    db.schemaVersion = SCHEMA;
    if(!Array.isArray(db.customRoutes)) db.customRoutes = [];
    db.activeRide = null; db.activeBreak = null;
    computeStats(); save();
    applyTheme(db.settings.theme);
    sel = ROUTES[0];
    closePanels(); renderAll();
    showToast(`<b>Imported</b><s>/</s>${db.rides.length} rides restored`);
  };
  rd.readAsText(f);
  e.target.value = "";
}

/* ═══════════════════════════════════════════════════════════════
   13. Paint loop — repaint only; time always comes from timestamps
   ═══════════════════════════════════════════════════════════════ */
let rafId = null, slowId = null;
function loop(){
  paint();
  rafId = requestAnimationFrame(loop);
}
function startLoop(){
  stopLoop();
  if(RM.matches){ slowId = setInterval(() => paint(), 1000); }
  else { rafId = requestAnimationFrame(loop); }
  /* belt and braces: background tabs throttle rAF to zero, so also
     poll on an interval, which keeps firing (slowly) when hidden. */
  slowId = slowId || setInterval(() => { if(document.hidden) paint(); }, 1000);
}
function stopLoop(){
  if(rafId) cancelAnimationFrame(rafId);
  if(slowId) clearInterval(slowId);
  rafId = slowId = null;
}
document.addEventListener("visibilitychange", () => {
  /* Never penalised — we only re-sync the display when you come back. */
  if(!document.hidden){
    if(driving){ scheduleCompletion(); scheduleBreakEnd(); }
    ensureDriver();
    pump();          /* §6b: refill the event queue after a throttled stretch */
    paint();
  }
});
if(RM.addEventListener) RM.addEventListener("change", startLoop);

/* ═══════════════════════════════════════════════════════════════
   14. Boot
   ═══════════════════════════════════════════════════════════════ */
load();
resolveOnLoad();
applyTheme(db.settings.theme);
buildMap();
sel = db.activeRide ? routeById(db.activeRide.routeId)
    : db.activeBreak ? routeById(db.activeBreak.routeId)
    : ROUTES[0];
if(!sel) sel = ROUTES[0];
renderAll();
startLoop();
addEventListener("resize", () => { lastK = -1; paint(); });
/* §2b: don't touch the clock until we know no other tab is already driving it. */
if(db.activeRide || db.activeBreak) probeDrive();
