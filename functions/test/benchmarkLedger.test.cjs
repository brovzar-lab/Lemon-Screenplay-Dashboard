const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BenchmarkCapExceededError,
  BenchmarkCallConflictError,
  BenchmarkDuplicateCallError,
  admitBenchmarkReservation,
  chargeUncertainBenchmarkReservation,
  normalizeBenchmarkRunLedger,
  rejectExistingBenchmarkCall,
  releaseBenchmarkReservation,
  settleBenchmarkReservation,
} = require('../lib/benchmarkLedger');

const ledger = (limit = 1_000_000) => normalizeBenchmarkRunLedger(undefined, limit);

test('concurrent lifetime reservations cannot cross the immutable run cap', () => {
  const first = admitBenchmarkReservation(ledger(), 700_000);
  assert.throws(() => admitBenchmarkReservation(first, 400_000), BenchmarkCapExceededError);
});

test('process interruption leaves the lifetime reservation held without expiry', () => {
  const interrupted = admitBenchmarkReservation(ledger(), 700_000);
  assert.equal(interrupted.reserved_microusd, 700_000);
  assert.throws(
    () => admitBenchmarkReservation(interrupted, 400_000),
    BenchmarkCapExceededError,
  );
});

test('uncertain dispatch charges the full hold and a proven rejection releases it', () => {
  const reserved = admitBenchmarkReservation(ledger(), 700_000);
  const uncertain = chargeUncertainBenchmarkReservation(reserved, 700_000);
  assert.equal(uncertain.spent_microusd, 700_000);
  assert.equal(uncertain.uncertain_spend_microusd, 700_000);
  assert.equal(uncertain.reserved_microusd, 0);

  const rejected = releaseBenchmarkReservation(reserved, 700_000);
  assert.equal(rejected.spent_microusd, 0);
  assert.equal(rejected.reserved_microusd, 0);
});

test('settlement cannot exceed the conservative reservation', () => {
  const reserved = admitBenchmarkReservation(ledger(), 100_000);
  assert.throws(
    () => settleBenchmarkReservation(reserved, 100_000, 100_001),
    /exceeded/,
  );
});

test('duplicate call IDs never dispatch again and conflicting hashes are rejected', () => {
  const contract = {
    request_sha256: 'a'.repeat(64),
    prompt_bundle_sha256: 'b'.repeat(64),
    structured_output_schema_sha256: 'c'.repeat(64),
  };
  assert.throws(
    () => rejectExistingBenchmarkCall({ ...contract, status: 'in_progress' }, contract),
    BenchmarkDuplicateCallError,
  );
  assert.throws(
    () => rejectExistingBenchmarkCall({ ...contract, request_sha256: 'd'.repeat(64) }, contract),
    BenchmarkCallConflictError,
  );
});

test('settlement, uncertainty, and release cannot subtract a missing hold', () => {
  const empty = ledger();
  assert.throws(() => settleBenchmarkReservation(empty, 1, 1), /fully held/);
  assert.throws(() => chargeUncertainBenchmarkReservation(empty, 1), /fully held/);
  assert.throws(() => releaseBenchmarkReservation(empty, 1), /fully held/);
});
