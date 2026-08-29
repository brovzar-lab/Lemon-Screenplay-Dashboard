const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertBenchmarkAuditBudget,
  deriveBenchmarkCallId,
  deriveBenchmarkPayloadEvidence,
  parseBenchmarkCapUsd,
  validateBenchmarkContract,
} = require('../lib/benchmarkCandidatePolicy');

const sha = (char) => char.repeat(64);
const schemaFreePayload = () => ({
  model: 'claude-sonnet-5',
  messages: [{ role: 'user', content: 'READY' }],
  max_tokens: 16,
});

const strictPayload = () => ({
  ...schemaFreePayload(),
  tools: [{
    name: 'detect_genre',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { external_genre: { type: 'string' } },
      required: ['external_genre'],
      additionalProperties: false,
    },
  }],
});

const compactPayload = () => ({
  ...schemaFreePayload(),
  tools: [{
    name: 'submit_structure_report',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        contract: { type: 'string', enum: ['submit_structure_report'] },
        application_schema_sha256: { type: 'string', enum: [sha('f')] },
        report_json: { type: 'string' },
      },
      required: ['contract', 'application_schema_sha256', 'report_json'],
      additionalProperties: false,
    },
  }],
});

const targetedCorrectionPayload = (name = 'repair_structure_report') => ({
  ...schemaFreePayload(),
  tools: [{
    name,
    description: 'Return only declared repairs.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        source_report_sha256: { type: 'string', enum: [sha('e')] },
        repairs: {
          type: 'object',
          properties: {
            'sub_scores.active_vs_passive': {
              type: 'object',
              properties: {
                page_citations: {
                  type: 'array',
                  items: { type: 'integer', enum: [42] },
                },
                citation_evidence: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      page: { type: 'integer', enum: [42] },
                      excerpt: {
                        type: 'string',
                        enum: ['Exact screenplay source line.'],
                      },
                    },
                    required: ['page', 'excerpt'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['page_citations', 'citation_evidence'],
              additionalProperties: false,
            },
          },
          required: ['sub_scores.active_vs_passive'],
          additionalProperties: false,
        },
      },
      required: ['source_report_sha256', 'repairs'],
      additionalProperties: false,
    },
  }],
  tool_choice: { type: 'tool', name },
});

function contract(overrides = {}, payload = compactPayload()) {
  const evidence = deriveBenchmarkPayloadEvidence(payload);
  const base = {
    run_id: sha('9'),
    screenplay_sha256: sha('a'),
    route: 'sonnet',
    generation: 'candidate',
    pipeline_stage: 'reader',
    pipeline_pass: 'sonnet',
    reader_name: 'structure',
    retry_number: 0,
    boundary_run: 1,
    prompt_bundle_sha256: sha('b'),
    schema_bundle_sha256: sha('c'),
    ...evidence,
    requested_model: payload.model,
    ...overrides,
  };
  return {
    value: { ...base, call_id: deriveBenchmarkCallId(base) },
    evidence,
    payload,
  };
}

function validate(entry) {
  return validateBenchmarkContract(
    entry.value,
    entry.evidence,
    entry.value.run_id,
    entry.value.requested_model,
    entry.payload,
  );
}

test('prompt fingerprint covers tool semantics and inference controls', () => {
  const payload = {
    ...strictPayload(),
    system: [{ type: 'text', text: 'system' }],
    tool_choice: { type: 'auto' },
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
  };
  payload.tools[0].description = 'Classify the screenplay genre.';
  const baseline = deriveBenchmarkPayloadEvidence(payload);
  for (const mutate of [
    (copy) => { copy.tools[0].name = 'different_tool'; },
    (copy) => { copy.tools[0].description = 'Different semantics.'; },
    (copy) => { copy.tool_choice = { type: 'tool', name: 'detect_genre' }; },
    (copy) => { copy.thinking = { type: 'enabled', budget_tokens: 1024 }; },
    (copy) => { copy.output_config = { effort: 'low' }; },
  ]) {
    const changed = structuredClone(payload);
    mutate(changed);
    assert.notEqual(
      deriveBenchmarkPayloadEvidence(changed).prompt_sha256,
      baseline.prompt_sha256,
    );
  }
});

test('candidate routes accept only the exact generation model', () => {
  assert.equal(validate(contract()).requested_model, 'claude-sonnet-5');
  const oldPayload = { ...compactPayload(), model: 'claude-sonnet-4-6' };
  assert.throws(
    () => validate(contract({ requested_model: oldPayload.model }, oldPayload)),
    /route generation/,
  );
});

