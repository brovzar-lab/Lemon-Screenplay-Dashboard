import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useToastStore } from '@/stores/toastStore';

const setDoc = vi.hoisted(() => vi.fn().mockRejectedValue(new Error('offline')));

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  setDoc,
}));

describe('feedbackStore localized failures', () => {
  afterEach(async () => {
    useToastStore.getState().clearToasts();
    setDoc.mockClear();
    await i18n.changeLanguage('en');
  });

  it('localizes Brain, notes, and calibration save failures', async () => {
    await i18n.changeLanguage('es');
    const { saveBrainVerdict, saveCalibrationProfile, saveFeedback } =
      await import('@/lib/feedbackStore');

    await saveBrainVerdict({
      screenplayId: 'one',
      screenplayTitle: 'Original Title',
      billyVerdict: 'consider',
      aiVerdict: 'pass',
      note: '',
      genre: 'Drama',
      subgenres: [],
      weightedScore: 5,
      source: 'screenplay-dashboard',
    });
    await saveFeedback({
      screenplayId: 'one',
      screenplayTitle: 'Original Title',
      userScore: null,
      userVerdict: null,
      dimensionOverrides: {},
      aiMissed: '',
      aiGotRight: '',
      greenlight: null,
      aiWeightedScore: 5,
      aiVerdict: 'pass',
      updatedAt: '',
    });
    await saveCalibrationProfile({
      displayName: 'Billy',
      totalReviews: 0,
      lastCalibrated: '',
      calibrationPrompt: '',
      enabled: false,
    });

    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual([
      'No se pudo guardar en Brain. Intenta de nuevo.',
      'No se pudieron guardar las notas. Es posible que tus cambios no se hayan guardado.',
      'No se pudo guardar el perfil de calibración.',
    ]);
  });
});
