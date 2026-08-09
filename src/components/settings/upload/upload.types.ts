/**
 * Shared types for the Upload feature
 */

export type ModelOption = 'haiku' | 'sonnet' | 'opus' | 'hybrid';

export type UploadPresentation = 'settings' | 'intake';

export interface ModelInfo {
  id: ModelOption;
  name: string;
  modelId: string;
  routeLabel: string;
  subtitle: string;
  costPerScript: string;
  speed: string;
  quality: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: string;
}
