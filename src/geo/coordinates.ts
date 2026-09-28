export type Coordinate = [number, number];
export function wgs84ToGcj02([lng, lat]: Coordinate): Coordinate {
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271)
    return [lng, lat];
  const x = lng - 105,
    y = lat - 35,
    p = Math.PI;
  let a =
      -100 +
      2 * x +
      3 * y +
      0.2 * y * y +
      0.1 * x * y +
      0.2 * Math.sqrt(Math.abs(x)),
    b =
      300 +
      x +
      2 * y +
      0.1 * x * x +
      0.1 * x * y +
      0.1 * Math.sqrt(Math.abs(x));
  a +=
    ((20 * Math.sin(6 * x * p) + 20 * Math.sin(2 * x * p)) * 2) / 3 +
    ((20 * Math.sin(y * p) + 40 * Math.sin((y / 3) * p)) * 2) / 3 +
    ((160 * Math.sin((y / 12) * p) + 320 * Math.sin((y * p) / 30)) * 2) / 3;
  b +=
    ((20 * Math.sin(6 * x * p) + 20 * Math.sin(2 * x * p)) * 2) / 3 +
    ((20 * Math.sin(x * p) + 40 * Math.sin((x / 3) * p)) * 2) / 3 +
    ((150 * Math.sin((x / 12) * p) + 300 * Math.sin((x / 30) * p)) * 2) / 3;
  const rad = (lat * p) / 180,
    m = 1 - 0.006693421622965943 * Math.sin(rad) ** 2;
  return [
    lng + (b * 180) / ((6378245 / Math.sqrt(m)) * Math.cos(rad) * p),
    lat +
      (a * 180) /
        (((6378245 * (1 - 0.006693421622965943)) / (m * Math.sqrt(m))) * p),
  ];
}
export function gcj02ToWgs84(c: Coordinate): Coordinate {
  let r: Coordinate = [...c];
  for (let i = 0; i < 5; i++) {
    const n = wgs84ToGcj02(r);
    r = [r[0] + c[0] - n[0], r[1] + c[1] - n[1]];
  }
  return r;
}
