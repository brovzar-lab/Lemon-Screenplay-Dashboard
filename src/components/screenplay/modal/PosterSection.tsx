import { useEffect, useState } from 'react';
import type { Screenplay } from '@/types';
import { usePosterStore } from '@/stores/posterStore';
import { generatePoster } from '@/lib/analysisService';

interface PosterSectionProps {
    screenplay: Screenplay;
}

export function PosterSection({ screenplay }: PosterSectionProps) {
    const { posters, setPosterStatus } = usePosterStore();
    const [errorType, setErrorType] = useState<'key_missing' | 'generic' | null>(null);

    // Merge prop state with store state
    const storedPoster = posters[screenplay.id];
    const posterUrl = storedPoster?.url || screenplay.posterUrl;
    const posterStatus = storedPoster?.status || screenplay.posterStatus || 'pending';

    // Auto-generate on mount if missing
    useEffect(() => {
        if (!posterUrl && posterStatus !== 'generating' && posterStatus !== 'ready' && posterStatus !== 'error') {
            const generate = async () => {
                setPosterStatus(screenplay.id, 'generating');
                try {
                    const url = await generatePoster(screenplay.title, screenplay.logline, screenplay.genre, screenplay.id);
                    setPosterStatus(screenplay.id, 'ready', url);
                    setErrorType(null);
                } catch (error) {
                    console.error('Poster generation failed', error);
                    setErrorType(error instanceof Error && error.message === 'GOOGLE_API_KEY_MISSING' ? 'key_missing' : 'generic');
                    setPosterStatus(screenplay.id, 'error');
                }
            };
            generate();
        }
    }, [screenplay.id, posterUrl, posterStatus, setPosterStatus, screenplay.title, screenplay.logline, screenplay.genre]);

    const handleRegenerate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setPosterStatus(screenplay.id, 'generating');
        try {
            const url = await generatePoster(screenplay.title, screenplay.logline, screenplay.genre, screenplay.id);
            setPosterStatus(screenplay.id, 'ready', url);
            setErrorType(null);
        } catch (error) {
            setErrorType(error instanceof Error && error.message === 'GOOGLE_API_KEY_MISSING' ? 'key_missing' : 'generic');
            setPosterStatus(screenplay.id, 'error');
        }
    };

    return (
        <div className="relative w-full h-[500px] bg-black-950 overflow-hidden shrink-0 group">
            {/* Loading State */}
            {posterStatus === 'generating' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <div className="relative w-12 h-12 mb-4">
                        <div className="absolute inset-0 rounded-full border-2 border-gold-500/30"></div>
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-500 animate-spin"></div>
                    </div>
                    <p className="text-gold-400 font-display tracking-widest text-sm animate-pulse">CREATING POSTER...</p>
                </div>
            )}

            {/* Error State — API Key Missing */}
            {posterStatus === 'error' && errorType === 'key_missing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black-900/80 px-6">
                    <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mb-4">
                        <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <p className="text-amber-300 font-medium text-sm mb-1">Google API Key Required</p>
                    <p className="text-black-400 text-xs text-center max-w-xs mb-4">
                        Poster generation uses Gemini. Add your Google API key in Settings → API Configuration to enable it.
                    </p>
                    <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gold-400 hover:text-gold-300 underline underline-offset-2"
                    >
                        Get a free API key from Google AI Studio →
                    </a>
                </div>
            )}

            {/* Error State — Generic */}
            {posterStatus === 'error' && errorType !== 'key_missing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black-900/50">
                    <p className="text-red-400 mb-2">Poster Generation Failed</p>
                    <button
                        onClick={handleRegenerate}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm text-white"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Display State */}
            {(posterStatus === 'ready' || posterUrl) && (
                <>
                    {/* Ambient Backgroumd */}
                    <div className="absolute inset-0">
                        <img
                            src={posterUrl}
                            alt=""
                            className="w-full h-full object-cover blur-2xl opacity-40 scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black-900 via-black-900/50 to-transparent" />
                    </div>

                    {/* Main Poster */}
                    <div className="relative h-full flex justify-center items-end pb-0 pt-8 z-10">
                        <img
                            src={posterUrl}
                            alt={`Poster for ${screenplay.title}`}
                            className="h-full object-contain drop-shadow-2xl rounded-t-lg shadow-black-950"
                        />
                    </div>

                    {/* Regenerate Button (Hidden until hover) */}
                    <button
                        onClick={handleRegenerate}
                        className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-lg text-white/50 hover:text-white border border-white/10 transition-all opacity-0 group-hover:opacity-100 z-30"
                        title="Regenerate Poster"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </>
            )}
        </div>
    );
}
