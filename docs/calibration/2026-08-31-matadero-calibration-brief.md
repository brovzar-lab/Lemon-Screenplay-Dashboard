# Standing calibration brief #1 — Matadero (2026-08-31)

Author: Billy Rovzar (human line-by-line audit of the Coverage V1 canary
round-2 report on "Matadero" against the 111-page PDF).
Status: **absorbed into the engine** — the ten reading rules below are
distilled into `COVERAGE_CHARTER`'s HOUSE READING RULES, the audit charter's
dialogue-vs-staging rule, the lens applicability instruction, the
`not_applicable` grade, and the report's `page_convention` field (see
`execution/coverage_v1.py`). This file is the verbatim source of record; if
the distillation and this text ever disagree, this text wins.

---

STANDING CALIBRATION BRIEF FOR THE COVERAGE ENGINE
Source: human audit of coverage-v1.0 output on "Matadero" (111-page PDF, 110 printed pages) checked line by line against the screenplay. Every example below is verified against the pages. Absorb these as permanent reading rules for all future coverage. This is not a one-time correction of one script.

WHAT WENT RIGHT, KEEP DOING IT
The logline, the genre identification, the protagonist read, and the top three concerns were accurate and would survive a professional room. In particular, the engine correctly located the script's thesis scene (printed p.88: Irina holds a knife three meters from an exposed flank while Betsabé fights, her foot lifts and comes back down, her mouth opens and nothing comes out) and used it as evidence for the arc. That is the standard. Keep citing the specific staged moment rather than asserting the arc.

READING RULE 1: THE LAST SCENE IS NOT THE LAST LINE
Failure: the engine wrote "The Carnicero is confirmed found" as the ending. What the script does is have Irina say "Encontraron al carnicero," then show the two cops turning to look at each other, then cut to the Carnicero alive in the boarded-up Dos Hermanos, sharpening a knife. The spoken line is false. The exchanged look is the tell and the cut is the proof.
Rule: never treat dialogue as fact. A line of dialogue is a character's claim. Before reporting any story fact sourced from dialogue, check whether staging elsewhere in the script confirms or contradicts it. When staging contradicts dialogue, the staging is the truth and the contradiction is usually the point of the scene. Report the irony, not the line.

READING RULE 2: DO NOT COLLAPSE A MULTI-STAGE CLIMAX
Failure: the engine reported the climax as one forklift ram pinning the killer against shelving. The actual sequence is: ram into stacked flour sacks, motor dies, killer is alive, he gets his stump around Irina's throat, Tommy screams "HERMANA," the killer freezes, his mask falls and reveals the face from the photograph, and only then does Irina raise the mast, pin him against the steel crossbeam, and strip the keyring off his belt on the way up. The engine deleted the emotional hinge of the entire movie.
Rule: when summarizing a climax, walk it beat by beat and check for a reversal in the middle. If the antagonist survives the protagonist's first decisive action, that survival and whatever breaks the deadlock are the most important content in the sequence and must appear in story_spine.climax.

READING RULE 3: NEVER INVENT A BEAT TO FILL A FIELD
Failure: the save-the-cat lens reported "All Is Lost at p.64, Guard seemingly mortally stabbed." Page 64 is the Guard delivering backstory in the security office. The Guard is not wounded until around printed p.79.
Rule: if a required structural beat cannot be located on a specific page with a quotable line of action, emit status "not_located" and say what you looked for and did not find. A missing beat is a legitimate and often valuable finding. A fabricated beat is the single most damaging thing this engine can produce, because it is indistinguishable from a real one to the reader.

READING RULE 4: SEARCH FOR THE PLANT BEFORE PRESCRIBING ONE
Failure: the engine told the writer to add foreshadowing for the killer's "hermana" vulnerability. Both halves of that setup already exist. The killer's half: DOS HERMANOS carved into the knife handles (p.6), the framed photo of the two brothers standing behind the knives, the Supervisor smashing it (p.32), the photo back on the cutting-room wall with a full INSERT describing both brothers' matching mouth and eyebrows (p.98), paying off with "La misma boca de la foto" (p.107). Tommy's half: the first line he speaks in the movie is "Buenos días hermana" (p.2).
Rule: before writing any note of the form "this is unprepared" or "add a setup," run a backward search for the payoff's key nouns, objects, and dialogue. Check INSERT and ANGLE headings specifically, since writers plant in them. If a setup exists, the note must be "sharpen the existing setup at p.X" and must cite the page. Telling a writer to build something already built destroys the credibility of every other note in the document.

