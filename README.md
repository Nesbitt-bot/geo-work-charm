# Geo Work Charm

A local-first, map-oriented workday ritual. A quiet screen while working; a small, 3.2-second clock-out charm after a confirmed departure. **Demo only: fictional workplaces and neighbors.** No backend, accounts, database, analytics, or copied third-party application code.

## Quickstart

Requires Node.js 22+ and npm.

```sh
npm ci --include=dev
npm run dev
# open http://localhost:5173
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

No API key is needed. Click **Use simulated location**, or enable real location on HTTPS / localhost. Denied/unavailable geolocation never silently becomes simulated location.

Routes (hash routing works on static hosting):
- `/` — neighborhood dashboard, demo workplace selector, current status and accuracy
- `/#/debug` — mock distance/accuracy and complete departure sequence
- `/#/widget?code=DEMO001` — full-viewport standalone charm, no development controls

Open a widget tab then use the debug tab: simulation settings synchronize through localStorage. Each tab independently confirms samples. Codes DEMO001 / DEMO002 / DEMO003 correspond to fictional Beijing / Shanghai / Shenzhen studios. These public codes are not passwords or identities.

## Live demo and screenshots

**Live URL: not published yet.** After you explicitly publish a repository and enable Pages, the expected URL is `https://<owner>.github.io/geo-work-charm/`.

Screenshot placeholders: desktop neighborhood, mobile dashboard, standalone working widget, clock-out animation. The project includes the actual responsive UI; no fabricated screenshots or deployment claim.

## Architecture

```text
public/data/users.json      Public fictional workplace configurations
src/core/geofence.ts        Pure Turf circle classifier + confirmation reducer
src/core/*.test.ts          Boundary, invalid input, hysteresis, coordinate/data tests
src/location/types.ts      WGS84 provider contract
src/location/providers.ts  AMap → browser fallback; manual simulation only
src/location/amap.ts       Shared optional JS 2.0 loader
src/geo/coordinates.ts      WGS84 ↔ GCJ-02 approximation
src/geo/nearby.ts           Seeded fictional people + simulated sample
src/store.ts               State lifecycle, persistence and cross-tab settings
src/components/Map.tsx     Schematic overview + local inset / optional AMap
src/animations/index.tsx   Replaceable animation registry
src/App.tsx                Hash routes, dashboard, widget, debug lab
```

The map uses an SVG/grid schematic by default: a 5 km circle around the current sample (workplace anchor before location), thirty clickable fictional neighbors, workplace and self markers, plus an inset that makes the tiny 80/120 m fence visible. The grid and decorative river are not real geography. Far-away workplaces may be outside the overview; their local inset remains visible. Neighbors are seeded by the local calendar date and rounded anchor coordinate; positions are generated with Turf inside 5 km of that anchor. Arrival times span 08:30–10:30; departure times span 17:00–20:30 in the viewer's local time. Status is schedule-derived, not surveillance. Changing day/anchor on a refreshed map generates another reproducible dataset.

## Geofence semantics

- At **≤80 m**, raw state is WORKING; at **≥120 m**, OFF_WORK.
- In the open 80–120 m band, retain the stable state. An unknown initial state stays unknown.
- Require **two consecutive valid samples** of a new state. One outlier cannot switch state.
- Accuracy **>150 m**, negative/nonfinite values, invalid coordinates or fence configuration are unreliable. Show UNKNOWN, freeze stable state, and break the candidate streak.
- Browser/provider errors and stale feeds show a neutral widget, not a fake departure.
- Only confirmed WORKING → OFF_WORK generates a departure event. OFF_WORK initialization, poor accuracy and entry do not animate.
- Persist only stable state, separately by demo code and actual source. Candidates and events are never persisted. Reopening a page does not replay a stored transition; a session must first observe a reliable working state before arming a new departure animation.
- Sample source changes clear confirmation candidates; real and simulated stable states are isolated.

`evaluate` and `reduceSample` are pure; `metersFrom` uses Turf great-circle distance. The classifier has a documented future `booleanPointInPolygon` seam, not a pretended polygon implementation. These circles indicate proximity, **not building entry or employment attendance**.

## Location, China and coordinate systems

All domain/provider samples use WGS84 latitude/longitude, accuracy in meters and epoch-millisecond timestamp. Browser geolocation requests high accuracy, zero cached age and a timeout. When AMap is configured it is attempted first, then browser geolocation after a failure/timeout. The user must explicitly select simulation if real location is unavailable. Watches, timers and late callbacks are cleaned up/ignored when switching providers or users.

