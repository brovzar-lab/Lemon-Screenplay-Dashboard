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
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

const INSIGHTS_COLLAPSED_KEY = 'lemon:discovery:slate-insights-collapsed';

function loadExpandedPreference(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(INSIGHTS_COLLAPSED_KEY) !== 'true';
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
  const [expanded, setExpanded] = useState(loadExpandedPreference);

  const handleExpandedChange = (next: boolean) => {
    setExpanded(next);
    window.localStorage.setItem(INSIGHTS_COLLAPSED_KEY, String(!next));
  };

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
            expanded={expanded}
            onExpandedChange={handleExpandedChange}
            className="screenplay-insights__dashboard"
            maxGenres={4}
          />
        </Suspense>
      </ErrorBoundary>
    </section>
  );
}
