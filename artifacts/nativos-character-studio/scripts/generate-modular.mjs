import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  Box3,
  Group,
  Matrix4,
  Vector3,
  BufferGeometry,
  Float32BufferAttribute,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  V,
  mesh,
  indexed,
  weld,
  clipSurface,
  solidify,
  sampler,
  facialRelief,
  tube,
  bead,
  boundaryEdges,
  subdivide,
  smooth,
} from "./modular/geometry.mjs";
import { definitions, presets } from "./modular/catalog.mjs";
import ManifoldModule from "manifold-3d";
const manifold = await ManifoldModule();
manifold.setup();
function asSolid(geometry) {
  const g = weld(geometry);
  const result = new manifold.Manifold(
    new manifold.Mesh({
      numProp: 3,
      vertProperties: new Float32Array(g.attributes.position.array),
      triVerts: new Uint32Array(g.index.array),
    }),
  );
  if (result.status() !== "NoError")
    throw new Error(`Invalid CSG operand: ${result.status()}`);
  return result;
}
function cutBody(geometry, body) {
  const input = asSolid(geometry),
    raw = input.subtract(body),
    cut = raw.simplify(0.015);
  if (cut.status() !== "NoError")
    throw new Error(`Body clearance boolean failed: ${cut.status()}`);
  const result = cut.getMesh(),
    g = new BufferGeometry();
  g.setAttribute(
    "position",
    new Float32BufferAttribute(result.vertProperties, 3),
  );
  g.setIndex(Array.from(result.triVerts));
  g.computeVertexNormals();
  // Regularize coincident contact sheets by a 0.01 mm normal expansion.
  // Keep Manifold's separate vertex identities: globally welding touching
  // sheets would introduce non-manifold edges.
  const position = g.attributes.position,
    normal = g.attributes.normal;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(
      i,
      position.getX(i) + normal.getX(i) * 0.01,
      position.getY(i) + normal.getY(i) * 0.01,
      position.getZ(i) + normal.getZ(i) * 0.01,
    );
  }
  const indices = g.index.array;
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < indices.length; i += 3) {
      const [ia, ib, ic] = [indices[i], indices[i + 1], indices[i + 2]];
      const a = V().fromBufferAttribute(position, ia),
        b = V().fromBufferAttribute(position, ib),
        c = V().fromBufferAttribute(position, ic);
      const ab = b.clone().sub(a),
        ac = c.clone().sub(a);
      if (ab.clone().cross(ac).length() >= 1e-7) continue;
      const n = V()
        .fromBufferAttribute(normal, ia)
        .add(V().fromBufferAttribute(normal, ib))
        .add(V().fromBufferAttribute(normal, ic))
        .normalize();
      if (ab.length() > 0.001) {
        c.addScaledVector(n.clone().cross(ab).normalize(), 0.002);
        position.setXYZ(ic, c.x, c.y, c.z);
      } else {
        b.addScaledVector(ac.clone().cross(n).normalize(), 0.002);
        position.setXYZ(ib, b.x, b.y, b.z);
      }
    }
  g.computeVertexNormals();
  input.delete();
  raw.delete();
  cut.delete();
  return g;
}
// Node adapter needed by the browser-oriented Three.js exporter; no external service.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "public/assets/collectible");
await fs.mkdir(path.join(out, "metadata"), { recursive: true });
await fs.mkdir(path.join(out, "thumbnails"), { recursive: true });

// Anatomical region boundaries in original asset units. Surfaces/positions are measured,
// not inferred from a generic replacement body. Female/male receive separate sampling.
const landmarks = {
  "2HT": {
    neck: 0.92,
    waist: 0.57,
    ankle: 0.12,
    shorts: 0.26,
    eye: 1.43,
    mouth: 1.2,
    headCenter: 1.46,
  },
  "3HT": {
    neck: 1.77,
    waist: 1.08,
    ankle: 0.17,
    shorts: 0.55,
    eye: 2.28,
    mouth: 2.02,
    headCenter: 2.3,
  },
  "4HT": {
    neck: 3.2,
    waist: 1.88,
    ankle: 0.2,
    shorts: 0.98,
    eye: 3.74,
    mouth: 3.48,
    headCenter: 3.76,
  },
};
const profiles = {},
  validation = [];

