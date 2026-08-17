/**
 * ContentDetails — Characters, Comparable Films, Standout Scenes,
 * Strengths/Weaknesses, Development Notes.
 */

import { clsx } from 'clsx';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Screenplay } from '@/types';
import { formatProducerTaxonomy, formatProducerText } from '@/lib/producerDisplay';
import { searchTmdbComparable } from '@/lib/tmdbService';
import { useApiConfigStore } from '@/stores/apiConfigStore';
import { SectionHeader } from './SectionHeader';

interface ContentDetailsProps {
    screenplay: Screenplay;
    presentation?: 'default' | 'workspace';
}

export function ContentDetails({ screenplay, presentation = 'default' }: ContentDetailsProps) {
    const isWorkspace = presentation === 'workspace';
    const content = (
        <>
            {/* Characters */}
            <CharactersSection screenplay={screenplay} isWorkspace={isWorkspace} />

            {/* Comparable Films */}
            {screenplay.comparableFilms.filter(f => f.title?.trim()).length > 0 && (
                <ComparableFilmsSection films={screenplay.comparableFilms.filter(f => f.title?.trim())} isWorkspace={isWorkspace} />
            )}

            {/* Standout Scenes */}
            {screenplay.standoutScenes.filter(s => s.scene?.trim()).length > 0 && (
                <StandoutScenesSection scenes={screenplay.standoutScenes.filter(s => s.scene?.trim())} isWorkspace={isWorkspace} />
            )}

            {/* Strengths & Weaknesses */}
            <StrengthsWeaknessesSection screenplay={screenplay} isWorkspace={isWorkspace} />

            {/* Development Notes */}
            {screenplay.developmentNotes.length > 0 && (
                <DevelopmentNotesSection notes={screenplay.developmentNotes} isWorkspace={isWorkspace} />
            )}
        </>
    );

    return isWorkspace
        ? <div className="screenplay-xray">{content}</div>
        : content;
}