READING RULE 5: GORE IS NOT AUTOMATICALLY A KILL, AND VIOLENCE CAN BE CHARACTER
Failure: the engine listed "hand-in-grinder" among the script's extreme kills. It is not a kill. After Irina amputates his hand in the band saw, the killer picks his own severed hand up off the table, carries it to the industrial grinder, and drops it onto the pile of ground meat that a customer later buys. It is the most self-revealing act the character performs and it is the mechanical plant for the final image of the bracelet in the ground beef. The engine filed it as content-rating risk and never mentioned it in strengths.
Rule: classify each violent beat by function before by intensity. Ask who it happens to, who performs it, and what it reveals or sets up. Self-directed violence, ritual, and disposal are character and theme material. Only beats where a character dies count toward kill inventory.

READING RULE 6: COUNT FROM A LEDGER, NEVER FROM MEMORY
Failure: the engine wrote "all five kills" and "three of five kills land in the final thirty pages." There are six on-page deaths (Supervisor p.33, Mabel p.47, Max p.58, Emilio p.63, Guard p.81, Betsabé p.89-91) and only two fall after p.81.
Rule: build an explicit ledger of deaths, injuries, and major reveals with page numbers and evidence before writing any prose. Generate every count, ratio, and page-range claim from the ledger. Never free-write a number.

READING RULE 7: RECONCILE YOUR OWN FIELDS BEFORE SEALING
Failure: this single document contained four internal contradictions. story_spine.ending said the killer was found while uncertainties said he was alive and sharpening. The spine described a one-stage climax while save-the-cat correctly described the two-stage version. The spine said the Guard died "crucifying himself against the Carnicero," which is garbled, while story-grid correctly said his hands were pinned to the floor with his own knives. Save-the-cat named the nose-ring tear as the "final image" while the synopsis correctly named the bracelet in the ground beef.
Rule: before finalizing, cross-check the ending, the climax, every character death, and every image labeled "final image" across the spine, the synopsis, and every lens. They must tell one story. If two passes disagree, resolve against the page and say which reading you rejected and why.

READING RULE 8: A LENS THAT DOES NOT APPLY DOES NOT GRADE
Failure: the comedy-contract lens graded a horror film "weak" while its own text stated that the lens does not apply. That is a genre penalty disguised as a finding.
Rule: each lens declares applicability first. If not applicable, grade is "not_applicable," it is excluded from every aggregate and from the verdict, and its text is kept only as a short genre-fit note.

READING RULE 9: CITE THE PRINTED PAGE NUMBER
Failure: page references mixed PDF index and printed page number in the same document, since the title page offsets them by one. A writer opening to a cited page found the wrong page.
Rule: every page reference in prose and in structured fields is the printed page number as it appears in the page header. State the convention once in the output.

READING RULE 10: READ THE SUPPORTING CAST'S THEME CARRYING
Failure: the engine noted only that the internal arc was "partly reassigned to the Guard" and then dropped him. The Guard carries the film's guilt theme: the orthopedic leg, the pill bottle he empties onto the floor (p.74), the exchange about Irina's father drinking, and the line "No fue solo tu padre. Fuimos todos." That is the town's complicity, and it is why his sacrifice lands. The engine also missed Betsabé's stutter, which escalates precisely with her fear and disappears when she decides to fight.
Rule: for every significant supporting character, ask what theme they carry and what physical or verbal tell tracks their state. Name the tell and cite it. These are the observations that make coverage read like a person wrote it.

---

## Engineering note on Rule 9 (page numbering)

The rule as written asks for printed page-header numbers. The engine's
verbatim citation verification and page relocation are keyed to physical
[PAGE N] parser markers, and printed headers are unreliable in scanned or
unnumbered PDFs — so the engine standardizes on the OTHER convention
instead of mixing: every reference is the [PAGE N] physical page, the model
is forbidden from reading printed headers for numbering, and every report
carries a `page_convention` field stating this once, satisfying the rule's
core demand (one consistent convention, stated in the output). If printed
headers must ever become the display convention, the right place is a
physical→printed offset map in the parser, not the model.
