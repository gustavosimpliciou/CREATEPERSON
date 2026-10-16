import { Fragment, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Mesh, MeshStandardMaterial } from 'three';
import { baseModelAnchors, baseModelHeights, baseModelUrls } from '@/studio/baseAssets';
import type { CharacterShape } from '@/components/CharacterViewport';

const baseSkinMaterial = new MeshStandardMaterial({ color: '#d7a582', roughness: 0.88 });

function SoftPart({ position, scale, color, roughness = 0.72, geometry = 'sphere', rotation = [0, 0, 0] }: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  roughness?: number;
  geometry?: 'sphere' | 'capsule';
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow>
      {geometry === 'capsule' ? <capsuleGeometry args={[0.5, 0.6, 6, 12]} /> : <sphereGeometry args={[1, 24, 18]} />}
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

function ImportedBase({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (object instanceof Mesh) {
        object.material = baseSkinMaterial;
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return copy;
  }, [scene]);
  return <primitive object={model} dispose={null} />;
}

export default function BaseCharacter({ shape }: { shape: CharacterShape }) {
  const anchors = baseModelAnchors[shape.ratio];
  const modelUrl = baseModelUrls[shape.ratio][shape.model];
  const modelScale = 2.811 / baseModelHeights[shape.ratio];
  const hair = shape.model === 'feminino' ? '#29272a' : '#403027';
  const shirtColor = shape.shirt === 'moletom' ? '#53676a' : shape.shirt === 'camiseta' ? '#cc6945' : '#d57b55';
  const pantsColor = shape.pants === 'estilizada' ? '#655c69' : shape.pants === 'curta' ? '#365460' : '#233d47';
  const shoeColor = shape.shoes === 'bota' ? '#473b32' : shape.shoes === 'sapato' ? '#30363b' : '#e3d9c8';
  const eyeShape: [number, number] = shape.eyes === 'ovais'
    ? [0.105, 0.16]
    : shape.eyes === 'estreitos'
      ? [0.13, 0.1]
      : [0.115, 0.14];
  const hairLength = shape.hair === 'longo' ? 0.46 : shape.hair === 'medio' ? 0.32 : 0.22;
  const headY = anchors.headY;
  const faceZ = anchors.faceZ;
  const legTop = anchors.hipY;
  const shortsY = anchors.legY + anchors.legHalf * 0.48;

  return (
    <group scale={[shape.torso * modelScale, shape.height * modelScale, modelScale]}>
      <ImportedBase url={modelUrl} />

      {/* Clothing overlays follow the supplied meshes' standard T-pose. */}
      <SoftPart
        position={[0, anchors.chestY, 0.015]}
        scale={[anchors.chestWidth * shape.torso, anchors.chestHeight, anchors.chestDepth]}
        color={shirtColor}
      />
      {([-1, 1] as const).map((side) => (
        <SoftPart
          key={`sleeve-${side}`}
          position={[side * anchors.sleeveCenter, anchors.shoulderY, 0]}
          scale={[anchors.sleeveWidth, anchors.sleeveLength, anchors.sleeveWidth]}
          color={shirtColor}
          geometry="capsule"
          rotation={[0, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2]}
        />
      ))}
      {shape.shirt === 'polo' && (
        <>
          <SoftPart position={[0, legTop + (anchors.shoulderY - legTop) * 0.88, 0.02]} scale={[0.23, 0.08, 0.25]} color="#e5d7c3" />
          <SoftPart position={[0, anchors.chestY - anchors.chestHeight * 0.45, anchors.chestDepth + 0.025]} scale={[0.035, anchors.chestHeight * 0.55, 0.02]} color="#f0b17d" />
        </>
      )}
      {shape.shirt === 'moletom' && (
        <SoftPart
          position={[0, anchors.shoulderY + anchors.sleeveWidth * 0.7, -anchors.chestDepth * 0.72]}
          scale={[anchors.chestWidth * 0.55, anchors.chestHeight * 0.42, anchors.chestDepth * 0.45]}
          color="#384d51"
        />
      )}

      {([-1, 1] as const).map((side) => (
        <Fragment key={`leg-${side}`}>
          {shape.pants === 'curta' ? (
            <>
              <SoftPart position={[side * anchors.legX, shortsY, 0]} scale={[0.14, anchors.legHalf * 0.52, 0.15]} color={pantsColor} geometry="capsule" />
              <SoftPart position={[side * anchors.legX, anchors.footY + 0.16, 0]} scale={[0.11, anchors.legHalf * 0.45, 0.12]} color="#d7a582" geometry="capsule" />
            </>
          ) : (
            <SoftPart
              position={[side * anchors.legX, anchors.legY, 0]}
              scale={[0.14, anchors.legHalf, 0.15]}
              color={pantsColor}
              geometry="capsule"
            />
          )}
          {shape.pants === 'estilizada' && (
            <SoftPart
              position={[side * anchors.legX, anchors.legY + anchors.legHalf * 0.72, 0.14]}
              scale={[0.14, Math.max(0.035, anchors.legHalf * 0.09), 0.025]}
              color="#d2985b"
            />
          )}
          <SoftPart
            position={[side * anchors.legX, anchors.footY, 0.09]}
            scale={[anchors.footWidth, anchors.footWidth * 0.52, anchors.footLength]}
            color={shoeColor}
          />
          {shape.shoes === 'tenis' && (
            <SoftPart
              position={[side * anchors.legX, anchors.footY - anchors.footWidth * 0.28, 0.22]}
              scale={[anchors.footWidth * 0.92, 0.025, anchors.footLength * 0.44]}
              color="#b9ad9b"
            />
          )}
        </Fragment>
      ))}

      {/* The supplied base has no facial textures; these editor pieces provide a simple face. */}
      {([-1, 1] as const).map((side) => (
        <group key={`eye-${side}`} position={[side * anchors.eyeOffset, headY + 0.03, faceZ + 0.012]}>
          <SoftPart position={[0, 0, 0]} scale={[eyeShape[0], eyeShape[1], 0.04]} color="#fff4e5" roughness={0.35} />
          <SoftPart position={[0.01, -0.015, 0.035]} scale={[eyeShape[0] * 0.56, eyeShape[1] * 0.58, 0.03]} color="#734b38" roughness={0.3} />
          <SoftPart position={[0.015, -0.012, 0.06]} scale={[eyeShape[0] * 0.32, eyeShape[1] * 0.38, 0.018]} color="#211d1b" roughness={0.25} />
          <SoftPart position={[0.03, 0.028, 0.075]} scale={[0.016, 0.02, 0.012]} color="#fff8ec" roughness={0.2} />
          <SoftPart position={[0, 0.19, 0.005]} scale={[0.13, shape.eyes === 'estreitos' ? 0.02 : 0.032, 0.035]} color={hair} />
          <SoftPart position={[side * -0.19, -0.16, 0.005]} scale={[0.06, 0.035, 0.016]} color="#df8d83" roughness={0.9} />
        </group>
      ))}
      <SoftPart position={[0, headY - 0.13, faceZ + 0.04]} scale={[0.065, 0.085, 0.07]} color="#d89e7c" />
      <SoftPart position={[0, headY - 0.29, faceZ + 0.045]} scale={[0.105, 0.022, 0.025]} color="#934d4b" />
      <SoftPart position={[0, headY - 0.31, faceZ + 0.055]} scale={[0.066, 0.01, 0.015]} color="#f2c0a2" />

      {/* Hair and accessories use the head anchors for all three supplied proportions. */}
      <SoftPart position={[0, headY + 0.37, 0]} scale={[anchors.headWidth, 0.2, 0.53]} color={hair} />
      <SoftPart position={[0, headY + 0.26, faceZ + 0.015]} scale={[0.34, 0.15, 0.11]} color={hair} />
      <SoftPart position={[-0.45, headY - 0.02, -0.15]} scale={[0.15, hairLength, 0.2]} color={hair} />
      <SoftPart position={[0.45, headY - 0.02, -0.15]} scale={[0.15, hairLength, 0.2]} color={hair} />
      {shape.hair !== 'curto' && (
        <SoftPart
          position={[0, headY - 0.28 - (shape.hair === 'longo' ? 0.16 : 0), -0.28]}
          scale={[0.39, shape.hair === 'longo' ? 0.47 : 0.28, 0.22]}
          color={hair}
        />
      )}
      {shape.accessory === 'oculos' && (
        <>
          {([-1, 1] as const).map((side) => (
            <mesh
              key={`glasses-${side}`}
              position={[side * anchors.eyeOffset, headY + 0.035, faceZ + 0.07]}
              scale={[0.28, 0.29, 0.13]}
            >
              <torusGeometry args={[0.5, 0.07, 8, 24]} />
              <meshStandardMaterial color="#272729" roughness={0.35} />
            </mesh>
          ))}
          <SoftPart position={[0, headY + 0.035, faceZ + 0.07]} scale={[0.1, 0.03, 0.02]} color="#272729" />
        </>
      )}
      {shape.accessory === 'bone' && (
        <>
          <SoftPart position={[0, headY + 0.6, 0]} scale={[anchors.headWidth * 0.95, 0.13, 0.52]} color="#d66a30" />
          <SoftPart position={[0, headY + 0.46, faceZ + 0.1]} scale={[0.39, 0.055, 0.2]} color="#c45b27" />
        </>
      )}
      {shape.accessory === 'chapeu' && (
        <>
          <SoftPart position={[0, headY + 0.58, 0]} scale={[0.38, 0.24, 0.36]} color="#665449" />
          <SoftPart position={[0, headY + 0.43, 0]} scale={[0.77, 0.055, 0.69]} color="#514239" />
        </>
      )}
    </group>
  );
}
