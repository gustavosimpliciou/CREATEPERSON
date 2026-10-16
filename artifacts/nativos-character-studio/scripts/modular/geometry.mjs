import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  Mesh,
  MeshStandardMaterial,
  DoubleSide,
  Raycaster,
  CatmullRomCurve3,
  TubeGeometry,
  SphereGeometry,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
export const material = (color, slot = "primary") => {
  const m = new MeshStandardMaterial({ color, roughness: 0.66, metalness: 0 });
  m.name = slot;
  return m;
};
export function mesh(geometry, color, name, slot = "primary") {
  geometry.computeVertexNormals();
  const result = new Mesh(geometry, material(color, slot));
  result.name = name;
  return result;
}
export function indexed(points, triangles) {
  const g = new BufferGeometry();
  g.setAttribute(
    "position",
    new Float32BufferAttribute(
      points.flatMap((p) => p.toArray()),
      3,
    ),
  );
  g.setIndex(triangles.flat());
  g.computeVertexNormals();
  return g;
}
export function weld(g) {
  const copy = g.clone();
  copy.deleteAttribute("normal");
  copy.deleteAttribute("uv");
  const result = mergeVertices(copy, 0.0001);
  result.computeVertexNormals();
  return result;
}
// Clip triangles against semantic garment planes, interpolating the surface normals.
export function clipSurface(source, planes) {
  const g = weld(source),
    p = g.attributes.position,
    n = g.attributes.normal,
    index = g.index.array;
  const points = [],
    normals = [],
    triangles = [];
  for (let i = 0; i < index.length; i += 3) {
    let poly = [0, 1, 2].map((k) => ({
      p: V().fromBufferAttribute(p, index[i + k]),
      n: V().fromBufferAttribute(n, index[i + k]),
    }));
    for (const plane of planes) {
      const next = [];
      for (let j = 0; j < poly.length; j++) {
        const a = poly[j],
          b = poly[(j + 1) % poly.length],
          da = plane(a.p),
          db = plane(b.p);
        if (da >= 0) next.push(a);
        if (da >= 0 !== db >= 0) {
          const t = da / (da - db);
          next.push({
            p: a.p.clone().lerp(b.p, t),
            n: a.n.clone().lerp(b.n, t).normalize(),
          });
        }
      }
      poly = next;
    }
    for (let j = 1; j < poly.length - 1; j++) {
      const tri = [poly[0], poly[j], poly[j + 1]];
      if (
        V()
          .subVectors(tri[1].p, tri[0].p)
          .cross(V().subVectors(tri[2].p, tri[0].p))
          .length() < 1e-7
      )
        continue;
      triangles.push(
        tri.map((a) => {
          points.push(a.p);
          normals.push(a.n);
          return points.length - 1;
        }),
      );
    }
  }
  const out = indexed(points, triangles);
  out.setAttribute(
    "normal",
    new Float32BufferAttribute(
      normals.flatMap((n) => n.toArray()),
      3,
    ),
  );
  // Weld identical position + normal samples at shared edges.
  return mergeVertices(out, 0.0001);
}
export function boundaryEdges(g) {
  const edges = new Map(),
    idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = idx[i + j],
        b = idx[i + ((j + 1) % 3)],
        key = [Math.min(a, b), Math.max(a, b)].join(":");
      if (edges.has(key)) edges.get(key).count++;
      else edges.set(key, { a, b, count: 1 });
    }
  return [...edges.values()].filter((e) => e.count === 1);
}
export function subdivide(surface) {
  const points = Array.from(
    { length: surface.attributes.position.count },
    (_, i) => V().fromBufferAttribute(surface.attributes.position, i),
  );
  const idx = surface.index.array,
    triangles = [],
    edges = new Map();
  const mid = (a, b) => {
    const key = [Math.min(a, b), Math.max(a, b)].join(":");
    if (!edges.has(key)) {
      edges.set(key, points.length);
      points.push(points[a].clone().lerp(points[b], 0.5));
    }
    return edges.get(key);
  };
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]],
      ab = mid(a, b),
      bc = mid(b, c),
      ca = mid(c, a);
    triangles.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
  }
  return indexed(points, triangles);
}
export function smooth(surface, iterations = 3, weight = 0.35) {
  const g = weld(surface),
    p = g.attributes.position,
    idx = g.index.array,
    neighbors = Array.from({ length: p.count }, () => new Set());
  const boundary = new Set(boundaryEdges(g).flatMap((e) => [e.a, e.b]));
  for (let i = 0; i < idx.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = idx[i + j],
        b = idx[i + ((j + 1) % 3)];
      neighbors[a].add(b);
      neighbors[b].add(a);
    }
  let points = Array.from({ length: p.count }, (_, i) =>
    V().fromBufferAttribute(p, i),
  );
  for (let k = 0; k < iterations; k++)
    points = points.map((v, i) => {
      if (boundary.has(i)) return v;
      const average = V();
      for (const n of neighbors[i]) average.add(points[n]);
      return v
        .clone()
        .lerp(average.multiplyScalar(1 / neighbors[i].size), weight);
    });
  points.forEach((v, i) => p.setXYZ(i, v.x, v.y, v.z));
  g.computeVertexNormals();
  return g;
}
// A two-sided shell with a real inner surface and closed opening rims.
export function solidify(surface, clearance, thickness) {
  const p = surface.attributes.position,
    n = surface.attributes.normal,
    count = p.count;
  const points = [],
    triangles = [];
  for (const distance of [clearance + thickness, clearance])
    for (let i = 0; i < count; i++)
      points.push(
        V()
          .fromBufferAttribute(p, i)
          .addScaledVector(V().fromBufferAttribute(n, i), distance),
      );
  const idx = surface.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
    triangles.push([a, b, c], [c + count, b + count, a + count]);
  }
  for (const { a, b } of boundaryEdges(surface))
    triangles.push([b, a, a + count], [b, a + count, b + count]);
  return indexed(points, triangles);
}
export function tube(
  points,
  radius,
  color,
  name,
  closed = false,
  slot = "primary",
) {
  const curve = new CatmullRomCurve3(points, closed, "centripetal");
  const g = new TubeGeometry(
    curve,
    Math.max(24, points.length * 3),
    radius,
    10,
    closed,
  );
  if (closed) return mesh(weld(g), color, name, slot);
  // Cap the two open tube ends; do not leave invisible open print surfaces.
  const positions = Array.from(
    { length: g.attributes.position.count },
    (_, i) => V().fromBufferAttribute(g.attributes.position, i),
  );
  const idx = Array.from(g.index.array),
    triangles = [];
  for (let i = 0; i < idx.length; i += 3) triangles.push(idx.slice(i, i + 3));
  const start = positions.length;
  positions.push(curve.getPoint(0), curve.getPoint(1));
  const endRing = g.attributes.position.count - 11;
  for (let j = 0; j < 10; j++)
    triangles.push(
      [start, j, j + 1],
      [start + 1, endRing + j + 1, endRing + j],
    );
  return mesh(weld(indexed(positions, triangles)), color, name, slot);
}
export function bead(position, scale, color, name, slot = "primary") {
  const g = new SphereGeometry(1, 24, 16);
  g.scale(...scale);
  g.translate(...position.toArray());
  return mesh(weld(g), color, name, slot);
}
export function sampler(geometry) {
  const target = new Mesh(
    geometry,
    new MeshStandardMaterial({ side: DoubleSide }),
  );
  target.updateMatrixWorld();
  const ray = new Raycaster();
  return (origin, direction) => {
    // Always move off exact symmetry seams: a seam miss can otherwise return
    // the far side of the head as a valid (but incorrect) first intersection.
    ray.set(
      origin.clone().add(V(0.00013, 0.00007, 0.00003)),
      direction.clone().normalize(),
    );
    let hit = ray.intersectObject(target, false)[0];
    // Exact symmetry seams can be missed by floating-point triangle tests.
    if (!hit) {
      ray.set(
        origin.clone().add(V(0.0001, 0.00003, 0)),
        direction.clone().normalize(),
      );
      hit = ray.intersectObject(target, false)[0];
    }
    return hit ?? null;
  };
}
// Conformal closed facial relief; every sample is projected onto the actual head.
export function facialRelief(
  sample,
  cx,
  cy,
  rx,
  ry,
  depth,
  clearance = 0.08,
  shape = "ellipse",
) {
  const points = [],
    triangles = [],
    segments = 48,
    rings = 7;
  const surface = (x, y, offset) => {
    const hit = sample(V(x, y, 160), V(0, 0, -1));
    if (!hit) throw new Error(`Face projection missed ${x},${y}`);
    return hit.point.clone().add(V(0, 0, offset));
  };
  // Duplicate center per layer is unnecessary; rings share a single pole.
  for (const layer of [0, 1]) {
    points.push(surface(cx, cy, clearance + (layer === 0 ? depth : 0)));
    for (let r = 1; r <= rings; r++)
      for (let j = 0; j < segments; j++) {
        const t = (j / segments) * Math.PI * 2,
          s = r / rings;
        const x = cx + rx * s * Math.cos(t),
          y =
            cy +
            ry *
              s *
              Math.sin(t) *
              (shape === "happy" ? (Math.sin(t) > 0 ? 0.45 : 1) : 1);
        points.push(
          surface(
            x,
            y,
            clearance +
              (layer === 0
                ? 0.25 + depth * Math.sqrt(Math.max(0, 1 - s * s))
                : 0),
          ),
        );
      }
  }
  const count = 1 + rings * segments;
  for (let l = 0; l < 2; l++) {
    const off = l * count,
      add = (a, b, c) =>
        triangles.push(
          l === 0 ? [a + off, b + off, c + off] : [c + off, b + off, a + off],
        );
    for (let j = 0; j < segments; j++) add(0, 1 + j, 1 + ((j + 1) % segments));
    for (let r = 1; r < rings; r++)
      for (let j = 0; j < segments; j++) {
        const a = 1 + (r - 1) * segments + j,
          b = 1 + (r - 1) * segments + ((j + 1) % segments),
          c = b + segments,
          d = a + segments;
        add(a, d, c);
        add(a, c, b);
      }
  }
  for (let j = 0; j < segments; j++) {
    const a = 1 + (rings - 1) * segments + j,
      b = 1 + (rings - 1) * segments + ((j + 1) % segments);
    triangles.push([b, a, a + count], [b, a + count, b + count]);
  }
  return indexed(points, triangles);
}