function auditGeometry(geometry) {
  const g = geometry,
    p = g.attributes.position,
    idx = g.index.array,
    edges = new Map();
  let degenerate = 0,
    volume = 0;
  const referenced = new Set();
  for (let i = 0; i < idx.length; i += 3) {
    const ids = [idx[i], idx[i + 1], idx[i + 2]],
      [a, b, c] = ids.map((j) => V().fromBufferAttribute(p, j));
    if (V().subVectors(b, a).cross(V().subVectors(c, a)).length() < 1e-7)
      degenerate++;
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let j = 0; j < 3; j++) {
      const x = ids[j],
        y = ids[(j + 1) % 3];
      referenced.add(x);
      const key = [Math.min(x, y), Math.max(x, y)].join(":");
      const e = edges.get(key) || { count: 0, balance: 0 };
      e.count++;
      e.balance += x < y ? 1 : -1;
      edges.set(key, e);
    }
  }
  return {
    vertices: p.count,
    triangles: idx.length / 3,
    boundaryEdges: [...edges.values()].filter((e) => e.count === 1).length,
    nonManifoldEdges: [...edges.values()].filter((e) => e.count > 2).length,
    windingErrors: [...edges.values()].filter(
      (e) => e.count === 2 && e.balance !== 0,
    ).length,
    degenerateTriangles: degenerate,
    looseVertices: p.count - referenced.size,
    finite: Array.from(p.array).every(Number.isFinite),
    signedVolumeMm3: Math.round(volume * 100) / 100,
  };
}

function projectLine(sample, points, offset = 0.7) {
  return points.map(([x, y]) => {
    const h = sample(V(x, y, 160), V(0, 0, -1));
    if (!h) throw new Error("Missing surface for facial curve");
    return h.point.add(V(0, 0, offset));
  });
}

function eyes(d, p, sample) {
  const group = new Group(),
    w = p.headWidth,
    rx =
      w *
      (d.id === "eyes-round" ? 0.098 : d.id === "eyes-soft" ? 0.095 : 0.078),
    ry =
      w * (d.id === "eyes-round" ? 0.098 : d.id === "eyes-oval" ? 0.12 : 0.064);
  for (const side of [-1, 1]) {
    const cx = side * w * 0.18,
      cy = p.eyeY;
    group.add(
      mesh(
        facialRelief(sample, cx, cy, rx, ry, 0.9),
        "#fff5e3",
        `sclera-${side}`,
        "sclera",
      ),
    );
    group.add(
      mesh(
        facialRelief(sample, cx, cy - 0.1, rx * 0.58, ry * 0.67, 0.65, 0.8),
        d.color,
        `iris-${side}`,
      ),
    );
    group.add(
      mesh(
        facialRelief(sample, cx, cy - 0.1, rx * 0.29, ry * 0.48, 0.4, 1.25),
        "#262029",
        `pupil-${side}`,
        "pupil",
      ),
    );
    group.add(
      mesh(
        facialRelief(
          sample,
          cx - rx * 0.18,
          cy + ry * 0.23,
          0.65,
          0.8,
          0.25,
          1.6,
        ),
        "#ffffff",
        `highlight-${side}`,
        "highlight",
      ),
    );
    const brow = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      brow.push([
        cx + rx * (t * 2 - 1),
        cy + ry + 2.0 + Math.sin(t * Math.PI) * 0.7,
      ]);
    }
    group.add(
      tube(projectLine(sample, brow, 0.65), 0.6, d.color, `brow-${side}`),
    );
  }
  return group;
}
function mouth(d, p, sample) {
  const g = new Group(),
    w = p.headWidth,
    rx = w * 0.095;
  if (d.id === "mouth-joy") {
    g.add(
      mesh(
        facialRelief(sample, 0, p.mouthY, rx, rx * 0.7, 0.55, 0.1, "happy"),
        d.color,
        "open-smile",
      ),
    );
    g.add(
      mesh(
        facialRelief(
          sample,
          0,
          p.mouthY + rx * 0.08,
          rx * 0.68,
          rx * 0.1,
          0.3,
          0.8,
        ),
        "#fff4e1",
        "smile-detail",
        "trim",
      ),
    );
  } else {
    const line = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      line.push([
        (t * 2 - 1) * rx,
        p.mouthY -
          (d.id === "mouth-smile" ? rx * 0.4 : 0.35) * Math.sin(t * Math.PI),
      ]);
    }
    g.add(tube(projectLine(sample, line, 0.6), 0.65, d.color, "mouth-relief"));
  }
  return g;
}

