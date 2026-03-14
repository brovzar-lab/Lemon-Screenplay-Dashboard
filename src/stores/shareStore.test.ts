/**
 * shareStore.test.ts
 *
 * Tests for the share token session cache Zustand store.
 * Ephemeral state — no persistence middleware.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useShareStore } from './shareStore';
import type { SharedView } from '@/lib/shareService';

describe('shareStore', () => {
    beforeEach(() => {
        // Reset store state between tests
        useShareStore.setState({ tokens: {} });
    });

    const mockView: SharedView = {
        token: 'abc-123',
        screenplayId: 'sp-001',
        screenplayTitle: 'Test Screenplay',
        includeNotes: false,
        createdAt: '2026-01-01T00:00:00Z',
    };

    describe('setToken', () => {
        it('adds a token entry keyed by screenplayId', () => {
            useShareStore.getState().setToken('sp-001', mockView);

            const tokens = useShareStore.getState().tokens;
            expect(tokens['sp-001']).toEqual(mockView);
        });

        it('overwrites an existing entry for the same screenplayId', () => {
            useShareStore.getState().setToken('sp-001', mockView);

            const updatedView = { ...mockView, token: 'new-token' };
            useShareStore.getState().setToken('sp-001', updatedView);

            expect(useShareStore.getState().tokens['sp-001'].token).toBe('new-token');
        });
    });

    describe('removeToken', () => {
        it('removes the token entry for a screenplayId', () => {
            useShareStore.getState().setToken('sp-001', mockView);
            useShareStore.getState().removeToken('sp-001');

            expect(useShareStore.getState().tokens['sp-001']).toBeUndefined();
        });

        it('is safe to call for a non-existent screenplayId', () => {
            expect(() => {
                useShareStore.getState().removeToken('non-existent');
            }).not.toThrow();
        });
    });

    describe('clearAll', () => {
        it('empties the tokens map', () => {
            useShareStore.getState().setToken('sp-001', mockView);
            useShareStore.getState().setToken('sp-002', { ...mockView, screenplayId: 'sp-002' });
            expect(Object.keys(useShareStore.getState().tokens)).toHaveLength(2);

            useShareStore.getState().clearAll();
            expect(Object.keys(useShareStore.getState().tokens)).toHaveLength(0);
        });
    });
});
