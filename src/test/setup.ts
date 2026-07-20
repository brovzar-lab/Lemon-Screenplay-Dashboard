/**
 * Test Setup
 * Global setup for Vitest tests
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  const user = {
    uid: 'test-user',
    email: 'billy@lemonfilms.com',
    emailVerified: true,
    isAnonymous: false,
    displayName: 'Billy Rovzar',
    phoneNumber: null,
    photoURL: null,
    providerId: 'firebase',
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: vi.fn(),
    getIdToken: vi.fn().mockResolvedValue('mock-token'),
    getIdTokenResult: vi.fn(),
    reload: vi.fn(),
    toJSON: vi.fn(),
  };
  return {
    ...actual,
    GoogleAuthProvider: class GoogleAuthProvider {
      setCustomParameters = vi.fn();
    },
    onAuthStateChanged: vi.fn((_auth, callback) => {
      callback(user);
      return vi.fn();
    }),
    signInWithPopup: vi.fn().mockResolvedValue({ user }),
    signOut: vi.fn().mockResolvedValue(undefined),
    setPersistence: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => { },
    removeListener: () => { },
    addEventListener: () => { },
    removeEventListener: () => { },
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() { }
  unobserve() { }
  disconnect() { }
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];

  constructor() { }
  observe() { }
  unobserve() { }
  disconnect() { }
  takeRecords() {
    return [];
  }
};

// Mock localStorage for Zustand persist middleware
// happy-dom does not implement a working localStorage, which causes
// TypeError: storage.setItem is not a function in all store-backed tests.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
