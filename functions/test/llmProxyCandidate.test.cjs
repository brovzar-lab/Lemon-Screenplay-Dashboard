const assert = require('node:assert/strict');
const test = require('node:test');
const Anthropic = require('@anthropic-ai/sdk');

const {
  CANDIDATE_MAX_OUTPUT_TOKENS,
  benchmarkUncertainAccounting,
  benchmarkRequestFailureState,
  candidateContractRejection,
  candidateSettlementFailure,
  isolationApp,
  isPermissionDenied,
  providerRejectionFailure,
  providerRejectionReleaseFailure,
  providerConfigurationFailure,
  providerTransportFailure,
} = require('../lib/llmProxyCandidate');
const { buildAnthropicRequest } = require('../lib/anthropicProxyCore');
const { deriveBenchmarkPayloadEvidence } = require('../lib/benchmarkCandidatePolicy');

test('candidate-only controls accept the exact 32k adaptive strict-tool request', () => {
  const request = {
    model: 'claude-sonnet-5',
    messages: [{ role: 'user', content: 'screenplay' }],
    max_tokens: 32_000,
    tools: [{
      name: 'submit_report',
      strict: true,
      input_schema: {
        type: 'object',
        properties: { report_json: { type: 'string' } },
        required: ['report_json'],
        additionalProperties: false,
      },
    }],
    tool_choice: { type: 'tool', name: 'submit_report' },
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
  };
  const built = buildAnthropicRequest(
    request,
    'service',
    CANDIDATE_MAX_OUTPUT_TOKENS,
    16_000,
    'global',
    true,
  );
  assert.equal(built.maxTokens, 32_000);
  assert.deepEqual(built.payload.tool_choice, request.tool_choice);
  assert.throws(
    () => buildAnthropicRequest(
      { ...request, max_tokens: 32_001 },
      'service',
      CANDIDATE_MAX_OUTPUT_TOKENS,
      16_000,
      'global',
      true,
    ),
    /max_tokens must be an integer between 1 and 32000/,
  );
  assert.throws(
    () => buildAnthropicRequest(
      request,
      'service',
      CANDIDATE_MAX_OUTPUT_TOKENS,
      16_000,
      'global',
    ),
    /cannot force tool choice/,
  );
  assert.throws(
    () => buildAnthropicRequest(
      { ...request, model: 'claude-opus-4-7' },
      'service',
      CANDIDATE_MAX_OUTPUT_TOKENS,
      16_000,
      'global',
      true,
    ),
    /cannot force tool choice/,
  );
});

test('candidate-only controls explicitly disable default thinking for small calls', () => {
  const request = {
    model: 'claude-sonnet-5',
    messages: [{ role: 'user', content: 'screenplay' }],
    max_tokens: 400,
    tools: [{
      name: 'submit_genre',
      strict: true,
      input_schema: {
        type: 'object',
        properties: { external_genre: { type: 'string' } },
        required: ['external_genre'],
        additionalProperties: false,
      },
    }],
    tool_choice: { type: 'tool', name: 'submit_genre' },
    thinking: { type: 'disabled' },
  };
  const built = buildAnthropicRequest(
    request,
    'service',
    CANDIDATE_MAX_OUTPUT_TOKENS,
    16_000,
    'global',
    true,
  );
  assert.deepEqual(built.payload.thinking, { type: 'disabled' });
  assert.deepEqual(built.payload.tool_choice, request.tool_choice);
  assert.throws(
    () => buildAnthropicRequest(
      request,
      'service',
      CANDIDATE_MAX_OUTPUT_TOKENS,
      16_000,
      'global',
    ),
    /restricted to the candidate benchmark/,
  );
});

