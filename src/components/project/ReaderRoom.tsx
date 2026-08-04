import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';

import { fetchReaderReports } from '@/lib/readerReportService';
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

export function ReaderRoom({ screenplay }: { screenplay: Screenplay }) {
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

  const selectedReader = READERS.find((reader) => reader.key === selectedKey) ?? READERS[0];
  const selectedReport = useMemo(
    () => reportFor(selectedReader, reportsQuery.data ?? []),
    [reportsQuery.data, selectedReader],
  );

  function closeConversation() {
    setConversationOpen(false);
    window.requestAnimationFrame(() => selectedReaderButtonRef.current?.focus());
  }

  return (
    <section className="reader-room" aria-labelledby="reader-room-title">
      <header className="reader-room__intro">
        <div>
          <p className="dsc-kicker">Five specialist lenses · sealed V9 evidence</p>
          <h2 id="reader-room-title" className="dsc-display">
            The Readers Room
          </h2>
        </div>
        <p>
          Select a reader to start a private conversation. Their sealed report stays one click away.
        </p>
      </header>

      <div className="reader-room__stage">
        <div className="reader-room__rail" aria-label="Specialist readers">
          {READERS.map((reader) => {
            const report = reportFor(reader, reportsQuery.data ?? []);
            const selected = selectedKey === reader.key;
            return (
              <button
                key={reader.key}
                ref={selected ? selectedReaderButtonRef : undefined}
                type="button"
                onClick={() => {
                  setSelectedKey(reader.key);
                  setConversationOpen(Boolean(report));
                }}
                aria-pressed={selected}
                aria-label={`${reader.role}: ${reader.name}. ${report ? 'Open private conversation' : 'Sealed report unavailable'}`}
                className={clsx('reader-persona', selected && 'reader-persona--active')}
              >
                <img src={reader.image} alt="" />
                <span className="reader-persona__copy">
                  <strong>{reader.name}</strong>
                  <span>{reader.role}</span>
                </span>
                <b>{report ? report.pillarScore.toFixed(1) : '—'}</b>
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
            readerRole={selectedReader.role}
            readerImage={selectedReader.image}
            report={selectedReport}
          />
        ) : (
          <article className="reader-case" aria-live="polite">
            <div className="reader-case__header">
              <img src={selectedReader.image} alt="" />
              <div>
                <span className="dsc-kicker">{selectedReader.role} · Independent report</span>
                <h3>{selectedReader.name}</h3>
                <p>{selectedReader.remit}</p>
              </div>
              <strong>{selectedReport ? selectedReport.pillarScore.toFixed(1) : '—'}</strong>
            </div>

            {reportsQuery.isPending ? (
              <p className="reader-case__empty">Opening the sealed reader report…</p>
            ) : reportsQuery.isError ? (
              <div className="reader-case__empty" role="alert">
                Reader evidence could not be loaded.
                <button type="button" onClick={() => void reportsQuery.refetch()}>
                  Try again
                </button>
              </div>
            ) : selectedReport ? (
              <>
                <blockquote>
                  {selectedReport.oneSentenceVerdict || 'No summary verdict was preserved.'}
                </blockquote>
                <div className="reader-case__evidence">
                  {selectedReport.subScores.map((subScore) => (
                    <section key={subScore.key}>
                      <header>
                        <h4>{subScore.label}</h4>
                        <strong>{subScore.score.toFixed(1)}</strong>
                      </header>
                      <p>{subScore.justification || 'No written evidence was preserved.'}</p>
                      {subScore.pageCitations.length > 0 && (
                        <span>Pages {subScore.pageCitations.join(', ')}</span>
                      )}
                    </section>
                  ))}
                </div>
                {selectedReport.redFlags.length > 0 && (
                  <div className="reader-case__flags">
                    <span>Watch points</span>
                    <ul>
                      {selectedReport.redFlags.map((flag) => (
                        <li key={flag}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="reader-case__empty">
                This older analysis does not contain a sealed {selectedReader.role.toLowerCase()}{' '}
                report.
              </p>
            )}

            <button
              type="button"
              className="reader-case__talk"
              onClick={() => setConversationOpen(true)}
              disabled={!selectedReport}
            >
              <span aria-hidden="true">◉</span>
              Talk privately with {selectedReader.name.split(' ')[0]}
            </button>
          </article>
        )}
      </div>

      {screenplay.readerDisagreements && screenplay.readerDisagreements.length > 0 && (
        <section className="reader-room__roundtable" aria-label="Roundtable disagreements">
          <span className="dsc-kicker">Roundtable disagreements</span>
          <div>
            {screenplay.readerDisagreements.map((disagreement, index) => (
              <article key={`${disagreement.topic}-${index}`}>
                <h3>{disagreement.topic}</h3>
                <p>{disagreement.resolution || 'No resolution was preserved.'}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
