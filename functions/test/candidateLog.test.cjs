const assert = require('node:assert/strict');
const test = require('node:test');

const { sanitizeCandidateLog } = require('../lib/candidateLog');

test('candidate logs discard prompts, screenplay details, outputs, credentials, and errors', () => {
  const safe = sanitizeCandidateLog({
    event: 'failed',
    call_id: 'call',
    prompt: 'secret prompt',
    screenplay_text: 'FADE IN',
    title: 'Secret Title',
    filename: 'secret.pdf',
    output: 'model output',
    authorization: 'Bearer secret',
    error: 'provider echoed body',
    usage: { input_tokens: 1, hidden: 2 },
    release: { git_sha: 'a'.repeat(40), secret: 'nope' },
  });
  assert.deepEqual(safe, {
    event: 'failed',
    call_id: 'call',
    usage: { input_tokens: 1 },
    release: { git_sha: 'a'.repeat(40) },
  });
});
