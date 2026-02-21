/**
 * DevExecContext — State management for the Development Executive AI chat.
 *
 * Manages: open/minimized state, message history, localStorage persistence.
 * Pattern cloned from ScreenPartner's ScreenwriterContext.
 */

import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import type { Screenplay } from '@/types';
import { sendDevExecMessage, type ChatMessage } from '@/services/devExecService';

const STORAGE_KEY = 'lemon_dev_exec_chat';
const MAX_MESSAGES = 60;

interface DevExecContextType {
    isOpen: boolean;
    isMinimized: boolean;
    messages: ChatMessage[];
    isLoading: boolean;
    toggleChat: () => void;
    minimizeChat: () => void;
    restoreChat: () => void;
    sendMessage: (content: string) => Promise<void>;
    clearChat: () => void;
    unreadCount: number;
    markAsRead: () => void;
    screenplays: Screenplay[];
    apiKey: string;
}

const DevExecContext = createContext<DevExecContextType | undefined>(undefined);

interface DevExecProviderProps {
    children: ReactNode;
    screenplays: Screenplay[];
    apiKey: string;
}

export function DevExecProvider({ children, screenplays, apiKey }: DevExecProviderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.messages || [];
            }
        } catch { /* silent */ }
        return [];
    });
    const [isLoading, setIsLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const isLoadingRef = useRef(false);
    const screenplaysRef = useRef(screenplays);

    // Keep screenplays ref fresh
    useEffect(() => {
        screenplaysRef.current = screenplays;
    }, [screenplays]);

    // Persist messages to localStorage
    useEffect(() => {
        try {
            const data = JSON.stringify({ messages: messages.slice(-MAX_MESSAGES) });
            const sizeInMB = new Blob([data]).size / (1024 * 1024);
            if (sizeInMB < 3) localStorage.setItem(STORAGE_KEY, data);
        } catch { /* silent */ }
    }, [messages]);

    const toggleChat = useCallback(() => {
        if (isMinimized) {
            setIsMinimized(false);
        } else {
            setIsOpen(prev => !prev);
            setIsMinimized(false);
        }
        setUnreadCount(0);
    }, [isMinimized]);

    const minimizeChat = useCallback(() => setIsMinimized(true), []);
    const restoreChat = useCallback(() => { setIsMinimized(false); setUnreadCount(0); }, []);
    const markAsRead = useCallback(() => setUnreadCount(0), []);

    const clearChat = useCallback(() => {
        setMessages([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoadingRef.current) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), userMessage]);
        setIsLoading(true);
        isLoadingRef.current = true;

        try {
            const response = await sendDevExecMessage(
                content,
                screenplaysRef.current,
                messages.slice(-12),
                apiKey,
            );

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: Date.now(),
            };

            setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), assistantMessage]);
            if (isMinimized) setUnreadCount(prev => prev + 1);
        } catch (error) {
            console.error('[DevExec] Send error:', error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant' as const,
                content: error instanceof Error
                    ? `Error: ${error.message}`
                    : 'Connection issue — try again in a moment.',
                timestamp: Date.now(),
            }]);
        } finally {
            setIsLoading(false);
            isLoadingRef.current = false;
        }
    }, [messages, apiKey, isMinimized]);

    return (
        <DevExecContext.Provider value={{
            isOpen, isMinimized, messages, isLoading,
            toggleChat, minimizeChat, restoreChat,
            sendMessage, clearChat, unreadCount, markAsRead,
            screenplays, apiKey,
        }}>
            {children}
        </DevExecContext.Provider>
    );
}

export function useDevExec() {
    const context = useContext(DevExecContext);
    if (!context) throw new Error('useDevExec must be used within DevExecProvider');
    return context;
}
