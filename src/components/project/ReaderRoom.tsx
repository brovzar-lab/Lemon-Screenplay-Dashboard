import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

import { fetchReaderReports } from '@/lib/readerReportService';
import { privateReaderChatMode } from '@/lib/privateReaderChat';
import { localizedReaderReports, savedLocalizedAnalysis } from '@/lib/localizedAnalysis';
import { formatProducerHeading, formatProducerText, formatProducerTaxonomy } from '@/lib/producerDisplay';
import { PrivateReaderChat } from '@/components/project/PrivateReaderChat';
import type { ReaderReportEvidence, Screenplay } from '@/types';

interface ReaderProfile {
  key: 'structure' | 'character' | 'craft' | 'concept' | 'emotion';
  name: string;
  role: string;
  image: string;
  remit: string;
  matches: string[];
}

interface ReaderChatReadiness {
  ready: boolean;
  label: string;
  detail: string;
}

const READERS: ReaderProfile[] = [
  {
    key: 'structure',
    name: 'Lena Park',
    role: 'Structure Reader',
    image: '/reader-personas/structure.jpg',
    remit: 'Turns, escalation, causality, and the ending.',
    matches: ['structure'],
  },
  {
    key: 'character',
    name: 'Marcus Reed',
    role: 'Character Reader',
    image: '/reader-personas/character.jpg',
    remit: 'Agency, relationships, contradiction, and change.',
    matches: ['character'],
  },
  {
    key: 'craft',
    name: 'Sofía Navarro',
    role: 'Craft Reader',
    image: '/reader-personas/craft.jpg',
    remit: 'Scene construction, dialogue, pace, and execution.',
    matches: ['craft', 'scene'],
  },
  {
    key: 'concept',
    name: 'Julian Vale',
    role: 'Concept Reader',
    image: '/reader-personas/concept.jpg',
    remit: 'Premise, originality, genre promise, and market clarity.',
    matches: ['concept'],
  },
  {
    key: 'emotion',
    name: 'Priya Shah',
    role: 'Emotion Reader',
    image: '/reader-personas/emotion.jpg',
    remit: 'Feeling, audience identification, resonance, and payoff.',
    matches: ['emotion'],
  },
];

function reportFor(
  persona: ReaderProfile,
  reports: ReaderReportEvidence[],
): ReaderReportEvidence | undefined {
  return reports.find((report) => {
    const key = `${report.reader} ${report.label}`.toLowerCase();
    return persona.matches.some((match) => key.includes(match));
  });
}

function readerChatReadiness(
  screenplay: Screenplay,
  report: ReaderReportEvidence | undefined,
  mode: ReturnType<typeof privateReaderChatMode>,
): ReaderChatReadiness {
  if (!screenplay.latestVersionId) {
    return {
      ready: false,
      label: 'Current sealed analysis required',
      detail: 'Reanalyze this legacy record so the conversation can cite the exact screenplay version.',
    };
  }
  if (!report) {
    return {
      ready: false,
      label: 'Reader report unavailable',
      detail: 'This analysis does not contain this reader’s sealed independent report.',
    };
  }
  if (mode === 'not_activated') {
    return {
      ready: false,
      label: 'Private chat not activated',
      detail: 'The sealed report is available, but private conversations are not enabled here.',
    };
  }
  if (mode === 'live' && (!screenplay.hasPdf || !screenplay.storagePath)) {
    return {
      ready: false,
      label: 'Source screenplay required',
      detail: 'Restore the source PDF before starting a live, project-grounded conversation.',
    };
  }
  return mode === 'local_review'
    ? {
        ready: true,
        label: 'Local preview ready',
        detail: 'Uses the sealed report to demonstrate the flow. No model call or charge occurs.',
      }
    : {
        ready: true,
        label: 'Ready for private conversation',
        detail: 'The sealed report, analysis version, and source screenplay are available.',
      };
}

