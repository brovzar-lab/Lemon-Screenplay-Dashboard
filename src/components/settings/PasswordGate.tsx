/**
 * PasswordGate — 4-digit PIN gate for sensitive settings sections.
 *
 * First visit: prompts user to set a PIN (stored as SHA-256 hash in localStorage).
 * Return visits: prompts for PIN to unlock (session stored in sessionStorage).
 * "Forgot PIN" flow: type RESET to clear the stored hash.
 */

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

interface PasswordGateProps {
  children: ReactNode;
  storageKey?: string;
}

const HASH_KEY_PREFIX = 'lemon-pin-hash';
const SESSION_KEY_PREFIX = 'lemon-pin-unlocked';

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function PasswordGate({ children, storageKey = 'default' }: PasswordGateProps) {
  const hashKey = `${HASH_KEY_PREFIX}-${storageKey}`;
  const sessionKey = `${SESSION_KEY_PREFIX}-${storageKey}`;

  const [mode, setMode] = useState<'loading' | 'setup' | 'unlock' | 'unlocked' | 'forgot'>('loading');
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [resetText, setResetText] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check if already unlocked this session or if PIN exists
  useEffect(() => {
    if (sessionStorage.getItem(sessionKey) === 'true') {
      setMode('unlocked');
    } else if (localStorage.getItem(hashKey)) {
      setMode('unlock');
    } else {
      setMode('setup');
    }
  }, [hashKey, sessionKey]);

  const focusInput = useCallback((refs: typeof inputRefs, index: number) => {
    setTimeout(() => refs.current[index]?.focus(), 10);
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleDigit = (
    value: string,
    index: number,
    arr: string[],
    setArr: (v: string[]) => void,
    refs: typeof inputRefs
  ) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...arr];
    next[index] = value;
    setArr(next);
    setError(null);

    if (value && index < 3) {
      focusInput(refs, index + 1);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    arr: string[],
    _setArr: (v: string[]) => void,
    refs: typeof inputRefs
  ) => {
    if (e.key === 'Backspace' && !arr[index] && index > 0) {
      focusInput(refs, index - 1);
    }
  };

  // ── Setup: Create new PIN ──
  const handleSetup = async () => {
    const joined = pin.join('');
    if (joined.length < 4) return;

    if (!isConfirmStep) {
      setIsConfirmStep(true);
      setConfirmPin(['', '', '', '']);
      setTimeout(() => confirmRefs.current[0]?.focus(), 50);
      return;
    }

    const confirmJoined = confirmPin.join('');
    if (joined !== confirmJoined) {
      setError('PINs don\'t match — try again');
      triggerShake();
      setConfirmPin(['', '', '', '']);
      setTimeout(() => confirmRefs.current[0]?.focus(), 50);
      return;
    }

    const hash = await sha256(joined);
    localStorage.setItem(hashKey, hash);
    sessionStorage.setItem(sessionKey, 'true');
    setMode('unlocked');
  };

  // ── Unlock: Verify existing PIN ──
  const handleUnlock = async () => {
    const joined = pin.join('');
    if (joined.length < 4) return;

    const storedHash = localStorage.getItem(hashKey);
    const hash = await sha256(joined);

    if (hash === storedHash) {
      sessionStorage.setItem(sessionKey, 'true');
      setMode('unlocked');
    } else {
      setError('Wrong PIN');
      triggerShake();
      setPin(['', '', '', '']);
      focusInput(inputRefs, 0);
    }
  };

  // ── Forgot: Reset PIN ──
  const handleReset = () => {
    if (resetText === 'RESET') {
      localStorage.removeItem(hashKey);
      sessionStorage.removeItem(sessionKey);
      setPin(['', '', '', '']);
      setConfirmPin(['', '', '', '']);
      setIsConfirmStep(false);
      setError(null);
      setResetText('');
      setMode('setup');
    }
  };

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (mode === 'unlock' && pin.every(d => d !== '')) {
      handleUnlock();
    }
    if (mode === 'setup' && !isConfirmStep && pin.every(d => d !== '')) {
      handleSetup();
    }
    if (mode === 'setup' && isConfirmStep && confirmPin.every(d => d !== '')) {
      handleSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, confirmPin, mode, isConfirmStep]);

  // Focus first input on mode change
  useEffect(() => {
    if (mode === 'setup' || mode === 'unlock') {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [mode]);

  if (mode === 'loading') return null;
  if (mode === 'unlocked') return <>{children}</>;

  // ── PIN Input Dots ──
  const renderPinInputs = (
    arr: string[],
    setArr: (v: string[]) => void,
    refs: typeof inputRefs,
  ) => (
    <div className={`flex gap-3 justify-center ${shake ? 'animate-shake' : ''}`}>
      {arr.map((digit, i) => (
        <div key={i} className="relative">
          <input
            ref={el => { refs.current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleDigit(e.target.value, i, arr, setArr, refs)}
            onKeyDown={e => handleKeyDown(e, i, arr, setArr, refs)}
            className="w-14 h-14 text-center text-2xl font-bold bg-black-800/80 border-2 border-gold-500/20 rounded-xl text-gold-200 focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/20 outline-none transition-all"
            autoComplete="off"
          />
          {/* Filled dot indicator */}
          <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full transition-all duration-200 ${
            digit ? 'bg-gold-400 scale-100' : 'bg-black-600 scale-75'
          }`} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      {/* Frosted Glass Card */}
      <div className="relative w-full max-w-sm">
        {/* Ambient glow */}
        <div className="absolute -inset-4 bg-gradient-to-br from-gold-500/10 via-transparent to-amber-500/10 rounded-3xl blur-xl" />

        <div className="relative bg-black-900/80 backdrop-blur-xl border border-gold-500/20 rounded-2xl p-8 shadow-2xl">
          {/* Lock Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500/20 to-amber-500/10 flex items-center justify-center border border-gold-500/20">
              <svg className="w-8 h-8 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          {/* ── Setup Mode ── */}
          {mode === 'setup' && (
            <>
              <h3 className="text-lg font-display text-gold-200 text-center mb-2">
                {isConfirmStep ? 'Confirm Your PIN' : 'Set a PIN'}
              </h3>
              <p className="text-sm text-black-400 text-center mb-6">
                {isConfirmStep
                  ? 'Enter the same PIN again to confirm'
                  : 'Protect your API keys with a 4-digit PIN'}
              </p>

              {isConfirmStep
                ? renderPinInputs(confirmPin, setConfirmPin, confirmRefs)
                : renderPinInputs(pin, setPin, inputRefs)
              }
            </>
          )}

          {/* ── Unlock Mode ── */}
          {mode === 'unlock' && (
            <>
              <h3 className="text-lg font-display text-gold-200 text-center mb-2">
                Enter PIN
              </h3>
              <p className="text-sm text-black-400 text-center mb-6">
                Enter your 4-digit PIN to access API settings
              </p>

              {renderPinInputs(pin, setPin, inputRefs)}
            </>
          )}

          {/* ── Forgot Mode ── */}
          {mode === 'forgot' && (
            <>
              <h3 className="text-lg font-display text-gold-200 text-center mb-2">
                Reset PIN
              </h3>
              <p className="text-sm text-black-400 text-center mb-4">
                Type <span className="font-mono text-red-400">RESET</span> to clear your PIN and set a new one
              </p>

              <input
                type="text"
                value={resetText}
                onChange={e => setResetText(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="Type RESET"
                className="w-full px-4 py-3 bg-black-800/80 border border-red-500/30 rounded-xl text-center text-gold-200 font-mono tracking-widest placeholder:text-black-600 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none"
                autoFocus
              />

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setMode('unlock'); setResetText(''); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-black-800/50 border border-black-700 text-black-300 hover:text-gold-200 hover:border-gold-500/30 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetText !== 'RESET'}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Confirm Reset
                </button>
              </div>
            </>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-400 text-center mt-4 animate-pulse">
              {error}
            </p>
          )}

          {/* Forgot PIN link */}
          {mode === 'unlock' && (
            <button
              onClick={() => setMode('forgot')}
              className="w-full text-center text-xs text-black-500 hover:text-gold-400 mt-6 transition-colors"
            >
              Forgot PIN?
            </button>
          )}

          {/* Security note */}
          <p className="text-[10px] text-black-600 text-center mt-6">
            PIN is stored as SHA-256 hash · Session unlocks until browser closes
          </p>
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}
