import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockWhere = vi.fn((_field: string, _operator: string, _value: unknown) => 'constraint');
let snapshotHandler: ((snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) | undefined;

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collection'),
  query: vi.fn(() => 'query'),
  where: (...args: [string, string, unknown]) => mockWhere(...args),
  onSnapshot: vi.fn((_query, onNext) => {
    snapshotHandler = onNext;
    return vi.fn();
  }),
}));

import { subscribeToUploadIssues } from './badFormatStore';

describe('subscribeToUploadIssues', () => {
  beforeEach(() => {
    mockWhere.mockClear();
    snapshotHandler = undefined;
  });

  it('subscribes to skipped and permanently failed jobs', () => {
    const onChange = vi.fn();
    subscribeToUploadIssues(onChange);

    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['skipped', 'failed']);

    snapshotHandler?.({
      docs: [
        {
          id: 'failed-job',
          data: () => ({
            filename: 'Broken.pdf',
            collection_id: 'LEMON',
            storage_path: 'ingest-queue/LEMON/Broken.pdf',
            status: 'failed',
            last_error: 'Anthropic timeout',
            attempt_count: 3,
          }),
        },
      ],
    });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'failed-job',
        status: 'failed',
        last_error: 'Anthropic timeout',
        attempt_count: 3,
      }),
    ]);
  });
});
