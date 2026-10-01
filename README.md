# Geo Work Charm

A browser-local workplace map and clock-out widget. Production uses actual browser GPS; Test uses a customizable simulated position. Search and chosen-address history use OpenStreetMap data. No backend, accounts, server database, or analytics.

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

No API key is needed. Location is requested immediately on page load, even before a workplace is selected. Browser permission is required on HTTPS / localhost. Denied GPS stays unavailable in Production; it never silently becomes simulated. Settings includes a permission retry button.

Routes (hash routing works on static hosting):
- `/` or `/#/production` — search, distance, street map and widget preview using browser GPS
- `/#/test` — the same UI with a distance slider, clickable map and draggable Test location
- `/#/settings` — coordinates, accuracy, geofence radii, map/search network options, offline maps and diagnostics
- `/#/widget/production` — fullscreen widget using browser GPS
- `/#/widget/test` — fullscreen widget using saved Test settings

Navigation contains only **Production**, **Test**, and **Settings**. The preview's ⛶ icon opens its mode's widget; both widget links also appear in Settings. Legacy `/#/debug` remains a Test alias.

Choose an address, open a Test widget tab, then click the Test map, drag its marker, or change the distance slider. Simulation settings synchronize through localStorage. Production always uses browser GPS and ignores saved Test coordinates. Opening Settings from Test preserves the Test feed. Fullscreen widgets remain neutral until a reliable position and workplace are available.

The minimal main screen contains search, distance, map, and a widget preview. Address suggestions appear after 600 ms of typing, with Chinese IME handling, cancellation, arrow keys, Enter selection and Escape dismissal. Only selected addresses enter history; the latest choice becomes the next default. Online search/map controls are in Settings and default enabled.

Chinese POIs may be indexed without the city prefix or with middle-dot separators. The search normalizes punctuation, retries the POI without a city prefix or area suffix when necessary, and ranks matching area letters first. The live test `长沙万达总部国际 C区` finds OSM's `万达·总部国际·C区` at WGS84 latitude **28.2054614**, longitude **112.965934**, ahead of B区 alternatives. This address is a verification case, not hardcoded app data. OSM coverage still limits autocomplete; this is not Google's address database.

## Keyless and offline operation

The dashboard defaults to online OpenStreetMap.de street tiles and Photon suggestions, with no AMap credentials. Until the first address is chosen it shows a world map, rather than assuming a workplace. Leaflet also renders saved OSM roads, paths, building outlines and available names offline. Three legacy neighborhood extracts remain bundled (1,462 features, about 370 KB uncompressed); they are map coverage, not selectable preset addresses. Labels avoid overlaps. Dragging, wheel/pinch/double-click/button zoom, keyboard navigation and a distance scale need no WebGL.

The first sample fits the workplace and position together. Later samples retain your pan/zoom. Production labels browser GPS as You; Test labels simulation as Test. Click the Test map or drag the Test marker to customize its position. The distance slider returns to distance-based simulation. Exact Test coordinates and accuracy are edited in Settings.

Settings → Save workplace map offline retrieves a bounded OSM extract around the chosen workplace through Overpass and saves up to three regional maps. Coverage is roughly 0.008 degrees across. The public server can time out; failures preserve saved data. Settings → Online street map controls keyless OpenStreetMap.de tiles, which are not bulk-downloaded or cached.

The production build includes a service worker that downloads the app HTML, JavaScript, CSS, and bundled street data on the first successful visit. Wait for **Offline app ready** in Settings, then reload Production, Test, and widget hash routes without a connection. This requires HTTPS or localhost, supported service workers, and retained browser storage. Development mode does not install the worker. Browser cache eviction or clearing site data requires another online visit. Updates install in the background and become active after all tabs using the old version close.

Arbitrary worldwide street-address search cannot run offline without a local address dataset. Selected-address history covers only chosen workplaces; no bundled city list supplies suggestions. Comprehensive offline address datasets and worldwide street maps are much larger. Offline street rendering covers bundled/downloaded neighborhoods only; areas beyond those extracts need another download. Missing building names or paths reflect OSM coverage, not invented geography.

