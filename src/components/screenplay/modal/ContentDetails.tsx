/**
 * ContentDetails — Characters, Comparable Films, Standout Scenes,
 * Strengths/Weaknesses, Development Notes.
 */

import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { SectionHeader } from './SectionHeader';

interface ContentDetailsProps {
    screenplay: Screenplay;
}

export function ContentDetails({ screenplay }: ContentDetailsProps) {
    return (
        <>
            {/* Characters */}
            <CharactersSection screenplay={screenplay} />

            {/* Comparable Films */}
            {screenplay.comparableFilms.length > 0 && (
                <ComparableFilmsSection films={screenplay.comparableFilms} />
            )}

            {/* Standout Scenes */}
            {screenplay.standoutScenes.length > 0 && (
                <StandoutScenesSection scenes={screenplay.standoutScenes} />
            )}

            {/* Strengths & Weaknesses */}
            <StrengthsWeaknessesSection screenplay={screenplay} />

            {/* Development Notes */}
            {screenplay.developmentNotes.length > 0 && (
                <DevelopmentNotesSection notes={screenplay.developmentNotes} />
            )}
        </>
    );
}

function CharactersSection({ screenplay }: { screenplay: Screenplay }) {
    return (
        <div>
            <SectionHeader icon="👥">Characters</SectionHeader>
            <div className="space-y-3">
                <div>
                    <h5 className="text-sm font-medium text-gold-400 mb-1">Protagonist</h5>
                    <p className="text-sm text-black-300">{screenplay.characters.protagonist}</p>
                </div>
                <div>
                    <h5 className="text-sm font-medium text-gold-400 mb-1">Antagonist</h5>
                    <p className="text-sm text-black-300">{screenplay.characters.antagonist}</p>
                </div>
                {screenplay.characters.supporting.length > 0 && (
                    <div>
                        <h5 className="text-sm font-medium text-gold-400 mb-1">Supporting Cast</h5>
                        <ul className="list-disc list-inside space-y-1">
                            {screenplay.characters.supporting.map((char, i) => (
                                <li key={i} className="text-sm text-black-300">{char}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

function ComparableFilmsSection({ films }: { films: Screenplay['comparableFilms'] }) {
    return (
        <div>
            <SectionHeader icon="🎥">Comparable Films</SectionHeader>
            <div className="grid md:grid-cols-2 gap-3">
                {films.map((film, i) => (
                    <div key={i} className="p-3 rounded-lg bg-black-900/50">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-black-200">{film.title}</span>
                            <span className={clsx(
                                'text-xs px-2 py-0.5 rounded',
                                film.boxOfficeRelevance === 'success' && 'bg-emerald-500/20 text-emerald-400',
                                film.boxOfficeRelevance === 'mixed' && 'bg-gold-500/20 text-gold-400',
                                film.boxOfficeRelevance === 'failure' && 'bg-red-500/20 text-red-400'
                            )}>
                                {film.boxOfficeRelevance}
                            </span>
                        </div>
                        <p className="text-xs text-black-500">{film.similarity}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StandoutScenesSection({ scenes }: { scenes: Screenplay['standoutScenes'] }) {
    return (
        <div>
            <SectionHeader icon="✨">Standout Scenes</SectionHeader>
            <div className="space-y-3">
                {scenes.map((scene, i) => (
                    <div key={i} className="p-3 rounded-lg bg-black-900/50">
                        <p className="text-sm text-black-200 mb-1">{scene.scene}</p>
                        <p className="text-xs text-black-500 italic">Why: {scene.why}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StrengthsWeaknessesSection({ screenplay }: { screenplay: Screenplay }) {
    if (screenplay.strengths.length === 0 && screenplay.weaknesses.length === 0 && screenplay.majorWeaknesses.length === 0) {
        return null;
    }

    return (
        <div className="grid md:grid-cols-2 gap-6">
            {screenplay.strengths.length > 0 && (
                <div>
                    <SectionHeader icon="💪">Strengths</SectionHeader>
                    <ul className="space-y-2">
                        {screenplay.strengths.map((strength, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-black-300">
                                <span className="text-emerald-400 mt-0.5">✓</span>
                                {strength}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {(screenplay.weaknesses.length > 0 || screenplay.majorWeaknesses.length > 0) && (
                <div>
                    <SectionHeader icon="⚠️">Weaknesses</SectionHeader>
                    <ul className="space-y-2">
                        {screenplay.majorWeaknesses.map((weakness, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-red-300">
                                <span className="text-red-400 mt-0.5">✗</span>
                                <span className="font-medium">[Major] {weakness}</span>
                            </li>
                        ))}
                        {screenplay.weaknesses.map((weakness, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-black-300">
                                <span className="text-gold-400 mt-0.5">!</span>
                                {weakness}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function DevelopmentNotesSection({ notes }: { notes: string[] }) {
    return (
        <div>
            <SectionHeader icon="📋">Development Notes</SectionHeader>
            <ul className="space-y-2">
                {notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-black-300">
                        <span className="text-gold-400 mt-0.5">→</span>
                        {note}
                    </li>
                ))}
            </ul>
        </div>
    );
}
