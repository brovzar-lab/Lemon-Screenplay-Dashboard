const assert = require('node:assert/strict');
const test = require('node:test');

const {
  READER_CHARTER_VERSION,
  READER_REPLY_TOOL,
  buildConversationHistory,
  buildReaderSystemPrompt,
  conversationId,
  loadReaderCharter,
  parseReaderReply,
  readerReportFromVersion,
  screenplayStoragePointer,
} = require('../lib/readerChatCore');
const { READER_CHAT_MODEL } = require('../lib/modelRegistry');

function version() {
  return {
    project_id: 'will-2010',
    version_id: 'sealed-v1',
    storage_path: 'gs://lemon-bucket/screenplays/will/versions/sealed-v1.pdf',
    storage_generation: '1234',
    analysis: {
      title: 'WILL 2010',
      verdict: 'PASS',
      reader_reports: {
        structure: { pillar_score: 5.2, one_sentence_verdict: 'The ending is late.' },
        character: { pillar_score: 4.4 },
        craft_scene: { pillar_score: 6.2 },
        concept: { pillar_score: 6.5 },
        emotional_resonance: { pillar_score: 5.0 },
      },
    },
  };
}

test('all five readers have versioned charters and stable private identities', () => {
  for (const reader of ['structure', 'character', 'craft', 'concept', 'emotion']) {
    const charter = loadReaderCharter(reader);
    assert.equal(charter.version, READER_CHARTER_VERSION);
    assert.match(charter.text, /sealed report/i);
    assert.equal(charter.sha256.length, 64);
  }
  assert.equal(
    conversationId({ uid: 'billy', projectId: 'will', versionId: 'v1', reader: 'structure' }),
    conversationId({ uid: 'billy', projectId: 'will', versionId: 'v1', reader: 'structure' }),
  );
  assert.notEqual(
    conversationId({ uid: 'billy', projectId: 'will', versionId: 'v1', reader: 'structure' }),
    conversationId({ uid: 'billy', projectId: 'will', versionId: 'v1', reader: 'character' }),
  );
});

test('reader conversations bind the exact report and exact PDF object', () => {
  const source = version();
  assert.equal(readerReportFromVersion(source, 'craft').pillar_score, 6.2);
  assert.deepEqual(screenplayStoragePointer(source), {
    bucket: 'lemon-bucket',
    objectName: 'screenplays/will/versions/sealed-v1.pdf',
    generation: '1234',
  });
  const charter = loadReaderCharter('structure');
  const prompt = buildReaderSystemPrompt({
    reader: 'structure',
    charter: charter.text,
    charterSha256: charter.sha256,
    sealedReport: readerReportFromVersion(source, 'structure'),
    sharedSynthesis: { verdict: 'PASS' },
    projectId: 'will-2010',
    versionId: 'sealed-v1',
    title: 'WILL 2010',
  });
  assert.equal(READER_CHAT_MODEL, 'claude-opus-5');
  assert.match(prompt, /SEALED VERSION ID: sealed-v1/);
  assert.match(prompt, /Never claim that this conversation edits it/i);
  assert.match(prompt, /untrusted evidence/i);
  assert.equal(READER_REPLY_TOOL.name, 'reader_private_reply');
});

test('PDF provenance rejects a malformed storage generation', () => {
  const source = version();
  source.storage_generation = 'latest';
  assert.throws(
    () => screenplayStoragePointer(source),
    /storage generation is malformed/,
  );
});

test('strict replies preserve citations and isolate a reconsidered position', () => {
  const reply = parseReaderReply({
    answer: 'I underweighted the comic escalation on pages 35 and 41.',
    citations: [
      { page: 35, note: 'The second reversal compounds the joke.' },
      { page: 41, note: 'The payoff changes the dramatic situation.' },
    ],
    position: 'reconsidered',
    reconsidered_position: {
      summary: 'The structure is more active than my sealed report allowed.',
      suggested_score: 6.4,
    },
  }, 110);

  assert.equal(reply.position, 'reconsidered');
  assert.equal(reply.reconsideredPosition.suggestedScore, 6.4);
  assert.deepEqual(reply.citations.map((citation) => citation.page), [35, 41]);
  assert.throws(() => parseReaderReply({
    answer: 'Unsupported.',
    citations: [{ page: 999, note: 'Not in the script.' }],
    position: 'unchanged',
  }, 110), /invalid page citation/);
});

test('conversation history keeps producer and reader voices distinct', () => {
  const history = buildConversationHistory([
    { role: 'producer', text: 'Why did you pass?', citations: [] },
    {
      role: 'reader',
      text: 'The ending lacked a final choice.',
      citations: [{ page: 98, note: 'Climax.' }],
      position: 'clarified',
    },
  ]);
  assert.match(history, /PRODUCER: Why did you pass/);
  assert.match(history, /READER: The ending lacked a final choice\. \[pages 98\]/);
});
