export type ModelType = 'feminino' | 'masculino';

export type PieceMetadata = {
  id: string;
  name: string;
  category: 'olhos' | 'cabelo' | 'camisa' | 'calca' | 'calcado' | 'acessorio';
  style: string;
  compatibleWith: ModelType[];
  anchor: string;
  defaultTransform: [number, number, number];
  scale: [number, number, number];
  colorVariant: string;
  origin: 'procedural-nativos';
  license: 'original';
  icon: string;
};

export const characterAnchors = {
  HEAD: [0, 2.96, 0] as [number, number, number],
  CHEST: [0, 1.63, 0] as [number, number, number],
  FACE_EYES: [0, 0.015, 0.498] as [number, number, number],
  HEAD_TOP: [0, 0.46, 0] as [number, number, number],
};

const piece = (
  id: string,
  name: string,
  category: PieceMetadata['category'],
  style: string,
  anchor: string,
  colorVariant: string,
  icon: string,
  scale: [number, number, number] = [1, 1, 1],
): PieceMetadata => ({
  id,
  name,
  category,
  style,
  compatibleWith: ['feminino', 'masculino'],
  anchor,
  defaultTransform: [0, 0, 0],
  scale,
  colorVariant,
  origin: 'procedural-nativos',
  license: 'original',
  icon,
});

export const pieceCatalog = {
  eyes: [
    piece('redondos', 'Redondos', 'olhos', 'grandes e expressivos', 'FACE_EYES', '#d58a53', 'olhos'),
    piece('ovais', 'Ovais', 'olhos', 'abertos e suaves', 'FACE_EYES', '#8b6854', 'ovais'),
    piece('estreitos', 'Estilizados', 'olhos', 'mais estreitos', 'FACE_EYES', '#6a827d', 'estreitos'),
  ],
  hair: [
    piece('curto', 'Curto', 'cabelo', 'volume compacto', 'HEAD', '#403027', 'curto'),
    piece('medio', 'Médio', 'cabelo', 'mechas laterais', 'HEAD', '#403027', 'medio'),
    piece('longo', 'Longo', 'cabelo', 'mechas alongadas', 'HEAD', '#403027', 'longo'),
  ],
  shirts: [
    piece('camiseta', 'Camiseta', 'camisa', 'gola redonda', 'CHEST', '#d57b55', 'camiseta'),
    piece('polo', 'Camisa com gola', 'camisa', 'gola e vista', 'CHEST', '#d57b55', 'polo'),
    piece('moletom', 'Moletom', 'camisa', 'mangas e capuz', 'CHEST', '#53676a', 'moletom'),
  ],
  pants: [
    piece('comprida', 'Comprida', 'calca', 'pernas completas', 'LEFT_FOOT', '#233d47', 'comprida'),
    piece('curta', 'Curta', 'calca', 'bermuda', 'LEFT_FOOT', '#365460', 'curta'),
    piece('estilizada', 'Estilizada', 'calca', 'duas cores', 'LEFT_FOOT', '#655c69', 'estilizada'),
  ],
  shoes: [
    piece('tenis', 'Tênis', 'calcado', 'casual', 'LEFT_FOOT', '#e3d9c8', 'tenis'),
    piece('bota', 'Bota', 'calcado', 'cano alto', 'LEFT_FOOT', '#473b32', 'bota'),
    piece('sapato', 'Sapato', 'calcado', 'clássico', 'LEFT_FOOT', '#30363b', 'sapato'),
  ],
  accessories: [
    piece('nenhum', 'Sem acessório', 'acessorio', 'visual livre', 'HEAD_TOP', '#2b2d30', 'nenhum'),
    piece('oculos', 'Óculos', 'acessorio', 'armação redonda', 'FACE_EYES', '#303033', 'oculos'),
    piece('bone', 'Boné', 'acessorio', 'aba frontal', 'HEAD_TOP', '#d66a30', 'bone'),
    piece('chapeu', 'Chapéu', 'acessorio', 'aba ampla', 'HEAD_TOP', '#665449', 'chapeu'),
  ],
} as const;

export type PieceSelections = {
  eyes: (typeof pieceCatalog.eyes)[number]['id'];
  hair: (typeof pieceCatalog.hair)[number]['id'];
  shirt: (typeof pieceCatalog.shirts)[number]['id'];
  pants: (typeof pieceCatalog.pants)[number]['id'];
  shoes: (typeof pieceCatalog.shoes)[number]['id'];
  accessory: (typeof pieceCatalog.accessories)[number]['id'];
};

export const initialPieceSelections: PieceSelections = {
  eyes: 'redondos',
  hair: 'medio',
  shirt: 'polo',
  pants: 'comprida',
  shoes: 'tenis',
  accessory: 'nenhum',
};
