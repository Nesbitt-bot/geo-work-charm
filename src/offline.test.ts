// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { prepareOffline } from "./offline";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("recognizes an installed offline copy even when its update cannot reach the server", async () => {
  vi.stubEnv("PROD", true);
  vi.stubEnv("BASE_URL", "/geo-work-charm/");
  const update = vi.fn().mockRejectedValue(new TypeError("Offline"));
  const register = vi.fn();
  const getRegistration = vi.fn().mockResolvedValue({ active: {}, update });
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration, register } });
  await expect(prepareOffline()).resolves.toBe(true);
  expect(getRegistration).toHaveBeenCalledWith("/geo-work-charm/");
  expect(update).toHaveBeenCalledOnce();
  expect(register).not.toHaveBeenCalled();
});
it("registers the worker at the repository base path on a first visit", async () => {
  vi.stubEnv("PROD", true);
  vi.stubEnv("BASE_URL", "/geo-work-charm/");
  const register = vi.fn().mockResolvedValue({});
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: vi.fn().mockResolvedValue(undefined),
      register,
      ready: Promise.resolve({ active: {} }),
    },
  });
  await expect(prepareOffline()).resolves.toBe(true);
  expect(register).toHaveBeenCalledWith(
    new URL("/geo-work-charm/sw.js", document.baseURI).href,
    { scope: "/geo-work-charm/" },
  );
});
