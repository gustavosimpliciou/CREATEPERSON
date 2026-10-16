import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Grid,
  OrbitControls,
  useProgress,
} from "@react-three/drei";
import { Suspense, useRef, useState, type RefObject } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Box, Crosshair, Move3D } from "lucide-react";
import {
  ErrorBoundary,
  type ErrorFallbackProps,
} from "@/components/error-boundary";
import BaseCharacter from "@/components/BaseCharacter";
import type { BaseRatio } from "@/studio/baseAssets";
import type { Selections, Colors } from "@/studio/modular/registry";

export type CharacterShape = {
  model: "feminino" | "masculino";
  ratio: BaseRatio;
  height: number;
  torso: number;
  parts: Selections;
  colors: Colors;
  hairTransform?: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    color?: string;
  };
};

function ViewportFallback({ resetError }: ErrorFallbackProps) {
  return (
    <section className="viewport" data-testid="viewport-webgl-unavailable">
      <div className="webgl-fallback">
        <div className="webgl-fallback-icon">
          <Box size={19} />
        </div>
        <div className="eyebrow">VISUALIZAÇÃO INDISPONÍVEL</div>
        <h2>Não foi possível carregar a cena.</h2>
        <p>
          Tente novamente. Se o problema continuar, verifique a conexão com o
          estúdio e a aceleração gráfica do navegador.
        </p>
        <button
          type="button"
          className="webgl-retry"
          onClick={resetError}
          data-testid="button-retry-webgl"
        >
          Tentar novamente
        </button>
      </div>
    </section>
  );
}

function Stage({
  shape,
  controls,
}: {
  shape: CharacterShape;
  controls: RefObject<OrbitControlsImpl | null>;
}) {
  return (
    <>
      <color attach="background" args={["#111214"]} />
      <fog attach="fog" args={["#111214", 8, 18]} />
      <ambientLight intensity={1.25} />
      <hemisphereLight args={["#fff1dd", "#46505a", 1.2]} />
      <directionalLight
        position={[4, 7, 5]}
        intensity={3.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight
        position={[-4, 3, -3]}
        intensity={1.7}
        color="#d8e1ee"
      />
      <spotLight
        position={[0, 5, 4]}
        intensity={1.2}
        angle={0.5}
        penumbra={0.8}
        color="#ffbf8b"
      />
      <Suspense fallback={null}>
        <BaseCharacter shape={shape} />
      </Suspense>
      <Grid
        position={[0, 0, 0]}
        args={[12, 12]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#35383a"
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor="#45413d"
        fadeDistance={9}
        fadeStrength={1.5}
        infiniteGrid
      />
      <ContactShadows
        position={[0, 0.015, 0]}
        opacity={0.45}
        scale={5}
        blur={2.5}
        far={3}
      />
      <OrbitControls
        ref={controls}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.4}
        maxDistance={9}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI - 0.16}
        target={[0, 1.4, 0]}
      />
    </>
  );
}

export default function CharacterViewport({
  shape,
}: {
  shape: CharacterShape;
}) {
  const orbit = useRef<OrbitControlsImpl>(null);
  const { active: loading } = useProgress();
  const [view, setView] = useState("frente");
  const applyView = (next: "frente" | "lado" | "traseira") => {
    const controls = orbit.current;
    if (!controls) return;
    const distance = controls.object.position.distanceTo(controls.target);
    const positions: Record<typeof next, [number, number, number]> = {
      frente: [0, 1.4, distance],
      lado: [distance, 1.4, 0],
      traseira: [0, 1.4, -distance],
    };
    controls.object.position.set(...positions[next]);
    controls.target.set(0, 1.4, 0);
    controls.update();
    setView(next);
  };
  const frame = () => {
    if (!orbit.current) return;
    orbit.current.target.set(0, 1.4, 0);
    orbit.current.object.position.set(0, 1.4, 6.35);
    orbit.current.update();
    setView("frente");
  };
  const center = () => {
    if (!orbit.current) return;
    orbit.current.target.set(0, 1.4, 0);
    orbit.current.update();
  };
  return (
    <ErrorBoundary FallbackComponent={ViewportFallback}>
      <section className="viewport" data-testid="viewport-character">
        <Canvas
          shadows
          camera={{ position: [0, 1.4, 6.35], fov: 34 }}
          dpr={[1, 1.7]}
        >
          <Stage shape={shape} controls={orbit} />
        </Canvas>
        {loading && (
          <div role="status" className="scene-loading">
            Carregando malhas…
          </div>
        )}
        <div className="view-heading">
          <div className="eyebrow">NATIVOS / STUDIO</div>
          <h1>Sua base, em volume.</h1>
        </div>
        <div className="view-tools" aria-label="Vistas do personagem">
          {(["frente", "lado", "traseira"] as const).map((item) => (
            <button
              key={item}
              className={`view-button ${view === item ? "selected" : ""}`}
              onClick={() => applyView(item)}
              data-testid={`view-${item}`}
            >
              {item === "lado"
                ? "Lateral"
                : item === "traseira"
                  ? "Traseira"
                  : "Frontal"}
            </button>
          ))}
        </div>
        <div className="viewport-actions">
          <button
            className="icon-action"
            onClick={center}
            aria-label="Recentralizar câmera"
            title="Recentralizar câmera"
            data-testid="button-center-camera"
          >
            <Crosshair size={15} />
          </button>
          <button
            className="icon-action"
            onClick={frame}
            aria-label="Enquadrar personagem"
            title="Enquadrar personagem"
            data-testid="button-frame-character"
          >
            <Box size={15} />
          </button>
        </div>
        <div className="hint-pill">
          <Move3D size={13} />
          <span>
            Arraste para girar · scroll para zoom · botão direito para mover
          </span>
        </div>
        <div className="viewport-meta">
          PERSPECTIVA&nbsp; / &nbsp;STUDIO LIGHT
        </div>
      </section>
    </ErrorBoundary>
  );
}
