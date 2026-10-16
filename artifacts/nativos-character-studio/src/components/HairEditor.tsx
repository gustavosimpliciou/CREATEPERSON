import { useState, useCallback, useEffect } from "react";
import { X, RotateCcw, Maximize, Scissors, Move } from "lucide-react";
import type { CharacterShape } from "./CharacterViewport";

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-row">
      <div className="slider-head">
        <label htmlFor={testId}>{label}</label>
        <output className="slider-value" htmlFor={testId} data-testid={`${testId}-value`}>
          {value.toFixed(2)}
        </output>
      </div>
      <input
        id={testId}
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--progress": `${progress}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        onMouseDown={(e) => e.stopPropagation()}
        data-testid={testId}
        aria-label={label}
      />
    </div>
  );
}

interface HairEditorProps {
  open: boolean;
  shape: CharacterShape;
  onClose: () => void;
  onChange: (shape: CharacterShape) => void;
}

export default function HairEditor({
  open,
  shape,
  onClose,
  onChange,
}: HairEditorProps) {
  if (!open) return null;

  const [transform, setTransform] = useState({
    position: shape.hairTransform?.position ?? [0, 0, 0],
    rotation: shape.hairTransform?.rotation ?? [0, 0, 0],
    scale: shape.hairTransform?.scale ?? [1, 1, 1],
    color: shape.hairTransform?.color ?? shape.colors.hair ?? "",
  });

  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const updateTransform = (patch: Partial<typeof transform>) => {
    setTransform((prev) => ({ ...prev, ...patch }));
  };

  const apply = () => {
    onChange({
      ...shape,
      hairTransform: {
        position: transform.position,
        rotation: transform.rotation,
        scale: transform.scale,
        color: transform.color || undefined,
      },
      colors: { ...shape.colors, hair: transform.color || undefined },
    });
  };

  const resetTransform = () => {
    setTransform({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: shape.colors.hair ?? "",
    });
    apply();
  };

  // Arrastar apenas pelo cabeçalho
  const startDrag = useCallback(
    (event: React.MouseEvent) => {
      // Só inicia arrasto se o clique for no cabeçalho (ou no ícone de mover)
      const target = event.target as HTMLElement;
      if (!target.closest(".hair-editor-header")) return;
      setDragging(true);
      const panel = document.querySelector(".hair-editor-panel");
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      setOffset({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    []
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!dragging) return;
      const panel = document.querySelector(".hair-editor-panel") as HTMLElement;
      if (!panel) return;
      panel.style.left = `${event.clientX - offset.x}px`;
      panel.style.top = `${event.clientY - offset.y}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    },
    [dragging, offset]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [open, handleMouseMove, handleMouseUp]);

  return (
    <div
      className="hair-editor-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Editor de cabelo"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="hair-editor-panel"
        style={{
          position: "fixed",
          top: "20vh",
          left: "10px",
          pointerEvents: "auto",
        }}
        onMouseDown={startDrag}
      >
        <header className="hair-editor-header">
          <div className="hair-editor-title">
            <Move size={14} />
            <span>EDITOR DE CABELO</span>
          </div>
          <button
            className="hair-editor-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Fechar editor"
            data-testid="hair-editor-close"
          >
            <X size={13} />
          </button>
        </header>

        <section className="hair-editor-section">
          <div className="hair-editor-subtitle">Transformação</div>
          <div className="hair-controls">
            <div className="hair-control-group">
              <div className="hair-control-label">Posição</div>
              {["X", "Y", "Z"].map((axis, i) => (
                <SliderRow
                  key={axis}
                  label={`Posição ${axis}`}
                  value={transform.position[i]}
                  min={-30}
                  max={30}
                  step={0.5}
                  onChange={(v) =>
                    updateTransform({
                      position: [
                        i === 0 ? v : transform.position[0],
                        i === 1 ? v : transform.position[1],
                        i === 2 ? v : transform.position[2],
                      ],
                    })
                  }
                  testId={`hair-pos-${axis.toLowerCase()}`}
                />
              ))}
            </div>
            <div className="hair-control-group">
              <div className="hair-control-label">Rotação</div>
              {["X", "Y", "Z"].map((axis, i) => (
                <SliderRow
                  key={axis}
                  label={`Rotação ${axis}`}
                  value={transform.rotation[i]}
                  min={-180}
                  max={180}
                  step={1}
                  onChange={(v) =>
                    updateTransform({
                      rotation: [
                        i === 0 ? v : transform.rotation[0],
                        i === 1 ? v : transform.rotation[1],
                        i === 2 ? v : transform.rotation[2],
                      ],
                    })
                  }
                  testId={`hair-rot-${axis.toLowerCase()}`}
                />
              ))}
            </div>
            <div className="hair-control-group">
              <div className="hair-control-label">Escala</div>
              {["X", "Y", "Z"].map((axis, i) => (
                <SliderRow
                  key={axis}
                  label={`Escala ${axis}`}
                  value={transform.scale[i]}
                  min={0.5}
                  max={2}
                  step={0.05}
                  onChange={(v) =>
                    updateTransform({
                      scale: [
                        i === 0 ? v : transform.scale[0],
                        i === 1 ? v : transform.scale[1],
                        i === 2 ? v : transform.scale[2],
                      ],
                    })
                  }
                  testId={`hair-scale-${axis.toLowerCase()}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="hair-editor-section">
          <div className="hair-editor-subtitle">Aparência</div>
          <div className="hair-color-row">
            <label className="hair-color-label">Cor do cabelo</label>
            <input
              type="color"
              value={transform.color || "#3d2a25"}
              onChange={(event) =>
                updateTransform({ color: event.target.value })
              }
              onMouseDown={(e) => e.stopPropagation()}
              className="hair-color-input"
            />
            <button
              className="hair-reset-button"
              onClick={(e) => {
                e.stopPropagation();
                resetTransform();
              }}
              aria-label="Restaurar padrão do cabelo"
              data-testid="hair-reset-transform"
            >
              <RotateCcw size={12} /> Padrão
            </button>
          </div>
        </section>

        <footer className="hair-editor-footer">
          <button
            className="hair-btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            data-testid="hair-editor-cancel"
          >
            <Scissors size={12} /> Fechar
          </button>
          <button
            className="hair-btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              apply();
            }}
            data-testid="hair-editor-apply"
          >
            <Maximize size={12} /> Aplicar
          </button>
        </footer>
      </div>
    </div>
  );
}
