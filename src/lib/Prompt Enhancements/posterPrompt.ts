// ============================================================================
// CINEMATIC MOVIE POSTER PROMPT ENGINE
// Generates photorealistic, genre-aware movie poster prompts for AI image models
// ============================================================================

// ---------------------------------------------------------------------------
// GENRE VISUAL DNA
// Each genre carries a distinct visual language — color science, lighting rigs,
// texture, composition patterns, and photographic references that real poster
// designers use. Generic "dramatic lighting" prompts produce generic results.
// ---------------------------------------------------------------------------

interface GenreVisualDNA {
  colorPalette: string;
  lighting: string;
  texture: string;
  composition: string;
  atmosphere: string;
  photographicRef: string;
  typographyStyle: string;
  moodKeywords: string[];
}

const GENRE_VISUAL_DNA: Record<string, GenreVisualDNA> = {
  horror: {
    colorPalette: 'desaturated cold blues and teals with isolated pops of crimson red, deep blacks crushing into shadow, sickly greens in highlights',
    lighting: 'harsh single-source side lighting with deep cast shadows, underlit faces, rim light separating subject from void-black background, motivated practical light sources like flickering bulbs or candles',
    texture: 'film grain (ISO 3200), subtle lens aberration, wet/reflective surfaces, fog diffusion, decayed organic textures',
    composition: 'subject isolated in frame with oppressive negative space, dutch angle 5-15 degrees, foreground obscured elements creating voyeuristic framing, something lurking in background bokeh',
    atmosphere: 'thick atmospheric haze, volumetric light cutting through darkness, visible breath in cold air, particulate matter floating in light beams',
    photographicRef: 'shot on anamorphic lens with oval bokeh, Roger Deakins-style controlled darkness, references: The Witch, Hereditary, It Follows poster aesthetics',
    typographyStyle: 'distressed serif or hand-scratched type, slightly eroded letterforms, title may bleed or dissolve at edges, white or blood-red on black',
    moodKeywords: ['dread', 'isolation', 'visceral', 'uncanny', 'suffocating'],
  },

  thriller: {
    colorPalette: 'steel blue-grey dominant, desaturated urban tones with selective warm accent (amber streetlight, cigarette glow), teal-and-orange split toning',
    lighting: 'neo-noir motivated lighting — venetian blind shadows, neon reflections on wet pavement, high contrast chiaroscuro, pools of light in overwhelming darkness',
    texture: 'clean digital sharpness with subtle grain, rain-slicked surfaces, reflective glass and metal, shallow depth of field isolating subject',
    composition: 'tight framing suggesting claustrophobia, split compositions (light/dark halves), figure emerging from or retreating into shadow, urban geometry creating leading lines',
    atmosphere: 'rain or recent rain (wet streets), city at night, breath visible, tension in stillness, something just happened or is about to',
    photographicRef: 'shot on Cooke S4 lenses, Darius Khondji color science, references: Se7en, Sicario, Zodiac, Gone Girl poster aesthetics',
    typographyStyle: 'clean sans-serif or condensed grotesque, metallic or embossed treatment, precise kerning, cold white or silver against dark background',
    moodKeywords: ['paranoia', 'tension', 'surveillance', 'moral ambiguity', 'unease'],
  },

  drama: {
    colorPalette: 'warm naturalistic palette — golden hour ambers, earthy ochres, muted sage greens, skin tones rendered with care, desaturated but not cold',
    lighting: 'soft motivated natural light, golden hour warmth, window light with gentle diffusion, Rembrandt lighting on faces, practical sources adding intimacy',
    texture: 'medium format film quality (Kodak Portra 400 aesthetic), gentle grain, lens bloom on highlights, slightly lifted blacks for nostalgic feel',
    composition: 'intimate close-up or medium shot, eye-level empathetic framing, balanced classical composition, landscape as emotional mirror, shallow DOF keeping focus on human expression',
    atmosphere: 'quiet emotional weight, lived-in environments with natural detail, golden light suggesting memory or fleeting moments, environmental storytelling through background',
    photographicRef: 'shot on Arri Alexa with vintage Panavision C-series glass, Emmanuel Lubezki natural light approach, references: Moonlight, Nomadland, The Tree of Life poster aesthetics',
    typographyStyle: 'elegant thin serif (Didot/Bodoni family) or refined humanist sans-serif, generous letter-spacing, tasteful minimalism, warm white or cream',
    moodKeywords: ['intimate', 'contemplative', 'tender', 'bittersweet', 'resilient'],
  },

  comedy: {
    colorPalette: 'saturated vibrant primaries, warm and inviting tones, punchy complementary color contrasts, bright whites, candy-colored accents',
    lighting: 'bright even key lighting with soft fill, minimal harsh shadows, high-key setup suggesting optimism, warm practical lights adding character',
    texture: 'clean and crisp digital quality, sharp focus across the frame, minimal grain, polished commercial finish',
    composition: 'centered or symmetrical framing (Wes Anderson influence for quirky, conventional for mainstream), characters in dynamic poses or reactions, environmental context playing for laughs, props and set design as comedy elements',
    atmosphere: 'bright and energetic, inviting and accessible, heightened reality with sharp detail, colorful environments that feel alive',
    photographicRef: 'bright commercial photography with saturated color grade, Robert Yeoman (Wes Anderson) or Janusz Kaminski warm palette, references: The Grand Budapest Hotel, Bridesmaids, Knives Out poster aesthetics',
    typographyStyle: 'bold rounded sans-serif or playful display type, strong solid fills, possibly stacked or arranged dynamically, bright colors against contrasting background',
    moodKeywords: ['vibrant', 'irreverent', 'warm', 'sharp', 'inviting'],
  },

  action: {
    colorPalette: 'high-contrast teal-and-orange blockbuster grade, fiery ambers and deep cyans, metallic silvers, explosive warm highlights against cool shadows',
    lighting: 'dramatic three-point setup with strong backlight creating rim separation, explosive practical light sources (fire, muzzle flash, sparks), hard directional key light, lens flares',
    texture: 'razor-sharp high-resolution detail, slight motion blur suggesting kinetic energy, sparks and debris particles, heat distortion',
    composition: 'dynamic diagonal compositions, low-angle hero shot establishing power, depth layering with foreground debris/particles, strong silhouettes against explosive backgrounds, multiple planes of action',
    atmosphere: 'explosive energy, smoke and fire, wind-blown elements, dust and particle effects, sense of massive scale',
    photographicRef: 'IMAX-quality detail, Larry Fong or Claudio Miranda high-contrast cinematography, references: Mad Max Fury Road, John Wick, Mission Impossible poster aesthetics',
    typographyStyle: 'heavy impact sans-serif or military stencil, metallic/chrome treatment with beveling, possible fire or destruction effect on letterforms, dominant scale',
    moodKeywords: ['explosive', 'kinetic', 'epic', 'relentless', 'visceral'],
  },

  'science fiction': {
    colorPalette: 'cool technological palette — electric blues, deep space blacks, holographic cyan accents, bioluminescent greens, stark white technology lighting against void',
    lighting: 'futuristic motivated sources — holographic displays, bioluminescent elements, star fields, atmospheric entry glow, clean clinical whites contrasted with deep space shadow',
    texture: 'hyper-clean digital precision for technology, cosmic dust and nebulae for space, reflective visors and metallic surfaces, subsurface scattering on alien materials',
    composition: 'vast scale establishing enormity (small figure against massive structure/landscape), symmetrical architecture suggesting order, vertiginous perspective shifts, circular/portal framing devices',
    atmosphere: 'cosmic vastness, technological sublime, the awe of the unknown, clean futurism or lived-in dystopia depending on tone, sense of scale beyond human comprehension',
    photographicRef: 'Hoyte van Hoytema deep space photography, Bradford Young atmospheric haze, references: Blade Runner 2049, Arrival, Interstellar, Dune poster aesthetics',
    typographyStyle: 'geometric sans-serif or custom futuristic display face, clean and precise, possible holographic or glowing treatment, generous tracking, white or cyan against dark',
    moodKeywords: ['awe', 'vastness', 'discovery', 'existential', 'transcendent'],
  },

  romance: {
    colorPalette: 'soft warm pastels and golden tones, blush pinks, lavender twilight, honey golds, gentle rose highlights, creamy skin tones, sunset gradient skies',
    lighting: 'magic hour golden backlight, soft diffused window light, warm practicals (string lights, candles), lens bloom and gentle flare, Rembrandt sculpting on faces',
    texture: 'dreamy soft focus with sharp eye detail, vintage lens character (swirly bokeh), halation on highlights, Pro Mist filter quality, Fuji 400H film emulation',
    composition: 'two subjects in intimate proximity, foreground bokeh elements (flowers, lights) framing subjects, shallow DOF creating romantic isolation, balanced but not rigid framing',
    atmosphere: 'warmth and intimacy, golden hour permanence, city lights as bokeh backdrop, seasonal beauty (autumn leaves, spring blossoms, summer golden light)',
    photographicRef: 'Vittorio Storaro warm romanticism, Robert Richardson golden light, references: La La Land, Portrait of a Lady on Fire, Call Me By Your Name poster aesthetics',
    typographyStyle: 'elegant script or refined thin serif, possibly handwritten quality, delicate and romantic, warm gold or white, graceful curves',
    moodKeywords: ['tender', 'luminous', 'yearning', 'intimate', 'ephemeral'],
  },

  western: {
    colorPalette: 'dusty earth tones — burnt sienna, raw umber, bleached yellows, weathered turquoise sky, sepia-shifted shadows, sun-bleached highlights',
    lighting: 'harsh overhead desert sun with deep eye socket shadows, magic hour warmth across landscapes, silhouettes against vast skies, campfire warmth in darkness',
    texture: 'heavy grain (Kodak 5219 stock feel), dust and heat haze, weathered surfaces, aged leather and wood, sweat and grime on skin',
    composition: 'wide panoramic framing establishing landscape dominance, lone figure small against vast environment, low-angle hero shots at high noon, horizon line as compositional anchor',
    atmosphere: 'oppressive heat haze, dust devils, vast empty sky, tumbleweeds and scrub brush, sense of lawlessness and frontier isolation',
    photographicRef: 'Bruno Delbonnel muted palette, Robert Richardson desert light, references: No Country for Old Men, The Revenant, Unforgiven poster aesthetics',
    typographyStyle: 'weathered slab-serif or distressed wood-type display, aged and worn letterforms, earthy tones or branded/burned effect, rustic authority',
    moodKeywords: ['rugged', 'desolate', 'stoic', 'mythic', 'unforgiving'],
  },

  noir: {
    colorPalette: 'strict monochromatic or near-monochromatic — silver-blacks, blue-blacks, harsh white highlights, single color accent (red lipstick, neon sign glow)',
    lighting: 'extreme chiaroscuro, venetian blind shadow patterns, single hard light source, silhouettes and shadow play, cigarette smoke catching light beams',
    texture: 'heavy contrast with crushed blacks, silver gelatin print quality, rain and reflections doubling the visual complexity, sharp noir grain',
    composition: 'canted angles, shadow as compositional element (shadow more prominent than figure), mirror and reflection motifs, depth staging through doorways and corridors',
    atmosphere: 'night city — wet neon, smoke-filled rooms, fog rolling in, moral murkiness made visible, the space between streetlights',
    photographicRef: 'John Alton shadow mastery, Gordon Willis darkness, references: The Third Man, Chinatown, Sin City poster aesthetics',
    typographyStyle: 'bold art deco or condensed noir display type, strong black-and-white contrast, possibly with neon glow effect or hard shadow, angular and sharp',
    moodKeywords: ['seductive', 'treacherous', 'shadowy', 'fatalistic', 'corrupt'],
  },

  fantasy: {
    colorPalette: 'rich jewel tones — deep sapphire blues, emerald greens, royal purples, burnished golds, firelight amber, magical luminescence',
    lighting: 'dramatic mixed sources — ethereal magical glow, firelight, god rays through forest canopy, moonlight with supernatural blue cast, volumetric mist catching light',
    texture: 'painterly photorealism, rich fabric and armor detail, environmental storytelling in every surface, magical particle effects, epic landscape detail',
    composition: 'epic scale with figures small against vast magical landscapes, vertical compositions emphasizing towers/mountains/trees, layered depth with foreground mystical elements, throne/crown/weapon as focal objects',
    atmosphere: 'sense of ancient magic and wonder, forests that feel alive, castles in impossible landscapes, storms and supernatural weather, the weight of myth',
    photographicRef: 'Vittorio Storaro epic grandeur, Greig Fraser atmospheric depth, references: Lord of the Rings, Pan\'s Labyrinth, Game of Thrones poster aesthetics',
    typographyStyle: 'ornamental serif with flourishes or medieval-inspired display, possibly with metallic/stone/enchanted treatment, gold or silver on dark, weight and grandeur',
    moodKeywords: ['epic', 'mythic', 'enchanted', 'ancient', 'magnificent'],
  },

  animation: {
    colorPalette: 'vivid and expressive color storytelling, bold saturated palette with clear emotional color coding, luminous highlights, rich shadows that maintain color',
    lighting: 'stylized dramatic lighting serving story emotion, bold light-to-shadow transitions, colored light sources creating mood, rim lights for character pop',
    texture: 'painterly rendered quality, visible artistic intention in every element, rich material differentiation, stylized realism or heightened reality',
    composition: 'dynamic character-driven compositions, expressive poses capturing personality, environmental storytelling, depth and scale play, strong silhouette readability',
    atmosphere: 'heightened emotional reality, worlds that feel fully realized and lived-in, every element serves story and character, magic in the mundane',
    photographicRef: 'Pixar/Ghibli lighting philosophy, cinematic virtual camera work, references: Spider-Verse, Spirited Away, How to Train Your Dragon poster aesthetics',
    typographyStyle: 'custom display type matching the world, playful and character-driven, bold and readable, color-integrated with poster palette',
    moodKeywords: ['expressive', 'imaginative', 'heartfelt', 'adventurous', 'wonder'],
  },

  documentary: {
    colorPalette: 'grounded naturalistic color, possibly desaturated for gravitas, earth tones and muted palette, color truth over stylization',
    lighting: 'available light authenticity, natural harsh or soft depending on environment, unpolished honesty in the light, real-world imperfections',
    texture: 'photojournalistic grain and imperfection, handheld energy even in stillness, real-world surfaces and environments, truth in texture',
    composition: 'photojournalistic framing — candid, observational, intimate access, wide establishing shots for context, tight portraits for humanity, real environments',
    atmosphere: 'raw authenticity, the weight of reality, unvarnished truth, respect for subject, quiet power in stillness',
    photographicRef: 'Maysles brothers observational style, Werner Herzog juxtapositions, references: Man on Wire, Free Solo, Amy poster aesthetics',
    typographyStyle: 'clean journalistic sans-serif or restrained serif, factual and authoritative, black or white, no decorative flourishes, quiet confidence',
    moodKeywords: ['authentic', 'unflinching', 'revelatory', 'human', 'urgent'],
  },
};