test('candidate contract rejection proves zero spend before reservation', () => {
  const payload = {
    model: 'claude-sonnet-5',
    messages: [{ role: 'user', content: 'screenplay' }],
    max_tokens: 32_000,
  };
  const evidence = deriveBenchmarkPayloadEvidence(payload);
  assert.deepEqual(
    candidateContractRejection({
      call_id: 'a'.repeat(64),
      requested_model: payload.model,
      request_sha256: evidence.request_sha256,
    }, evidence, payload.model),
    {
      call_id: 'a'.repeat(64),
      requested_model: payload.model,
      request_sha256: evidence.request_sha256,
      disposition: 'rejected_before_reservation',
      new_cost_microusd: 0,
      charged_cost_microusd: 0,
      reserved_cost_microusd: 0,
      validation_failure_code: 'CANDIDATE_CONTRACT_REJECTED',
      validation_failure_reason: (
        'Candidate rejected the request contract before reservation or provider dispatch.'
      ),
    },
  );
  assert.equal(candidateContractRejection({
    call_id: 'a'.repeat(64),
    requested_model: payload.model,
    request_sha256: 'b'.repeat(64),
  }, evidence, payload.model), undefined);
});

test('online isolation probes recognize Firestore and Storage IAM denial codes', () => {
  assert.equal(isPermissionDenied({ code: 7 }), true);
  assert.equal(isPermissionDenied({ code: 403 }), true);
  assert.equal(isPermissionDenied({ code: 'permission-denied' }), true);
  assert.equal(isPermissionDenied({ code: 500 }), false);
});

test('staging and production probes use distinct explicit Admin SDK apps', () => {
  const staging = isolationApp('lemon-screenplay-staging');
  const production = isolationApp('lemon-screenplay-dashboard');

  assert.notEqual(staging.name, production.name);
  assert.equal(staging.options.projectId, 'lemon-screenplay-staging');
  assert.equal(production.options.projectId, 'lemon-screenplay-dashboard');
});

test('uncertain benchmark errors expose the exact call and cap charge', () => {
  const reservation = {
    run_id: 'run-1',
    call_id: 'call-1',
    requested_model: 'claude-sonnet-5',
    reserved_microusd: 125_000,
  };

  assert.deepEqual(
    benchmarkUncertainAccounting(reservation, {
      actual_cost_microusd: 125_000,
      actual_cost_usd: 0.125,
    }),
    {
      call_id: 'call-1',
      requested_model: 'claude-sonnet-5',
      uncertainty_status: 'charged_reservation',
      charged_cost_microusd: 125_000,
      charged_cost_usd: 0.125,
      reserved_cost_microusd: 0,
      reserved_cost_usd: 0,
      cap_cost_microusd: 125_000,
      cap_cost_usd: 0.125,
    },
  );
  assert.equal(
    benchmarkUncertainAccounting(reservation).uncertainty_status,
    'reservation_held',
  );
  assert.equal(
    benchmarkUncertainAccounting(reservation).cap_cost_microusd,
    125_000,
  );
});

test('ambiguous rejection acknowledgement recovered as rejected remains proven zero-spend', () => {
  const reservation = {
    run_id: 'run-1',
    call_id: 'call-1',
    requested_model: 'claude-sonnet-5',
    reserved_microusd: 125_000,
  };
  assert.deepEqual(
    benchmarkRequestFailureState(false, reservation, {
      ledger_status: 'rejected',
      actual_cost_microusd: 0,
      actual_cost_usd: 0,
    }),
    { rejected: true, benchmarkAccounting: undefined },
  );
});

test('candidate settlement failures retain finite privacy-safe validation causes', () => {
  const cacheFailure = candidateSettlementFailure(
    new Error('Anthropic response omitted valid cache_creation_input_tokens usage.'),
    'response_validation',
  );
  assert.equal(cacheFailure.validation_failure_code, 'PROVIDER_CACHE_TOTALS_MISSING');
  assert.equal(
    cacheFailure.validation_failure_reason,
    'Cached provider response omitted required aggregate cache usage.',
  );
  assert.match(cacheFailure.settlement_error_sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    candidateSettlementFailure(
      new Error('Anthropic cache-creation usage detail does not reconcile.'),
      'response_validation',
    ).validation_failure_code,
    'PROVIDER_CACHE_DETAIL_MISMATCH',
  );
  assert.equal(
    candidateSettlementFailure(new Error('Firestore unavailable'), 'settlement')
      .validation_failure_code,
    'FIRESTORE_SETTLEMENT_FAILED',
  );
});

