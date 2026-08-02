import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';

import { fetchReaderReports } from '@/lib/readerReportService';
import type { ReaderReportEvidence, Screenplay } from '@/types';

interface ReaderPersona {
  key: 'structure' | 'character' | 'craft' | 'concept' | 'emotion';
  name: string;
  role: string;
  image: string;
  remit: string;
  matches: string[];
}

const PERSONAS: ReaderPersona[] = [
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
  persona: ReaderPersona,
  reports: ReaderReportEvidence[],
): ReaderReportEvidence | undefined {
  return reports.find((report) => {
    const key = `${report.reader} ${report.label}`.toLowerCase();
    return persona.matches.some((match) => key.includes(match));
  });
}

export function ReaderRoom({ screenplay }: { screenplay: Screenplay }) {
  const [selectedKey, setSelectedKey] = useState<ReaderPersona['key']>('structure');
  const [conversationOpen, setConversationOpen] = useState(false);
  const reportsQuery = useQuery({
    queryKey: [
      'reader-evidence',
      screenplay.projectId ?? screenplay.sourceFile,
      screenplay.latestVersionId ?? 'latest-parent',
    ],
    queryFn: () => fetchReaderReports(screenplay),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const selectedPersona = PERSONAS.find((persona) => persona.key === selectedKey) ?? PERSONAS[0];
  const selectedReport = useMemo(
    () => reportFor(selectedPersona, reportsQuery.data ?? []),
    [reportsQuery.data, selectedPersona],
  );

  return (
    <section className="reader-room" aria-labelledby="reader-room-title">
      <header className="reader-room__intro">
        <div>
          <p className="dsc-kicker">Five specialist lenses · sealed V9 evidence</p>
          <h2 id="reader-room-title" className="dsc-display">The Readers Room</h2>
        </div>
        <p>
          Select a reader to hear their case. Scores and citations below come from the saved analysis, not a new model call.
        </p>
      </header>

      <div className="reader-room__stage">
        <div className="reader-room__rail" aria-label="AI reader personas">
          {PERSONAS.map((persona) => {
            const report = reportFor(persona, reportsQuery.data ?? []);
            const selected = selectedKey === persona.key;
            return (
              <button
                key={persona.key}
                type="button"
                onClick={() => {
                  setSelectedKey(persona.key);
                  setConversationOpen(false);
                }}
                aria-pressed={selected}
                aria-label={`${persona.role}: ${persona.name}`}
                className={clsx('reader-persona', selected && 'reader-persona--active')}
              >
                <img src={persona.image} alt="" />
                <span className="reader-persona__copy">
                  <small>AI persona</small>
                  <strong>{persona.name}</strong>
                  <span>{persona.role}</span>
                </span>
                <b>{report ? report.pillarScore.toFixed(1) : '—'}</b>
              </button>
            );
          })}
        </div>

        <article className="reader-case" aria-live="polite">
          <div className="reader-case__header">
            <img src={selectedPersona.image} alt="" />
            <div>
              <span className="dsc-kicker">{selectedPersona.role} · AI persona</span>
              <h3>{selectedPersona.name}</h3>
              <p>{selectedPersona.remit}</p>
            </div>
            <strong>{selectedReport ? selectedReport.pillarScore.toFixed(1) : '—'}</strong>
          </div>

          {reportsQuery.isPending ? (
            <p className="reader-case__empty">Opening the sealed reader report…</p>
          ) : reportsQuery.isError ? (
            <div className="reader-case__empty" role="alert">
              Reader evidence could not be loaded.
              <button type="button" onClick={() => void reportsQuery.refetch()}>Try again</button>
            </div>
          ) : selectedReport ? (
            <>
              <blockquote>{selectedReport.oneSentenceVerdict || 'No summary verdict was preserved.'}</blockquote>
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
                  <ul>{selectedReport.redFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul>
                </div>
              )}
            </>
          ) : (
            <p className="reader-case__empty">
              This older analysis does not contain a sealed {selectedPersona.role.toLowerCase()} report.
            </p>
          )}

          <button
            type="button"
            className="reader-case__talk"
            onClick={() => setConversationOpen(true)}
            disabled={!selectedReport}
          >
            <span aria-hidden="true">◉</span>
            Talk with {selectedPersona.name.split(' ')[0]}
          </button>
        </article>

        <aside
          className={clsx('reader-conversation', conversationOpen && 'reader-conversation--open')}
          role={conversationOpen ? 'dialog' : undefined}
          aria-label={conversationOpen ? 'Conversation preview' : undefined}
          aria-hidden={!conversationOpen}
        >
          {conversationOpen && selectedReport && (
            <>
              <header>
                <div>
                  <span className="dsc-kicker">No-cost local preview</span>
                  <h3>Conversation with {selectedPersona.name}</h3>
                </div>
                <button type="button" onClick={() => setConversationOpen(false)} aria-label="Close conversation">×</button>
              </header>
              <div className="reader-conversation__notice">
                Gemini Live remains off for local review. No model call has been made and no voice cost has been incurred.
              </div>
              <div className="reader-conversation__transcript">
                <span>{selectedPersona.name}</span>
                <p>{selectedReport.oneSentenceVerdict}</p>
                {selectedReport.subScores[0] && (
                  <p>
                    My strongest evidence is {selectedReport.subScores[0].label.toLowerCase()}: {selectedReport.subScores[0].justification}
                  </p>
                )}
              </div>
              <footer>
                Live questions and spoken answers unlock only after a separate paid voice-call approval.
              </footer>
            </>
          )}
        </aside>
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
