/**
 * SettingsPasswordGate
 * Friction gate for sensitive settings panels (Upload, Calibration).
 * Shows a PIN entry card; on correct code renders children for the session.
 * Resets when component unmounts (navigating to another tab).
 */

import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

const GATE_PASSWORD = '1234';

interface SettingsPasswordGateProps {
    label: string; // e.g. "Upload" or "Calibration"
    children: React.ReactNode;
}

export function SettingsPasswordGate({ label, children }: SettingsPasswordGateProps) {
    const [unlocked, setUnlocked] = useState(false);
    const [input, setInput] = useState('');
    const [shake, setShake] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!unlocked) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [unlocked]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input === GATE_PASSWORD) {
            setUnlocked(true);
            setError('');
        } else {
            setShake(true);
            setError('Incorrect password');
            setInput('');
            setTimeout(() => setShake(false), 500);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    if (unlocked) return <>{children}</>;

    return (
        <div className="flex flex-col items-center justify-center py-16">
            <div className={clsx(
                'w-full max-w-sm p-8 rounded-2xl border glass text-center space-y-6',
                shake ? 'animate-shake border-red-500/40' : 'border-gold-500/20'
            )}>
                {/* Lock icon */}
                <div className="mx-auto w-14 h-14 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
                    <svg className="w-7 h-7 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>

                <div>
                    <h3 className="text-lg font-display text-gold-200 mb-1">{label} — Restricted</h3>
                    <p className="text-sm text-black-400">Enter the admin password to access this section.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                        ref={inputRef}
                        type="password"
                        value={input}
                        onChange={(e) => { setInput(e.target.value); setError(''); }}
                        placeholder="Password"
                        autoComplete="current-password"
                        className={clsx(
                            'input w-full text-center tracking-widest text-lg',
                            error ? 'border-red-500/50 focus:border-red-500/70' : ''
                        )}
                    />
                    {error && (
                        <p className="text-xs text-red-400">{error}</p>
                    )}
                    <button
                        type="submit"
                        disabled={!input.length}
                        className="btn btn-primary w-full disabled:opacity-40"
                    >
                        Unlock
                    </button>
                </form>
            </div>

            <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
        </div>
    );
}

export default SettingsPasswordGate;