test('provider rejection evidence hashes but never persists arbitrary provider text', () => {
  const secret = 'PRIVATE_SCREENPLAY_SENTINEL sk-ant-secret';
  const body = {
    type: 'error',
    error: { type: 'invalid_request_error', message: secret },
    request_id: 'req_011CeYRejectedProof123',
  };
  const error = Anthropic.APIError.generate(
    400,
    body,
    secret,
    new Headers({ 'request-id': body.request_id }),
  );
  const evidence = providerRejectionFailure(secret, error);
  assert.match(evidence.provider_error_sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(evidence).includes(secret), false);
  assert.equal(
    evidence.validation_failure_code,
    'PROVIDER_INVALID_REQUEST_BEFORE_GENERATION',
  );
  assert.equal(evidence.provider_error_class, 'BadRequestError');
  assert.equal(evidence.provider_http_status, 400);
  assert.equal(evidence.provider_error_type, 'invalid_request_error');
  assert.equal(evidence.provider_request_id, body.request_id);
  assert.equal(evidence.provider_transport_detail, 'provider_http_error');
});

test('provider transport uncertainty is finite and hashes private error text', () => {
  const cause = Object.assign(new Error('socket hang up PRIVATE_SCREENPLAY_SENTINEL'), {
    code: 'ECONNRESET',
  });
  const error = new Anthropic.APIConnectionError({ cause });
  const evidence = providerTransportFailure('PRIVATE_SCREENPLAY_SENTINEL', error);
  assert.equal(evidence.validation_failure_code, 'PROVIDER_TRANSPORT_UNCERTAIN');
  assert.match(evidence.provider_error_sha256, /^[a-f0-9]{64}$/);
  assert.equal(evidence.provider_error_class, 'APIConnectionError');
  assert.equal(evidence.provider_http_status, null);
  assert.equal(evidence.provider_error_type, 'connection_error');
  assert.equal(evidence.provider_request_id, null);
  assert.equal(evidence.provider_transport_detail, 'connection_reset');
  assert.match(evidence.provider_failure_summary, /detail=connection_reset/);
  assert.equal(JSON.stringify(evidence).includes('PRIVATE_SCREENPLAY_SENTINEL'), false);
});

test('failed zero-spend release keeps provider and settlement failures distinct', () => {
  const evidence = providerRejectionReleaseFailure(
    'PRIVATE_PROVIDER_REASON',
    Anthropic.APIError.generate(
      400,
      { error: { type: 'invalid_request_error' } },
      'PRIVATE_PROVIDER_REASON',
      new Headers({ 'request-id': 'req_011CeYReleaseProof123' }),
    ),
    new Error('PRIVATE_FIRESTORE_REASON'),
  );
  assert.equal(
    evidence.validation_failure_code,
    'PROVIDER_REJECTION_RELEASE_UNCERTAIN',
  );
  assert.match(evidence.provider_error_sha256, /^[a-f0-9]{64}$/);
  assert.match(evidence.settlement_error_sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(evidence.provider_error_sha256, evidence.settlement_error_sha256);
  assert.equal(evidence.provider_request_id, 'req_011CeYReleaseProof123');
  assert.equal(JSON.stringify(evidence).includes('PRIVATE_PROVIDER_REASON'), false);
  assert.equal(JSON.stringify(evidence).includes('PRIVATE_FIRESTORE_REASON'), false);
});

test('provider client configuration failure is finite, hashed, and pre-dispatch', () => {
  const evidence = providerConfigurationFailure(
    new Error('PRIVATE_CONFIGURATION sk-ant-secret'),
  );
  assert.equal(
    evidence.validation_failure_code,
    'CANDIDATE_PROVIDER_CONFIGURATION_UNAVAILABLE',
  );
  assert.match(evidence.configuration_error_sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(evidence).includes('PRIVATE_CONFIGURATION'), false);
});
