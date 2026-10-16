import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import {
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  BufferGeometry,
} from "three";
import { STLLoader } from "three-stdlib";
import type { Piece } from "@/studio/modular/registry";

type StlPiece = Piece & { stlPath?: string };

interface HeadDims {
  width: number;
  height: number;
  depth: number;
  centerY: number;
  centerZ: number;
}

interface HairTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: string;
}

interface StlPartProps {
  piece: StlPiece & { loader?: string };
  color?: string;
  headDims?: HeadDims;
  transform?: HairTransform;
}

function conformToHead(
  geometry: BufferGeometry,
  headDims: HeadDims,
  scale: number
) {
  const posAttr = geometry.attributes.position;
  if (!posAttr) return;

  const count = posAttr.count;

  // Elipsoide do crânio no espaço do cabelo (já centralizado e escalado)
  const headRx = (headDims.width / 2) * scale * 1.015;
  const headRy = (headDims.height / 2) * scale * 1.015;
  const headRz = (headDims.depth / 2) * scale * 1.015;

  const centerY = headDims.centerY * scale;
  const centerZ = headDims.centerZ * scale;

  const temp = new Vector3();

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    let y = posAttr.getY(i);
    let z = posAttr.getZ(i);

    const dy = y - centerY;
    const dz = z - centerZ;

    const ellipsoid =
      (x * x) / (headRx * headRx) +
      (dy * dy) / (headRy * headRy) +
      (dz * dz) / (headRz * headRz);

    // Região interna do crânio: projetar para a superfície (cavidade de contato)
    if (ellipsoid > 0 && ellipsoid < 0.95 && dy < headRy * 0.75) {
      const factor = 1 / Math.sqrt(ellipsoid);
      temp.set(x * factor, dy * factor, dz * factor);

      // Só aplica projeção na região inferior/central (preserva topo e laterais)
      if (temp.y < headRy * 0.85) {
        posAttr.setXYZ(i, temp.x, temp.y + centerY, temp.z + centerZ);
      }
    }
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}

function StlPart({
  piece,
  color,
  headDims,
  transform,
}: StlPartProps) {
  const url = piece.stlPath ? `/assets/collectible/${piece.stlPath}` : "";
  const geometry = useLoader(STLLoader, url);

  const model = useMemo(() => {
    if (!geometry) return null;

    const geom = geometry.clone();

    const baseMaterial = new MeshStandardMaterial({
      color: transform?.color ?? color ?? "#3d2a25",
      roughness: 0.6,
      metalness: 0.1,
    });

    // 1. Calcular bounding box e centralizar o cabelo na origem local
    const tmpMesh = new Mesh(geom);
    const box = new Box3().setFromObject(tmpMesh);
    const center = new Vector3();
    box.getCenter(center);
    const size = new Vector3();
    box.getSize(size);

    const posAttr = geom.attributes.position;
    const count = posAttr.count;

    // Centralizar o cabelo (origem no centro do bounding box)
    for (let i = 0; i < count; i++) {
      posAttr.setXYZ(
        i,
        posAttr.getX(i) - center.x,
        posAttr.getY(i) - center.y,
        posAttr.getZ(i) - center.z
      );
    }
    posAttr.needsUpdate = true;

    // 2. Calcular escala adaptativa para casar com a cabeça
    let scale = 1;
    if (headDims) {
      const headRef = Math.max(headDims.width, headDims.depth);
      const hairRef = Math.max(size.x, size.z);
      scale = hairRef > 0 ? (headRef / hairRef) * 1.05 : 1;
    }

    // 3. Aplicar escala nos vértices (apenas uma vez)
    for (let i = 0; i < count; i++) {
      posAttr.setXYZ(
        i,
        posAttr.getX(i) * scale,
        posAttr.getY(i) * scale,
        posAttr.getZ(i) * scale
      );
    }
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();

    // 4. Conformação ao crânio (scalp fit) - cria cavidade interna de contato
    if (headDims) {
      conformToHead(geom, headDims, scale);
      geom.computeVertexNormals();
    }

    const mesh = new Mesh(geom, baseMaterial.clone());
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 5. Posicionar a BASE do cabelo no topo da cabeça (não o centro)
    if (headDims) {
      // Posiciona o centro do cabelo no centerY da cabeça, mas deslocado para cima
      // para que o cabelo fique no nível do crânio, não flutuando nem enterrado
      mesh.position.set(0, headDims.centerY * scale, headDims.centerZ * scale);
    }

    // 6. Aplicar transformação do usuário (posição, rotação, escala relativa)
    if (transform) {
      // Posição: deslocamento relativo ao posicionamento base
      mesh.position.x += transform.position[0];
      mesh.position.y += transform.position[1];
      mesh.position.z += transform.position[2];

      // Rotação em graus convertida para radianos
      mesh.rotation.set(
        (transform.rotation[0] * Math.PI) / 180,
        (transform.rotation[1] * Math.PI) / 180,
        (transform.rotation[2] * Math.PI) / 180
      );

      // Escala relativa multiplicada sobre a escala base já aplicada nos vértices
      mesh.scale.set(
        transform.scale[0],
        transform.scale[1],
        transform.scale[2]
      );
      mesh.updateMatrixWorld();
    }

    const group = new Group();
    group.add(mesh);
    return group;
  }, [geometry, color, headDims, transform]);

  return (
    <group name={`stl/${piece.id}`}>
      {model && <primitive object={model} dispose={null} />}
    </group>
  );
}

export default StlPart;
