# Geo Work Charm

A mobile-first work badge with a reversible settings card. The front uses the supplied portrait, the official GitHub mark, **Trance-0**, and **Vibe coding engineer** by default; department is optional. The upper-right three-line menu flips the card 180° to its settings. Desktop visitors see a dismissible recommendation to use a phone. There is no login backend: opening the app loads your local badge.

The UI uses a pixel-art style: square borders, hard shadows, a pixelated version of the supplied portrait and a block-built office scene. Silkscreen Regular is bundled locally under the SIL Open Font License 1.1 and precached for offline use; unsupported scripts such as Chinese use the device's text font. Office lights use stepped fades while the building remains still. Original uploads and profile settings remain locally editable.

All badge portraits, including uploads, are center-cropped into a 48×48-pixel preview in the browser and shown with a subtle pixel-grid overlay. Portrait and office colors have boosted saturation. This rendering never changes the original IndexedDB image. The more saturated default palettes replace earlier default colors; custom theme colors remain unchanged.

On mobile, the card fills the available viewport with safe-area margins and follows browser toolbar resizing. Double-tap (or desktop double-click) the badge to force Off work and play its animation without a workplace or GPS fix; repeat to switch to Working. The focused badge also supports Enter/Space. **Additional → Double-tap to switch status** is enabled by default and saved locally. The manual display override lasts for this session until the option is disabled or the location source changes; it never writes a GPS or attendance event. Off-work artwork covers the entire card, with the menu and status overlaid. The default off-work scene is a graphite office building drawn in inline SVG. Clock-out dims warm office lights floor by floor; returning to work lights them from the lobby upward before revealing the portrait. The building remains still. The transition lasts 3.2 seconds; reduced motion uses a brief 0.9-second light fade rather than hiding it. Initialization does not replay a transition. Uploaded off-work images are retained, with the office transition shown before the chosen image.

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

No API key is needed. Location is requested immediately on page load, even before a workplace is selected. Browser permission is required on HTTPS / localhost. Denied GPS stays unavailable when Browser location is selected; it never silently becomes a custom position. Settings includes a permission retry button.

Routes use static-host-compatible hash routing:

- `/` or `/#/badge` — badge front using the saved location source
- `/#/settings` — settings back
- `/#/debug` — current location map followed by session logs
- `/#/widget` — standalone badge using the same saved settings

The back has **Settings / Debugging** tabs. Settings retains Info, Company location and Additional sections. **Current position → Browser location / Custom location** replaces separate Production/Test modes, and persists across reloads and widgets. Custom location provides address search, a draggable map pin, map click selection, and optional coordinates, distance and accuracy. No current position is invented before you choose one. Map selection saves exact coordinates immediately; when online suggestions are enabled, Photon reverse lookup adds a nearby address label without snapping the pin. Coordinates remain usable if lookup fails or the app is offline. Custom selection never changes company history or browser GPS. Existing legacy routes remain usable, and saved Test locations are retained.

Debugging shows the map first, including the company marker, both work/off-work range circles, the current browser/custom position and its accuracy circle. Bounded, in-memory session logs follow. The overview map is read-only; the custom picker in Settings edits your position. Switching panels scrolls back to the top.

**Info** edits the profile photo, company logo, name, optional department and job title. **Company location** contains OSM-compatible address search, the current-position source and custom picker, work/off-work thresholds and the off-work image (the office-building SVG by default). **Additional** contains light/dark themes, configurable accent/background/card colors, motion reflection, double-tap status switching, online options, permission retry, offline maps and a standalone badge link.

Uploaded photos/logos/off-work images are kept as image Blobs in **IndexedDB**, not sent to a server. PNG, JPEG, WebP, GIF and SVG files up to 8 MB are supported; invalid images are rejected. Revision tokens in localStorage keep open badges synchronized. Reset restores the shipped defaults. Default assets are bundled and precached for offline startup.

