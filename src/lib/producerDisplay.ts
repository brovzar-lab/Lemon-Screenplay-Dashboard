const PRODUCER_TERMS: Record<string, string> = {
  craft_scene: 'Craft & Scene',
  craft_warning_red: 'craft warning',
  emotional_resonance: 'Emotional Resonance',
  film_now: 'FILM NOW',
  genre_execution: 'Genre Execution',
  reader_disagreement: 'Reader disagreement',
  supporting_cast: 'Supporting Cast',
};

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatProducerTaxonomy(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';
  const mapped = PRODUCER_TERMS[normalized.toLowerCase()];
  return mapped ?? titleCase(normalized.replaceAll('_', ' ').replaceAll('-', ' '));
}

export function formatProducerText(value: string): string {
  return value.replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi, (token) => {
    const mapped = PRODUCER_TERMS[token.toLowerCase()];
    return mapped ?? token.replaceAll('_', ' ');
  });
}

export function formatProducerHeading(value: string): string {
  const cleaned = formatProducerText(value).replace(/craft\s*\/\s*scene/gi, 'Craft & Scene');
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '';
}

export function formatAnalysisVersion(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return 'Analysis version not recorded';
  const versionMatch = normalized.match(/^v(\d+)(?:[_\s-]+(.+))?$/i);
  if (!versionMatch) return formatProducerTaxonomy(normalized);
  const suffix = versionMatch[2] ? ` ${titleCase(versionMatch[2].replaceAll('_', ' '))}` : '';
  return `V${versionMatch[1]}${suffix}`;
}

export function formatReaderPosition(value: string): string {
  const labels: Record<string, string> = {
    clarified: 'Position clarified',
    reconsidered: 'Position reconsidered',
    unchanged: 'Position unchanged',
  };
  return labels[value] ?? formatProducerTaxonomy(value);
}
