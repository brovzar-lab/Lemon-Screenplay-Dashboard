import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreenplays } from '@/hooks/useScreenplays';
import { DEFAULT_FEATURED_POLICY, selectFeaturedProject } from '@/lib/featuredProject';
import { loadFeaturedEngagements, loadFeaturedPolicy, saveFeaturedPolicy } from '@/lib/featuredProjectSettings';
import {
  getScreenplayDisplayTitle,
  getScreenplayFormatInfo,
} from '@/lib/screenplayDisplay';
import { useIsAdmin } from '@/stores/authStore';
import { RECOMMENDATION_CONFIG } from '@/types';
import type { FeaturedPolicy, RecommendationTier } from '@/types';

const PRIORITIES: Array<{ value: FeaturedPolicy['priorityMode']; label: string; detail: string }> = [
  { value: 'highest_overall', label: 'Highest overall score', detail: 'Best final score among eligible projects.' },
  { value: 'strongest_structure', label: 'Strongest structure', detail: 'Prioritizes narrative mechanics and execution.' },
  { value: 'most_commercial', label: 'Most commercial', detail: 'Uses market potential, CVS, then final score.' },
  { value: 'fastest_read', label: 'Fastest qualifying read', detail: 'Shortest project above the minimum score.' },
  { value: 'development_opportunity', label: 'Development opportunity', detail: 'Prioritizes upside and fixability.' },
];

