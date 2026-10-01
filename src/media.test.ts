import { indexedDB } from "fake-indexeddb";
import { expect, it, vi } from "vitest";
import { readImage, removeImage, storeImage } from "./media";
vi.stubGlobal("indexedDB", indexedDB);
it("persists uploaded image bytes separately from preferences and can reset each slot", async () => {
  const image = new Blob(["original-avatar-bytes"], { type: "image/jpeg" });
  await storeImage("avatar", image);
  const restored = await readImage("avatar");
  expect(await restored?.text()).toBe("original-avatar-bytes");
  expect(restored?.type).toBe("image/jpeg");
  await storeImage("logo", new Blob(["brand-logo"], { type: "image/png" }));
  await removeImage("avatar");
  expect(await readImage("avatar")).toBeNull();
  expect(await (await readImage("logo"))?.text()).toBe("brand-logo");
});
it("rejects non-images and oversized uploads before writing them", async () => {
  await expect(
    storeImage("avatar", new Blob(["text"], { type: "text/plain" })),
  ).rejects.toThrow("Choose an image");
  await expect(
    storeImage(
      "offwork",
      new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: "image/png" }),
    ),
  ).rejects.toThrow("8 MB");
});
