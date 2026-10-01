import { runInNewContext } from "node:vm";
import type { OutputBundle, OutputOptions, PluginContext } from "rollup";
import { expect, it, vi } from "vitest";
import { offlinePlugin } from "./offline-plugin";

async function workerSource() {
  const emitFile = vi.fn();
  const hook = offlinePlugin().generateBundle;
  if (typeof hook !== "function") throw Error("Missing build hook");
  await hook.call(
    { emitFile } as unknown as PluginContext,
    {} as OutputOptions,
    {
      "index.html": { type: "asset", source: "<html>App</html>" },
      "assets/app-123.js": { type: "chunk", code: "console.log('App')" },
      "assets/map-456.js": { type: "chunk", code: "console.log('Map')" },
    } as unknown as OutputBundle,
    false,
  );
  return emitFile.mock.calls[0][0].source as string;
}
interface WorkerEvent {
  request?: { url: string; method: string; mode: string };
  waitUntil?: (promise: Promise<unknown>) => void;
  respondWith?: (promise: Promise<unknown>) => void;
}
it.each(["/", "/geo-work-charm/"])(
  "caches offline app routes and chunks at %s without touching other sites or third-party requests",
  async (path) => {
    const scope = `https://example.github.io${path}`;
    const handlers = new Map<string, (event: WorkerEvent) => void>();
    const stores = new Map<string, Map<string, string>>([
      [`gw-shell:${path}:old`, new Map()],
      ["gw-shell:/another-project/:old", new Map()],
    ]);
    const offlineFetch = vi.fn(() => Promise.reject(Error("Offline")));
    runInNewContext(await workerSource(), {
      URL,
      fetch: offlineFetch,
      self: {
        registration: { scope },
        clients: { claim: vi.fn() },
        addEventListener: (
          type: string,
          handler: (event: WorkerEvent) => void,
        ) => handlers.set(type, handler),
      },
      caches: {
        keys: async () => [...stores.keys()],
        delete: async (key: string) => stores.delete(key),
        open: async (key: string) => {
          if (!stores.has(key)) stores.set(key, new Map());
          const entries = stores.get(key)!;
          return {
            addAll: async (urls: string[]) =>
              urls.forEach((url) => entries.set(url, `Cached ${url}`)),
            match: async (
              request: string | { url: string },
              options?: { ignoreVary: boolean },
            ) => {
              // Vite/static hosts may return Vary: Origin; CORS module requests
              // differ from Cache.addAll requests even for the same asset URL.
              if (typeof request !== "string" && !options?.ignoreVary)
                return undefined;
              return entries.get(
                typeof request === "string" ? request : request.url,
              );
            },
          };
        },
      },
    });
    let work: Promise<unknown> | undefined;
    handlers.get("install")!({
      waitUntil: (promise) => {
        work = promise;
      },
    });
    await work;
    handlers.get("activate")!({
      waitUntil: (promise) => {
        work = promise;
      },
    });
    await work;
    expect(stores.has(`gw-shell:${path}:old`)).toBe(false);
    expect(stores.has("gw-shell:/another-project/:old")).toBe(true);
    for (const url of [
      scope,
      `${scope}?view=offline`,
      `${scope}index.html`,
      `${scope}assets/map-456.js`,
    ]) {
      const respondWith = vi.fn();
      handlers.get("fetch")!({
        request: {
          url,
          method: "GET",
          mode: url.includes("assets/") ? "cors" : "navigate",
        },
        respondWith,
      });
      expect(respondWith).toHaveBeenCalledOnce();
      await expect(respondWith.mock.calls[0][0]).resolves.toContain("Cached");
    }
    for (const url of [
      "https://photon.komoot.io/api/?q=test",
      "https://a.basemaps.cartocdn.com/tiles.png",
      `${scope}other-data.json`,
    ]) {
      const respondWith = vi.fn();
      handlers.get("fetch")!({
        request: { url, method: "GET", mode: "cors" },
        respondWith,
      });
      expect(respondWith).not.toHaveBeenCalled();
    }
    expect(offlineFetch).not.toHaveBeenCalled();
  },
);
