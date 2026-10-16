import model2htFeminino from '@/assets/models/chibi-2ht-fft.glb?url';
import model2htMasculino from '@/assets/models/chibi-2ht-mft.glb?url';
import model3htFeminino from '@/assets/models/chibi-3ht-fft.glb?url';
import model3htMasculino from '@/assets/models/chibi-3ht-mft.glb?url';
import model4htFeminino from '@/assets/models/chibi-4ht-fft.glb?url';
import model4htMasculino from '@/assets/models/chibi-4ht-mft.glb?url';

export type BaseRatio = '2HT' | '3HT' | '4HT';
export type BaseGender = 'feminino' | 'masculino';

export const baseModelUrls: Record<BaseRatio, Record<BaseGender, string>> = {
  '2HT': { feminino: model2htFeminino, masculino: model2htMasculino },
  '3HT': { feminino: model3htFeminino, masculino: model3htMasculino },
  '4HT': { feminino: model4htFeminino, masculino: model4htMasculino },
};

export const baseModelHeights: Record<BaseRatio, number> = {
  '2HT': 1.961,
  '3HT': 2.811,
  '4HT': 4.28,
};

export const baseModelAnchors = {
  '2HT': {
    headY: 1.43, faceZ: 0.39, eyeOffset: 0.19, headWidth: 0.56,
    chestY: 0.68, chestWidth: 0.31, chestHeight: 0.24, chestDepth: 0.23,
    shoulderY: 0.88, sleeveCenter: 0.49, sleeveLength: 0.29, sleeveWidth: 0.095,
    hipY: 0.43, legY: 0.27, legHalf: 0.24, legX: 0.2,
    footY: 0.055, footWidth: 0.13, footLength: 0.19,
  },
  '3HT': {
    headY: 2.28, faceZ: 0.47, eyeOffset: 0.22, headWidth: 0.6,
    chestY: 1.37, chestWidth: 0.4, chestHeight: 0.42, chestDepth: 0.3,
    shoulderY: 1.64, sleeveCenter: 0.69, sleeveLength: 0.39, sleeveWidth: 0.13,
    hipY: 0.83, legY: 0.47, legHalf: 0.4, legX: 0.18,
    footY: 0.075, footWidth: 0.18, footLength: 0.27,
  },
  '4HT': {
    headY: 3.73, faceZ: 0.55, eyeOffset: 0.24, headWidth: 0.64,
    chestY: 2.38, chestWidth: 0.44, chestHeight: 0.66, chestDepth: 0.34,
    shoulderY: 2.76, sleeveCenter: 1.03, sleeveLength: 0.57, sleeveWidth: 0.16,
    hipY: 1.48, legY: 0.8, legHalf: 0.76, legX: 0.24,
    footY: 0.08, footWidth: 0.22, footLength: 0.32,
  },
} as const;