test('Fable is rejected and Haiku is non-binding only', () => {
  const fablePayload = { ...compactPayload(), model: 'claude-fable-5' };
  assert.throws(
    () => validate(contract({ requested_model: fablePayload.model }, fablePayload)),
    /not approved/,
  );

  const haikuPayload = { ...schemaFreePayload(), model: 'claude-haiku-4-5-20251001' };
  const haiku = contract({
    requested_model: haikuPayload.model,
    pipeline_stage: 'triage',
    reader_name: null,
  }, haikuPayload);
  assert.doesNotThrow(() => validate(haiku));
  const bindingHaiku = contract({ requested_model: haikuPayload.model }, {
    ...compactPayload(), model: haikuPayload.model,
  });
  assert.throws(() => validate(bindingHaiku), /non-binding/);
});

test('long non-binding work permits only generation-matched Sonnet', () => {
  const triagePayload = schemaFreePayload();
  const longColdRead = contract({
    route: 'opus',
    pipeline_stage: 'triage',
    reader_name: null,
  }, triagePayload);
  assert.doesNotThrow(() => validate(longColdRead));
  const opusPayload = { ...schemaFreePayload(), model: 'claude-opus-5' };
  const opusColdRead = contract({
    route: 'opus',
    requested_model: opusPayload.model,
    pipeline_stage: 'triage',
    reader_name: null,
  }, opusPayload);
  assert.throws(() => validate(opusColdRead), /generation-matched Sonnet/);
});

test('call IDs bind request hashes and retry numbers', () => {
  assert.notEqual(
    contract({ retry_number: 0 }).value.call_id,
    contract({ retry_number: 1 }).value.call_id,
  );
  const changed = compactPayload();
  changed.max_tokens = 17;
  assert.notEqual(contract().value.call_id, contract({}, changed).value.call_id);
  assert.notEqual(
    contract({ pipeline_pass: 'sonnet' }).value.call_id,
    contract({ pipeline_pass: 'opus' }).value.call_id,
  );
});

test('prior audit spend includes the pilot and stays under the audit ceiling', () => {
  assert.doesNotThrow(() => assertBenchmarkAuditBudget(8_000_000, 106_425));
  assert.throws(
    () => assertBenchmarkAuditBudget(8_000_000, 106_424),
    /settled pilot cost/,
  );
  assert.doesNotThrow(() => assertBenchmarkAuditBudget(8_000_000, 10_000_000));
});

test('stage, reader, retry, boundary, prompt, and schemas are derived and fail closed', () => {
  assert.doesNotThrow(() => validate(contract(
    { pipeline_stage: 'triage', reader_name: null },
    schemaFreePayload(),
  )));
  assert.doesNotThrow(() => validate(contract(
    { pipeline_stage: 'genre_detection', reader_name: null },
    strictPayload(),
  )));
  assert.doesNotThrow(() => validate(contract({
    pipeline_stage: 'claim_verification', reader_name: 'batch_001_of_004',
  })));
  assert.throws(
    () => validate(contract({ reader_name: 'batch_001_of_004' })),
    /reader_name/,
  );
  assert.throws(
    () => validate(contract({
      pipeline_stage: 'claim_verification', reader_name: 'batch_005_of_004',
    })),
    /reader_name/,
  );
  assert.throws(
    () => validate(contract({
      pipeline_stage: 'synthesis', reader_name: 'batch_001_of_004',
    })),
    /reader_name/,
  );
  assert.throws(() => validate(contract({ pipeline_stage: 'unknown' })), /reader_name|call matrix/);
  assert.throws(() => validate(contract({ reader_name: null })), /reader_name|call matrix/);
  assert.throws(
    () => validate(contract(
      { pipeline_stage: 'reader', reader_name: 'structure' },
      schemaFreePayload(),
    )),
    /call matrix/,
  );
  assert.throws(() => validate(contract({ retry_number: 2 })), /0 or 1/);
  for (const stage of ['triage', 'cold_read', 'smoke']) {
    assert.throws(
      () => validate(contract({
        pipeline_stage: stage,
        reader_name: null,
        retry_number: 1,
      }, schemaFreePayload())),
      /call matrix/,
    );
  }
  assert.throws(
    () => validate(contract({
      pipeline_stage: 'claim_verification',
      reader_name: 'batch_001_of_004',
      retry_number: 1,
    })),
    /call matrix/,
  );
  assert.throws(() => validate(contract({ boundary_run: 4 })), /between 1 and 3/);
  assert.throws(() => validate(contract({ pipeline_pass: 'Sonnet pass' })), /pipeline_pass/);
  assert.throws(() => validate(contract({ prompt_sha256: sha('1') })), /prompt_sha256/);
  assert.throws(
    () => validate(contract({ transport_schema_sha256: sha('2') })),
    /Schema fingerprints/,
  );
});

