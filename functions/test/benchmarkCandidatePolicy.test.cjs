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
    name: 'submit_story_grid_genre',
    description: "Submit the screenplay's validated Story Grid genre classification.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        external_genre: {
          type: 'string',
          enum: [
            'Action', 'Horror', 'Crime', 'Thriller', 'Western', 'Eastern',
            'War', 'Society', 'Love', 'Performance', 'Comedy',
          ],
        },
        comedy_paired_genre: {
          type: 'string',
          enum: [
            '', 'Action', 'Horror', 'Crime', 'Thriller', 'Western', 'Eastern',
            'War', 'Society', 'Love', 'Performance',
          ],
        },
        comedy_subgenre: {
          type: 'string',
          enum: [
            '', 'Rom-Com', 'Buddy Comedy', 'Fish Out of Water',
            'Satire / Dark Comedy', 'Farce / Slapstick',
            'Coming-of-Age Comedy',
          ],
        },
        comedic_tone: { type: 'boolean' },
        internal_genre: {
          type: 'string',
          enum: [
            'Education', 'Maturation', 'Revelation', 'Disillusionment',
            'Punitive', 'Redemption', 'Testing', 'Pathetic', 'Sentimental',
            'Tragic', 'Admiration',
          ],
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        one_line_why: { type: 'string' },
      },
      required: [
        'external_genre', 'comedy_paired_genre', 'comedy_subgenre',
        'comedic_tone', 'internal_genre', 'confidence', 'one_line_why',
      ],
      additionalProperties: false,
    },
  }],
  tool_choice: { type: 'tool', name: 'submit_story_grid_genre' },
});

const compactPayload = (name = 'submit_structure_report') => ({
  ...schemaFreePayload(),
  tools: [{
    name,
    description: 'Return the complete V9 report as one JSON string.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        contract: { type: 'string', enum: [name] },
        application_schema_sha256: { type: 'string', enum: [sha('f')] },
        report_json: { type: 'string' },
      },
      required: ['contract', 'application_schema_sha256', 'report_json'],
      additionalProperties: false,
    },
  }],
  tool_choice: { type: 'tool', name },
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
  }, compactPayload('submit_claim_verification'))));
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
  assert.doesNotThrow(() => validate(contract(
    { retry_number: 2 },
    targetedCorrectionPayload(),
  )));
  assert.throws(
    () => validate(contract({ retry_number: 2 }, compactPayload())),
    /call matrix/,
  );
  assert.throws(() => validate(contract({
    pipeline_stage: 'triage', reader_name: null, retry_number: 2,
  }, schemaFreePayload())), /call matrix/);
  assert.throws(() => validate(contract({
    pipeline_stage: 'genre_detection', reader_name: null, retry_number: 2,
  }, strictPayload())), /call matrix/);
  assert.throws(() => validate(contract({ retry_number: 3 })), /0, 1, or 2/);
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
  assert.doesNotThrow(() => validate(contract({
    pipeline_stage: 'claim_verification',
    reader_name: 'batch_001_of_004',
    retry_number: 1,
  }, compactPayload('submit_claim_verification'))));
  assert.throws(() => validate(contract({
    pipeline_stage: 'claim_verification',
    reader_name: 'batch_001_of_004',
    retry_number: 2,
  }, compactPayload('submit_claim_verification'))), /call matrix/);
  assert.throws(() => validate(contract({ boundary_run: 4 })), /between 1 and 3/);
  assert.throws(() => validate(contract({ pipeline_pass: 'Sonnet pass' })), /pipeline_pass/);
  assert.throws(() => validate(contract({ prompt_sha256: sha('1') })), /prompt_sha256/);
  assert.throws(
    () => validate(contract({ transport_schema_sha256: sha('2') })),
    /Schema fingerprints/,
  );
});

