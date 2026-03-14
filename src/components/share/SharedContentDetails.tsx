/**
 * SharedContentDetails
 *
 * Displays analysis content sections: synopsis, strengths, weaknesses,
 * development notes, characters, comparable films, standout scenes,
 * target audience, and budget tier for the shared partner view.
 *
 * BUNDLE ISOLATION: Only imports from @/types (configs) and @/lib/utils.
 */

import { BUDGET_TIERS } from '@/types';
import type { SharedViewDocument } from '@/lib/shareService';

interface SharedContentDetailsProps {
  analysis: SharedViewDocument['analysis'];
  notes?: SharedViewDocument['notes'];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-black-800 border border-gold-500/10 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gold-200 uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function SharedContentDetails({ analysis, notes }: SharedContentDetailsProps) {
  const budgetTier = BUDGET_TIERS[analysis.budgetCategory];

  return (
    <div className="space-y-6">
      {/* Synopsis / Logline */}
      <Section title="Synopsis">
        {analysis.logline && (
          <p className="text-gold-300 italic mb-4">{analysis.logline}</p>
        )}
        {analysis.themes?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {analysis.themes.map((theme) => (
              <span
                key={theme}
                className="px-2 py-1 text-xs rounded-md bg-black-700 text-black-300"
              >
                {theme}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Strengths */}
      {analysis.strengths?.length > 0 && (
        <Section title="Strengths">
          <ul className="space-y-2">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="text-sm text-black-200 flex gap-2">
                <span className="text-emerald-400 shrink-0">+</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Weaknesses */}
      {analysis.weaknesses?.length > 0 && (
        <Section title="Weaknesses">
          <ul className="space-y-2">
            {analysis.weaknesses.map((w, i) => (
              <li key={i} className="text-sm text-black-200 flex gap-2">
                <span className="text-amber-400 shrink-0">-</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Major Weaknesses */}
      {analysis.majorWeaknesses?.length > 0 && (
        <Section title="Major Weaknesses">
          <ul className="space-y-2">
            {analysis.majorWeaknesses.map((mw, i) => (
              <li key={i} className="text-sm text-black-200 flex gap-2">
                <span className="text-red-400 shrink-0">!</span>
                <span>{mw}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Development Notes */}
      {analysis.developmentNotes?.length > 0 && (
        <Section title="Development Notes">
          <ul className="space-y-2">
            {analysis.developmentNotes.map((note, i) => (
              <li key={i} className="text-sm text-black-200">
                {note}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Characters */}
      {analysis.characters && (
        <Section title="Characters">
          <div className="space-y-3">
            {analysis.characters.protagonist && (
              <div>
                <span className="text-xs text-gold-300 uppercase tracking-wider">Protagonist</span>
                <p className="text-sm text-black-200 mt-1">{analysis.characters.protagonist}</p>
              </div>
            )}
            {analysis.characters.antagonist && (
              <div>
                <span className="text-xs text-gold-300 uppercase tracking-wider">Antagonist</span>
                <p className="text-sm text-black-200 mt-1">{analysis.characters.antagonist}</p>
              </div>
            )}
            {analysis.characters.supporting?.length > 0 && (
              <div>
                <span className="text-xs text-gold-300 uppercase tracking-wider">Supporting Cast</span>
                <ul className="mt-1 space-y-1">
                  {analysis.characters.supporting.map((c, i) => (
                    <li key={i} className="text-sm text-black-200">{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Comparable Films */}
      {analysis.comparableFilms?.length > 0 && (
        <Section title="Comparable Films">
          <div className="space-y-3">
            {analysis.comparableFilms.map((film, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-black-200">{film.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    film.boxOfficeRelevance === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : film.boxOfficeRelevance === 'failure'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {film.boxOfficeRelevance}
                  </span>
                </div>
                <p className="text-xs text-black-400">{film.similarity}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Standout Scenes */}
      {analysis.standoutScenes?.length > 0 && (
        <Section title="Standout Scenes">
          <div className="space-y-3">
            {analysis.standoutScenes.map((scene, i) => (
              <div key={i}>
                <p className="text-sm text-black-200">{scene.scene}</p>
                <p className="text-xs text-black-400 mt-1 italic">{scene.why}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Target Audience */}
      {analysis.targetAudience && (
        <Section title="Target Audience">
          <div className="space-y-2">
            <p className="text-sm text-black-200">
              {analysis.targetAudience.primaryDemographic}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-black-400">Gender skew:</span>
              <span className="text-xs text-black-300 capitalize">
                {analysis.targetAudience.genderSkew}
              </span>
            </div>
            {analysis.targetAudience.interests?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {analysis.targetAudience.interests.map((interest) => (
                  <span
                    key={interest}
                    className="px-2 py-1 text-xs rounded-md bg-black-700 text-black-300"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Budget Tier */}
      <Section title="Budget Category">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gold-300">
            {budgetTier?.label || analysis.budgetCategory}
          </span>
          {budgetTier?.range && (
            <span className="text-sm text-black-400">{budgetTier.range}</span>
          )}
        </div>
        {analysis.budgetJustification && (
          <p className="text-sm text-black-300 mt-2">{analysis.budgetJustification}</p>
        )}
      </Section>

      {/* Marketability */}
      {analysis.marketability && (
        <Section title="Marketability">
          <span className={`inline-block px-3 py-1 text-sm font-medium rounded-md capitalize ${
            analysis.marketability === 'high'
              ? 'bg-emerald-500/10 text-emerald-400'
              : analysis.marketability === 'low'
                ? 'bg-red-500/10 text-red-400'
                : 'bg-amber-500/10 text-amber-400'
          }`}>
            {analysis.marketability}
          </span>
        </Section>
      )}

      {/* Producer Notes (only if included) */}
      {notes && notes.length > 0 && (
        <Section title="Producer Notes">
          <div className="space-y-4">
            {notes.map((note, i) => (
              <div key={i} className="border-l-2 border-gold-500/20 pl-4">
                <p className="text-sm text-black-200 whitespace-pre-wrap">{note.content}</p>
                <p className="text-xs text-black-500 mt-1">
                  {new Date(note.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