const VERDICTS: RecommendationTier[] = ['film_now', 'recommend', 'consider'];

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function humanizeOption(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function OptionGroup({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useTranslation();
  if (values.length === 0) return null;
  return (
    <fieldset className="featured-policy__options">
      <legend>{t(label)}</legend>
      <div>
        {values.map((value) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => onChange(toggleValue(selected, value))}
            />
            <span>{humanizeOption(value)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FeaturedProjectPanel() {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { data: screenplays = [], isLoading } = useScreenplays();
  const [policy, setPolicy] = useState<FeaturedPolicy>(() => loadFeaturedPolicy());
  const [saved, setSaved] = useState(false);
  const producerLookIds = useMemo(
    () =>
      new Set(
        screenplays
          .filter((screenplay) => screenplay.developmentOpportunity?.requiresProducerLook)
          .map((screenplay) => screenplay.projectId ?? screenplay.id),
      ),
    [screenplays],
  );
  const selection = useMemo(
    () =>
      selectFeaturedProject(screenplays, policy, {
        producerLookIds,
        engagements: loadFeaturedEngagements(),
      }),
    [policy, producerLookIds, screenplays],
  );

  const featuredDetail = (() => {
    const screenplay = selection.screenplay;
    if (!screenplay) return t('The current studio policy excludes every project in the slate.');
    if (selection.reason.code === 'manual_pin') {
      return t('This project remains Featured until an administrator removes the pin.');
    }
    if (selection.reason.code === 'dust_resurfacing') {
      return t('It clears the {{score}} minimum and has not been opened within {{count}} days.', {
        score: policy.dustMinimumScore.toFixed(1),
        count: policy.dustDays,
      });
    }
    let detail: string;
    if (policy.priorityMode === 'strongest_structure') {
      detail = t('Its structure score of {{score}} leads today’s eligible slate.', {
        score: screenplay.dimensionScores.structure.toFixed(1),
      });
    } else if (policy.priorityMode === 'most_commercial') {
      detail = t('Market potential, commercial viability, and final score place it first under the studio policy.');
    } else if (policy.priorityMode === 'fastest_read') {
      detail = Number.isFinite(screenplay.metadata.pageCount) && screenplay.metadata.pageCount > 0
        ? t('At {{count}} pages, it is the shortest eligible project above the required score.', { count: screenplay.metadata.pageCount })
        : t('It is the shortest eligible project with a recorded page count above the required score.');
    } else if (policy.priorityMode === 'development_opportunity') {
      detail = screenplay.developmentOpportunity?.rationale ?? t('Its upside and fixability make it the most useful project to review now.');
    } else {
      detail = t('Its {{score}} final score leads the projects allowed by today’s studio policy.', {
        score: (screenplay.producerProjection?.finalScore ?? screenplay.weightedScore).toFixed(1),
      });
    }
    if (selection.reason.mandateFallback) return `${t('No current mandate match.')} ${detail}`;
    if (selection.reason.invalidPin) return `${t('The pinned project is unavailable.')} ${detail}`;
    return detail;
  })();
  const options = useMemo(() => {
    const unique = (values: Array<string | undefined>) =>
      [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
    return {
      genres: unique(screenplays.map((screenplay) => screenplay.genre)),
      themes: unique(screenplays.flatMap((screenplay) => screenplay.themes)),
      formats: unique(screenplays.map((screenplay) => getScreenplayFormatInfo(screenplay).format)),
      categories: unique(screenplays.map((screenplay) => screenplay.category)),
    };
  }, [screenplays]);

  const update = <Key extends keyof FeaturedPolicy>(key: Key, value: FeaturedPolicy[Key]) => {
    setSaved(false);
    setPolicy((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    saveFeaturedPolicy(policy);
    setSaved(true);
  };

  return (
    <div className="featured-policy">
      <header className="featured-policy__intro">
        <div>
          <p className="settings-eyebrow">{t('Daily development desk')}</p>
          <h2>{t('Choose what deserves attention today')}</h2>
          <p>
            {t('Featured uses analysis already stored in the slate. It never rescores a project and never makes a paid model call when you sign in.')}
          </p>
        </div>
        <span className="featured-policy__preview-label">{t('Local preview only')}</span>
      </header>

      <fieldset disabled={!isAdmin || isLoading} className="featured-policy__controls">
        <section>
          <h3>{t('Eligibility')}</h3>
          <p>{t('Set the decision range the studio wants considered.')}</p>
          <div className="featured-policy__verdicts">
            {VERDICTS.map((tier) => (
              <label key={tier} data-verdict={tier}>
                <input
                  type="checkbox"
                  checked={policy.eligibleVerdicts.includes(tier)}
                  onChange={() =>
                    update('eligibleVerdicts', toggleValue(policy.eligibleVerdicts, tier) as RecommendationTier[])
                  }
                />
                <span>{t(RECOMMENDATION_CONFIG[tier].label)}</span>
              </label>
            ))}
          </div>
          <label className="featured-policy__switch">
            <input
              type="checkbox"
              checked={policy.includeProducerLookPass}
              onChange={(event) => update('includeProducerLookPass', event.target.checked)}
            />
            <span><strong>{t('Include Producer Look passes')}</strong><small>{t('Only Pass projects explicitly routed for producer review qualify.')}</small></span>
          </label>
          <label className="featured-policy__switch">
            <input
              type="checkbox"
              checked={policy.excludeProduced}
              onChange={(event) => update('excludeProduced', event.target.checked)}
            />
            <span><strong>{t('Exclude produced projects')}</strong></span>
          </label>
          <label className="featured-policy__switch">
            <input
              type="checkbox"
              checked={policy.excludeIncomplete}
              onChange={(event) => update('excludeIncomplete', event.target.checked)}
            />
            <span><strong>{t('Exclude incomplete analyses')}</strong></span>
          </label>
        </section>

        <section>
          <h3>{t('Priority')}</h3>
          <label className="featured-policy__field">
            <span>{t('What matters most')}</span>
            <select
              value={policy.priorityMode}
              onChange={(event) => update('priorityMode', event.target.value as FeaturedPolicy['priorityMode'])}
            >
              {PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{t(priority.label)}</option>)}
            </select>
            <small>{t(PRIORITIES.find((priority) => priority.value === policy.priorityMode)?.detail ?? '')}</small>
          </label>
          {policy.priorityMode === 'fastest_read' && (
            <label className="featured-policy__field">
              <span>{t('Minimum final score')}</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={policy.fastestReadMinimumScore}
                onChange={(event) => update('fastestReadMinimumScore', Number(event.target.value))}
              />
            </label>
          )}
        </section>

        <section>
          <h3>{t('Dust resurfacing')}</h3>
          <label className="featured-policy__switch">
            <input
              type="checkbox"
              checked={policy.dustEnabled}
              onChange={(event) => update('dustEnabled', event.target.checked)}
            />
            <span><strong>{t('Resurface overlooked projects')}</strong><small>{t('Bring strong material back after it has gone unopened.')}</small></span>
          </label>
          {policy.dustEnabled && (
            <div className="featured-policy__two-up">
              <label className="featured-policy__field">
                <span>{t('Unopened for')}</span>
                <select value={policy.dustDays} onChange={(event) => update('dustDays', Number(event.target.value) as 30 | 60 | 90)}>
                  <option value="30">{t('{{count}} days', { count: 30 })}</option><option value="60">{t('{{count}} days', { count: 60 })}</option><option value="90">{t('{{count}} days', { count: 90 })}</option>
                </select>
              </label>
              <label className="featured-policy__field">
                <span>{t('Minimum score')}</span>
                <input type="number" min="0" max="10" step="0.1" value={policy.dustMinimumScore} onChange={(event) => update('dustMinimumScore', Number(event.target.value))} />
              </label>
            </div>
          )}
        </section>

        <section className="featured-policy__mandates">
          <h3>{t('Current studio mandate')}</h3>
          <p>{t('Leave a group empty to allow every option in that group.')}</p>
          <OptionGroup label="Genre" values={options.genres} selected={policy.mandateGenres} onChange={(values) => update('mandateGenres', values)} />
          <OptionGroup label="Theme" values={options.themes} selected={policy.mandateThemes} onChange={(values) => update('mandateThemes', values)} />
          <OptionGroup label="Format" values={options.formats} selected={policy.mandateFormats} onChange={(values) => update('mandateFormats', values)} />
          <OptionGroup label="Category" values={options.categories} selected={policy.mandateCategories} onChange={(values) => update('mandateCategories', values)} />
        </section>

        <section>
          <h3>{t('Manual pin')}</h3>
          <label className="featured-policy__field">
            <span>{t('Keep one project Featured')}</span>
            <select value={policy.pinnedProjectId ?? ''} onChange={(event) => update('pinnedProjectId', event.target.value || null)}>
              <option value="">{t('No pinned project')}</option>
              {screenplays.map((screenplay) => (
                <option key={screenplay.id} value={screenplay.projectId ?? screenplay.id}>
                  {getScreenplayDisplayTitle(screenplay.title).title}
                </option>
              ))}
            </select>
          </label>
        </section>
      </fieldset>

      <section className="featured-policy__preview" aria-live="polite">
        <p className="settings-eyebrow">{t('Today’s Featured preview')}</p>
        {selection.screenplay ? (
          <>
            <h3>{getScreenplayDisplayTitle(selection.screenplay.title).title}</h3>
            <strong>{t(selection.reason.headline)}</strong>
            <p>{featuredDetail}</p>
            {selection.reason.invalidPin && <p className="featured-policy__warning">{t('The pinned project is unavailable, so the policy fell back safely.')}</p>}
          </>
        ) : (
          <><h3>{t('No eligible project')}</h3><p>{featuredDetail}</p></>
        )}
      </section>

      <footer className="featured-policy__footer">
        {!isAdmin && <p>{t('Only an administrator can change the studio Featured policy.')}</p>}
        <button type="button" onClick={() => { setPolicy(DEFAULT_FEATURED_POLICY); setSaved(false); }} disabled={!isAdmin}>{t('Restore defaults')}</button>
        <button type="button" onClick={save} disabled={!isAdmin}>{t(saved ? 'Preview saved' : 'Save local preview')}</button>
      </footer>
    </div>
  );
}
