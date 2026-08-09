import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrivateReaderChat } from '@/components/project/PrivateReaderChat';
import { loadPrivateReaderConversation, sendPrivateReaderMessage } from '@/lib/privateReaderChat';

vi.mock('@/lib/privateReaderChat', () => ({
  privateReaderChatMode: () => 'live',
  loadPrivateReaderConversation: vi.fn(async () => ({
    threadId: 'thread-1',
    exists: true,
    provenance: {
      charterVersion: 'reader-charters-v1',
      modelId: 'claude-opus-5',
      sealedProjectId: 'atlas',
      sealedVersionId: 'sealed-v1',
    },
    messages: [
      {
        id: 'question-1',
        role: 'producer',
        text: 'Why did you underweight the comedy?',
        citations: [],
        createdAt: '2026-08-02T11:59:00.000Z',
      },
      {
        id: 'message-1',
        role: 'reader',
        text: 'I <cite index="1-10,1-12">underweighted the comic escalation</cite>.',
        citations: [{ page: 35, note: 'The joke compounds through the reversal.' }],
        position: 'reconsidered',
        reconsideredPosition: {
          summary: 'The protagonist is more active than my sealed report allowed.',
          suggestedScore: 6.4,
        },
        modelId: 'claude-opus-5',
        effort: 'high',
        requestedModelChoice: 'auto',
        routeReason: 'auto_default_opus',
        routeLabel: 'Auto selected Opus 5',
        routingPolicyVersion: 'reader-chat-routing-v1',
        modelAttempts: [{ modelId: 'claude-opus-5', outcome: 'success' }],
        usage: {
          input_tokens: 1_200,
          output_tokens: 320,
          cache_creation_input_tokens: 18_000,
          cache_read_input_tokens: 42_000,
          actual_cost_usd: 0.1245,
        },
        createdAt: '2026-08-02T12:00:00.000Z',
      },
    ],
  })),
  sendPrivateReaderMessage: vi.fn(),
}));

const report = {
  reader: 'structure',
  label: 'Structure',
  pillarScore: 5.2,
  oneSentenceVerdict: 'The ending arrives late.',
  redFlags: [],
  subScores: [],
};

beforeEach(() => {
  vi.mocked(loadPrivateReaderConversation).mockClear();
  vi.mocked(sendPrivateReaderMessage).mockReset();
});

