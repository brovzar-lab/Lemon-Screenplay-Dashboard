const assert = require('node:assert/strict');
const test = require('node:test');

const {
  POSTER_MODELS,
  POSTER_LEASE_MS,
  canClaimPosterRequest,
  isCurrentV9Analysis,
  isPosterAdmin,
  isPosterEligible,
  isPosterVersionCurrent,
  normalizePosterModel,
  normalizePosterVerdict,
  posterDisposition,
} = require('../lib/posterCore');
const {
  posterBudgetDate,
  posterReservationExpiresAtMs,
  settlePosterLedger,
} = require('../lib/posterBudget');
const { admitBudgetReservation } = require('../lib/budgetCounter');
const { completedIngestProjectId, runAutomaticPoster } = require('../lib/onIngestCompleted');

test('Pass is withheld while every positive verdict is poster-eligible', () => {
  assert.equal(isPosterEligible(normalizePosterVerdict('PASS')), false);
  assert.equal(isPosterEligible(normalizePosterVerdict('CONSIDER')), true);
  assert.equal(isPosterEligible(normalizePosterVerdict('RECOMMEND')), true);
  assert.equal(isPosterEligible(normalizePosterVerdict('FILM NOW')), true);
  assert.equal(isPosterEligible(normalizePosterVerdict('unknown')), false);
  assert.equal(posterDisposition(normalizePosterVerdict('PASS')), 'withhold');
  assert.equal(posterDisposition(normalizePosterVerdict('CONSIDER')), 'generate');
  assert.equal(posterDisposition(normalizePosterVerdict('unknown')), 'skip');
});

test('manual poster access requires Billy and one approved server model', () => {
  assert.equal(isPosterAdmin('BILLY@lemonfilms.com'), true);
  assert.equal(isPosterAdmin('reader@lemonfilms.com'), false);
  assert.equal(normalizePosterModel('premium'), 'premium');
  assert.equal(normalizePosterModel('gemini-3-pro-image'), null);
});

test('poster projection accepts only the exact current screenplay version', () => {
  assert.equal(isPosterVersionCurrent('version-2', 'version-2'), true);
  assert.equal(isPosterVersionCurrent('version-3', 'version-2'), false);
});

test('duplicate completion delivery does not start another automatic poster', () => {
  const after = { status: 'complete', screenplay_doc_id: 'project-1' };
  assert.equal(completedIngestProjectId({ status: 'analyzing' }, after), 'project-1');
  assert.equal(completedIngestProjectId({ status: 'complete' }, after), null);
});

test('the same poster request can claim and call the paid model only once', () => {
  const now = Date.parse('2026-08-18T12:00:00.000Z');
  const input = {
    currentVersion: 'version-1',
    expectedVersion: 'version-1',
    posterStatus: undefined,
    posterVersion: undefined,
    posterRequestedAtMs: null,
    nowMs: now,
  };
  let paidCalls = 0;
  if (canClaimPosterRequest({ ...input, priorJobExists: false })) paidCalls += 1;
  if (canClaimPosterRequest({ ...input, priorJobExists: true })) paidCalls += 1;
  assert.equal(paidCalls, 1);
});

test('a live poster lease blocks overlap but a crashed lease expires', () => {
  const now = Date.parse('2026-08-18T12:00:00.000Z');
  const input = {
    priorJobExists: false,
    currentVersion: 'version-1',
    expectedVersion: 'version-1',
    posterStatus: 'generating',
    posterVersion: 'version-1',
    nowMs: now,
  };
  assert.equal(
    canClaimPosterRequest({
      ...input,
      posterRequestedAtMs: now - POSTER_LEASE_MS + 1,
    }),
    false,
  );
  assert.equal(
    canClaimPosterRequest({
      ...input,
      posterRequestedAtMs: now - POSTER_LEASE_MS,
    }),
    true,
  );
});

