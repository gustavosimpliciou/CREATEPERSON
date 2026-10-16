import fs from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';
for (const ratio of ['2ht', '3ht', '4ht']) for (const gender of ['fft', 'mft']) {
  const buffer = await fs.readFile(new URL(`../src/assets/models/chibi-${ratio}-${gender}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(gltf.scene);
  const meshes = [];
  gltf.scene.traverse(m => { if(m.isMesh) {
    const box = new Box3().setFromObject(m);
    meshes.push({name:m.name, vertices:m.geometry.attributes.position.count, min:box.min.toArray(), max:box.max.toArray()});
  }});
  console.log(JSON.stringify({id:`${ratio}-${gender}`, min:bounds.min.toArray(), max:bounds.max.toArray(), meshes}));
}
