import data from "./library.generated.json";

export const categories = [
  "eyes",
  "mouth",
  "hair",
  "shirt",
  "pants",
  "accessory",
] as const;
export type Category = (typeof categories)[number];
export type BaseId = keyof typeof data.profiles;
export type AnchorName =
  keyof (typeof data.profiles)["3HT-feminino"]["anchors"];
export type Piece = Omit<(typeof data.items)[number], "category" | "anchor"> & {
  category: Category;
  anchor: AnchorName;
};
export type Selections = Record<Category, string | null>;
export type Colors = Partial<Record<Category, string>>;
export const library = data;
export const pieces = data.items as Piece[];
export const emptySelections: Selections = {
  eyes: null,
  mouth: null,
  hair: null,
  shirt: null,
  pants: null,
  accessory: null,
};
export const sampleSelections: Selections = {
  eyes: "eyes-round",
  mouth: "mouth-smile",
  hair: "hair-short",
  shirt: "shirt-polo",
  pants: "pants-straight",
  accessory: null,
};
export const pieceById = new Map(pieces.map((piece) => [piece.id, piece]));
export const assetUrl = (path: string) =>
  `${import.meta.env.BASE_URL}assets/collectible/${path}`;
export const variantUrl = (piece: Piece, base: BaseId) =>
  assetUrl(`${piece.directory}/${piece.id}/${base}.glb`);

export function incompatibility(
  piece: Piece,
  selections: Selections,
  base: BaseId,
): string | null {
  if (!piece.compatibility.includes(base))
    return "Esta peça não tem uma versão para a base escolhida.";
  for (const id of Object.values(selections)) {
    const other = id ? pieceById.get(id) : undefined;
    if (!other || other.category === piece.category) continue;
    if (
      piece.conflicts.includes(other.id) ||
      other.conflicts.includes(piece.id)
    ) {
      return `Remova “${other.name}” para usar esta peça.`;
    }
  }
  return null;
}

// Validate saved/external state at the boundary: stale IDs cannot trigger arbitrary URLs.
export function sanitizeSelections(input: unknown, base: BaseId): Selections {
  const result = { ...emptySelections };
  if (!input || typeof input !== "object") return result;
  for (const category of categories) {
    const value = (input as Record<string, unknown>)[category];
    const piece = typeof value === "string" ? pieceById.get(value) : undefined;
    if (piece?.category === category && !incompatibility(piece, result, base))
      result[category] = piece.id;
  }
  return result;
}
