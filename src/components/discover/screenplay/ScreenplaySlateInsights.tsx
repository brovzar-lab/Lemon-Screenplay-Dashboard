import { lazy, Suspense, useState, type ComponentType } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { Screenplay } from '@/types';

interface AnalyticsProps {
  screenplays: Screenplay[];
  totalScreenplays?: Screenplay[];
  title?: string;
  initiallyExpanded?: boolean;
  deferContentUntilExpanded?: boolean;
  className?: string;
  maxGenres?: number;
}

const LazyAnalyticsDashboard = lazy(async () => {
  const module = await import('@/components/charts/AnalyticsDashboard');
  return { default: module.AnalyticsDashboard };
});

interface ScreenplaySlateInsightsProps {
  screenplays: Screenplay[];
  allScreenplays: Screenplay[];
  AnalyticsComponent?: ComponentType<AnalyticsProps>;
}

export function ScreenplaySlateInsights({
  screenplays,
  allScreenplays,
  AnalyticsComponent = LazyAnalyticsDashboard,
}: ScreenplaySlateInsightsProps) {
  const [requested, setRequested] = useState(false);

  if (!requested) {
    return (
      <section className="screenplay-insights screenplay-insights--collapsed">
        <button
          type="button"
          onClick={() => setRequested(true)}
          aria-expanded="false"
          aria-label="Show Slate Insights"
        >
          <span>
            <strong>Slate Insights</strong>
            <small>Score distribution · verdict mix · top genres · slate composition</small>
          </span>
          <span aria-hidden="true">Show</span>
          <span className="sr-only">Show Slate Insights</span>
        </button>
      </section>
    );
  }

  return (
    <section className="screenplay-insights">
      <ErrorBoundary
        fallback={
          <p role="status" className="screenplay-insights__error">
            Slate Insights are temporarily unavailable. Your screenplay results are unaffected.
          </p>
        }
      >
        <Suspense fallback={<p role="status">Opening Slate Insights…</p>}>
          <AnalyticsComponent
            screenplays={screenplays}
            totalScreenplays={allScreenplays}
            title="Slate Insights"
            initiallyExpanded
            deferContentUntilExpanded
            className="screenplay-insights__dashboard"
            maxGenres={4}
          />
        </Suspense>
      </ErrorBoundary>
    </section>
  );
}