// ---------------------------------------------------------------------------
// POSTER COMPOSITION ARCHETYPES
// Real movie posters follow specific compositional patterns.
// This selects the best archetype based on genre and content.
// ---------------------------------------------------------------------------

type PosterArchetype =
  | 'hero_dominant'      // Single character dominates the frame (action, thriller)
  | 'floating_heads'     // Multiple character faces arranged hierarchically (ensemble)
  | 'silhouette'         // Character(s) in dramatic silhouette (any genre, very cinematic)
  | 'landscape_figure'   // Small figure against vast environment (sci-fi, western, drama)
  | 'intimate_portrait'  // Close-up emotional portrait (drama, romance, horror)
  | 'symbolic_object'    // Central symbolic object/image (thriller, horror, mystery)
  | 'split_composition'  // Divided frame showing duality (thriller, drama)
  | 'teaser_minimal'     // Minimal, mysterious, mostly typography and mood (any genre);

interface ArchetypeSpec {
  description: string;
  compositionNotes: string;
  bestFor: string[];
}

const POSTER_ARCHETYPES: Record<PosterArchetype, ArchetypeSpec> = {
  hero_dominant: {
    description: 'Single heroic figure commands the frame, typically from mid-thigh up, strong posture, looking off-camera or directly at viewer',
    compositionNotes: 'Figure fills 60-70% of vertical space, slightly off-center, background provides context and scale, lighting sculpts the body dramatically',
    bestFor: ['action', 'thriller', 'western', 'science fiction'],
  },
  floating_heads: {
    description: 'Multiple character faces/busts arranged by narrative importance, largest face dominant, others orbiting at smaller scale',
    compositionNotes: 'Primary face fills upper 40%, supporting characters arranged below and to sides, background scene or location at bottom third, clear hierarchy of scale = hierarchy of importance',
    bestFor: ['drama', 'comedy', 'romance', 'action'],
  },
  silhouette: {
    description: 'Character rendered as dramatic dark silhouette against vivid or atmospheric background, shape tells the story',
    compositionNotes: 'Silhouette must have a recognizable and interesting outline (weapon, posture, costume detail), background carries all color and atmosphere, extremely high contrast',
    bestFor: ['horror', 'thriller', 'western', 'noir', 'science fiction', 'action'],
  },
  landscape_figure: {
    description: 'Vast environment dominates the frame with small human figure(s) establishing scale and vulnerability or determination',
    compositionNotes: 'Environment fills 80%+ of frame, figure small but precisely placed (often lower third, rule of thirds intersection), environment IS the story',
    bestFor: ['science fiction', 'western', 'fantasy', 'drama', 'documentary'],
  },
  intimate_portrait: {
    description: 'Extreme close-up or tight portrait, emotional truth in the face, every pore and expression tells the story',
    compositionNotes: 'Face fills most of frame, eyes at upper third line, shallow DOF melting background, lighting sculpts emotion, negative space weighted to one side',
    bestFor: ['drama', 'horror', 'romance', 'documentary'],
  },
  symbolic_object: {
    description: 'Central symbolic image or object carries the entire poster — a key, a door, a mask, blood on snow, etc.',
    compositionNotes: 'Object centered or slightly above center, surrounded by contextual atmosphere, clean and graphically strong, conceptual and striking, minimal composition with maximum impact',
    bestFor: ['thriller', 'horror', 'noir', 'drama', 'science fiction'],
  },
  split_composition: {
    description: 'Frame divided into two contrasting halves — light/dark, past/present, good/evil, two characters facing opposite directions',
    compositionNotes: 'Clear dividing line (vertical, diagonal, or implied), each half tells a different part of the story, contrast between halves IS the concept, unity through shared elements',
    bestFor: ['thriller', 'drama', 'noir', 'science fiction'],
  },
  teaser_minimal: {
    description: 'Stark, mysterious, minimal — mostly atmosphere, color, and typography, withholding more than it reveals',
    compositionNotes: 'Vast negative space, single compelling element, typography does heavy lifting, color and texture set mood, withhold information to create intrigue',
    bestFor: ['horror', 'thriller', 'science fiction', 'noir', 'drama'],
  },
};