test('poster failure is contained after ingest completion', async () => {
  const originalError = console.error;
  console.error = () => undefined;
  try {
    await assert.doesNotReject(
      runAutomaticPoster(
        {
          apiKey: 'server-secret',
          projectId: 'project-1',
          requestId: 'auto-job-1',
          sourceId: 'job-1',
          model: 'economy',
        },
        async () => {
          throw new Error('budget or image generation failed');
        },
      ),
    );
  } finally {
    console.error = originalError;
  }
});

test('automatic posters use the approved lowest-cost model without fallback', () => {
  assert.equal(normalizePosterModel('economy'), 'economy');
  assert.equal(normalizePosterModel('other'), null);
  assert.equal(POSTER_MODELS.economy.id, 'gemini-3.1-flash-lite-image');
  assert.equal(POSTER_MODELS.economy.costMicrousd, 33_600);
  assert.ok(POSTER_MODELS.economy.costMicrousd < POSTER_MODELS.studio.costMicrousd);
  assert.ok(POSTER_MODELS.studio.costMicrousd < POSTER_MODELS.premium.costMicrousd);
});

test('automatic generation is restricted to the completed V9 engine', () => {
  assert.equal(isCurrentV9Analysis('v9_archaeology'), true);
  assert.equal(isCurrentV9Analysis('v8_archaeology'), false);
  assert.equal(isCurrentV9Analysis('v9_triage'), false);
});

test('poster settlement keeps the UTC budget day reserved before midnight', () => {
  const reservationDate = posterBudgetDate(new Date('2026-08-18T23:59:59.000Z'));
  assert.equal(reservationDate, '2026-08-18');
  assert.notEqual(reservationDate, posterBudgetDate(new Date('2026-08-19T00:00:01.000Z')));
});

test('a hard-timeout poster remains reserved through its UTC budget day', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');
  const expiresAt = posterReservationExpiresAtMs(now);
  const ledger = {
    date: '2026-08-18',
    limit_microusd: 33_600,
    spent_microusd: 0,
    reserved_microusd: 33_600,
    call_count: 0,
    uncertain_call_count: 0,
    uncertain_spend_microusd: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    by_model: {},
    active_reservations: {
      timedOut: {
        reserved_microusd: 33_600,
        expires_at_ms: expiresAt,
        model: POSTER_MODELS.economy.id,
        job_id: 'job',
      },
    },
  };
  assert.throws(() =>
    admitBudgetReservation(
      ledger,
      'retry',
      {
        reserved_microusd: 33_600,
        expires_at_ms: expiresAt,
        model: POSTER_MODELS.economy.id,
        job_id: 'retry-job',
      },
      Date.parse('2026-08-18T23:59:59.000Z'),
    ),
  );
  assert.equal(expiresAt, Date.parse('2026-08-19T01:00:00.000Z'));
  const settled = settlePosterLedger(
    ledger,
    'timedOut',
    'economy',
    true,
    Date.parse('2026-08-19T00:30:00.000Z'),
  );
  assert.equal(settled.spent_microusd, 33_600);
  assert.equal(settled.reserved_microusd, 0);
});

test('poster settlement is idempotent after an ambiguous transaction response', () => {
  const now = Date.parse('2026-08-18T12:00:00.000Z');
  const ledger = {
    date: '2026-08-18',
    limit_microusd: 5_000_000,
    spent_microusd: 0,
    reserved_microusd: 33_600,
    call_count: 0,
    uncertain_call_count: 0,
    uncertain_spend_microusd: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    by_model: {},
    active_reservations: {
      request: {
        reserved_microusd: 33_600,
        expires_at_ms: now + 60_000,
        model: POSTER_MODELS.economy.id,
        job_id: 'job',
      },
    },
  };
  const settled = settlePosterLedger(ledger, 'request', 'economy', false, now);
  const retriedAsUncertain = settlePosterLedger(settled, 'request', 'economy', true, now);
  assert.equal(settled.spent_microusd, 33_600);
  assert.equal(retriedAsUncertain.spent_microusd, 33_600);
  assert.equal(retriedAsUncertain.uncertain_spend_microusd, 0);
});
