import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  Box3,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  Raycaster,
  Vector3,
  Triangle,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const root = fileURLToPath(new URL("../", import.meta.url)),
  out = path.join(root, "public/assets/collectible");
const manifest = JSON.parse(
  await fs.readFile(path.join(out, "metadata/library.json"), "utf8"),
);
const report = JSON.parse(
  await fs.readFile(path.join(out, "metadata/validation.json"), "utf8"),
);
const load = async (file) => {
  const b = await fs.readFile(file);
  return new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
};
const categories = ["eyes", "mouth", "hair", "shirt", "pants", "accessory"];
assert.equal(manifest.canonicalHeightMm, 120);
assert.deepEqual(
  manifest,
  JSON.parse(
    await fs.readFile(
      path.join(root, "src/studio/modular/library.generated.json"),
      "utf8",
    ),
  ),
);
assert.equal(new Set(manifest.items.map((i) => i.id)).size, 18);
for (const category of categories)
  assert.equal(manifest.items.filter((i) => i.category === category).length, 3);
assert.equal(report.length, 108);
for (const item of manifest.items) {
  assert.equal(item.compatibility.length, 6);
  await fs.access(path.join(out, item.thumbnail));
  for (const conflict of item.conflicts)
    assert(manifest.items.some((i) => i.id === conflict));
}
for (const variant of report)
  for (const m of variant.meshes) {
    for (const key of [
      "boundaryEdges",
      "nonManifoldEdges",
      "windingErrors",
      "degenerateTriangles",
      "looseVertices",
    ])
      assert.equal(
        m[key],
        0,
        `${variant.base}/${variant.piece}/${m.name}: ${key}`,
      );
    assert(m.finite);
    assert(
      m.signedVolumeMm3 > 0,
      `${variant.piece}/${m.name}: inverted volume`,
    );
  }
const fit = [];
for (const [id, p] of Object.entries(manifest.profiles)) {
  const original = path.join(root, "src/assets/models", p.sourceFile),
    bytes = await fs.readFile(original);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    p.sourceSha256,
    "Original base has changed: regenerate fitted variants",
  );
  const { scene: base } = await load(original);
  base.updateMatrixWorld(true);
  const targets = [];
  base.traverse((m) => {
    if (m.isMesh) {
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      g.translate(0, -p.sourceMinY, 0);
      g.scale(p.sourceScaleToMm, p.sourceScaleToMm, p.sourceScaleToMm);
      const target = new Mesh(g, new MeshBasicMaterial({ side: DoubleSide }));
      target.updateMatrixWorld();
      targets.push(target);
    }
  });
  const triangles = [];
  for (const target of targets) {
    const p = target.geometry.attributes.position,
      idx = target.geometry.index.array;
    for (let i = 0; i < idx.length; i += 3)
      triangles.push(
        new Triangle(
          ...[0, 1, 2].map((k) =>
            new Vector3().fromBufferAttribute(p, idx[i + k]),
          ),
        ),
      );
  }
  const ray = new Raycaster(),
    dir = new Vector3(0.173, 0.071, 1).normalize();
  const inside = (point) => {
    ray.set(point, dir);
    const hits = ray
      .intersectObjects(targets, false)
      .filter(
        (hit, i, all) =>
          !i || Math.abs(hit.distance - all[i - 1].distance) > 0.001,
      );
    if (hits[0]?.distance < 0.08) return false;
    if (hits.length % 2 === 0) return false;
    // Use Euclidean distance for contact tolerance; a grazing ray exaggerates it.
    const closest = new Vector3();
    return !triangles.some(
      (triangle) =>
        triangle.closestPointToPoint(point, closest).distanceToSquared(point) <=
        0.08 ** 2,
    );
  };
  for (const item of manifest.items) {
    const { scene } = await load(
      path.join(out, item.directory, item.id, `${id}.glb`),
    );
    assert.equal(scene.children[0].userData.id, item.id);
    scene.scale.setScalar(1000);
    scene.position.fromArray(p.anchors[item.anchor]);
    scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(scene),
      size = bounds.getSize(new Vector3());
    assert(
      size.length() > 0 && size.length() < 200,
      `Invalid scale ${id}/${item.id}`,
    );
    let samples = 0,
      penetrations = 0;
    scene.traverse((m) => {
      if (m.isMesh) {
        const pos = m.geometry.attributes.position,
          idx = m.geometry.index.array,
          edges = new Map(),
          used = new Set();
        assert(Array.from(pos.array).every(Number.isFinite));
        for (let i = 0; i < idx.length; i += 3) {
          const ids = [idx[i], idx[i + 1], idx[i + 2]],
            vs = ids.map((j) => new Vector3().fromBufferAttribute(pos, j));
          assert(
            new Triangle(...vs).getArea() > 0.00000005,
            `${id}/${item.id}/${m.name}: serialized degenerate face`,
          );
          for (let j = 0; j < 3; j++) {
            const a = ids[j],
              b = ids[(j + 1) % 3],
              key = [Math.min(a, b), Math.max(a, b)].join(":");
            used.add(a);
            const edge = edges.get(key) || { count: 0, balance: 0 };
            edge.count++;
            edge.balance += a < b ? 1 : -1;
            edges.set(key, edge);
          }
        }
        assert.equal(used.size, pos.count, `${item.id}: loose vertex`);
        for (const edge of edges.values()) {
          assert.equal(
            edge.count,
            2,
            `${id}/${item.id}: open/nonmanifold edge`,
          );
          assert.equal(edge.balance, 0, `${item.id}: orientation`);
        }
      }
      if (
        !m.isMesh ||
        !["fitted-shell", "sculpted-scalp", "crown"].includes(m.name)
      )
        return;
      const pos = m.geometry.attributes.position;
      // Sample both sides of the final boolean result, independently of generation.
      for (let i = 0; i < pos.count; i += 3) {
        const point = new Vector3()
          .fromBufferAttribute(pos, i)
          .applyMatrix4(m.matrixWorld);
        samples++;
        if (inside(point)) penetrations++;
      }
    });
    if (samples)
      fit.push({
        base: id,
        piece: item.id,
        samples,
        sampledInsideBody: penetrations,
      });
  }
  console.log(
    `Validated ${id}: files, metadata, dimensions and surface samples.`,
  );
}
await fs.writeFile(
  path.join(out, "metadata/fit-validation.json"),
  JSON.stringify(fit, null, 2) + "\n",
);
const intersections = fit.filter((r) => r.sampledInsideBody);
console.log(
  JSON.stringify(
    { variants: 108, topology: "pass", fitChecks: fit.length, intersections },
    null,
    2,
  ),
);
if (intersections.length) process.exitCode = 1;