**Gravity / holographic reflection** in Additional is off by default. Turning it on enables a rainbow foil surface with device-orientation-driven reflection and gentle tilt; desktop pointer movement provides a fallback. Safari/iOS motion permission is requested only from the toggle/button user gesture. Reduced-motion preferences preserve a static foil texture and disable tilt/flip animation. The uploaded portrait itself is never changed.

Address suggestions appear after 600 ms of typing, with Chinese IME handling, cancellation and keyboard selection. Only chosen company addresses enter history. The latest company remains the default on reload. Search and maps remain keyless and online by default; offline mode uses selected history and saved maps.

Chinese POIs may be indexed without the city prefix or with middle-dot separators. The search normalizes punctuation, retries the POI without a city prefix or area suffix when necessary, and ranks matching area letters first. The live test `长沙万达总部国际 C区` finds OSM's `万达·总部国际·C区` at WGS84 latitude **28.2054614**, longitude **112.965934**, ahead of B区 alternatives. This address is a verification case, not hardcoded app data. OSM coverage still limits autocomplete; this is not Google's address database.

## Keyless and offline operation

The badge front makes no map or address requests. Opening address search uses keyless Photon suggestions; opening Debugging or the custom picker uses OpenStreetMap.de tiles unless disabled. Leaflet also renders saved local street data. Legacy extracts are coverage, not preset addresses.

Browser location uses GPS only. Custom location uses the explicitly chosen current position; coordinates, the distance slider and dragging a pin are available inside Settings. The location accuracy circle is visible in Debugging and the custom picker.

Settings → Save workplace map offline retrieves a bounded OSM extract around the chosen workplace through Overpass and saves up to three regional maps. Coverage is roughly 0.008 degrees across. The public server can time out; failures preserve saved data. Settings → Online street map controls keyless OpenStreetMap.de tiles, which are not bulk-downloaded or cached.

The production build includes a service worker that downloads the app HTML, JavaScript, CSS, and bundled street data on the first successful visit. Wait for **Offline app ready** in Settings, then reload badge, settings, debugging, and widget hash routes without a connection. This requires HTTPS or localhost, supported service workers, and retained browser storage. Development mode does not install the worker. Browser cache eviction or clearing site data requires another online visit. Updates install in the background and become active after all tabs using the old version close.

Arbitrary worldwide street-address search cannot run offline without a local address dataset. Selected-address history covers only chosen workplaces; no bundled city list supplies suggestions. Comprehensive offline address datasets and worldwide street maps are much larger. Offline street rendering covers bundled/downloaded neighborhoods only; areas beyond those extracts need another download. Missing building names or paths reflect OSM coverage, not invented geography.

