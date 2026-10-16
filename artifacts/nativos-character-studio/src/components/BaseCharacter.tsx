import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Mesh, MeshStandardMaterial } from "three";
import { baseModelUrls } from "@/studio/baseAssets";
import type { CharacterShape } from "@/components/CharacterViewport";
import ModularParts from "@/components/ModularParts";
import { library, type BaseId } from "@/studio/modular/registry";

const baseSkinMaterial = new MeshStandardMaterial({
  color: "#d7a582",
  roughness: 0.88,
});

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
  const modelUrl = baseModelUrls[shape.ratio][shape.model];
  const base = `${shape.ratio}-${shape.model}` as BaseId;
  const profile = library.profiles[base];
  const displayScale = 2.811 / library.canonicalHeightMm;

  return (
    <group
      scale={[
        shape.torso * displayScale,
        shape.height * displayScale,
        displayScale,
      ]}
    >
      <group scale={profile.sourceScaleToMm}>
        <group position={[0, -profile.sourceMinY, 0]}>
          <ImportedBase url={modelUrl} />
        </group>
      </group>
      <ModularParts
        base={base}
        selections={shape.parts}
        colors={shape.colors}
        hairTransform={shape.hairTransform}
      />
    </group>
  );
}