// ---------------------------------------------------------------------------
// ARCHETYPE SELECTION LOGIC
// Selects the best poster archetype based on genre + optional user preference
// ---------------------------------------------------------------------------

function selectArchetype(
  genre: string,
  preferredArchetype?: PosterArchetype
): { archetype: PosterArchetype; spec: ArchetypeSpec } {
  if (preferredArchetype && POSTER_ARCHETYPES[preferredArchetype]) {
    return { archetype: preferredArchetype, spec: POSTER_ARCHETYPES[preferredArchetype] };
  }

  const genreLower = genre.toLowerCase();

  // Default archetype per genre (curated choices)
  const defaults: Record<string, PosterArchetype> = {
    horror: 'silhouette',
    thriller: 'split_composition',
    drama: 'intimate_portrait',
    comedy: 'floating_heads',
    action: 'hero_dominant',
    'science fiction': 'landscape_figure',
    romance: 'intimate_portrait',
    western: 'landscape_figure',
    noir: 'silhouette',
    fantasy: 'hero_dominant',
    animation: 'hero_dominant',
    documentary: 'intimate_portrait',
  };

  const archetype = defaults[genreLower] || 'hero_dominant';
  return { archetype, spec: POSTER_ARCHETYPES[archetype] };
}

// ---------------------------------------------------------------------------
// RESOLVE GENRE DNA
// Falls back to a solid default if the genre isn't in our map
// ---------------------------------------------------------------------------

