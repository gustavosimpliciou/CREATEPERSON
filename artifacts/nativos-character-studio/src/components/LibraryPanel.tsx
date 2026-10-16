import type { CharacterShape } from "./CharacterViewport";
import { Info, RotateCcw, X, Scissors } from "lucide-react";
import {
  assetUrl,
  incompatibility,
  library,
  pieces,
  type BaseId,
  type Category,
  type Piece,
} from "@/studio/modular/registry";

const labels: Record<Category, string> = {
  eyes: "Olhos",
  mouth: "Boca",
  hair: "Cabelo",
  shirt: "Camisas",
  pants: "Calças",
  accessory: "Acessórios",
};
const sections: Record<string, Category[]> = {
  rosto: ["eyes", "mouth"],
  cabelo: ["hair"],
  roupas: ["shirt", "pants"],
  acessorios: ["accessory"],
};

export default function LibraryPanel({
  section,
  shape,
  setShape,
  onEditHair,
  onHairSelect,
}: {
  section: string;
  shape: CharacterShape;
  setShape: (shape: CharacterShape) => void;
  onEditHair?: () => void;
  onHairSelect?: () => void;
}) {
  const base = `${shape.ratio}-${shape.model}` as BaseId;
  const select = (category: Category, piece: Piece | null) => {
    if (piece && incompatibility(piece, shape.parts, base)) return;
    setShape({
      ...shape,
      parts: { ...shape.parts, [category]: piece?.id ?? null },
    });
    if (category === "hair") {
      onHairSelect?.();
    }
  };
  return (
    <aside className="properties library-panel">
      <header className="panel-title">
        <h2>BIBLIOTECA MODULAR</h2>
        <span>
          {shape.ratio} / {shape.model === "feminino" ? "F" : "M"}
        </span>
      </header>
      {section === "rosto" && (
        <section className="panel-section">
          <div className="section-label">Expressões</div>
          <div className="face-presets">
            {library.facePresets.map((preset) => (
              <button
                key={preset.id}
                className="segment"
                onClick={() =>
                  setShape({
                    ...shape,
                    parts: {
                      ...shape.parts,
                      eyes: preset.eyes,
                      mouth: preset.mouth,
                    },
                  })
                }
                data-testid={`expression-${preset.id}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </section>
      )}
      {sections[section]?.map((category) => (
        <section className="panel-section" key={category}>
          <div className="section-top">
            <div className="section-label">{labels[category]}</div>
            <button
              className="remove-piece"
              onClick={() => select(category, null)}
              disabled={!shape.parts[category]}
              aria-label={`Remover ${labels[category]}`}
              data-testid={`remove-${category}`}
            >
              <X size={12} /> Remover
            </button>
          </div>
          <div className="module-grid">
            {pieces
              .filter((piece) => piece.category === category)
              .map((piece) => {
                const reason = incompatibility(piece, shape.parts, base);
                return (
                  <div className="module-option" key={piece.id}>
                    <button
                      className={`module-card ${shape.parts[category] === piece.id ? "active" : ""}`}
                      onClick={() => select(category, piece)}
                      disabled={!!reason}
                      aria-pressed={shape.parts[category] === piece.id}
                      title={reason ?? piece.notes}
                      data-testid={`piece-${piece.id}`}
                    >
                      <img
                        src={assetUrl(piece.thumbnail)}
                        alt=""
                        loading="lazy"
                        width="160"
                        height="140"
                      />
                      <strong>{piece.name}</strong>
                      <span>{piece.notes}</span>
                    </button>
                    {reason && <p className="compatibility-note">{reason}</p>}
                  </div>
                );
              })}
          </div>
          {shape.parts[category] && (
            <div className="material-control">
              <label htmlFor={`color-${category}`}>
                Cor {category === "eyes" ? "da íris e sobrancelhas" : "da peça"}
              </label>
              <input
                id={`color-${category}`}
                type="color"
                value={
                  shape.colors[category] ??
                  pieces.find((p) => p.id === shape.parts[category])!.color
                }
                onChange={(event) =>
                  setShape({
                    ...shape,
                    colors: { ...shape.colors, [category]: event.target.value },
                  })
                }
              />
              <button
                aria-label={`Restaurar cor de ${labels[category]}`}
                onClick={() => {
                  const colors = { ...shape.colors };
                  delete colors[category];
                  setShape({ ...shape, colors });
                }}
              >
                <RotateCcw size={13} />
              </button>
            </div>
          )}
          {category === "hair" && shape.parts.hair && (
            <div className="material-control">
              <button
                className="edit-hair-button"
                onClick={() => onEditHair?.()}
                data-testid="edit-hair-fit"
              >
                <Scissors size={13} /> Ajustar encaixe do cabelo
              </button>
            </div>
          )}
        </section>
      ))}
      <div className="note-card">
        <div className="note-heading">
          <Info size={13} /> Encaixe por base
        </div>
        As peças acompanham a base e seus ajustes. Boné e chapéu são usados sem
        cabelo nesta coleção.
      </div>
    </aside>
  );
}