Keyless online options include [Photon](https://photon.komoot.io/) for worldwide OSM address search, [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) for bounded map-data extracts, and [Nominatim](https://nominatim.org/) for explicit OSM searches (its public endpoint has a [usage policy](https://operations.osmfoundation.org/policies/nominatim/), including no client autocomplete). Public availability, coverage and limits vary. This app uses Photon for debounced suggestions and submitted searches, Overpass on explicit area download, and [OpenStreetMap.de](https://www.openstreetmap.de/) tiles by default. Provider/source attribution remains visible on the map.

## Live demo and screenshots

Live URL: [Geo Work Charm](https://nesbitt-bot.github.io/geo-work-charm/).

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
src/geo/nearby.ts           Distance-based custom position generation
src/store.ts               State lifecycle, persistence and cross-tab settings
src/components/Map.tsx     Leaflet overview + draggable custom position
src/components/WorkplaceSearch.tsx  Minimal address search and suggestions
src/components/Settings.tsx  Sectioned settings with location source picker
src/components/Badge.tsx     Portrait badge and motion/foil rendering
src/components/Debugging.tsx  Session logging panel
src/media.ts               IndexedDB image persistence and previews
offline-plugin.ts          Build-time versioned app-shell service worker
src/offline.ts             Base-aware service worker registration
src/animations/index.tsx   Replaceable animation registry
src/App.tsx                Badge, Settings, Debugging and fullscreen routes
```

The working badge shows identity and a small status. Off work displays the configured image across the full badge; initialization does not replay a celebration. Settings edits location and profile details; Debugging shows the location overview and logs.

## Geofence semantics

- At **≤80 m**, raw state is WORKING; at **≥120 m**, OFF_WORK.
- In the open 80–120 m band, retain the stable state. An unknown initial state stays unknown.
- Establish the initial status from the **first reliable fix**; browser watches may not emit another fix while stationary. Initialization never plays a departure animation. Later status changes require **two distinct consecutive valid fixes**; one outlier cannot switch state.
- Accuracy **>150 m**, negative/nonfinite values, invalid coordinates or fence configuration are unreliable. Show UNKNOWN, freeze stable state, and break the candidate streak.
- Browser/provider errors show a neutral widget, not a fake departure. An unchanged position is retained while its watch remains active; silence from a stationary watch is not treated as a missing fix. Duplicate/out-of-order timestamps do not clear a valid status or count as confirmation.
- Only confirmed WORKING → OFF_WORK generates a departure event. OFF_WORK initialization, poor accuracy and entry do not animate.
- Persist only stable state, separately by demo code and actual source. Candidates and events are never persisted. Reopening a page does not replay a stored transition; a session must first observe a reliable working state before arming a new departure animation.
- Sample source changes clear confirmation candidates; real and simulated stable states are isolated.

Browser location processes each GPS callback directly rather than relying on React-rendered samples, so batched callbacks cannot lose confirmation fixes. Choosing a workplace after GPS has arrived evaluates that existing fix immediately. After a provider error or poor accuracy, the first recovered reliable fix re-establishes status without a false clock-out. Neutral charm labels distinguish a missing workplace, missing position, poor accuracy and an undecided boundary position.

`evaluate` and `reduceSample` are pure; `metersFrom` uses Turf great-circle distance. The classifier has a documented future `booleanPointInPolygon` seam, not a pretended polygon implementation. These circles indicate proximity, **not building entry or employment attendance**.

## Location, China and coordinate systems

All domain/provider samples use WGS84 latitude/longitude, accuracy in meters and epoch-millisecond timestamp. Browser geolocation requests high accuracy, zero cached age and a timeout. The active app uses browser geolocation directly, even if old AMap environment values remain present. The user must explicitly select Custom location if browser location is unavailable. Watches, timers and late callbacks are cleaned up/ignored when switching providers or users. GPS availability and the browser/OS positioning provider's own network requirements remain device-dependent.

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

Settings, your chosen custom workplace, location source, custom current position, per-workplace/per-source stable state, up to 80 chosen addresses and up to three downloaded map extracts live in localStorage. App assets and bundled maps live in Cache Storage. Suggestion responses have a separate five-minute session cache for repeated queries; they never become default workplaces. **No raw GPS samples, timestamps, trajectory, or location history are persisted.** Explicitly choosing your current location as a workplace saves that single coordinate by request. Selected results and map pins save workplace coordinates and selected search text. Downloaded street extracts record the requested area, not a movement history. Clearing this site's storage resets these records and removes its offline copy. There is no upload API or analytics. Photon receives typed/submitted search text and explicitly selected custom coordinates for reverse lookup; Overpass receives explicitly requested bounds; online OpenStreetMap.de tiles receive tile requests. Map tiles and address suggestions default online; turn them off to work with saved data. A remembered real-location provider may resume on reload subject to browser permission.

## Limitations and future backend path

This is not a reliable background attendance tracker, authorization system or payroll tool. Browsers suspend tabs, throttle timers and can deny location; indoor GPS drifts. Mobile web cannot guarantee background transitions. The 150 m threshold is intentionally permissive for a toy demo and can exceed the fence size. Real-world accuracy filtering, uncertainty modeling, minimum dwell time, timestamp ordering and sensor/provider audits need more work. AMap access and Chinese deployment need vendor/legal review. The date seed follows the viewer's local day, not a workplace timezone. Stable state can outlive a real workday; it is only a UI hint, not an authoritative record.

For a future service: introduce explicit consent, real authentication, private workplace configuration, auditable event semantics, a carefully minimized event endpoint and retention policy. Keep raw trajectories out by default; do not send public demo codes as credentials. Consider polygon fences via Turf, a MapLibre adapter, and a controlled server-side AMap proxy. Those are future work, not hidden dependencies.

## References and license

Original application code and clock-out SVG/CSS artwork are [MIT](LICENSE). The default portrait was supplied by the project user. The GitHub mark comes from official Octicons; its MIT license is included in src/assets/OCTICONS-LICENSE.txt. Libraries and OSM data retain their own licenses.

- [Turf](https://turfjs.org/) — geospatial functions
- [Leaflet](https://leafletjs.com/) — SVG street geometry and interactive map controls
- [OpenStreetMap](https://www.openstreetmap.org/copyright) — street/building data under ODbL; see [data notice](src/geo/data/NOTICE.md)
- [AMap JS API](https://lbs.amap.com/api/javascript-api-v2/summary)
- [jonnyhuck](https://github.com/jonnyhuck) — geospatial ecosystem reference
- [naranyala](https://github.com/naranyala) — attendance-demo ecosystem reference
- [Geoattend discovery](https://github.com/search?q=Geoattend&type=repositories) — contextual prior-art search, not an incorporated implementation

These references are reading pointers, not claims of affiliation, compatibility or copied code.

## Verification record

Validated with Node 26: dependency installation, ESLint, TypeScript, 82 passing Vitest tests, and a production build with `/geo-work-charm/` base. Tests cover geofence behavior, debounced suggestions, Chinese IME, keyboard selection, Chinese POI query/ranking, no preset addresses, restoring latest selected history, cancelled requests, real OSM map content, geometry conversion, bounded map download/cache behavior, service worker scope/cache isolation, and static-host `Vary: Origin` compatibility. The test command disables Node's experimental native Web Storage so jsdom supplies browser storage consistently.

Live desktop/mobile verification typed `长沙万达总部国际 C区` without pressing Search, received `万达·总部国际·C区` ahead of B区, selected it, and reloaded with that address as the default. Both search and street tiles were on by default. Only C区 entered history. The mobile layout had no horizontal overflow at 375 px. All displayed suggestions and coordinates came from live Photon/OSM data, not a hardcoded lookup table.

The Codex in-app browser verified visible OSM road/path labels and building outlines from the bundled maps, with Chinese road and building/place names, drag panning, zoom controls and a changing distance scale. The implementation uses SVG cartography rather than inaccessible CARTO tiles. The mobile map retains its 420 px height without horizontal overflow. With the final preview server stopped, the dashboard reloaded from cache with 466 SVG paths and real Chinese road/building labels. Build-time OSM extracts were successfully retrieved; the browser's subsequent public Overpass download returned HTTP 504, and the UI preserved the bundled map and reported the failure. The browser verified actual online street imagery and Chinese labels from OpenStreetMap.de; this replaces the inaccessible CARTO/OSM.org hosts and the Esri placeholder tiles in this part of China. Real GPS and AMap were not live-tested.


Badge UI verification: supplied portrait and official logo, card flip, shared settings sections, logging-only Debugging, theme/palette and mode restoration, motion permission fallback, IndexedDB image bytes/reset, and image upload restoration after browser reload. A 390 × 844 view fit with no page scrolling. Physical iOS sensor permission and device tilt were not tested on hardware; orientation behavior is covered by simulated events, and reduced-motion behavior was observed in the desktop browser.
