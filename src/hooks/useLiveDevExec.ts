/**
 * useLiveDevExec — Real-time voice conversation with the Development Executive.
 *
 * Uses Gemini Live API via raw WebSocket for bidirectional audio:
 * - User speaks via microphone → PCM 16kHz → Gemini
 * - Gemini responds with natural voice → PCM 24kHz → speakers
 *
 * Protocol reverse-engineered from @google/genai SDK v1.41.0 source code.
 * Uses raw WebSocket — no SDK dependency needed.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPcmBlob, decode, decodeAudioData } from '@/utils/audioUtils';
import type { Screenplay } from '@/types';

export type LiveVoiceName = 'Kore' | 'Puck' | 'Charon' | 'Aoede' | 'Fenrir' | 'Zephyr';

// WebSocket endpoint and model — verified against SDK source
const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

// ─── System Instruction ──────────────────────────────────────────────────────

function buildSystemInstruction(screenplays: Screenplay[]): string {
    const total = screenplays.length;
    const filmNow = screenplays.filter(s => s.recommendation === 'film_now');
    const recommend = screenplays.filter(s => s.recommendation === 'recommend');
    const consider = screenplays.filter(s => s.recommendation === 'consider');
    const pass = screenplays.filter(s => s.recommendation === 'pass');

    const top5 = [...screenplays].sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 5);
    const topList = top5.map((s, i) =>
        `${i + 1}. "${s.title}" by ${s.author} - ${s.weightedScore.toFixed(1)}/10, ${s.genre}`
    ).join('\n');

    const genres: Record<string, number> = {};
    screenplays.forEach(s => { genres[s.genre || 'Unknown'] = (genres[s.genre || 'Unknown'] || 0) + 1; });
    const genreList = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([g, c]) => `${g}: ${c}`).join(', ');

    return `You are the Head of Development at Lemon Studios, having a VOICE CONVERSATION with the company's producer.

PERSONALITY:
- Strategic and decisive. Recommend clear actions.
- You know every script in the pipeline — reference them by name.
- Development-minded. You see potential in scripts that need work.
- Market-aware. You know what buyers and audiences want.
- Honest but constructive. Flag risks while highlighting opportunity.

VOICE STYLE:
- Talk naturally, like you're in a meeting together. Not reading a report.
- Keep responses tight. 2-4 sentences per thought. This is a conversation.
- Reference specific project titles and scores when giving advice.
- Be encouraging about strong material, direct about weak material.
- No bullet points, no numbered lists — just talk.

YOUR SLATE:
- Total scripts: ${total}
- FILM NOW: ${filmNow.length} | STRONG CONSIDER: ${recommend.length} | CONSIDER: ${consider.length} | PASS: ${pass.length}
- Top genres: ${genreList}

TOP 5 SCRIPTS:
${topList}

${filmNow.length > 0 ? `FILM NOW TITLES: ${filmNow.map(s => `"${s.title}" (${s.weightedScore.toFixed(1)})`).join(', ')}` : ''}

Remember: you're TALKING, not writing. Keep it conversational. Short sentences. Natural rhythm.`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLiveDevExec() {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const wsRef = useRef<WebSocket | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);

    const cleanup = useCallback(() => {
        activeSourcesRef.current.forEach(source => {
            try { source.stop(); } catch { /* already stopped */ }
        });
        activeSourcesRef.current.clear();

        if (wsRef.current) {
            try {
                if (wsRef.current.readyState === WebSocket.OPEN ||
                    wsRef.current.readyState === WebSocket.CONNECTING) {
                    wsRef.current.close();
                }
            } catch { /* ignore */ }
            wsRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (inputAudioContextRef.current) {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }

        outputNodeRef.current = null;
        setIsConnected(false);
        setIsConnecting(false);
        setVolume(0);
    }, []);

    const connect = useCallback(async (
        voiceName: LiveVoiceName,
        screenplays: Screenplay[],
        apiKey: string,
    ) => {
        if (isConnecting || isConnected) return;
        setIsConnecting(true);
        setError(null);

        try {
            if (!apiKey) throw new Error('No API key. Go to Settings → API Configuration.');

            // Get microphone
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const outputCtx = new AudioCtx({ sampleRate: 24000 });
            const inputCtx = new AudioCtx({ sampleRate: 16000 });
            audioContextRef.current = outputCtx;
            inputAudioContextRef.current = inputCtx;
            nextStartTimeRef.current = 0;

            const outputNode = outputCtx.createGain();
            outputNode.connect(outputCtx.destination);
            outputNodeRef.current = outputNode;

            const systemText = buildSystemInstruction(screenplays);

            // ─── CONNECT VIA RAW WEBSOCKET ───
            // Format verified against @google/genai SDK v1.41.0 source code
            const ws = new WebSocket(`${WS_URL}?key=${apiKey}`);
            wsRef.current = ws;

            ws.onopen = () => {
                // Setup message — exact format from SDK's liveConnectParametersToMldev()
                // and liveConnectConfigToMldev()
                const setupMessage = {
                    setup: {
                        model: MODEL,
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: voiceName,
                                    },
                                },
                            },
                        },
                        systemInstruction: {
                            role: 'user',
                            parts: [{ text: systemText }],
                        },
                    },
                };

                ws.send(JSON.stringify(setupMessage));
            };

            ws.onmessage = async (event) => {
                try {
                    let data: Record<string, unknown>;
                    if (typeof event.data === 'string') {
                        data = JSON.parse(event.data);
                    } else if (event.data instanceof Blob) {
                        data = JSON.parse(await event.data.text());
                    } else {
                        return;
                    }


                    // ─── SETUP COMPLETE ───
                    if ('setupComplete' in data) {
                        setIsConnected(true);
                        setIsConnecting(false);

                        const micSource = inputCtx.createMediaStreamSource(stream);
                        sourceRef.current = micSource;

                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        processorRef.current = processor;
                        let chunkCount = 0;

                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);

                            // Volume for visualizer
                            let sum = 0;
                            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                            setVolume(Math.sqrt(sum / inputData.length));

                            // Send audio to Gemini via realtimeInput.audio
                            // NOTE: mediaChunks is DEPRECATED per Google API docs.
                            // New format uses the `audio` field directly.
                            if (ws.readyState === WebSocket.OPEN) {
                                const pcm = createPcmBlob(inputData);
                                chunkCount++;
                                ws.send(JSON.stringify({
                                    realtimeInput: {
                                        audio: pcm,
                                    },
                                }));
                            }
                        };

                        micSource.connect(processor);
                        processor.connect(inputCtx.destination);
                        return;
                    }

                    // ─── SERVER CONTENT (audio response / interruption) ───
                    // SDK source (line 12722): for non-Vertex, data is used directly
                    const sc = data.serverContent as Record<string, unknown> | undefined;
                    if (sc) {
                        // Audio from model
                        const mt = sc.modelTurn as Record<string, unknown> | undefined;
                        const parts = mt?.parts as Array<Record<string, unknown>> | undefined;

                        if (parts && outputCtx && outputNodeRef.current) {
                            for (const part of parts) {
                                const inlineData = part.inlineData as { data?: string } | undefined;
                                if (inlineData?.data) {
                                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);

                                    const audioBuffer = await decodeAudioData(
                                        decode(inlineData.data),
                                        outputCtx,
                                        24000,
                                        1,
                                    );

                                    const bufferSource = outputCtx.createBufferSource();
                                    bufferSource.buffer = audioBuffer;
                                    bufferSource.connect(outputNodeRef.current);
                                    bufferSource.addEventListener('ended', () => {
                                        activeSourcesRef.current.delete(bufferSource);
                                    });
                                    bufferSource.start(nextStartTimeRef.current);
                                    nextStartTimeRef.current += audioBuffer.duration;
                                    activeSourcesRef.current.add(bufferSource);
                                }
                            }
                        }

                        // Interruption
                        if (sc.interrupted) {
                            activeSourcesRef.current.forEach(src => {
                                try { src.stop(); } catch { /* already stopped */ }
                            });
                            activeSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    }
                } catch (parseErr) {
                    console.warn('[LiveDevExec] Parse error:', parseErr);
                }
            };

            ws.onclose = (event) => {
                console.log('[LiveDevExec] Closed:', event.code, event.reason);
                if (event.code !== 1000) {
                    setError(`Connection closed: ${event.reason || `code ${event.code}`}`);
                }
                cleanup();
            };

            ws.onerror = () => {
                console.error('[LiveDevExec] WebSocket error');
                setError('Connection error — check your API key');
                cleanup();
            };

        } catch (err) {
            console.error('[LiveDevExec] Failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to connect');
            cleanup();
        }
    }, [isConnecting, isConnected, cleanup]);

    useEffect(() => {
        return () => { cleanup(); };
    }, [cleanup]);

    return {
        isConnected,
        isConnecting,
        connect,
        disconnect: cleanup,
        volume,
        error,
    };
}