test('reader and synthesis recovery accepts one fresh retry and one targeted correction', () => {
  assert.doesNotThrow(() => validate(contract(
    { retry_number: 1 },
    targetedCorrectionPayload(),
  )));
  assert.doesNotThrow(() => validate(contract(
    { pipeline_stage: 'synthesis', reader_name: null, retry_number: 1 },
    targetedCorrectionPayload('repair_synthesis_report'),
  )));
  assert.doesNotThrow(() => validate(contract(
    { retry_number: 2 },
    targetedCorrectionPayload(),
  )));
  assert.doesNotThrow(() => validate(contract(
    { pipeline_stage: 'synthesis', reader_name: null, retry_number: 2 },
    targetedCorrectionPayload('repair_synthesis_report'),
  )));
  for (const retry_number of [1, 2]) {
    assert.doesNotThrow(() => validate(contract(
      { retry_number },
      compactPayload('repair_structure_report'),
    )));
    assert.doesNotThrow(() => validate(contract(
      { pipeline_stage: 'synthesis', reader_name: null, retry_number },
      compactPayload('repair_synthesis_report'),
    )));
  }
  assert.throws(
    () => validate(contract({}, strictPayload())),
    /call matrix/,
  );
  assert.doesNotThrow(() => validate(contract(
    { retry_number: 1 },
    compactPayload(),
  )));
  assert.doesNotThrow(() => validate(contract(
    { pipeline_stage: 'synthesis', reader_name: null, retry_number: 1 },
    compactPayload('submit_synthesis_report'),
  )));
  assert.throws(
    () => validate(contract({
      pipeline_stage: 'claim_verification',
      reader_name: 'batch_001_of_004',
      retry_number: 1,
    }, targetedCorrectionPayload())),
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

test('compact report envelopes are exact and stage-bound', () => {
  const mutations = [
    (payload) => { delete payload.tool_choice; },
    (payload) => { payload.tool_choice = { type: 'auto' }; },
    (payload) => { payload.tool_choice.name = 'submit_character_report'; },
    (payload) => {
      payload.tools[0].name = 'submit_character_report';
      payload.tools[0].input_schema.properties.contract.enum = [
        'submit_character_report',
      ];
      payload.tool_choice.name = 'submit_character_report';
    },
    (payload) => {
      payload.tools[0].input_schema.properties.contract.enum = [
        'submit_character_report',
      ];
    },
    (payload) => { payload.tools[0].input_schema.unexpected = true; },
    (payload) => { payload.tools[0].input_schema.additionalProperties = true; },
    (payload) => {
      payload.tools[0].input_schema.properties.report_json = { type: 'number' };
    },
    (payload) => {
      payload.tools[0].input_schema.properties.report_json.enum = ['{}'];
    },
  ];
  for (const mutate of mutations) {
    const payload = compactPayload();
    mutate(payload);
    assert.throws(
      () => validate(contract({ retry_number: 1 }, payload)),
      /call matrix/,
    );
  }

  const malformedBinding = compactPayload();
  malformedBinding.tools[0].input_schema.properties[
    'application_schema_sha256'
  ].enum.push(sha('e'));
  assert.throws(
    () => contract({ retry_number: 1 }, malformedBinding),
    /bind one application schema fingerprint/,
  );
});

test('genre uses only the committed schema and forced tool', () => {
  const mutations = [
    (payload) => { delete payload.tool_choice; },
    (payload) => { payload.tool_choice = { type: 'auto' }; },
    (payload) => { payload.tool_choice.name = 'different_tool'; },
    (payload) => { payload.tools[0].name = 'different_tool'; },
    (payload) => { payload.tools[0].description = 'Different contract.'; },
    (payload) => {
      payload.tools[0].input_schema.properties.confidence.enum = ['high'];
    },
    (payload) => { payload.tools[0].input_schema.additionalProperties = true; },
  ];
  for (const mutate of mutations) {
    const payload = strictPayload();
    mutate(payload);
    assert.throws(
      () => validate(contract({
        pipeline_stage: 'genre_detection',
        reader_name: null,
      }, payload)),
      /call matrix/,
    );
  }
});

test('old thinking routes require auto tool choice while candidate routes are forced', () => {
  const oldCompact = compactPayload();
  oldCompact.model = 'claude-sonnet-4-6';
  oldCompact.tool_choice = { type: 'auto' };
  assert.doesNotThrow(() => validate(contract({
    generation: 'old',
    requested_model: oldCompact.model,
    retry_number: 1,
  }, oldCompact)));

  const oldCorrection = targetedCorrectionPayload();
  oldCorrection.model = 'claude-sonnet-4-6';
  oldCorrection.tool_choice = { type: 'auto' };
  assert.doesNotThrow(() => validate(contract({
    generation: 'old',
    requested_model: oldCorrection.model,
    retry_number: 1,
  }, oldCorrection)));

  const forcedOld = compactPayload();
  forcedOld.model = 'claude-sonnet-4-6';
  assert.throws(() => validate(contract({
    generation: 'old',
    requested_model: forcedOld.model,
  }, forcedOld)), /call matrix/);
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
  assert.equal(parseBenchmarkCapUsd('80'), 80);
  assert.equal(parseBenchmarkCapUsd('79.893575'), 79.893575);
  assertBenchmarkAuditBudget(79_893_575, 106_425);
  assert.throws(
    () => assertBenchmarkAuditBudget(79_893_576, 106_425),
    /authorized audit ceiling/,
  );
  assertBenchmarkAuditBudget(42_488_027, 37_511_973);
  assert.throws(
    () => assertBenchmarkAuditBudget(42_488_028, 37_511_973),
    /authorized audit ceiling/,
  );
  assert.throws(
    () => assertBenchmarkAuditBudget(1_000_000, 106_424),
    /settled pilot cost/,
  );
  assert.throws(() => parseBenchmarkCapUsd('80.000001'), /between 0 and 80/);
  assert.throws(() => parseBenchmarkCapUsd('1.0000001'), /between 0 and 80/);
  assert.throws(() => parseBenchmarkCapUsd('not-money'), /between 0 and 80/);
});