Keyless online options include [Photon](https://photon.komoot.io/) for worldwide OSM address search, [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) for bounded map-data extracts, and [Nominatim](https://nominatim.org/) for explicit OSM searches (its public endpoint has a [usage policy](https://operations.osmfoundation.org/policies/nominatim/), including no client autocomplete). Public availability, coverage and limits vary. This app uses Photon for debounced suggestions and submitted searches, Overpass on explicit area download, and [OpenStreetMap.de](https://www.openstreetmap.de/) tiles by default. Provider/source attribution remains visible on the map.

## Live demo and screenshots

**Live URL: not published yet.** After you explicitly publish a repository and enable Pages, the expected URL is `https://<owner>.github.io/geo-work-charm/`.

Screenshot placeholders: desktop neighborhood, mobile dashboard, standalone working widget, clock-out animation. The project includes the actual responsive UI; no fabricated screenshots or deployment claim.

## Architecture

```text
src/core/geofence.ts        Pure Turf circle classifier + confirmation reducer
src/core/*.test.ts          Boundary, invalid input, hysteresis, coordinate/data tests
src/location/types.ts      WGS84 provider contract
src/location/providers.ts  Browser location; legacy AMap adapter remains unused
src/location/amap.ts       Legacy JS 2.0 loader (not used by default app)
src/location/geocode.ts    OSM suggestions, Chinese query handling, selected-address history
src/geo/coordinates.ts      WGS84 ↔ GCJ-02 approximation
src/geo/streets.ts          OSM geometry conversion, local packs, bounded downloads
src/geo/data/*.json         Real offline demo-neighborhood street/building extracts
src/geo/data/NOTICE.md      OSM attribution and ODbL database license notice
scripts/download-streets.mjs  Reproduce/update the shipped OSM extracts
src/geo/nearby.ts           Distance-based Test position generation
src/store.ts               State lifecycle, persistence and cross-tab settings
src/components/Map.tsx     Minimal Leaflet map + draggable Test location
src/components/WorkplaceSearch.tsx  Minimal address search and suggestions
src/components/Settings.tsx  Accuracy, geofence, Test coordinates, networking, offline maps
offline-plugin.ts          Build-time versioned app-shell service worker
src/offline.ts             Base-aware service worker registration
src/animations/index.tsx   Replaceable animation registry
src/App.tsx                Production, Test, Settings and fullscreen widget routes
```

The map shows workplace entry/exit rings, location and accuracy. It retains pan/zoom across position updates. The UI omits fictional neighbor dots and explanatory legends to keep the main screens focused on search and distance.

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

All domain/provider samples use WGS84 latitude/longitude, accuracy in meters and epoch-millisecond timestamp. Browser geolocation requests high accuracy, zero cached age and a timeout. The active app uses browser geolocation directly, even if old AMap environment values remain present. The user must explicitly select simulation if real location is unavailable. Watches, timers and late callbacks are cleaned up/ignored when switching providers or users. GPS availability and the browser/OS positioning provider's own network requirements remain device-dependent.

The unused legacy AMap adapter uses `convert:true`, returning GCJ-02 positions that are approximately inverted to WGS84. The included iterative conversion is a common mathematical approximation, not survey-grade or a guarantee about every provider/device's coordinate behavior. Outside the broad mainland-China bounding box conversion is identity; borders and special regions need production validation. Browser positioning can vary by operating system and provider, especially in China; verify its datum rather than applying a second conversion blindly. Offline coordinate entry and Photon/OSM use WGS84. No BD-09 support.

## AMap and GitHub Pages

The changing IP of GitHub Pages is not the primary issue for browser maps: server-side Web Service keys and browser JavaScript SDK keys have different security models. Browser keys generally use origin/domain restrictions, while IP allowlists apply to server requests. AMap still requires credentials and network access, and its recommended security proxy conflicts with a strictly backend-free design. The app therefore no longer automatically loads AMap; the legacy adapter files remain available for future integrations. Old `.env.local` AMap values do not enable it. **Every `VITE_*` value used by frontend code is public**, so do not place server secrets there.

## Deploy to GitHub Pages (no keys)

1. Create/push a repository only when ready to publish; no remote is created by this project.
2. In GitHub **Settings → Pages → Source**, select **GitHub Actions**.
3. Push `main` or run the included workflow manually.
4. The workflow runs `npm ci`, lint, typecheck, tests and production build, uploads `dist`, then deploys with a `github-pages` environment, Pages/OIDC permissions and concurrency protection.
5. It sets `VITE_BASE_PATH=/<repository-name>/`. For a root user/organization Pages repository, change that value to `/`. Default local/static builds use relative `./`.
6. No API variables or backend configuration are required. The build emits `sw.js` alongside the app and scopes its cache to this repository path.

Asset links and service worker registration respect Vite's base. Workplace selection comes from browser history, so offline startup does not depend on a preset JSON fetch. Hash routes do not need a server rewrite or 404 workaround.

## Privacy and persistence

Settings, your chosen custom workplace, provider preference, simulation values, per-workplace/per-source stable state, up to 80 chosen addresses and up to three downloaded map extracts live in localStorage. App assets and bundled maps live in Cache Storage. Suggestion responses have a separate five-minute session cache for repeated queries; they never become default workplaces. **No raw GPS samples, timestamps, trajectory, or location history are persisted.** Explicitly choosing your current location as a workplace saves that single coordinate by request. Selected results and map pins save workplace coordinates and selected search text. Downloaded street extracts record the requested area, not a movement history. Clearing this site's storage resets these records and removes its offline copy. There is no upload API or analytics. Photon receives typed/submitted search text; Overpass receives explicitly requested bounds; online OpenStreetMap.de tiles receive tile requests. Map tiles and address suggestions default online; turn them off to work with saved data. A remembered real-location provider may resume on reload subject to browser permission.

## Limitations and future backend path

This is not a reliable background attendance tracker, authorization system or payroll tool. Browsers suspend tabs, throttle timers and can deny location; indoor GPS drifts. Mobile web cannot guarantee background transitions. The 150 m threshold is intentionally permissive for a toy demo and can exceed the fence size. Real-world accuracy filtering, uncertainty modeling, minimum dwell time, timestamp ordering and sensor/provider audits need more work. AMap access and Chinese deployment need vendor/legal review. The date seed follows the viewer's local day, not a workplace timezone. Stable state can outlive a real workday; it is only a UI hint, not an authoritative record.

For a future service: introduce explicit consent, real authentication, private workplace configuration, auditable event semantics, a carefully minimized event endpoint and retention policy. Keep raw trajectories out by default; do not send public demo codes as credentials. Consider polygon fences via Turf, a MapLibre adapter, and a controlled server-side AMap proxy. Those are future work, not hidden dependencies.

## References and license

Original application code and SVG/CSS artwork, released under [MIT](LICENSE). Libraries keep their respective licenses.

- [Turf](https://turfjs.org/) — geospatial functions
- [Leaflet](https://leafletjs.com/) — SVG street geometry and interactive map controls
- [OpenStreetMap](https://www.openstreetmap.org/copyright) — street/building data under ODbL; see [data notice](src/geo/data/NOTICE.md)
- [AMap JS API](https://lbs.amap.com/api/javascript-api-v2/summary)
- [jonnyhuck](https://github.com/jonnyhuck) — geospatial ecosystem reference
- [naranyala](https://github.com/naranyala) — attendance-demo ecosystem reference
- [Geoattend discovery](https://github.com/search?q=Geoattend&type=repositories) — contextual prior-art search, not an incorporated implementation

These references are reading pointers, not claims of affiliation, compatibility or copied code.

## Verification record

Validated with Node 26: dependency installation, ESLint, TypeScript, 48 passing Vitest tests, and a production build with `/geo-work-charm/` base. Tests cover geofence behavior, debounced suggestions, Chinese IME, keyboard selection, Chinese POI query/ranking, no preset addresses, restoring latest selected history, cancelled requests, real OSM map content, geometry conversion, bounded map download/cache behavior, service worker scope/cache isolation, and static-host `Vary: Origin` compatibility. The test command disables Node's experimental native Web Storage so jsdom supplies browser storage consistently.

Live desktop/mobile verification typed `长沙万达总部国际 C区` without pressing Search, received `万达·总部国际·C区` ahead of B区, selected it, and reloaded with that address as the default. Both search and street tiles were on by default. Only C区 entered history. The mobile layout had no horizontal overflow at 375 px. All displayed suggestions and coordinates came from live Photon/OSM data, not a hardcoded lookup table.

The Codex in-app browser verified visible OSM road/path labels and building outlines from the bundled maps, with Chinese road and building/place names, drag panning, zoom controls and a changing distance scale. The implementation uses SVG cartography rather than inaccessible CARTO tiles. The mobile map retains its 420 px height without horizontal overflow. With the final preview server stopped, the dashboard reloaded from cache with 466 SVG paths and real Chinese road/building labels. Build-time OSM extracts were successfully retrieved; the browser's subsequent public Overpass download returned HTTP 504, and the UI preserved the bundled map and reported the failure. The browser verified actual online street imagery and Chinese labels from OpenStreetMap.de; this replaces the inaccessible CARTO/OSM.org hosts and the Esri placeholder tiles in this part of China. Real GPS and AMap were not live-tested.