export function ReaderRoom({ screenplay }: { screenplay: Screenplay }) {
  const { t, i18n } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<ReaderProfile['key']>('structure');
  const [conversationOpen, setConversationOpen] = useState(false);
  const selectedReaderButtonRef = useRef<HTMLButtonElement>(null);
  const reportsQuery = useQuery({
    queryKey: [
      'reader-evidence',
      screenplay.projectId ?? screenplay.sourceFile,
      screenplay.latestVersionId ?? 'latest-parent',
    ],
    queryFn: () => fetchReaderReports(screenplay),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const localizedContent = savedLocalizedAnalysis(
    screenplay,
    i18n.resolvedLanguage === 'es' ? 'es' : 'en',
  )?.content;
  const reports = localizedReaderReports(reportsQuery.data ?? [], localizedContent);

  const selectedReader = READERS.find((reader) => reader.key === selectedKey) ?? READERS[0];
  const selectedReport = useMemo(
    () => reportFor(selectedReader, reports),
    [reports, selectedReader],
  );
  const chatMode = privateReaderChatMode();
  const hasExactVersion = Boolean(screenplay.latestVersionId);
  const readiness = readerChatReadiness(screenplay, selectedReport, chatMode);
  const canOpenConversation = readiness.ready;
  const chatIntro = !hasExactVersion
    ? t('This legacy record preserves its roundtable evidence, but it needs a current sealed analysis before private conversations can cite the screenplay.')
    : chatMode === 'live'
    ? t('Select a reader to start a private conversation. Their sealed report stays one click away.')
    : chatMode === 'local_review'
      ? t('Select a reader to preview the conversation flow. Local review uses sealed evidence and makes no model call.')
      : t('Read each sealed report here. Private Reader Chat is not activated in this environment.');

  function talkButtonLabel(): string {
    const firstName = selectedReader.name.split(' ')[0];
    if (!hasExactVersion) return t('Reanalyze to create a citable analysis version');
    if (!selectedReport) return t('Reanalyze for {{role}} chat', { role: t(selectedReader.role) });
    if (chatMode === 'live' && (!screenplay.hasPdf || !screenplay.storagePath)) {
      return t('Restore source screenplay to chat');
    }
    if (chatMode === 'not_activated') return t('Private Reader Chat not activated');
    if (chatMode === 'local_review') return t('Preview conversation with {{name}}', { name: firstName });
    return t('Talk privately with {{name}}', { name: firstName });
  }

  function closeConversation() {
    setConversationOpen(false);
    window.requestAnimationFrame(() => selectedReaderButtonRef.current?.focus());
  }

  return (
    <section className="reader-room" aria-labelledby="reader-room-title">
      <header className="reader-room__intro">
        <div>
          <p className="dsc-kicker">
            {t(hasExactVersion ? 'Five specialist lenses · sealed V9 evidence' : 'Legacy reader evidence · preserved for review')}
          </p>
          <h2 id="reader-room-title" className="dsc-display">
            {t('The Readers Room')}
          </h2>
        </div>
        <p>{chatIntro}</p>
      </header>

      <div className="reader-room__stage">
        <div className="reader-room__rail" aria-label={t('Specialist readers')}>
          {READERS.map((reader) => {
            const report = reportFor(reader, reports);
            const selected = selectedKey === reader.key;
            const readerReadiness = readerChatReadiness(screenplay, report, chatMode);
            return (
              <button
                key={reader.key}
                ref={selected ? selectedReaderButtonRef : undefined}
                type="button"
                onClick={() => {
                  setSelectedKey(reader.key);
                  setConversationOpen(readerReadiness.ready);
                }}
                aria-pressed={selected}
                aria-label={`${t(reader.role)}: ${reader.name}. ${t(readerReadiness.label)}`}
                className={clsx('reader-persona', selected && 'reader-persona--active')}
              >
                <img src={reader.image} alt="" />
                <span className="reader-persona__copy">
                  <strong>{reader.name}</strong>
                  <span>{t(reader.role)}</span>
                </span>
                <b>{report ? report.pillarScore.toFixed(1) : '—'}</b>
                <small>{t(readerReadiness.ready ? 'Chat ready' : 'Report only')}</small>
              </button>
            );
          })}
        </div>

        {conversationOpen && selectedReport ? (
          <PrivateReaderChat
            key={selectedReader.key}
            open
            onClose={closeConversation}
            projectId={screenplay.projectId ?? screenplay.id}
            versionId={screenplay.latestVersionId ?? 'latest-parent'}
            reader={selectedReader.key}
            readerName={selectedReader.name}
            readerRole={t(selectedReader.role)}
            readerImage={selectedReader.image}
            report={selectedReport}
          />
        ) : (
          <article className="reader-case" aria-live="polite">
            <div className="reader-case__header">
              <img src={selectedReader.image} alt="" />
              <div>
                <span className="dsc-kicker">{t(selectedReader.role)} · {t('Independent report')}</span>
                <h3>{selectedReader.name}</h3>
                <p>{t(selectedReader.remit)}</p>
              </div>
              <strong>{selectedReport ? selectedReport.pillarScore.toFixed(1) : '—'}</strong>
            </div>

            <div
              className={clsx(
                'reader-case__readiness',
                readiness.ready && 'reader-case__readiness--ready',
              )}
              role="status"
            >
              <strong>{t(readiness.label)}</strong>
              <span>{t(readiness.detail)}</span>
            </div>

            {reportsQuery.isPending ? (
              <p className="reader-case__empty">{t('Opening the sealed reader report…')}</p>
            ) : reportsQuery.isError ? (
              <div className="reader-case__empty" role="alert">
                {t('Reader evidence could not be loaded.')}
                <button type="button" onClick={() => void reportsQuery.refetch()}>
                  {t('Try again')}
                </button>
              </div>
            ) : selectedReport ? (
              <>
                <blockquote>
                  {selectedReport.oneSentenceVerdict ? formatProducerText(selectedReport.oneSentenceVerdict) : t('No summary verdict was preserved.')}
                </blockquote>
                <div className="reader-case__evidence">
                  {selectedReport.subScores.map((subScore) => (
                    <section key={subScore.key}>
                      <header>
                        <h4>{formatProducerTaxonomy(subScore.label)}</h4>
                        <strong>{subScore.score.toFixed(1)}</strong>
                      </header>
                      <p>{subScore.justification ? formatProducerText(subScore.justification) : t('No written evidence was preserved.')}</p>
                      {subScore.pageCitations.length > 0 && (
                        <span>{t('Pages {{pages}}', { pages: subScore.pageCitations.join(', ') })}</span>
                      )}
                    </section>
                  ))}
                </div>
                {selectedReport.redFlags.length > 0 && (
                  <div className="reader-case__flags">
                    <span>{t('Watch points')}</span>
                    <ul>
                      {selectedReport.redFlags.map((flag) => (
                        <li key={flag}>{formatProducerText(flag)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : !hasExactVersion ? (
              <p className="reader-case__empty">
                {t('This project needs a current sealed analysis version before a private conversation can cite the correct screenplay evidence.')}
              </p>
            ) : (
              <p className="reader-case__empty">
                {t('This older analysis does not contain a sealed {{role}} report.', { role: t(selectedReader.role).toLocaleLowerCase() })}
              </p>
            )}

            <button
              type="button"
              className="reader-case__talk"
              onClick={() => setConversationOpen(true)}
              disabled={!canOpenConversation}
            >
              <span aria-hidden="true">◉</span>
              {talkButtonLabel()}
            </button>
          </article>
        )}
      </div>

      {screenplay.readerDisagreements && screenplay.readerDisagreements.length > 0 && (
        <section className="reader-room__roundtable" aria-label={t('Roundtable disagreements')}>
          <span className="dsc-kicker">{t('Roundtable disagreements')}</span>
          <div>
            {screenplay.readerDisagreements.map((disagreement, index) => (
              <article key={`${disagreement.topic}-${index}`}>
                <h3>{formatProducerHeading(disagreement.topic)}</h3>
                <div className="reader-room__positions">
                  <section>
                    <strong>{formatProducerHeading(disagreement.readerA)}</strong>
                    <p>{formatProducerText(disagreement.readerAPosition)}</p>
                  </section>
                  <section>
                    <strong>{formatProducerHeading(disagreement.readerB)}</strong>
                    <p>{formatProducerText(disagreement.readerBPosition)}</p>
                  </section>
                </div>
                <div className="reader-room__resolution">
                  <strong>{t('Roundtable resolution')}</strong>
                  <p>{disagreement.resolution ? formatProducerText(disagreement.resolution) : t('No resolution was preserved.')}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
