import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCatalogUpdate, selectNewestFamilyModel } from './check-anthropic-models.mjs';

describe('Anthropic model catalog', () => {
  it('chooses the newest family model by created_at from unordered results', () => {
    const newest = selectNewestFamilyModel(
      [
        { id: 'claude-sonnet-5', created_at: '2026-08-01T00:00:00Z' },
        { id: 'claude-sonnet-4-6', created_at: '2026-02-01T00:00:00Z' },
        { id: 'claude-sonnet-5-1', created_at: '2026-08-15T00:00:00Z' },
      ],
      'sonnet',
    );

    assert.equal(newest?.id, 'claude-sonnet-5-1');
  });

  it('updates observed models without changing approved scoring routes', () => {
    const catalog = {
      analysisRoutes: { sonnet: { modelId: 'claude-sonnet-4-6' } },
      interactiveRoutes: { readerChatDefault: { modelId: 'claude-opus-5' } },
      latestObserved: {
        haiku: 'claude-haiku-4-5',
        sonnet: 'claude-sonnet-5',
        opus: 'claude-opus-5',
        fable: 'claude-fable-5',
      },
      verifiedAt: '2026-08-09',
    };
    const models = [
      { id: 'claude-opus-5', created_at: '2026-08-01T00:00:00Z' },
      { id: 'claude-fable-5', created_at: '2026-08-01T00:00:00Z' },
      { id: 'claude-sonnet-5-1', created_at: '2026-08-15T00:00:00Z' },
      { id: 'claude-haiku-4-5', created_at: '2025-10-01T00:00:00Z' },
    ];

    const update = buildCatalogUpdate(catalog, models, '2026-08-20');

    assert.deepEqual(update.catalog.analysisRoutes, catalog.analysisRoutes);
    assert.deepEqual(update.catalog.interactiveRoutes, catalog.interactiveRoutes);
    assert.equal(update.catalog.latestObserved.sonnet, 'claude-sonnet-5-1');
    assert.equal(update.catalog.latestObserved.fable, 'claude-fable-5');
    assert.equal(update.catalog.verifiedAt, '2026-08-20');
    assert.deepEqual(update.changes, [
      { family: 'sonnet', previous: 'claude-sonnet-5', current: 'claude-sonnet-5-1' },
    ]);
  });
});
