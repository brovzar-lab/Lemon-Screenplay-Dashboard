/**
 * FilmNowSection — FILM NOW qualifiers display.
 */

import type { Screenplay } from '@/types';
import { SectionHeader } from './SectionHeader';

interface FilmNowSectionProps {
    screenplay: Screenplay;
}

export function FilmNowSection({ screenplay }: FilmNowSectionProps) {
    if (!screenplay.isFilmNow || !screenplay.filmNowAssessment) return null;

    return (
        <div className="p-4 rounded-xl bg-gradient-to-r from-gold-900/20 to-gold-800/10 border border-gold-500/30">
            <SectionHeader icon="⭐">FILM NOW Qualifiers</SectionHeader>
            <div className="space-y-4">
                <div>
                    <h5 className="text-gold-400 text-sm font-medium mb-1">Lightning Test</h5>
                    <p className="text-black-300 text-sm">{screenplay.filmNowAssessment.lightningTest}</p>
                </div>
                {screenplay.filmNowAssessment.goosebumpsMoments.length > 0 && (
                    <div>
                        <h5 className="text-gold-400 text-sm font-medium mb-1">Goosebumps Moments</h5>
                        <ul className="list-disc list-inside space-y-1">
                            {screenplay.filmNowAssessment.goosebumpsMoments.map((moment, i) => (
                                <li key={i} className="text-black-300 text-sm">{moment}</li>
                            ))}
                        </ul>
                    </div>
                )}
                <div>
                    <h5 className="text-gold-400 text-sm font-medium mb-1">Career Risk Test</h5>
                    <p className="text-black-300 text-sm">{screenplay.filmNowAssessment.careerRiskTest}</p>
                </div>
                <div>
                    <h5 className="text-gold-400 text-sm font-medium mb-1">Legacy Potential</h5>
                    <p className="text-black-300 text-sm">{screenplay.filmNowAssessment.legacyPotential}</p>
                </div>
            </div>
        </div>
    );
}
