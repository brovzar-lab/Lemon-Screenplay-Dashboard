const assert = require('node:assert/strict');
const test = require('node:test');

const {
  deriveBenchmarkCallId,
  validateBenchmarkContract,
} = require('../lib/benchmarkCandidatePolicy');

const sha = (char) => char.repeat(64);

function contract(overrides = {}) {
  const base = {
    run_id: 'smoke-20260821',
    screenplay_sha256: sha('a'),
    route: 'sonnet',
    generation: 'candidate',
    pipeline_stage: 'reader',
    reader_name: 'structure',
    retry_number: 0,
    boundary_run: 1,
    prompt_bundle_sha256: sha('b'),
    structured_output_schema_sha256: sha('c'),
    request_sha256: sha('d'),
    requested_model: 'claude-sonnet-5',
    ...overrides,
  };
  return { ...base, call_id: deriveBenchmarkCallId(base) };
}

test('candidate routes accept only the exact old or candidate generation model', () => {
  const valid = contract();
  assert.equal(
    validateBenchmarkContract(valid, sha('d'), valid.run_id, valid.requested_model).call_id,
    valid.call_id,
  );
  const wrong = contract({ requested_model: 'claude-sonnet-4-6' });
  assert.throws(
    () => validateBenchmarkContract(wrong, sha('d'), wrong.run_id, wrong.requested_model),
    /route generation/,
  );
});

test('Fable is rejected and Haiku is non-binding only', () => {
  const fable = contract({ requested_model: 'claude-fable-5' });
  assert.throws(
    () => validateBenchmarkContract(fable, sha('d'), fable.run_id, fable.requested_model),
    /not approved/,
  );
  const haiku = contract({
    requested_model: 'claude-haiku-4-5-20251001',
    pipeline_stage: 'triage',
    reader_name: null,
  });
  assert.doesNotThrow(
    () => validateBenchmarkContract(haiku, sha('d'), haiku.run_id, haiku.requested_model),
  );
  const bindingHaiku = contract({ requested_model: 'claude-haiku-4-5-20251001' });
  assert.throws(
    () => validateBenchmarkContract(
      bindingHaiku, sha('d'), bindingHaiku.run_id, bindingHaiku.requested_model,
    ),
    /non-binding/,
  );
});

test('long non-binding work permits only generation-matched Sonnet', () => {
  const longColdRead = contract({
    route: 'opus',
    requested_model: 'claude-sonnet-5',
    pipeline_stage: 'triage',
    reader_name: null,
  });
  assert.doesNotThrow(
    () => validateBenchmarkContract(
      longColdRead,
      sha('d'),
      longColdRead.run_id,
      longColdRead.requested_model,
    ),
  );
  const opusColdRead = contract({
    route: 'opus',
    requested_model: 'claude-opus-5',
    pipeline_stage: 'triage',
    reader_name: null,
  });
  assert.throws(
    () => validateBenchmarkContract(
      opusColdRead,
      sha('d'),
      opusColdRead.run_id,
      opusColdRead.requested_model,
    ),
    /generation-matched Sonnet/,
  );
});

test('call IDs bind request hashes and retry numbers', () => {
  assert.notEqual(
    contract({ retry_number: 0 }).call_id,
    contract({ retry_number: 1 }).call_id,
  );
  assert.notEqual(
    contract({ request_sha256: sha('d') }).call_id,
    contract({ request_sha256: sha('e') }).call_id,
  );
});
