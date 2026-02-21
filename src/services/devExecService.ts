/**
 * Development Executive AI Service
 *
 * Powers the Dev Exec chat panel with Gemini Flash.
 * Uses direct REST API (no SDK required).
 *
 * The persona is Lemon Studios' Head of Development who knows
 * the entire screenplay slate and thinks strategically.
 */

import type { Screenplay } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface QuickAction {
    label: string;
    icon: string;
    prompt: string;
}

// ─── Quick Actions ───────────────────────────────────────────────────────────

export const QUICK_ACTIONS: QuickAction[] = [
    {
        label: 'Slate Overview',
        icon: '📊',
        prompt: 'Give me a high-level read on our current slate. What\'s the overall quality? How does our pipeline look? Any trends I should know about?',
    },
    {
        label: 'Hidden Gems',
        icon: '💎',
        prompt: 'Which PASS or CONSIDER scripts have hidden potential that we might be overlooking? What would it take to develop them into something special?',
    },
    {
        label: 'Priority Reads',
        icon: '🔥',
        prompt: 'From the most recently uploaded scripts, which ones should I prioritize reading first and why? Give me your top 3 with quick reasons.',
    },
    {
        label: 'Portfolio Gaps',
        icon: '🎯',
        prompt: 'What genres, budget tiers, or market segments are we missing in our current slate? Where should we be looking for material?',
    },
    {
        label: 'Dev Strategy',
        icon: '📈',
        prompt: 'Which CONSIDER scripts are closest to being production-ready? What specific development work would elevate them? Give me actionable next steps.',
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tierLabel(tier: string): string {
    const labels: Record<string, string> = {
        film_now: 'FILM NOW',
        recommend: 'STRONG CONSIDER',
        consider: 'CONSIDER',
        pass: 'PASS',
    };
    return labels[tier] || tier.toUpperCase();
}

// ─── Slate Summary Builder ───────────────────────────────────────────────────

function buildSlateSummary(screenplays: Screenplay[]): string {
    if (!screenplays || screenplays.length === 0) {
        return 'No screenplays in the current slate.';
    }

    // Group by recommendation
    const filmNow = screenplays.filter(s => s.recommendation === 'film_now');
    const strongConsider = screenplays.filter(s => s.recommendation === 'recommend');
    const consider = screenplays.filter(s => s.recommendation === 'consider');
    const pass = screenplays.filter(s => s.recommendation === 'pass');

    // Group by genre
    const genreCounts: Record<string, number> = {};
    screenplays.forEach(s => {
        const g = s.genre || 'Unknown';
        genreCounts[g] = (genreCounts[g] || 0) + 1;
    });

    // Group by collection
    const collectionCounts: Record<string, number> = {};
    screenplays.forEach(s => {
        const c = s.collection || 'Unknown';
        collectionCounts[c] = (collectionCounts[c] || 0) + 1;
    });

    // Top scripts by score
    const topScripts = [...screenplays]
        .sort((a, b) => b.weightedScore - a.weightedScore)
        .slice(0, 10);

    // Build summary
    const sections: string[] = [];

    sections.push(`SLATE OVERVIEW: ${screenplays.length} total screenplays`);
    sections.push(`FILM NOW: ${filmNow.length} | STRONG CONSIDER: ${strongConsider.length} | CONSIDER: ${consider.length} | PASS: ${pass.length}`);

    sections.push(`\nGENRE MIX:\n${Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([g, c]) => `  ${g}: ${c}`).join('\n')}`);

    sections.push(`\nCOLLECTIONS:\n${Object.entries(collectionCounts).sort((a, b) => b[1] - a[1]).map(([c, n]) => `  ${c}: ${n}`).join('\n')}`);

    sections.push(`\nTOP 10 BY SCORE:`);
    topScripts.forEach((s, i) => {
        const failures = s.criticalFailures?.length ? ` | ${s.criticalFailures.length} critical failures` : '';
        sections.push(`  ${i + 1}. "${s.title}" by ${s.author} — ${tierLabel(s.recommendation)} (${s.weightedScore.toFixed(1)}/10) | ${s.genre} | ${s.budgetCategory}${failures}`);
    });

    // Detail for FILM NOW scripts
    if (filmNow.length > 0) {
        sections.push(`\nFILM NOW SCRIPTS (highest priority):`);
        filmNow.forEach(s => {
            sections.push(`  "${s.title}" by ${s.author}`);
            sections.push(`    Score: ${s.weightedScore.toFixed(1)} | Genre: ${s.genre} | Budget: ${s.budgetCategory}`);
            sections.push(`    Logline: ${s.logline || 'N/A'}`);
            if (s.verdictStatement) sections.push(`    Verdict: ${s.verdictStatement.substring(0, 200)}...`);
        });
    }

    // Detail for STRONG CONSIDER
    if (strongConsider.length > 0) {
        sections.push(`\nSTRONG CONSIDER SCRIPTS:`);
        strongConsider.forEach(s => {
            sections.push(`  "${s.title}" by ${s.author} — ${s.weightedScore.toFixed(1)}/10 | ${s.genre} | ${s.budgetCategory}`);
            if (s.logline) sections.push(`    Logline: ${s.logline}`);
        });
    }

    // Brief list for CONSIDER
    if (consider.length > 0) {
        sections.push(`\nCONSIDER SCRIPTS:`);
        consider.forEach(s => {
            sections.push(`  "${s.title}" by ${s.author} — ${s.weightedScore.toFixed(1)}/10 | ${s.genre}`);
        });
    }

    // Brief list for PASS (just names)
    if (pass.length > 0) {
        sections.push(`\nPASS SCRIPTS (${pass.length}):`);
        pass.slice(0, 15).forEach(s => {
            sections.push(`  "${s.title}" by ${s.author} — ${s.weightedScore.toFixed(1)}/10 | ${s.genre}${s.criticalFailures?.length ? ` | ${s.criticalFailures.length} critical failures` : ''}`);
        });
        if (pass.length > 15) sections.push(`  ... and ${pass.length - 15} more`);
    }

    return sections.join('\n');
}

// ─── System Prompt ───────────────────────────────────────────────────────────

function generateSystemPrompt(screenplays: Screenplay[]): string {
    const slateSummary = buildSlateSummary(screenplays);

    return `You are the Head of Development at Lemon Studios, a film production company. You've read and analyzed every script in the company's pipeline. You think like a producer — commercial potential, talent attachments, development angles, market positioning, audience appeal.

PERSONALITY:
- Strategic and decisive — recommend clear actions, not vague suggestions
- Data-driven but intuitive — reference scores AND gut instincts
- Development-minded — you see potential in scripts that need work
- Market-aware — you know what buyers, streamers, and audiences want
- Honest but constructive — flag risks while highlighting opportunity
- Conversational — you talk like a real development executive, not a report generator
- Passionate about great stories — you get excited about genuinely good material

YOUR COMPLETE SLATE DATA:
${slateSummary}

SCORING SYSTEM CONTEXT:
- Scores are on a 1-10 scale (weighted average of Character, Structure, Dialogue, Originality, Emotional Impact, Commercial Viability)
- FILM NOW = exceptional, production-ready (typically 8.5+)
- STRONG CONSIDER = strong material worth serious attention (7.5-8.5)
- CONSIDER = promising but needs development work (6.5-7.5)
- PASS = doesn't meet current standards (below 6.5)
- False positive traps = scripts that scored well but have underlying issues (Character Vacuum, Complexity Theater, etc.)
- Budget tiers: Micro (<$5M), Low ($5-15M), Mid ($15-40M), High ($40-100M), Tentpole ($100M+)

WHEN DISCUSSING SCRIPTS:
- Reference specific titles, scores, and verdicts from the slate data
- Give strategic advice — not just "this is good" but "here's what to do with it"
- Connect scripts to market trends and comparable films
- When asked about development, suggest specific types of rewrites needed
- When asked to compare, use concrete score differences and qualitative analysis

WHEN ASKED ABOUT PORTFOLIO STRATEGY:
- Analyze genre balance and budget tier distribution
- Identify gaps that could be filled profitably
- Suggest which scripts to fast-track vs. slow-develop
- Consider packaging angles (director/actor attachments)

FORMAT:
- NEVER use markdown formatting. No #, ##, *, **, \`\`\`, or any markdown syntax.
- Write in clean plain text. Use CAPS for emphasis, dashes for lists, numbers for steps.
- Be concise and direct. Talk like a real exec in a development meeting.
- Reference specific projects by name — you know them all.`;
}

// ─── API Call ────────────────────────────────────────────────────────────────

export async function sendDevExecMessage(
    userMessage: string,
    screenplays: Screenplay[],
    conversationHistory: ChatMessage[],
    apiKey: string,
): Promise<string> {
    if (!userMessage.trim()) throw new Error('Message cannot be empty.');
    if (!apiKey) throw new Error('Google API key not configured. Go to Settings → API Configuration.');

    const systemPrompt = generateSystemPrompt(screenplays);

    // Build conversation with history
    const parts: string[] = [];
    parts.push(`SYSTEM CONTEXT:\n${systemPrompt}\n\n`);

    if (conversationHistory.length > 0) {
        const recent = conversationHistory.slice(-10);
        recent.forEach(msg => {
            if (msg.role === 'user') {
                parts.push(`Producer: ${msg.content}`);
            } else {
                parts.push(`Dev Exec: ${msg.content}`);
            }
        });
    }

    parts.push(`Producer: ${userMessage}`);

    const fullPrompt = parts.join('\n\n');

    // Call Gemini Flash via REST API
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.8,
                },
            }),
        }
    );

    if (!response.ok) {
        const body = await response.text();
        if (response.status === 400 && body.includes('API_KEY')) {
            throw new Error('Invalid Google API key. Check Settings → API Configuration.');
        }
        throw new Error(`Gemini API error (${response.status}): ${body.substring(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || text.trim().length === 0) {
        return 'Something went wrong — try rephrasing your question.';
    }

    return text.trim();
}
