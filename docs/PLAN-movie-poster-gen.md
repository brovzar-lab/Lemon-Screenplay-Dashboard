# Project Plan: Movie Poster Generation (Nano Banana Pro)

> **Goal:** Generate cinematic movie posters using Gemini Imagen 3 models for each screenplay, display them as a "reveal" layer before analysis, and persist them to Firebase Storage.

---

## 1. Architecture

### Backend (Cloud Functions)

- **New Cloud Function:** `generatePoster(screenplayId, title, logline, mood)`
- **AI Model:** Google Gemini (Imagen 3) via Vertex AI or Google AI Studio API.
- **Prompt Engineering:** "Nano Banana Pro" style — cinematic, high-contrast, marketing-ready one-sheet.
- **Storage:** Save to `gs://.../posters/{screenplayId}.webp`.
- **Database:** Update `screenplays/{id}` with `posterUrl` and `posterStatus: 'generating' | 'ready'`.

### Frontend (React/Zustand)

- **Store:** `usePosterStore` to track generation status/URL if not in main screenplay object yet.
- **UI Component:** `PosterRevealModal`
  - Triggers on `ScreenplayCard` click.
  - Shows high-res poster with "Enter Dashboard" CTA.
  - Background: Blurred version of poster or cinematic backdrop.
  - Actions: "Regenerate" (admin only?), "Download".
- **Trigger:**
  - *Option A (Auto):* Generate on upload (costly).
  - *Option B (On-Demand):* Generate on first view -> "Generating Poster..." loader -> Reveal. **(Selected: On-Demand for cost control)**

---

## 2. Implementation Steps

### Phase 1: Core Logic (Backend/API)

- [ ] Set up Gemini Imagen 3 client (Vertex AI or Google AI JS SDK).
- [ ] Create `generatePoster` service function.
  - Input: Title, Logline, Genre, Tone.
  - Prompt: "Clean, cinematic movie poster for a [Genre] film titled '[Title]'. [Logline]. Style: High budget, winning award, 8k resolution, textless/minimal text."
- [ ] Implement Firebase Storage upload of generated image.

### Phase 2: Frontend Integration

- [ ] Update `Screenplay` type with `posterUrl` and `posterStatus`.
- [ ] Create `PosterReveal` component (Overlay).
- [ ] Modify `ScreenplayCard` click handler:
  - If `posterUrl` exists → Show `PosterReveal`.
  - If not → Show "Generating Magic..." → Call API → Save → Show `PosterReveal`.

### Phase 3: "Nano Banana" Styling

- [ ] Refine Prompt Engineering for "Nano Banana" aesthetic (Cinematic, Aesthetically pleasing, Commercial).
- [ ] Add "Regenerate" button for different variations.

---

## 3. Agents & Skills

| Task | Agent | Skill |
|------|-------|-------|
| Backend/API | `backend-specialist` | `google-cloud`, `firebase-admin` |
| UI/Reveal | `frontend-specialist` | `cinematic-ui`, `framer-motion` |
| Prompting | `prompt-engineer` | `image-gen-prompts` |

---

## 4. Verification

- [ ] Upload new screenplay → Click → See "Generating..." → See Poster.
- [ ] Verify image saved in Firebase Storage.
- [ ] Verify `posterUrl` persisted in Firestore/Database.
- [ ] Reload page → Click screenplay → Immediate Poster (no generation).