function resolveGenreDNA(genre: string): GenreVisualDNA {
  const genreLower = genre.toLowerCase();

  // Direct match
  if (GENRE_VISUAL_DNA[genreLower]) return GENRE_VISUAL_DNA[genreLower];

  // Fuzzy match: check if the genre contains or is contained by a known genre
  for (const [key, dna] of Object.entries(GENRE_VISUAL_DNA)) {
    if (genreLower.includes(key) || key.includes(genreLower)) return dna;
  }

  // Compound genres: "horror comedy" → pick the first recognized genre
  const words = genreLower.split(/[\s\-\/,]+/);
  for (const word of words) {
    if (GENRE_VISUAL_DNA[word]) return GENRE_VISUAL_DNA[word];
  }

  // Sensible default that works broadly
  return GENRE_VISUAL_DNA['drama'];
}

// ---------------------------------------------------------------------------
// EXTRACT VISUAL HOOKS FROM LOGLINE
// Pulls concrete visual elements from the logline to ground the image
// ---------------------------------------------------------------------------

function extractVisualHooks(logline: string): string {
  // This provides guidance for the AI to interpret the logline visually
  return [
    `Interpret the following story premise and extract its strongest visual elements for the poster:`,
    `"${logline}"`,
    `Ground the poster image in SPECIFIC, CONCRETE visual details suggested by this premise.`,
    `Do not create a generic genre poster — make it THIS story's poster.`,
  ].join(' ');
}

