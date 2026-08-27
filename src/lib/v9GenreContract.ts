import rawStoryGrid from '../../execution/story_grid.json';

type GenreEntry = {
  value_spectrum: string;
  core_event?: string;
  value_progression: string;
  obligatory_scenes: Array<{ scene: string; placement: string }>;
  conventions?: string[];
  pairing_rule?: string;
  craft_rules?: string[];
};

type ComedySubgenre = {
  core_tension: string;
  obligatory_scenes: Array<{ scene: string; placement: string }>;
};

const storyGrid = rawStoryGrid as {
  external_genres: Record<string, GenreEntry>;
  comedy_subgenres: Record<string, ComedySubgenre>;
  internal_genres: Record<string, Record<string, string>>;
};

const externalGenres = Object.keys(storyGrid.external_genres);
const internalGenres = new Set(
  Object.values(storyGrid.internal_genres).flatMap((family) => Object.keys(family)),
);
const comedySubgenres = new Set(Object.keys(storyGrid.comedy_subgenres));
const externalByLower = new Map(externalGenres.map((genre) => [genre.toLowerCase(), genre]));

export interface BrowserGenreDetection {
  external_genre: string;
  is_comedy: boolean;
  comedy_paired_genre: string | null;
  comedy_subgenre: string | null;
  comedic_tone: boolean;
  internal_genre: string;
  confidence: 'high' | 'medium' | 'low';
  one_line_why: string;
}

function canonicalExternal(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  return externalByLower.get(value.trim().toLowerCase());
}

export function validateBrowserGenreDetection(value: unknown): BrowserGenreDetection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Genre detection is missing.');
  }
  const raw = value as Record<string, unknown>;
  const external = canonicalExternal(raw.external_genre);
  if (!external) throw new Error('Genre detection has an unknown external genre.');
  if (typeof raw.is_comedy !== 'boolean' || raw.is_comedy !== (external === 'Comedy')) {
    throw new Error('Genre detection comedy flag contradicts its external genre.');
  }
  if (typeof raw.comedic_tone !== 'boolean') {
    throw new Error('Genre detection has an invalid comedic tone flag.');
  }
  if (typeof raw.internal_genre !== 'string' || !internalGenres.has(raw.internal_genre)) {
    throw new Error('Genre detection has an unknown internal genre.');
  }
  if (raw.confidence !== 'high' && raw.confidence !== 'medium' && raw.confidence !== 'low') {
    throw new Error('Genre detection has an invalid confidence.');
  }
  if (typeof raw.one_line_why !== 'string' || raw.one_line_why.trim().length === 0) {
    throw new Error('Genre detection has no rationale.');
  }
  const paired = raw.is_comedy ? canonicalExternal(raw.comedy_paired_genre) : undefined;
  const subgenre = raw.is_comedy && typeof raw.comedy_subgenre === 'string'
    ? raw.comedy_subgenre
    : undefined;
  if (raw.is_comedy && (!paired || paired === 'Comedy' || !subgenre || !comedySubgenres.has(subgenre))) {
    throw new Error('Comedy genre detection is missing its paired genre or subgenre.');
  }
  return {
    external_genre: external,
    is_comedy: raw.is_comedy,
    comedy_paired_genre: paired ?? null,
    comedy_subgenre: subgenre ?? null,
    comedic_tone: raw.comedic_tone || raw.is_comedy,
    internal_genre: raw.internal_genre,
    confidence: raw.confidence,
    one_line_why: raw.one_line_why.trim(),
  };
}

export function canonicalGenreOutput(detection: BrowserGenreDetection): {
  genre: string;
  subgenres: string[];
} {
  const subgenres = detection.is_comedy
    ? [detection.comedy_paired_genre, detection.comedy_subgenre]
      .filter((value): value is string => Boolean(value))
    : [];
  if (!subgenres.includes(detection.internal_genre)) subgenres.push(detection.internal_genre);
  return { genre: detection.external_genre, subgenres };
}

export const GENRE_DETECTION_INSTRUCTION = `Classify the screenplay using Shawn Coyne's Story Grid Five-Leaf Clover. Pick one external genre from: ${externalGenres.join(', ')}. Pick one internal genre from: ${[...internalGenres].join(', ')}. If external_genre is Comedy, is_comedy MUST be true and you MUST supply a non-Comedy comedy_paired_genre plus one comedy_subgenre from: ${[...comedySubgenres].join(', ')}. Otherwise is_comedy MUST be false. Return this exact nested object with the quality fields:\n"genre_detection": {\n  "external_genre": "",\n  "is_comedy": false,\n  "comedy_paired_genre": "",\n  "comedy_subgenre": "",\n  "comedic_tone": false,\n  "internal_genre": "",\n  "confidence": "high|medium|low",\n  "one_line_why": ""\n}`;

function externalGenreCard(genre: string): string {
  const entry = storyGrid.external_genres[genre];
  const scenes = entry.obligatory_scenes
    .map((scene) => `  - ${scene.scene} — ${scene.placement}`)
    .join('\n');
  return `### ${genre} — value spectrum: ${entry.value_spectrum}\nCore Event: ${entry.core_event ?? ''}\nValue progression: ${entry.value_progression}\nObligatory scenes:\n${scenes}\nConventions: ${(entry.conventions ?? []).join('; ')}`;
}

export function buildBrowserGenreCard(detection: BrowserGenreDetection): string {
  if (!detection.is_comedy) {
    return `## STORY GRID — GENRE OBLIGATIONS FOR THIS SCRIPT\n${externalGenreCard(detection.external_genre)}`;
  }
  const comedy = storyGrid.external_genres.Comedy;
  const subgenre = storyGrid.comedy_subgenres[detection.comedy_subgenre!];
  const comedyScenes = comedy.obligatory_scenes
    .map((scene) => `  - ${scene.scene} — ${scene.placement}`)
    .join('\n');
  const subgenreScenes = subgenre.obligatory_scenes
    .map((scene) => `  - ${scene.scene} — ${scene.placement}`)
    .join('\n');
  return `## STORY GRID — GENRE OBLIGATIONS FOR THIS SCRIPT\n### Comedy\n${comedy.pairing_rule ?? ''}\nComedy obligatory scenes:\n${comedyScenes}\nSubgenre — ${detection.comedy_subgenre}: ${subgenre.core_tension}\n${subgenreScenes}\nComedy craft rules:\n${(comedy.craft_rules ?? []).map((rule) => `  - ${rule}`).join('\n')}\nPAIRED GENRE:\n${externalGenreCard(detection.comedy_paired_genre!)}`;
}
