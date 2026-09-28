/* eslint-disable @typescript-eslint/no-explicit-any */
export type AMapSDK = any;
declare global {
  interface Window {
    AMap?: AMapSDK;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}
let promise: Promise<AMapSDK> | undefined;
export const amapConfigured = Boolean(
  import.meta.env.VITE_AMAP_KEY && import.meta.env.VITE_AMAP_SECURITY_CODE,
);
export function loadAMap(): Promise<AMapSDK> {
  if (!amapConfigured) return Promise.reject(Error("AMap not configured"));
  if (window.AMap) return Promise.resolve(window.AMap);
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    window._AMapSecurityConfig = {
      securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
    };
    const script = document.createElement("script"),
      timer = setTimeout(() => reject(Error("AMap timed out")), 10000);
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(import.meta.env.VITE_AMAP_KEY)}&plugin=AMap.Geolocation`;
    script.onload = () => {
      clearTimeout(timer);
      if (window.AMap) resolve(window.AMap);
      else reject(Error("SDK unavailable"));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(Error("SDK failed"));
    };
    document.head.appendChild(script);
  });
  return promise;
}
