import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DevelopmentOpportunityBadge } from '@/components/discover/DevelopmentOpportunityBadge';
import { createTestScreenplay } from '@/test/factories';
import type { ProducerAssessmentHead } from '@/types';

describe('DevelopmentOpportunityBadge', () => {
  it('surfaces Producer Look separately from the original verdict', () => {
    const screenplay = createTestScreenplay({
      id: 'will',
      projectId: 'will',
      latestVersionId: 'v1',
      weightedScore: 4.7,
      recommendation: 'pass',
    });
    const assessment: ProducerAssessmentHead = {
      producerUid: 'billy',
      projectId: 'will',
      latestAssessmentId: 'take-1',
      revision: 1,
      versionId: 'v1',
      title: 'WILL',
      aiFinalScore: 4.7,
      aiVerdict: 'pass',
      producerScore: 7.6,
      producerVerdict: 'recommend',
      pursuit: 'yes',
      includeInCalibration: true,
      updatedAt: '2026-08-06T18:00:00.000Z',
    };

    render(<DevelopmentOpportunityBadge screenplay={screenplay} assessment={assessment} />);

    expect(screen.getByText('Producer Look')).toBeInTheDocument();
    expect(screen.getByTestId('development-opportunity-badge')).toHaveAttribute(
      'title',
      expect.stringContaining('AI score and verdict remain unchanged'),
    );
  });

  it('renders nothing when opportunity evidence is not corroborated', () => {
    const { container } = render(
      <DevelopmentOpportunityBadge screenplay={createTestScreenplay()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden when the screenplay falls outside the bounded Producer Look queue', () => {
    const screenplay = createTestScreenplay({
      verdictStatement: 'A fresh high-concept comedy with a strong narrative engine.',
      strengths: ['Original voice', 'Commercial hook'],
    });
    const { container } = render(
      <DevelopmentOpportunityBadge screenplay={screenplay} routed={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
