import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Mesh, MeshStandardMaterial } from "three";
import {
  categories,
  library,
  pieceById,
  sanitizeSelections,
  variantUrl,
  type BaseId,
  type Piece,
  type Colors,
  type Selections,
} from "@/studio/modular/registry";
import type { CharacterShape } from "./CharacterViewport";
import StlPart from "@/components/StlPart";

function Part({
  piece,
  base,
  color,
  hairTransform,
}: {
  piece: Piece & { stlPath?: string; loader?: string };
  base: BaseId;
  color?: string;
  hairTransform?: CharacterShape["hairTransform"];
}) {
  if (piece.loader === "stl") {
    const profile = library.profiles[base];
    const headDims = {
      width: profile.headWidth,
      height: profile.headHeight,
      depth: profile.headDepth,
      centerY: profile.headCenterY,
      centerZ: profile.headCenterZ,
    };
    return <StlPart piece={piece as any} color={color} headDims={headDims} transform={hairTransform} />;
  }
  const { scene } = useGLTF(variantUrl(piece, base));
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const recolor = (source: MeshStandardMaterial) => {
        const material = source.clone();
        if (color && material.name === "primary") material.color.set(color);
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(recolor)
        : recolor(object.material);
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return copy;
  }, [scene, color]);
  useEffect(
    () => () =>
      model.traverse((object) => {
        if (object instanceof Mesh)
          (Array.isArray(object.material)
            ? object.material
            : [object.material]
          ).forEach((material) => material.dispose());
      }),
    [model],
  );
  const anchor = library.profiles[base].anchors[piece.anchor] as [
    number,
    number,
    number,
  ];
  return (
    <group position={anchor} name={`${base}/${piece.id}`}>
      <group scale={1000}>
        <primitive object={model} dispose={null} />
      </group>
    </group>
  );
}

export default function ModularParts({
  base,
  selections,
  colors,
  hairTransform,
}: {
  base: BaseId;
  selections: Selections;
  colors: Colors;
  hairTransform?: CharacterShape["hairTransform"];
}) {
  const valid = sanitizeSelections(selections, base);
  return (
    <group name="modular-library">
      {categories.map((category) => {
        const piece = valid[category] ? pieceById.get(valid[category]!) : null;
        return piece ? (
          <Part
            key={`${base}/${piece.id}`}
            piece={piece}
            base={base}
            color={colors[category]}
            hairTransform={category === "hair" ? hairTransform : undefined}
          />
        ) : null;
      })}
    </group>
  );
}