test('one reader or synthesis correction uses its exact targeted strict schema', () => {
  assert.doesNotThrow(() => validate(contract(
    { retry_number: 1 },
    targetedCorrectionPayload(),
  )));
  assert.doesNotThrow(() => validate(contract(
    { pipeline_stage: 'synthesis', reader_name: null, retry_number: 1 },
    targetedCorrectionPayload('repair_synthesis_report'),
  )));
  assert.throws(
    () => validate(contract({}, strictPayload())),
    /call matrix/,
  );
  assert.throws(
    () => validate(contract({ retry_number: 1 }, compactPayload())),
    /call matrix/,
  );
  const invalidPayloads = [
    strictPayload(),
    { ...targetedCorrectionPayload(), tool_choice: { type: 'auto' } },
    (() => {
      const value = targetedCorrectionPayload('repair_character_report');
      value.tool_choice.name = 'repair_structure_report';
      return value;
    })(),
    (() => {
      const value = targetedCorrectionPayload();
      value.tools[0].input_schema.properties.source_report_sha256.enum = ['not-a-hash'];
      return value;
    })(),
    (() => {
      const value = targetedCorrectionPayload();
      value.tools[0].input_schema.properties.repairs.properties = {};
      value.tools[0].input_schema.properties.repairs.required = [];
      return value;
    })(),
    (() => {
      const value = targetedCorrectionPayload();
      value.tools[0].input_schema.properties.repairs.additionalProperties = true;
      return value;
    })(),
    (() => {
      const value = targetedCorrectionPayload();
      value.tools[0].input_schema.properties.repairs.properties[
        'sub_scores.active_vs_passive'
      ].properties.citation_evidence.items.properties.excerpt.pattern = '.+';
      return value;
    })(),
    (() => {
      const value = targetedCorrectionPayload();
      value.tools[0].input_schema.properties.repairs.properties[
        'sub_scores.active_vs_passive'
      ].properties.page_citations.minItems = 2;
      return value;
    })(),
    (() => {
      const value = targetedCorrectionPayload();
      value.tools[0].input_schema.properties.repairs.properties[
        'sub_scores.active_vs_passive'
      ].additionalProperties = true;
      return value;
    })(),
    (() => {
      const value = targetedCorrectionPayload();
      value.tools[0].input_schema.properties.repairs.properties[
        'sub_scores.active_vs_passive'
      ].required = ['page_citations'];
      return value;
    })(),
  ];
  for (const payload of invalidPayloads) {
    assert.throws(
      () => validate(contract({ retry_number: 1 }, payload)),
      /call matrix/,
    );
  }

  const tooMany = targetedCorrectionPayload();
  const repairSchema = tooMany.tools[0].input_schema.properties.repairs;
  const exemplar = repairSchema.properties['sub_scores.active_vs_passive'];
  repairSchema.properties = Object.fromEntries(
    Array.from({ length: 25 }, (_, index) => [
      `sub_scores.metric_${index}`,
      structuredClone(exemplar),
    ]),
  );
  repairSchema.required = Object.keys(repairSchema.properties);
  assert.throws(
    () => validate(contract({ retry_number: 1 }, tooMany)),
    /call matrix/,
  );
});

test('schema-free calls cannot carry forged schema fingerprints', () => {
  const mislabeled = contract({
    pipeline_stage: 'triage',
    reader_name: null,
    schema_sha256: sha('f'),
  }, schemaFreePayload());
  assert.throws(() => validate(mislabeled), /schema-free/);
});

test('candidate cap is server-side bounded to the authorized audit ceiling', () => {
  assert.equal(parseBenchmarkCapUsd('39.893575'), 39.893575);
  assertBenchmarkAuditBudget(39_893_575, 106_425);
  assert.throws(
    () => assertBenchmarkAuditBudget(39_893_576, 106_425),
    /authorized audit ceiling/,
  );
  assert.throws(
    () => assertBenchmarkAuditBudget(1_000_000, 106_424),
    /settled pilot cost/,
  );
  assert.throws(() => parseBenchmarkCapUsd('40.000001'), /between 0 and 40/);
  assert.throws(() => parseBenchmarkCapUsd('1.0000001'), /between 0 and 40/);
  assert.throws(() => parseBenchmarkCapUsd('not-money'), /between 0 and 40/);
});
