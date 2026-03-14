/**
 * SharedViewLayout
 *
 * Full standalone page layout for the shared partner view.
 * Displays branding, poster, title, recommendation, scores,
 * analysis content, and download button.
 *
 * BUNDLE ISOLATION: Only imports from @/types, @/components/ui,
 * @/components/share (siblings), and @/lib/shareService (types).
 */

import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { SharedScoresPanel } from './SharedScoresPanel';
import { SharedContentDetails } from './SharedContentDetails';
import type { SharedViewDocument } from '@/lib/shareService';

interface SharedViewLayoutProps {
  data: SharedViewDocument;
}

export function SharedViewLayout({ data }: SharedViewLayoutProps) {
  const { analysis } = data;

  return (
    <div className="min-h-screen bg-black-900">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header with logo */}
        <header className="flex items-center justify-center mb-8">
          <img
            src="/lemon-logo.png"
            alt="Lemon Studios"
            className="h-8 w-8"
          />
        </header>

        {/* Poster */}
        {data.posterUrl && (
          <div className="flex justify-center mb-8">
            <img
              src={data.posterUrl}
              alt={`${analysis.title} poster`}
              className="rounded-xl max-h-80 object-cover shadow-lg"
            />
          </div>
        )}

        {/* Title / Author / Genre bar */}
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-gold-200 mb-2">
            {analysis.title}
          </h1>
          <p className="text-lg text-black-300">
            {analysis.author}
          </p>
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            <span className="px-3 py-1 text-sm rounded-md bg-black-800 text-black-300 border border-black-700">
              {analysis.genre}
            </span>
            {analysis.subgenres?.map((sg) => (
              <span
                key={sg}
                className="px-2 py-1 text-xs rounded-md bg-black-800 text-black-400 border border-black-700"
              >
                {sg}
              </span>
            ))}
            {analysis.tone && (
              <span className="px-2 py-1 text-xs rounded-md bg-black-800 text-black-400 border border-black-700">
                {analysis.tone}
              </span>
            )}
          </div>
        </div>

        {/* Recommendation Badge */}
        <div className="flex justify-center mb-6">
          <RecommendationBadge tier={analysis.recommendation} size="lg" />
        </div>

        {/* Verdict Statement */}
        {analysis.verdictStatement && (
          <blockquote className="bg-black-800 border-l-4 border-gold-500/30 rounded-r-xl p-5 mb-8 text-black-200 italic text-sm sm:text-base">
            {analysis.verdictStatement}
          </blockquote>
        )}

        {/* Download Script button */}
        {data.pdfUrl && (
          <div className="flex justify-center mb-8">
            <button
              type="button"
              onClick={() => window.open(data.pdfUrl!, '_blank')}
              className="px-6 py-3 bg-gold-500 hover:bg-gold-400 text-black-900 font-semibold rounded-lg transition-colors"
            >
              Download Script
            </button>
          </div>
        )}

        {/* Scores */}
        <div className="mb-8">
          <SharedScoresPanel analysis={analysis} />
        </div>

        {/* Content Details */}
        <SharedContentDetails
          analysis={analysis}
          notes={data.notes}
        />

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-black-700 text-center">
          <p className="text-xs text-black-500">Lemon Studios</p>
        </footer>
      </div>
    </div>
  );
}
