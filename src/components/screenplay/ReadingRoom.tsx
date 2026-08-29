import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Screenplay } from '@/types';
import type { PercentileRank } from '@/lib/percentileRanking';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useIsAdmin } from '@/stores/authStore';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { getScreenplayDisplayAuthor, getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import {
  AlertBanners,
  ContentDetails,
  FieldPositionPanel,
  NotesSection,
  ProducerTake,
  ScoresPanel,
} from './modal';
import { useTranslation } from 'react-i18next';
import { analysisIsEnglishFallback, localizedScreenplay } from '@/lib/localizedAnalysis';
import { AnalysisLanguageNotice } from '@/components/project/AnalysisLanguageNotice';
import { isDecisionReady } from '@/lib/producerProjection';

interface ReadingRoomProps {
  screenplays: Screenplay[];
  initialScreenplayId?: string;
  percentileRanks: ReadonlyMap<string, PercentileRank>;
  onClose: () => void;
}

export function ReadingRoom({
  screenplays,
  initialScreenplayId,
  percentileRanks,
  onClose,
}: ReadingRoomProps) {
  const { t, i18n } = useTranslation();
  const isAdmin = useIsAdmin();
  const [currentId, setCurrentId] = useState(initialScreenplayId ?? screenplays[0]?.id);
  const contentRef = useRef<HTMLDivElement>(null);
  const quickFavorites = useFavoritesStore((state) => state.quickFavorites);
  const toggleQuickFavorite = useFavoritesStore((state) => state.toggleQuickFavorite);

  const currentIndex = useMemo(() => {
    const index = screenplays.findIndex((screenplay) => screenplay.id === currentId);
    return index >= 0 ? index : 0;
  }, [currentId, screenplays]);
  const originalScreenplay = screenplays[currentIndex];
  const screenplay = originalScreenplay
    ? localizedScreenplay(originalScreenplay, i18n.resolvedLanguage === 'es' ? 'es' : 'en')
    : undefined;
  const isFavorite = originalScreenplay ? quickFavorites.includes(originalScreenplay.id) : false;

  const navigate = useCallback(
    (direction: -1 | 1) => {
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= screenplays.length) return;
      setCurrentId(screenplays[nextIndex].id);
      contentRef.current?.scrollTo({ top: 0 });
    },
    [currentIndex, screenplays],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!screenplay) onClose();
  }, [onClose, screenplay]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (isTyping) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigate(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigate(1);
      } else if (event.key.toLowerCase() === 'f' && screenplay) {
        event.preventDefault();
        toggleQuickFavorite(screenplay.id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onClose, screenplay, toggleQuickFavorite]);

  if (!screenplay) return null;
  const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;
  const displayAuthor = getScreenplayDisplayAuthor(screenplay.author);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black-950 text-black-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reading-room-title"
    >
      <header className="shrink-0 border-b border-black-700 bg-black-900 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <span className="text-xs font-semibold text-gold-400 uppercase">{t('Reading Room')}</span>
            <span className="text-xs text-black-500 tabular-nums">
              {t('{{current}} of {{total}}', { current: currentIndex + 1, total: screenplays.length })}
            </span>
            {isDecisionReady(screenplay) ? (
              <RecommendationBadge tier={screenplay.recommendation} />
            ) : (
              <span className="text-xs font-semibold text-amber-300">
                {t('Decision data unavailable until verification')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(-1)}
              disabled={currentIndex === 0}
              className="w-10 h-10 flex items-center justify-center rounded border border-black-600 text-xl disabled:opacity-30"
              aria-label={t('Previous screenplay')}
              title={t('Previous screenplay')}
            >
              ‹
            </button>
            <button
              onClick={() => navigate(1)}
              disabled={currentIndex === screenplays.length - 1}
              className="w-10 h-10 flex items-center justify-center rounded border border-black-600 text-xl disabled:opacity-30"
              aria-label={t('Next screenplay')}
              title={t('Next screenplay')}
            >
              ›
            </button>
            <button
              onClick={() => toggleQuickFavorite(screenplay.id)}
              className={`w-10 h-10 flex items-center justify-center rounded border text-lg ${
                isFavorite
                  ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                  : 'border-black-600 text-black-400'
              }`}
              aria-label={isFavorite ? t('Remove from favorites') : t('Add to favorites')}
              title={isFavorite ? t('Remove from favorites') : t('Add to favorites')}
              aria-pressed={isFavorite}
            >
              ★
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded border border-black-600 text-xl"
              aria-label={t('Exit Reading Room')}
              title={t('Exit Reading Room')}
            >
              ×
            </button>
          </div>
        </div>
      </header>

      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0 px-5 md:px-8 py-7 space-y-8 lg:border-r border-black-700">
            <div>
              <h1
                id="reading-room-title"
                className="text-3xl md:text-4xl font-display text-gold-200"
              >
                {displayTitle}
              </h1>
              {displayAuthor && <p className="text-black-400 mt-1">{t('by')} {t(displayAuthor)}</p>}
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="chip chip-genre">{screenplay.genre}</span>
                <span className="chip chip-budget">{screenplay.budgetCategory}</span>
              </div>
            </div>

            {originalScreenplay && analysisIsEnglishFallback(originalScreenplay, i18n.resolvedLanguage === 'es' ? 'es' : 'en') && (
              <AnalysisLanguageNotice screenplay={originalScreenplay} />
            )}
            <AlertBanners screenplay={screenplay} />
            <FieldPositionPanel rank={percentileRanks.get(screenplay.id)} />

            <section aria-labelledby="reading-room-logline">
              <h2 id="reading-room-logline" className="text-lg font-display text-gold-200 mb-3">
                {t('Logline')}
              </h2>
              <p className="text-lg text-black-200 leading-relaxed">{screenplay.logline}</p>
            </section>

            <ScoresPanel screenplay={screenplay} />
            <ContentDetails screenplay={screenplay} />
          </main>

          <aside className="px-5 md:px-6 py-7 space-y-8 bg-black-900/40">
            <NotesSection key={`notes-${screenplay.id}`} screenplayId={screenplay.id} />
            {isAdmin && (
              <ProducerTake key={`producer-take-${screenplay.id}`} screenplay={screenplay} />
            )}
          </aside>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {t('Reviewing {{title}}, screenplay {{current}} of {{total}}', {
          title: displayTitle,
          current: currentIndex + 1,
          total: screenplays.length,
        })}
      </span>
    </div>
  );
}