describe('PrivateReaderChat', () => {
  it('shows citations and a reconsidered view without replacing the sealed score', async () => {
    render(
      <PrivateReaderChat
        open
        onClose={vi.fn()}
        projectId="atlas"
        versionId="sealed-v1"
        reader="structure"
        readerName="Lena Park"
        readerRole="Structure Reader"
        readerImage="/reader-personas/structure.jpg"
        report={report}
      />,
    );

    expect(await screen.findByText('I underweighted the comic escalation.')).toBeInTheDocument();
    expect(screen.queryByText(/<cite/i)).not.toBeInTheDocument();
    expect(screen.getByText('p. 35')).toBeInTheDocument();
    expect(screen.getByText('Position reconsidered')).toBeInTheDocument();
    expect(screen.getByText('New private view: 6.4')).toBeInTheDocument();
    expect(screen.getByText('The sealed score above has not changed.')).toBeInTheDocument();
    expect(screen.getByText('Answered with Opus 5 · high effort')).toBeInTheDocument();
    expect(screen.getByText('Auto selected Opus 5')).toBeInTheDocument();
    expect(screen.getByText(/\$0\.1245/)).toBeInTheDocument();
    expect(screen.getByText(/42,000 cache read/)).toBeInTheDocument();
    expect(screen.getByText(/18,000 cache write/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Get Fable 5’s deeper second opinion/i }),
    ).toBeInTheDocument();
  });

  it('sends an explicit Fable selection through the secure request seam', async () => {
    const user = userEvent.setup();
    vi.mocked(sendPrivateReaderMessage).mockResolvedValue({
      threadId: 'thread-1',
      exists: true,
      provenance: null,
      messages: [],
    });
    render(
      <PrivateReaderChat
        open
        onClose={vi.fn()}
        projectId="atlas"
        versionId="sealed-v1"
        reader="structure"
        readerName="Lena Park"
        readerRole="Structure Reader"
        readerImage="/reader-personas/structure.jpg"
        report={report}
      />,
    );

    await screen.findByText('I underweighted the comic escalation.');
    await user.click(screen.getByRole('button', { name: /Fable 5 Deepest/i }));
    await user.type(screen.getByLabelText(/Ask Lena anything/i), 'Take the deepest possible look.');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(sendPrivateReaderMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Take the deepest possible look.',
        modelChoice: 'fable',
      }),
    );
  });

  it('submits with Enter, keeps Shift+Enter as a line break, and shows an immediate thinking state', async () => {
    const user = userEvent.setup();
    let resolveSend:
      | ((value: Awaited<ReturnType<typeof sendPrivateReaderMessage>>) => void)
      | undefined;
    vi.mocked(sendPrivateReaderMessage).mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );
    render(
      <PrivateReaderChat
        open
        onClose={vi.fn()}
        projectId="atlas"
        versionId="sealed-v1"
        reader="structure"
        readerName="Lena Park"
        readerRole="Structure Reader"
        readerImage="/reader-personas/structure.jpg"
        report={report}
      />,
    );

    const composer = await screen.findByLabelText(/Ask Lena anything/i);
    await user.type(composer, 'What changes{Shift>}{Enter}{/Shift}your mind?');

    expect(composer).toHaveValue('What changes\nyour mind?');
    expect(sendPrivateReaderMessage).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');

    expect(sendPrivateReaderMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'What changes\nyour mind?',
      }),
    );
    expect(screen.getByText(/What changes\s+your mind\?/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /Lena is thinking/i })).toBeInTheDocument();

    await act(async () => {
      resolveSend?.({
        threadId: 'thread-1',
        exists: true,
        provenance: null,
        messages: [
          {
            id: 'question-new',
            role: 'producer',
            text: 'What changes\nyour mind?',
            citations: [],
            createdAt: '2026-08-03T12:00:00.000Z',
          },
          {
            id: 'answer-new',
            role: 'reader',
            text: 'Show me a decisive final choice. Then let the consequence land before the resolution.',
            citations: [{ page: 91, note: 'The current final choice occurs here.' }],
            position: 'clarified',
            modelId: 'claude-opus-5',
            effort: 'high',
            createdAt: '2026-08-03T12:00:01.000Z',
          },
        ],
      });
    });

    const finishReveal = await screen.findByRole('button', { name: /Show full response/i });
    await user.click(finishReveal);
    expect(screen.getByText(/Show me a decisive final choice/)).toBeInTheDocument();
    await waitFor(() => expect(composer).toHaveFocus());
  });

  it('restores a failed question to the composer', async () => {
    const user = userEvent.setup();
    vi.mocked(sendPrivateReaderMessage).mockRejectedValue(new Error('Reader service unavailable.'));
    render(
      <PrivateReaderChat
        open
        onClose={vi.fn()}
        projectId="atlas"
        versionId="sealed-v1"
        reader="structure"
        readerName="Lena Park"
        readerRole="Structure Reader"
        readerImage="/reader-personas/structure.jpg"
        report={report}
      />,
    );

    const composer = await screen.findByLabelText(/Ask Lena anything/i);
    await user.type(composer, 'Do not lose this question.{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Reader service unavailable.');
    expect(composer).toHaveValue('Do not lose this question.');
    expect(composer).toHaveFocus();
  });

  it('requests a one-click Fable deep review of the prior producer question', async () => {
    const user = userEvent.setup();
    vi.mocked(sendPrivateReaderMessage).mockResolvedValue({
      threadId: 'thread-1',
      exists: true,
      provenance: null,
      messages: [],
    });
    render(
      <PrivateReaderChat
        open
        onClose={vi.fn()}
        projectId="atlas"
        versionId="sealed-v1"
        reader="structure"
        readerName="Lena Park"
        readerRole="Structure Reader"
        readerImage="/reader-personas/structure.jpg"
        report={report}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: /Get Fable 5’s deeper second opinion/i }),
    );

    expect(sendPrivateReaderMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Why did you underweight the comedy?',
        modelChoice: 'fable',
        deepReview: true,
      }),
    );
  });

  it('closes the private conversation with Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PrivateReaderChat
        open
        onClose={onClose}
        projectId="atlas"
        versionId="sealed-v1"
        reader="structure"
        readerName="Lena Park"
        readerRole="Structure Reader"
        readerImage="/reader-personas/structure.jpg"
        report={report}
      />,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
