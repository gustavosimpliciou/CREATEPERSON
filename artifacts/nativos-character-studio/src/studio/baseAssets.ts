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