function scalp(
  p,
  sample,
  { style = "short", clearance = 0.7, thickness = 1.4, hat = false } = {},
) {
  const rows = 24,
    cols = 80,
    points = [],
    triangles = [],
    center = V(0, p.headCenterY, p.headCenterZ);
  const hitAt = (theta, phi) => {
    const dir = V(
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.cos(phi),
    );
    const hit = sample(
      center.clone().addScaledVector(dir, 120),
      dir.clone().negate(),
    );
    if (!hit) throw new Error(`Scalp projection failed ${theta}/${phi}`);
    const wave = hat
      ? 0
      : 0.6 +
        0.65 *
          Math.pow(Math.cos(phi * 6 + theta * 2), 2) *
          Math.pow(Math.sin(theta), 2);
    const point = hit.point.addScaledVector(dir, wave);
    if (!hat && style !== "short" && theta > 1.3) {
      const t = Math.min(1, (theta - 1.3) / 0.72),
        ease = t * t * (3 - 2 * t);
      const rimDir = V(
        Math.sin(1.35) * Math.sin(phi),
        Math.cos(1.35),
        Math.sin(1.35) * Math.cos(phi),
      );
      const rim = sample(
        center.clone().addScaledVector(rimDir, 120),
        rimDir.clone().negate(),
      );
      if (!rim) throw new Error("Hair contact rim missed");
      point.x = point.x * (1 - ease) + rim.point.x * 1.025 * ease;
      point.z =
        point.z * (1 - ease) +
        (p.headCenterZ + (rim.point.z - p.headCenterZ) * 1.04) * ease;
      point.y -= ease * p.headHeight * (style === "long" ? 0.48 : 0.12);
      point.y += Math.cos(phi * 6) * 0.7 * ease;
    }
    return point;
  };
  points.push(hitAt(0, 0));
  for (let r = 1; r <= rows; r++)
    for (let j = 0; j < cols; j++) {
      const phi = (j / cols) * Math.PI * 2,
        front = Math.max(0, Math.cos(phi));
      let end = hat
        ? 1.18
        : style === "short"
          ? 1.72
          : style === "medium"
            ? 2.12
            : 2.05;
      if (!hat) end -= (style === "short" ? 0.63 : 0.96) * front;
      if (!hat) end += 0.07 * Math.sin(phi * 3) * front;
      points.push(hitAt((end * r) / rows, phi));
    }
  for (let j = 0; j < cols; j++)
    triangles.push([0, 1 + j, 1 + ((j + 1) % cols)]);
  for (let r = 1; r < rows; r++)
    for (let j = 0; j < cols; j++) {
      const a = 1 + (r - 1) * cols + j,
        b = 1 + (r - 1) * cols + ((j + 1) % cols),
        c = b + cols,
        d = a + cols;
      triangles.push([a, d, c], [a, c, b]);
    }
  return solidify(
    smooth(indexed(points, triangles), 10, 0.4),
    clearance + 0.45,
    thickness,
  );
}

function hair(d, p, sample) {
  const style = d.id.split("-")[1],
    g = new Group();
  g.add(mesh(scalp(p, sample, { style }), d.color, "sculpted-scalp"));
  return g;
}

function trimBoundary(
  surface,
  clearance,
  thickness,
  color,
  filter = () => true,
) {
  const g = new Group(),
    pos = surface.attributes.position,
    n = surface.attributes.normal,
    edges = boundaryEdges(surface),
    next = new Map();
  for (const { a, b } of edges) next.set(a, b);
  while (next.size) {
    const start = next.keys().next().value,
      loop = [];
    let cur = start;
    do {
      loop.push(cur);
      const other = next.get(cur);
      next.delete(cur);
      cur = other;
    } while (cur !== undefined && cur !== start && loop.length < 10000);
    if (loop.length < 3) continue;
    const points = loop.map((i) =>
      V()
        .fromBufferAttribute(pos, i)
        .addScaledVector(V().fromBufferAttribute(n, i), clearance + thickness),
    );
    if (filter(points))
      g.add(tube(points, 0.65, color, "bound-edge", true, "trim"));
  }
  return g;
}