AMap `Geolocation` uses `convert:true`, returning GCJ-02 positions that are approximately inverted to WGS84 before evaluation. WGS84 positions are converted to GCJ-02 for AMap display. The included iterative conversion is a common mathematical approximation, not survey-grade or a guarantee about every provider/device's coordinate behavior. Outside the broad mainland-China bounding box conversion is identity; borders and special regions need production validation. Browser positioning can vary by operating system and provider, especially in China; verify its datum rather than applying a second conversion blindly. No BD-09 support.

## Optional AMap JS 2.0

Copy `.env.example` to `.env.local` and set both:

```dotenv
VITE_AMAP_KEY=your_web_js_key
VITE_AMAP_SECURITY_CODE=your_demo_security_code
```

Restart Vite. Use the vendor's proper origin/domain restrictions. The shared loader is used by both map and positioning adapters. If loading/rendering fails, the schematic remains available; geolocation falls back to browser rather than fabricated positions. AMap was not live-tested without credentials.

**Every `VITE_*` value is exposed in the frontend bundle.** The security code in this demo is not a secret-storage mechanism. For production, follow AMap's security proxy/service-host configuration and use an appropriate server-side proxy. Map/positioning SDKs transmit network requests to third parties and may have independent logging, licensing, attribution and regulatory requirements. The no-key schematic does not load them. No remote fonts are used.

## Deploy to GitHub Pages (no keys)

1. Create/push a repository only when ready to publish; no remote is created by this project.
2. In GitHub **Settings → Pages → Source**, select **GitHub Actions**.
3. Push `main` or run the included workflow manually.
4. The workflow runs `npm ci`, lint, typecheck, tests and production build, uploads `dist`, then deploys with a `github-pages` environment, Pages/OIDC permissions and concurrency protection.
5. It sets `VITE_BASE_PATH=/<repository-name>/`. For a root user/organization Pages repository, change that value to `/`. Default local/static builds use relative `./`.
6. Optional AMap values can be set as repository Actions variables, understanding they are public bundle values.

Asset links and the public JSON fetch respect Vite's base. Hash routes do not need a server rewrite or 404 workaround.

## Privacy and persistence

Only selected demo code, provider preference, mock distance/accuracy and per-code/per-source stable state are in localStorage. **No real GPS coordinates, raw samples, timestamps or trajectory are persisted.** Current location exists in tab memory only. Clearing this site's storage resets preferences/stable state. There is no upload API and no analytics. Optional third-party maps/positioning still produce external requests; “local” does not mean those vendors are offline. A previously chosen real provider is remembered and may resume on reload subject to browser permissions.

## Limitations and future backend path

This is not a reliable background attendance tracker, authorization system or payroll tool. Browsers suspend tabs, throttle timers and can deny location; indoor GPS drifts. Mobile web cannot guarantee background transitions. The 150 m threshold is intentionally permissive for a toy demo and can exceed the fence size. Real-world accuracy filtering, uncertainty modeling, minimum dwell time, timestamp ordering and sensor/provider audits need more work. AMap access and Chinese deployment need vendor/legal review. The date seed follows the viewer's local day, not a workplace timezone. Stable state can outlive a real workday; it is only a UI hint, not an authoritative record.

For a future service: introduce explicit consent, real authentication, private workplace configuration, auditable event semantics, a carefully minimized event endpoint and retention policy. Keep raw trajectories out by default; do not send public demo codes as credentials. Consider polygon fences via Turf, a MapLibre adapter, and a controlled server-side AMap proxy. Those are future work, not hidden dependencies.

## References and license

Original application code and SVG/CSS artwork, released under [MIT](LICENSE). Libraries keep their respective licenses.

- [Turf](https://turfjs.org/) — geospatial functions
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) — possible future renderer, not bundled
- [AMap JS API](https://lbs.amap.com/api/javascript-api-v2/summary)
- [jonnyhuck](https://github.com/jonnyhuck) — geospatial ecosystem reference
- [naranyala](https://github.com/naranyala) — attendance-demo ecosystem reference
- [Geoattend discovery](https://github.com/search?q=Geoattend&type=repositories) — contextual prior-art search, not an incorporated implementation

These references are reading pointers, not claims of affiliation, compatibility or copied code.

## Verification record

Validated with Node 24: clean `npm ci --include=dev`, ESLint, TypeScript, 24 passing Vitest tests, production build with `/geo-work-charm/` base, and static asset/public JSON smoke check. `npm audit --include=dev` reported zero vulnerabilities at implementation time. React + jsdom integration tests exercise clickable neighbors, simulated entry/departure, unreliable-location neutrality, standalone widget routing, cross-tab storage updates, and no replay after reload. A Chromium executable is not installed in this environment, so these are automated DOM integration tests, **not a claimed real-browser visual or live GPS/AMap test**.
