/**
 * DevExecChat — Floating Development Executive AI chat panel.
 *
 * Features:
 * - Centered mic button for LIVE VOICE conversation (Gemini Live API)
 * - Text chat with quick actions below
 * - Premium glassmorphism UI
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { useDevExec } from '@/contexts/DevExecContext';
import { QUICK_ACTIONS } from '@/services/devExecService';
import { useLiveDevExec, type LiveVoiceName } from '@/hooks/useLiveDevExec';

export function DevExecChat() {
    const {
        isOpen, isMinimized, messages, isLoading,
        minimizeChat, restoreChat, toggleChat, sendMessage, clearChat,
        screenplays, apiKey,
    } = useDevExec();

    const {
        isConnected, isConnecting, connect, disconnect, volume, error: liveError,
    } = useLiveDevExec();

    const [input, setInput] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    useEffect(() => {
        if (isOpen && !isMinimized && !isConnected) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, isMinimized, isConnected]);

    const handleSend = useCallback((messageOverride?: string) => {
        const text = messageOverride || input.trim();
        if (!text) return;
        setInput('');
        sendMessage(text);
    }, [input, sendMessage]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleMicClick = useCallback(() => {
        if (isConnected) {
            disconnect();
        } else {
            connect('Charon' as LiveVoiceName, screenplays, apiKey);
        }
    }, [isConnected, connect, disconnect, screenplays, apiKey]);

    if (!isOpen) return null;

    // ─── Minimized ───
    if (isMinimized) {
        return (
            <div
                onClick={restoreChat}
                className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2 rounded-full bg-black-900/90 border border-gold-500/30 cursor-pointer hover:border-gold-500/60 transition-all shadow-lg backdrop-blur-xl"
            >
                <span className="text-lg">🎬</span>
                <span className="text-sm font-medium text-gold-400">DEV EXEC</span>
                {(messages.length > 0 || isConnected) && (
                    <span className={clsx(
                        'w-2 h-2 rounded-full animate-pulse',
                        isConnected ? 'bg-green-400' : 'bg-gold-400',
                    )} />
                )}
            </div>
        );
    }

    // ─── Full Panel ───
    const panelSize = isExpanded ? 'w-[600px] h-[80vh]' : 'w-[420px] h-[600px]';
    const ringScale = 1 + volume * 8;

    return (
        <div className={clsx(
            'fixed bottom-6 right-6 z-[100] flex flex-col rounded-2xl overflow-hidden',
            'bg-black-950/95 border shadow-2xl backdrop-blur-xl',
            'transition-all duration-300',
            isConnected ? 'border-green-500/30' : 'border-gold-500/20',
            panelSize,
        )}>
            {/* ═══ HEADER ═══ */}
            <div className={clsx(
                'flex items-center justify-between px-4 py-3 border-b',
                isConnected
                    ? 'bg-gradient-to-r from-green-900/30 to-black-900/80 border-green-500/20'
                    : 'bg-gradient-to-r from-gold-900/30 to-black-900/80 border-gold-500/20',
            )}>
                <div className="flex items-center gap-2">
                    {isConnected ? (
                        <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                    ) : (
                        <span className="text-lg">🎬</span>
                    )}
                    <span className={clsx(
                        'text-sm font-bold tracking-wider',
                        isConnected ? 'text-green-400' : 'text-gold-400',
                    )}>
                        DEV EXEC
                    </span>
                    {isConnected && (
                        <span className="text-xs text-green-400/70 font-medium">LIVE</span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {!isConnected && (
                        <button onClick={clearChat} className="p-1.5 rounded-lg text-black-500 hover:text-red-400 hover:bg-white/5 transition-colors" title="Clear">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 rounded-lg text-black-500 hover:text-gold-400 hover:bg-white/5 transition-colors" title={isExpanded ? 'Collapse' : 'Expand'}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {isExpanded ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M15 9V4.5M15 9h4.5M9 15v4.5M9 15H4.5M15 15v4.5M15 15h4.5" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            )}
                        </svg>
                    </button>
                    <button onClick={minimizeChat} className="p-1.5 rounded-lg text-black-500 hover:text-gold-400 hover:bg-white/5 transition-colors" title="Minimize">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                    </button>
                    <button onClick={() => { if (isConnected) disconnect(); toggleChat(); }} className="p-1.5 rounded-lg text-black-500 hover:text-red-400 hover:bg-white/5 transition-colors" title="Close">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ═══ BODY ═══ */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Messages area (scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                    {messages.length === 0 && !isConnected && !isConnecting ? (
                        /* Empty state with quick actions */
                        <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                            <p className="text-gold-400 font-medium text-sm">Your Head of Development</p>
                            <p className="text-black-500 text-xs">
                                Knows every script in your pipeline.<br />
                                Ask about projects, strategy, or the slate.
                            </p>

                            {/* Quick Actions */}
                            <div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-3">
                                {QUICK_ACTIONS.map((action) => (
                                    <button
                                        key={action.label}
                                        onClick={() => handleSend(action.prompt)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left bg-black-900/50 border border-gold-500/10 hover:border-gold-500/30 hover:bg-black-800/50 transition-all text-black-300 hover:text-gold-300"
                                    >
                                        <span>{action.icon}</span>
                                        <span>{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : isConnected || isConnecting ? (
                        /* ─── LIVE VOICE MODE ─── */
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            {/* Status */}
                            <div className="text-center">
                                <h3 className="text-gold-400 font-bold text-lg">
                                    {isConnecting ? 'Connecting...' : 'Live Conversation'}
                                </h3>
                                <p className="text-black-500 text-sm mt-1">
                                    {isConnecting
                                        ? 'Setting up voice connection'
                                        : 'Speak naturally. Your Dev Exec is listening.'
                                    }
                                </p>
                            </div>

                            {/* Volume dots */}
                            {isConnected && (
                                <div className="flex gap-1.5">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <span
                                            key={i}
                                            className={clsx(
                                                'w-2 h-6 rounded-full transition-all duration-75',
                                                volume * 20 > i ? 'bg-gold-400' : 'bg-black-800',
                                            )}
                                            style={{
                                                height: volume * 20 > i ? `${12 + Math.random() * 16}px` : '8px',
                                            }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Error */}
                            {liveError && (
                                <p className="text-red-400 text-xs text-center px-4">{liveError}</p>
                            )}

                            {/* End button */}
                            {isConnected && (
                                <button
                                    onClick={disconnect}
                                    className="px-6 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
                                >
                                    End Conversation
                                </button>
                            )}
                        </div>
                    ) : (
                        /* ─── TEXT MESSAGES ─── */
                        <>
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={clsx(
                                        'flex',
                                        msg.role === 'user' ? 'justify-end' : 'justify-start',
                                    )}
                                >
                                    <div className={clsx(
                                        'max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                                        msg.role === 'user'
                                            ? 'bg-gold-500/15 text-gold-100 rounded-br-md'
                                            : 'bg-black-800/60 text-black-200 rounded-bl-md border border-black-700/50',
                                    )}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-black-800/60 border border-black-700/50 px-4 py-3 rounded-2xl rounded-bl-md">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <span className="w-2 h-2 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <span className="w-2 h-2 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <span className="w-2 h-2 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                            <span className="text-xs text-black-500">Thinking...</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* ═══ CENTER MIC BUTTON — always visible ═══ */}
                <div className="flex flex-col items-center py-3 border-t border-gold-500/10 bg-black-900/30">
                    {/* Big mic button */}
                    <div className="relative flex items-center justify-center mb-3">
                        {/* Animated volume rings */}
                        {(isConnected || isConnecting) && (
                            <>
                                <div
                                    className="absolute rounded-full border-2 border-gold-500/20 transition-transform duration-75"
                                    style={{
                                        width: '80px', height: '80px',
                                        transform: `scale(${ringScale})`,
                                    }}
                                />
                                <div
                                    className="absolute rounded-full border border-gold-500/10 transition-transform duration-100"
                                    style={{
                                        width: '96px', height: '96px',
                                        transform: `scale(${1 + volume * 5})`,
                                    }}
                                />
                            </>
                        )}

                        <button
                            onClick={handleMicClick}
                            disabled={isLoading}
                            className={clsx(
                                'relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg',
                                isConnected
                                    ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/20 hover:from-red-400 hover:to-red-500'
                                    : isConnecting
                                        ? 'bg-gold-500/30 animate-pulse'
                                        : 'bg-gradient-to-br from-gold-500 to-gold-600 shadow-gold-500/20 hover:from-gold-400 hover:to-gold-500',
                            )}
                            title={isConnected ? 'End conversation' : 'Start live voice conversation'}
                        >
                            {isConnected ? (
                                /* Stop icon */
                                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                            ) : (
                                /* Mic icon */
                                <svg className="w-7 h-7 text-black-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Mic label */}
                    <p className="text-black-600 text-[10px] uppercase tracking-wider mb-2">
                        {isConnected ? 'Tap to end' : isConnecting ? 'Connecting...' : 'Tap to talk'}
                    </p>

                    {/* Text input (below mic) */}
                    {!isConnected && !isConnecting && (
                        <div className="w-full px-3">
                            <div className="flex items-end gap-2">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Or type a message..."
                                    rows={1}
                                    className="flex-1 resize-none bg-black-800/50 border border-black-700 rounded-xl px-4 py-2 text-sm text-black-200 placeholder-black-600 focus:outline-none focus:border-gold-500/40 transition-colors"
                                    style={{ maxHeight: '80px' }}
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isLoading}
                                    className={clsx(
                                        'p-2 rounded-xl transition-all',
                                        input.trim() && !isLoading
                                            ? 'bg-gold-500 text-black-950 hover:bg-gold-400'
                                            : 'bg-black-800 text-black-600 cursor-not-allowed',
                                    )}
                                    title="Send"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