function garment(d, p, body, sample) {
  const shirt = d.category === "shirt",
    relaxed = d.id === "pants-relaxed",
    sweater = d.id === "shirt-sweater";
  const clearance = relaxed ? 2.1 : shirt ? 2.6 : 0.65,
    thickness = 1.2;
  const hem = shirt
    ? p.waistY - 1.2
    : d.id === "pants-shorts"
      ? p.shortsY
      : p.ankleY;
  const top = shirt ? p.neckY + (p.ratio === "2HT" ? 4 : -0.8) : p.waistY;
  const cuff = p.armSpan * (sweater ? 0.405 : 0.29);
  const planes = [(v) => v.y - hem, (v) => top - v.y];
  if (shirt)
    planes.push(
      (v) => cuff - v.x,
      (v) => cuff + v.x,
    );
  let surface = subdivide(subdivide(clipSurface(body, planes)));
  if (shirt) {
    // Build a conservative torso envelope from horizontal sections of the body.
    // A garment spans the bust and abdomen instead of copying anatomical creases.
    const bp = body.attributes.position,
      bi = body.index.array,
      rows = 48,
      sections = [];
    const underarm = top - 3;
    const torsoLimit = p.armSpan * 0.16;
    for (let row = 0; row <= rows; row++) {
      const y = hem + ((underarm - hem) * row) / rows,
        section = [];
      for (let i = 0; i < bi.length; i += 3)
        for (let j = 0; j < 3; j++) {
          const a = V().fromBufferAttribute(bp, bi[i + j]),
            b = V().fromBufferAttribute(bp, bi[i + ((j + 1) % 3)]);
          if (a.y < y !== b.y < y) {
            const v = a.lerp(b, (y - a.y) / (b.y - a.y));
            if (Math.abs(v.x) < torsoLimit) section.push(v);
          }
        }
      const rx = Math.max(1, ...section.map((v) => Math.abs(v.x))),
        rz = Math.max(1, ...section.map((v) => Math.abs(v.z)));
      const factor = Math.max(
        1,
        ...section.map((v) => Math.sqrt((v.x / rx) ** 2 + (v.z / rz) ** 2)),
      );
      sections.push({ rx: rx * factor, rz: rz * factor });
    }
    // Keep the lower silhouette from collapsing into a tight waist.
    const lowerRx = Math.max(...sections.slice(0, 20).map((s) => s.rx));
    const lowerRz = Math.max(...sections.slice(0, 20).map((s) => s.rz));
    const pos = surface.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = V().fromBufferAttribute(pos, i);
      if (v.y > underarm + 2 || Math.abs(v.x) > torsoLimit) continue;
      const q = Math.max(
          0,
          Math.min(rows, ((v.y - hem) / (underarm - hem)) * rows),
        ),
        lo = Math.floor(q),
        hi = Math.min(rows, lo + 1),
        t = q - lo;
      const rx = Math.max(
          lowerRx,
          sections[lo].rx * (1 - t) + sections[hi].rx * t,
        ),
        rz = Math.max(lowerRz, sections[lo].rz * (1 - t) + sections[hi].rz * t);
      const factor = 1 / Math.sqrt((v.x / rx) ** 2 + (v.z / rz) ** 2);
      const blend = Math.min(1, Math.max(0, (underarm + 2 - v.y) / 4), Math.max(0, (torsoLimit - Math.abs(v.x)) / 3));
      if (Number.isFinite(factor) && factor > 1) {
        v.x *= 1 + (factor - 1) * blend;
        v.z *= 1 + (factor - 1) * blend;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
  }
  surface = smooth(surface, 6, 0.3);
  const g = new Group();
  const shell = solidify(surface, clearance, thickness);
  const garmentSample = sampler(shell);
  g.add(mesh(shell, d.color, "fitted-shell"));
  g.add(
    trimBoundary(
      surface,
      clearance,
      thickness,
      d.id === "shirt-polo" ? "#e8ddc8" : d.color,
    ),
  );
  if (d.id === "shirt-polo") {
    // Split collar flaps follow the sampled chest instead of floating planes.
    const y = top - 5,
      w = p.headWidth * 0.085;
    for (const side of [-1, 1]) {
      const points = projectLine(
        garmentSample,
        [
          [side * 0.8, y],
          [side * w, y - 0.5],
          [side * w * 0.75, y - 4],
          [side * 1.2, y - 2.8],
        ],
        0.2,
      );
      const surf = indexed(
        points,
        side < 0
          ? [
              [0, 1, 2],
              [0, 2, 3],
            ]
          : [
              [0, 2, 1],
              [0, 3, 2],
            ],
      );
      surf.setAttribute(
        "normal",
        new Float32BufferAttribute(
          points.flatMap(() => [0, 0, 1]),
          3,
        ),
      );
      g.add(mesh(solidify(surf, 0, 0.8), "#e9dcc5", `collar-${side}`, "trim"));
    }
    for (let i = 0; i < 3; i++) {
      const point = projectLine(garmentSample, [[0, top - 6 - i * 2.5]], 0.2)[0];
      g.add(bead(point, [0.65, 0.65, 0.5], "#e9dcc5", `button-${i}`, "trim"));
    }
  }
  if (sweater) {
    const y = hem + (top - hem) * 0.3,
      w = p.headWidth * 0.14;
    const pts = projectLine(
      garmentSample,
      [
        [-w, y + 2],
        [-w * 0.8, y - 2],
        [w * 0.8, y - 2],
        [w, y + 2],
      ],
      0.35,
    );
    g.add(tube(pts, 0.6, "#a9bdc3", "pocket-seam", false, "trim"));
  }
  if (relaxed) {
    for (const side of [-1, 1]) {
      const x = side * p.headWidth * 0.12,
        y = p.waistY - 3;
      const pts = projectLine(
        garmentSample,
        [
          [x * 0.4, y],
          [x, y - 2],
          [x * 1.3, y - 4],
        ],
        0.35,
      );
      g.add(tube(pts, 0.6, "#b6bc9d", `pocket-${side}`, false, "trim"));
    }
  }
  return g;
}

function accessory(d, p, sample) {
  const g = new Group(),
    w = p.headWidth;
  if (d.id === "accessory-glasses") {
    const rx = w * 0.117,
      ry = w * 0.13;
    for (const side of [-1, 1]) {
      const pts = [];
      for (let j = 0; j < 48; j++) {
        const t = (j / 48) * Math.PI * 2;
        pts.push([
          side * w * 0.18 + rx * Math.cos(t),
          p.eyeY + ry * Math.sin(t),
        ]);
      }
      g.add(
        tube(
          projectLine(sample, pts, 3.6),
          0.75,
          d.color,
          `frame-${side}`,
          true,
        ),
      );
      const front = projectLine(
        sample,
        [[side * (w * 0.18 + rx), p.eyeY + 0.8]],
        3.6,
      )[0];
      g.add(
        tube(
          [
            front,
            V(side * w * 0.46, p.eyeY + 0.8, front.z - 3),
            V(side * w * 0.53, p.eyeY, p.headCenterZ + 2),
            V(side * w * 0.52, p.eyeY - 1, p.headCenterZ - 3),
          ],
          0.75,
          d.color,
          `temple-${side}`,
        ),
      );
    }
    g.add(
      tube(
        projectLine(
          sample,
          [
            [-w * 0.06, p.eyeY + 0.8],
            [0, p.eyeY + 1.8],
            [w * 0.06, p.eyeY + 0.8],
          ],
          3.6,
        ),
        0.75,
        d.color,
        "bridge",
      ),
    );
  } else {
    g.add(
      mesh(
        scalp(p, sample, { hat: true, clearance: 0.9, thickness: 1.6 }),
        d.color,
        "crown",
      ),
    );
    const bucket = d.id === "accessory-hat",
      pts = [],
      tris = [],
      rows = 6,
      cols = 80;
    for (let r = 0; r <= rows; r++)
      for (let j = 0; j <= cols; j++) {
        const t = r / rows,
          phi = bucket ? (j / cols) * Math.PI * 2 : -1.35 + (j / cols) * 2.7;
        const dir = V(
          Math.sin(1.18) * Math.sin(phi),
          Math.cos(1.18),
          Math.sin(1.18) * Math.cos(phi),
        );
        const hit = sample(
          V(0, p.headCenterY, p.headCenterZ).addScaledVector(dir, 120),
          dir.clone().negate(),
        );
        if (!hit) throw new Error("Hat fitting missed");
        const length = bucket ? 5.0 : 8.0 * Math.max(0, Math.cos(phi));
        pts.push(
          hit.point.add(
            V(
              Math.sin(phi) * (1.5 + t * length),
              1.0 - t * (bucket ? 2.8 : 1.0),
              Math.cos(phi) * (1.5 + t * length),
            ),
          ),
        );
      }
    for (let r = 0; r < rows; r++)
      for (let j = 0; j < cols; j++) {
        const a = r * (cols + 1) + j,
          b = a + 1,
          c = b + cols + 1,
          d = a + cols + 1;
        tris.push([a, b, c], [a, c, d]);
      }
    g.add(
      mesh(solidify(weld(indexed(pts, tris)), 0, 1.4), d.color, "shaped-brim"),
    );
  }
  return g;
}

function thumbnail(group, base, definition) {
  // Orthographic preview of the actual geometry; no unrelated icon placeholders.
  const items = [];
  const isClothing = ["shirt", "pants"].includes(definition.category);
  const display = new Group();
  display.add(group.clone(true));
  const box = new Box3().setFromObject(display),
    center = box.getCenter(V()),
    size = box.getSize(V());
  const scale = 112 / Math.max(size.x, size.y),
    faces = [];
  display.updateMatrixWorld(true);
  display.traverse((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position,
      idx = m.geometry.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const tri = [0, 1, 2].map((k) =>
        V()
          .fromBufferAttribute(p, idx[i + k])
          .applyMatrix4(m.matrixWorld),
      );
      const normal = V()
        .subVectors(tri[1], tri[0])
        .cross(V().subVectors(tri[2], tri[0]))
        .normalize();
      if (normal.z < 0.05) continue;
      const color = m.material.color
        .clone()
        .multiplyScalar(
          0.6 + 0.4 * Math.max(0, normal.dot(V(-0.4, 0.6, 1).normalize())),
        );
      faces.push({
        z: tri.reduce((s, p) => s + p.z, 0),
        svg: `<path d="M${tri.map((p) => `${(80 + (p.x - center.x) * scale).toFixed(2)},${(70 - (p.y - center.y) * scale).toFixed(2)}`).join("L")}Z" fill="#${color.getHexString()}"/>`,
      });
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 140"><rect width="160" height="140" rx="12" fill="#1c2023"/>${faces
    .sort((a, b) => a.z - b.z)
    .map((f) => f.svg)
    .join("")}</svg>`;
}

for (const ratio of ["2HT", "3HT", "4HT"])
  for (const gender of ["feminino", "masculino"]) {
    const id = `${ratio}-${gender}`,
      filename = `chibi-${ratio.toLowerCase()}-${gender === "feminino" ? "fft" : "mft"}.glb`;
    const bytes = await fs.readFile(
      path.join(root, "src/assets/models", filename),
    );
    const { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene),
      sourceHeight = box.max.y - box.min.y,
      scale = 120 / sourceHeight;
    const geometries = [];
    scene.traverse((m) => {
      if (m.isMesh) {
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        g.translate(0, -box.min.y, 0);
        g.scale(scale, scale, scale);
        g.deleteAttribute("uv");
        g.deleteAttribute("normal");
        geometries.push(g);
      }
    });
    const base = weld(mergeGeometries(geometries.map((g) => g.toNonIndexed()))),
      lm = landmarks[ratio],
      mm = (y) => (y - box.min.y) * scale;
    const clothingBase =
      ratio === "2HT"
        ? weld(
            mergeGeometries(
              geometries
                .filter((g) => {
                  g.computeBoundingBox();
                  return g.boundingBox.max.y < 90;
                })
                .map((g) => g.toNonIndexed()),
            ),
          )
        : base;
    const head = clipSurface(base, [(v) => v.y - mm(lm.neck)]);
    head.computeBoundingBox();
    const hb = head.boundingBox;
    const p = {
      id,
      ratio,
      gender,
      sourceFile: filename,
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      sourceMinY: box.min.y,
      sourceScaleToMm: scale,
      heightMm: 120,
      headWidth: hb.max.x - hb.min.x,
      headDepth: hb.max.z - hb.min.z,
      headHeight: hb.max.y - hb.min.y,
      headCenterY: mm(lm.headCenter),
      headCenterZ: (hb.max.z + hb.min.z) / 2,
      eyeY: mm(lm.eye),
      mouthY: mm(lm.mouth),
      neckY: mm(lm.neck),
      waistY: mm(lm.waist),
      ankleY: mm(lm.ankle),
      shortsY: mm(lm.shorts),
      armSpan: (box.max.x - box.min.x) * scale,
    };
    const sampleHead = sampler(head),
      sampleBody = sampler(base),
      originalSolid = asSolid(base);
    // A small six-direction envelope supplies 0.05 mm contact tolerance and
    // prevents coplanar symmetry surfaces from becoming zero-area CSG slivers.
    const offsets = [
      [0.05, 0, 0],
      [-0.05, 0, 0],
      [0, 0.05, 0],
      [0, -0.05, 0],
      [0, 0, 0.05],
      [0, 0, -0.05],
    ].map((v) => originalSolid.translate(v));
    const bodySolid = manifold.Manifold.union(offsets);
    offsets.forEach((s) => s.delete());
    originalSolid.delete();
    const face = (y) => sampleHead(V(0, y, 160), V(0, 0, -1)).point.z;
    p.anchors = {
      HEAD: [0, p.headCenterY, p.headCenterZ],
      FACE_EYES: [0, p.eyeY, face(p.eyeY)],
      FACE_MOUTH: [0, p.mouthY, face(p.mouthY)],
      HEAD_TOP: [0, 120, p.headCenterZ],
      NECK: [0, p.neckY, 0],
      TORSO: [0, (p.neckY + p.waistY) / 2, 0],
      WAIST: [0, p.waistY, 0],
    };
    profiles[id] = p;
    for (const def of definitions) {
      let group =
        def.category === "eyes"
          ? eyes(def, p, sampleHead)
          : def.category === "mouth"
            ? mouth(def, p, sampleHead)
            : def.category === "hair"
              ? hair(def, p, sampleHead)
              : def.category === "accessory"
                ? accessory(def, p, sampleHead)
                : garment(def, p, clothingBase, sampleBody);
      // Subtract the actual body to remove residual internal overlaps at the crotch,
      // underarms and ears. This closes new contact surfaces instead of hiding them.
      if (["shirt", "pants", "hair", "accessory"].includes(def.category))
        group.traverse((m) => {
          if (m.isMesh) m.geometry = cutBody(m.geometry, bodySolid);
        });
      group.name = def.id;
      group.userData = {
        id: def.id,
        base: id,
        anchor: def.anchor,
        units: "millimeter",
        version: 1,
      };
      if (id === "3HT-feminino")
        await fs.writeFile(
          path.join(out, def.thumbnail),
          thumbnail(group, base, def),
        );
      const anchor = V(...p.anchors[def.anchor]);
      // Bake an anchor-local origin into each mesh, ready for independent placement.
      group.traverse((m) => {
        if (m.isMesh) m.geometry.translate(-anchor.x, -anchor.y, -anchor.z);
      });
      const checks = [];
      group.traverse((m) => {
        if (m.isMesh)
          checks.push({ name: m.name, ...auditGeometry(m.geometry) });
      });
      validation.push({ base: id, piece: def.id, meshes: checks });
      const dir = path.join(out, def.directory, def.id);
      await fs.mkdir(dir, { recursive: true });
      // glTF uses meters; authoring and anchors remain in millimeters.
      group.scale.setScalar(0.001);
      group.userData.units = "meter";
      const glb = await new GLTFExporter().parseAsync(group, {
        binary: true,
        onlyVisible: true,
      });
      await fs.writeFile(path.join(dir, `${id}.glb`), Buffer.from(glb));
    }
    bodySolid.delete();
    console.log(
      `Generated ${id}: 18 modules, ${p.headWidth.toFixed(1)} mm head width.`,
    );
  }
const manifest = {
  schemaVersion: 1,
  libraryVersion: "1.0.0",
  units: "millimeter",
  glbUnits: "meter",
  canonicalHeightMm: 120,
  axis: { up: "+Y", front: "+Z", right: "+X" },
  profiles,
  items: definitions,
  facePresets: presets,
};
await fs.writeFile(
  path.join(out, "metadata/library.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await fs.mkdir(path.join(root, "src/studio/modular"), { recursive: true });
await fs.writeFile(
  path.join(root, "src/studio/modular/library.generated.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await fs.writeFile(
  path.join(out, "metadata/validation.json"),
  JSON.stringify(validation, null, 2) + "\n",
);
const failures = validation.flatMap((v) =>
  v.meshes
    .filter(
      (m) =>
        !m.finite ||
        m.boundaryEdges ||
        m.nonManifoldEdges ||
        m.windingErrors ||
        m.degenerateTriangles ||
        m.looseVertices,
    )
    .map((m) => ({ base: v.base, piece: v.piece, ...m })),
);
console.log(
  JSON.stringify(
    {
      variants: validation.length,
      meshes: validation.reduce((s, v) => s + v.meshes.length, 0),
      topologyFailures: failures.length,
      failures: failures.slice(0, 12),
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
