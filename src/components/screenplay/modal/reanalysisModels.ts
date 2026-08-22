import { MODEL_PLANNING_COSTS_USD } from '@/components/settings/upload/upload.constants';
import modelCatalog from '@/config/anthropic-model-catalog.json';

export type ReanalysisModelOption = {
  id: 'sonnet' | 'opus';
  label: string;
  desc: string;
};

export const REANALYSIS_MODELS: ReanalysisModelOption[] = [
  {
    id: 'sonnet',
    label: modelCatalog.analysisRoutes.sonnet.displayName,
    desc: `Approved · $${MODEL_PLANNING_COSTS_USD.sonnet[0].toFixed(2)}–$${MODEL_PLANNING_COSTS_USD.sonnet[1].toFixed(2)}`,
  },
  {
    id: 'opus',
    label: modelCatalog.analysisRoutes.opus.displayName,
    desc: `Approved · $${MODEL_PLANNING_COSTS_USD.opus[0].toFixed(2)}–$${MODEL_PLANNING_COSTS_USD.opus[1].toFixed(2)}`,
  },
];
