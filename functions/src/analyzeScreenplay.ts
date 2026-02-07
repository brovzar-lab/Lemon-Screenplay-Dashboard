/**
 * analyzeScreenplay Cloud Function
 *
 * Accepts screenplay text + metadata, calls Anthropic API with the V6 prompt,
 * and returns the raw analysis JSON. The client normalizes it.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import Anthropic from '@anthropic-ai/sdk';
import { buildV6Prompt, type LensName } from './prompts';

const CLAUDE_MODELS: Record<string, string> = {
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001',
  opus: 'claude-opus-4-6',
};

const MAX_TEXT_LENGTH = 400_000;

interface AnalyzeRequest {
  text: string;
  metadata: {
    title: string;
    pageCount: number;
    wordCount: number;
  };
  lenses: LensName[];
  apiKey: string;
  model?: string; // 'sonnet' | 'haiku' | 'opus'
}

export const analyzeScreenplay = onCall(
  {
    timeoutSeconds: 540,   // 9 min — analysis can take 2-5 min
    memory: '512MiB',
    maxInstances: 5,
    cors: true,
  },
  async (request) => {
    const data = request.data as AnalyzeRequest;

    // Validate required fields
    if (!data.text || typeof data.text !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing or invalid screenplay text');
    }
    if (!data.apiKey || typeof data.apiKey !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing API key');
    }
    if (!data.metadata?.title) {
      throw new HttpsError('invalid-argument', 'Missing metadata.title');
    }

    // Truncate text if too long
    let text = data.text;
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH) + '\n\n[... truncated ...]';
    }

    const modelKey = data.model || 'sonnet';
    const model = CLAUDE_MODELS[modelKey] || CLAUDE_MODELS.sonnet;
    const lenses = data.lenses || [];

    // Build prompt
    const prompt = buildV6Prompt(text, data.metadata, lenses);

    // Call Anthropic API
    const client = new Anthropic({ apiKey: data.apiKey });

    try {
      const message = await client.messages.create({
        model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      // Parse JSON from response
      let analysis: Record<string, unknown>;
      try {
        analysis = JSON.parse(responseText);
      } catch {
        // Try to extract JSON from response with extra text
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new HttpsError('internal', 'Failed to parse analysis JSON from Claude response');
        }
      }

      // Wrap in standard V6 output structure
      return {
        source_file: data.metadata.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf',
        analysis_model: `claude-${modelKey}`,
        analysis_version: 'v6_unified',
        lenses_enabled: lenses,
        metadata: {
          filename: data.metadata.title + '.pdf',
          page_count: data.metadata.pageCount,
          word_count: data.metadata.wordCount,
        },
        analysis,
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
        },
      };
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;

      const err = error as { status?: number; message?: string };
      if (err.status === 401) {
        throw new HttpsError('unauthenticated', 'Invalid Anthropic API key');
      }
      if (err.status === 429) {
        throw new HttpsError('resource-exhausted', 'Anthropic rate limit exceeded. Please wait and try again.');
      }
      throw new HttpsError('internal', `Analysis failed: ${err.message || 'Unknown error'}`);
    }
  },
);