// ---------------------------------------------------------------------------
// LANGUAGE / REGION VARIANT
// For Mexican market posters, Spanish-language productions, etc.
// ---------------------------------------------------------------------------

interface RegionalOptions {
  language?: 'en' | 'es' | 'fr' | 'pt' | 'de';  // Title language
  marketFeel?: 'hollywood' | 'arthouse' | 'latin_american' | 'european';
}

function getRegionalNotes(options?: RegionalOptions): string {
  if (!options) return '';

  const notes: string[] = [];

  if (options.language === 'es') {
    notes.push('Title text should be rendered in Spanish with correct accent marks and punctuation (¿¡).');
  }

  if (options.marketFeel === 'latin_american') {
    notes.push(
      'Visual sensibility should reflect Latin American cinema — grounded realism with magical undercurrents, ' +
      'warm earth tones of Mexican/Latin landscapes, authentic textures and environments, ' +
      'referencing the visual language of directors like Iñárritu, Cuarón, del Toro, Alonso Ruizpalacios.'
    );
  }

  if (options.marketFeel === 'arthouse') {
    notes.push(
      'Art-house aesthetic: restrained, conceptual, European poster design sensibility. ' +
      'More negative space, stronger graphic design principles, less is more. ' +
      'Reference: A24, MUBI, Criterion Collection poster design language.'
    );
  }

  return notes.length > 0 ? '\n\n' + notes.join('\n') : '';
}