function CharactersSection({ screenplay, isWorkspace }: { screenplay: Screenplay; isWorkspace: boolean }) {
    const { t } = useTranslation();
    return (
        <section className={clsx(isWorkspace && 'screenplay-xray__section screenplay-xray__section--characters')}>
            <SectionHeader icon={isWorkspace ? undefined : '👥'}>{t('Characters')}</SectionHeader>
            <div className="space-y-3">
                <div>
                    <h5 className="text-sm font-medium text-gold-400 mb-1">{t('Protagonist')}</h5>
                    <p className="text-sm text-black-300">{formatProducerText(screenplay.characters.protagonist)}</p>
                </div>
                <div>
                    <h5 className="text-sm font-medium text-gold-400 mb-1">{t('Antagonist')}</h5>
                    <p className="text-sm text-black-300">{formatProducerText(screenplay.characters.antagonist)}</p>
                </div>
                {screenplay.characters.supporting.length > 0 && (
                    <div>
                        <h5 className="text-sm font-medium text-gold-400 mb-1">{t('Supporting Cast')}</h5>
                        <ul className="list-disc list-inside space-y-1">
                            {screenplay.characters.supporting.map((char, i) => (
                                <li key={i} className="text-sm text-black-300">{formatProducerText(typeof char === 'string' ? char : String(char))}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
}

function ComparableFilmsSection({ films, isWorkspace }: { films: Screenplay['comparableFilms']; isWorkspace: boolean }) {
    const { t } = useTranslation();
    const limitedFilms = films.slice(0, 3);
    if (isWorkspace) return <WorkspaceComparableFilms films={limitedFilms} />;

    return (
        <section>
            <SectionHeader icon="🎥">{t('Comparable Films')}</SectionHeader>
            <div className="grid md:grid-cols-2 gap-3">
                {limitedFilms.map((film, i) => (
                    <div key={`${film.title}-${i}`} className="p-3 bg-black-900/50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-black-200">{film.title}</span>
                            {(film.comparisonLens || film.boxOfficeRelevance) && (
                                <span className="text-xs px-2 py-0.5 rounded bg-gold-500/20 text-gold-400">
                                    {formatProducerTaxonomy(film.comparisonLens || film.boxOfficeRelevance || '')}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-black-500">{formatProducerText(film.similarity)}</p>
                        {film.keyDivergence && (
                            <p className="text-xs text-black-500 italic mt-1">{t('Key divergence:')} {formatProducerText(film.keyDivergence)}</p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}

function WorkspaceComparableFilms({ films }: { films: Screenplay['comparableFilms'] }) {
    const { t } = useTranslation();
    const configuredTmdbApiKey = useApiConfigStore((state) => state.tmdbApiKey);
    const tmdbApiKey = configuredTmdbApiKey
        || (import.meta.env.VITE_TMDB_API_KEY as string | undefined)
        || '';
    const posterQueries = useQueries({
        queries: films.map((film) => ({
            queryKey: ['tmdb-comparable-poster', film.title],
            queryFn: () => searchTmdbComparable(film.title, tmdbApiKey),
            enabled: Boolean(tmdbApiKey && film.title.trim()),
            staleTime: Number.POSITIVE_INFINITY,
            gcTime: Number.POSITIVE_INFINITY,
            retry: false,
        })),
    });

    return (
        <section className="screenplay-xray__section screenplay-comparables">
            <SectionHeader>{t('Comparable Films')}</SectionHeader>
            <p className="screenplay-comparables__intro">
                {t('Three reference points selected by the readers. Poster images are supplied by TMDB and do not affect the analysis.')}
            </p>
            <div className="screenplay-comparables__grid">
                {films.map((film, index) => {
                    const poster = posterQueries[index]?.data;
                    const isLoading = posterQueries[index]?.isPending && Boolean(tmdbApiKey);
                    const displayTitle = poster?.releaseYear
                        ? film.title.replace(new RegExp(`\\s*\\(${poster.releaseYear}\\)\\s*$`), '')
                        : film.title;
                    return (
                        <article className="screenplay-comparable" key={`${film.title}-${index}`}>
                            <div className="screenplay-comparable__poster" aria-hidden="true">
                                {poster ? (
                                    <img src={poster.posterUrl} alt="" loading="lazy" />
                                ) : isLoading ? (
                                    <span className="screenplay-comparable__poster-loading" />
                                ) : (
                                    <span className="screenplay-comparable__poster-fallback">{film.title.slice(0, 1)}</span>
                                )}
                            </div>
                            <div className="screenplay-comparable__copy">
                                <span className="screenplay-comparable__lens">
                                    {formatProducerTaxonomy(film.comparisonLens || 'Comparison')}
                                </span>
                                <h4>{displayTitle}</h4>
                                {poster?.releaseYear && <span>{poster.releaseYear}</span>}
                                <p>{formatProducerText(film.similarity)}</p>
                                {film.keyDivergence && (
                                    <p className="screenplay-comparable__divergence">
                                        <strong>{t('Where it differs:')}</strong> {formatProducerText(film.keyDivergence)}
                                    </p>
                                )}
                                {poster && (
                                    <a
                                        href={`https://www.themoviedb.org/movie/${poster.tmdbId}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {t('View film details')}
                                    </a>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

function StandoutScenesSection({ scenes, isWorkspace }: { scenes: Screenplay['standoutScenes']; isWorkspace: boolean }) {
    const { t } = useTranslation();
    return (
        <section className={clsx(isWorkspace && 'screenplay-xray__section screenplay-xray__section--standout')}>
            <SectionHeader icon={isWorkspace ? undefined : '✨'}>{t('Standout Scenes')}</SectionHeader>
            <div className="space-y-3">
                {scenes.map((scene, i) => (
                    <div key={i} className={clsx('p-3 bg-black-900/50', isWorkspace ? 'rounded-sm border border-black-700' : 'rounded-lg')}>
                        <p className="text-sm text-black-200 mb-1">{formatProducerText(scene.scene)}</p>
                        <p className="text-xs text-black-500 italic">{t('Why:')} {formatProducerText(scene.why)}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

function StrengthsWeaknessesSection({ screenplay, isWorkspace }: { screenplay: Screenplay; isWorkspace: boolean }) {
    const { t } = useTranslation();
    if (screenplay.strengths.length === 0 && screenplay.weaknesses.length === 0 && screenplay.majorWeaknesses.length === 0) {
        return null;
    }

    return (
        <section className={clsx('grid md:grid-cols-2 gap-6', isWorkspace && 'screenplay-xray__section')}>
            {screenplay.strengths.length > 0 && (
                <div>
                    <SectionHeader icon={isWorkspace ? undefined : '💪'}>{t('Strengths')}</SectionHeader>
                    <ul className="space-y-2">
                        {screenplay.strengths.map((strength, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-black-300">
                                <span className="text-emerald-400 mt-0.5">✓</span>
                                {formatProducerText(typeof strength === 'string' ? strength : String(strength))}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {(screenplay.weaknesses.length > 0 || screenplay.majorWeaknesses.length > 0) && (
                <div>
                    <SectionHeader icon={isWorkspace ? undefined : '⚠️'}>{t('Weaknesses')}</SectionHeader>
                    <ul className="space-y-2">
                        {screenplay.majorWeaknesses.map((weakness, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-red-300">
                                <span className="text-red-400 mt-0.5">✗</span>
                                <span className="font-medium">{t('Major:')} {formatProducerText(typeof weakness === 'string' ? weakness : String(weakness))}</span>
                            </li>
                        ))}
                        {screenplay.weaknesses.map((weakness, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-black-300">
                                <span className="text-gold-400 mt-0.5">!</span>
                                {formatProducerText(typeof weakness === 'string' ? weakness : String(weakness))}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

function DevelopmentNotesSection({ notes, isWorkspace }: { notes: string[]; isWorkspace: boolean }) {
    const { t } = useTranslation();
    return (
        <section className={clsx(isWorkspace && 'screenplay-xray__section screenplay-xray__section--development')}>
            <SectionHeader icon={isWorkspace ? undefined : '📋'}>{t('Development Notes')}</SectionHeader>
            <ul className="space-y-2">
                {notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-black-300">
                        <span className="text-gold-400 mt-0.5">→</span>
                        {formatProducerText(typeof note === 'string' ? note : String(note))}
                    </li>
                ))}
            </ul>
        </section>
    );
}
