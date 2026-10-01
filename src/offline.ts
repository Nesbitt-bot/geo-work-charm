export async function prepareOffline(): Promise<boolean> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return false;
  try {
    const worker = new URL(
      `${import.meta.env.BASE_URL}sw.js`,
      document.baseURI,
    );
    const scope = new URL("./", worker).pathname;
    const existing = await navigator.serviceWorker.getRegistration(scope);
    if (existing?.active) {
      // Offline reloads already have an installed worker. A network failure
      // while checking for an update must not report the cached app as missing.
      void existing.update().catch(() => {});
      return true;
    }
    await navigator.serviceWorker.register(worker.href, {
      scope,
    });
    await navigator.serviceWorker.ready;
    return true;
  } catch {
    return false;
  }
}
