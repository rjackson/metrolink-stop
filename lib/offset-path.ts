export type Point = { x: number; y: number };

/** The point a given distance along a path, or its end if it's shorter than that */
export function pointAlong(points: Point[], distance: number): Point {
  let remaining = distance;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length >= remaining && length > 0) {
      const t = remaining / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= length;
  }
  return points[points.length - 1];
}

/**
 * A path shifted sideways by `offset` (to the right of its direction of travel, in screen coordinates where y points
 * down), keeping its corners mitred. Used to draw lines that share track side by side.
 */
export function offsetPath(points: Point[], offset: number): Point[] {
  if (offset === 0 || points.length < 2) {
    return points;
  }

  // Unit normals of each segment, pointing right of the direction of travel
  const normals = points.slice(1).map((point, i) => {
    const dx = point.x - points[i].x;
    const dy = point.y - points[i].y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: -dy / length, y: dx / length };
  });

  return points.map((point, i) => {
    const before = normals[Math.max(i - 1, 0)];
    const after = normals[Math.min(i, normals.length - 1)];
    const sum = { x: before.x + after.x, y: before.y + after.y };
    const length = Math.hypot(sum.x, sum.y);
    if (length < 1e-6) {
      // A complete reversal has no sensible mitre, so just use one side
      return { x: point.x + after.x * offset, y: point.y + after.y * offset };
    }
    const miter = { x: sum.x / length, y: sum.y / length };
    // Lengthen the mitre on corners so parallel lines stay parallel, but not without limit on sharp ones
    const scale = Math.min(1 / Math.max(miter.x * after.x + miter.y * after.y, 1e-6), 2);
    return { x: point.x + miter.x * offset * scale, y: point.y + miter.y * offset * scale };
  });
}