// ---------------------------------------------------------------------------
// OPTIONAL TAGLINE HANDLING
// ---------------------------------------------------------------------------

function getTaglineInstruction(tagline?: string): string {
  if (!tagline) return '';
  return `Include the tagline "${tagline}" in smaller text below or above the title, set in a complementary typeface that doesn't compete with the title.`;
}

// ===========================================================================
// MAIN PROMPT BUILDER
// ===========================================================================

export interface PosterPromptOptions {
  title: string;
  logline: string;
  genre: string;
  tagline?: string;
  archetype?: PosterArchetype;
  regional?: RegionalOptions;
  additionalNotes?: string;  // User can inject specific visual requests
  tone?: 'dark' | 'light' | 'neutral';  // Override mood direction
}

export function buildPosterPrompt(options: PosterPromptOptions): string {
  const {
    title,
    logline,
    genre,
    tagline,
    archetype: preferredArchetype,
    regional,
    additionalNotes,
    tone,
  } = options;

  const dna = resolveGenreDNA(genre);
  const { archetype, spec: archetypeSpec } = selectArchetype(genre, preferredArchetype);
  const visualHooks = extractVisualHooks(logline);

  // Build the prompt as a layered instruction set
  const prompt = [
    // ── CORE IDENTITY ──────────────────────────────────────────────────
    `Create a photorealistic professional movie poster for "${title}", a ${genre} film.`,
    '',

    // ── STORY GROUNDING ────────────────────────────────────────────────
    `STORY PREMISE: ${visualHooks}`,
    '',

    // ── COMPOSITION ARCHITECTURE ───────────────────────────────────────
    `POSTER COMPOSITION TYPE: ${archetype.replace(/_/g, ' ').toUpperCase()}`,
    `${archetypeSpec.description}.`,
    `Composition details: ${archetypeSpec.compositionNotes}.`,
    '',

    // ── VISUAL DNA (GENRE-SPECIFIC) ────────────────────────────────────
    `COLOR SCIENCE: ${dna.colorPalette}.`,
    '',
    `LIGHTING DESIGN: ${dna.lighting}.`,
    '',
    `TEXTURE & LENS: ${dna.texture}.`,
    '',
    `ATMOSPHERE: ${dna.atmosphere}.`,
    '',
    `CINEMATOGRAPHIC REFERENCE: ${dna.photographicRef}.`,
    '',

    // ── TYPOGRAPHY ─────────────────────────────────────────────────────
    `TITLE TYPOGRAPHY: The title "${title}" must be rendered clearly and legibly as the primary typographic element. ${dna.typographyStyle}. The title should be integrated into the overall poster design — not floating on top of it but feeling like a designed element. Place title in the lower third or upper section depending on composition balance.`,
    tagline ? getTaglineInstruction(tagline) : '',
    '',

    // ── EMOTIONAL FREQUENCY ────────────────────────────────────────────
    `EMOTIONAL TONE: The poster should radiate these qualities: ${dna.moodKeywords.join(', ')}. ${
      tone === 'dark' ? 'Push toward the darker, more intense end of this spectrum.' :
      tone === 'light' ? 'Lean toward the more hopeful, luminous end of this spectrum.' :
      'Balance these qualities to serve the story.'
    }`,
    '',

    // ── TECHNICAL REQUIREMENTS ─────────────────────────────────────────
    'TECHNICAL SPECIFICATIONS:',
    '- Portrait orientation, 2:3 aspect ratio (standard theatrical one-sheet)',
    '- Photorealistic rendering quality — this must look like a photograph, not an illustration or digital painting (unless animation genre)',
    '- Professional color grading with intentional palette — no muddy or accidental colors',
    '- High resolution with sharp focal detail where the eye should land first',
    '- Depth of field should guide the viewer\'s eye to the primary subject',
    '',

    // ── PROHIBITIONS ───────────────────────────────────────────────────
    'DO NOT INCLUDE:',
    '- Actor names, credits block, billing block, or studio logos',
    '- Rating badges (PG-13, R, etc.)',
    '- Review quotes or festival laurels',
    '- Watermarks or stock photo artifacts',
    '- Multiple competing text elements beyond title and optional tagline',
    '- Generic stock-photo compositions — this must feel like a SPECIFIC film, not a genre template',

    // ── REGIONAL VARIANT ───────────────────────────────────────────────
    getRegionalNotes(regional),

    // ── USER ADDITIONS ─────────────────────────────────────────────────
    additionalNotes ? `\nADDITIONAL CREATIVE DIRECTION: ${additionalNotes}` : '',

  ].filter(line => line !== undefined).join('\n');

  return prompt.trim();
}

// ===========================================================================
// SIMPLE WRAPPER (drop-in replacement for the original function signature)
// ===========================================================================

export function buildSimplePosterPrompt(
  title: string,
  logline: string,
  genre: string
): string {
  return buildPosterPrompt({ title, logline, genre });
}

// ===========================================================================
// EXAMPLE USAGE
// ===========================================================================

/*
// Simple (drop-in replacement):
const prompt = buildSimplePosterPrompt(
  "Oro Verde",
  "A powerful Mexican family's agave empire crumbles when the youngest son uncovers that their fortune was built on blood.",
  "thriller"
);

// Full options:
const prompt = buildPosterPrompt({
  title: "Oro Verde",
  logline: "A powerful Mexican family's agave empire crumbles when the youngest son uncovers that their fortune was built on blood.",
  genre: "thriller",
  tagline: "Every fortune has a price.",
  archetype: "split_composition",
  regional: { language: 'es', marketFeel: 'latin_american' },
  additionalNotes: "Feature agave fields at golden hour transitioning to darkness. The family hacienda should loom in the background.",
  tone: "dark",
});
*/
