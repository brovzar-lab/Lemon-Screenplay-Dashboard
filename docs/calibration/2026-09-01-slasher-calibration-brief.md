# Standing calibration brief #3 — Slasher in Acapulco (2026-09-01)

Author: Billy Rovzar (human line-by-line audit of the coverage-v1.1-candidate
sealed output on "Slasher in Acapulco", 104-page PDF, 103 printed pages,
title-page offset of 1; printed page numbers throughout). This was the
generalization test: a script that contributed no rules, read by the engine
calibrated on briefs #1 and #2.
Status: **absorbed into the engine as coverage-v1.1** — see the engineering
notes at the end. This file is the verbatim source of record; if the
distillation and this text ever disagree, this text wins.

---

STANDING CALIBRATION BRIEF #3 FOR THE COVERAGE ENGINE
Source: human audit of the sealed output on "Slasher in Acapulco" (104-page PDF, 103 printed pages, title page offset of 1), checked line by line against the screenplay. All page numbers below are PRINTED page numbers. This brief supersedes nothing in Briefs #1 and #2; it adds to them and reports which prior fixes landed.

============================================================
PART ZERO: FIXES THAT LANDED. DO NOT REGRESS THESE.
============================================================
The following defects from Briefs #1 and #2 are resolved in this output and must remain resolved:
- page_convention and page_numbering are now declared explicitly, with the offset detected from 102 page headers. Correct.
- comedy-contract returned grade "not_applicable" on a horror script instead of grading it "weak." Correct, and the exact fix requested twice.
- Absent beats are now reported as "NOT LOCATED" (Theme Stated, the ticking clock) instead of being invented to fill a schema field. This is the single most important fix in the system and it is working.
- continuity_flags exists and surfaced real findings (Torito/Armando dual name; Don Ramón's death removing the only established control over the monster; the combi keys logic gap).
- The audit ran on Sonnet, produced six partial classifications instead of a blanket pass, and correctly set human_review_recommended to true with review_reasons populated.
Keep all of the above.

============================================================
PART ONE: THE RECURRING DEFECT, NOW CONFIRMED AS SYSTEMATIC
============================================================
For the third consecutive script, the engine's central criticism was that something is unprepared or unresolved, and the preparation or resolution was on the page.
- Matadero: claimed the "hermana" trigger was unprepared. It is planted on p.2 and across the photo chain (pp.6, 32, 98, 107).
- Hermanos Márquez Castillo: claimed the inheritance loophole was unseeded. It is read aloud twice on p.52 and quoted back on p.123.
- Slasher in Acapulco: two false absence claims, detailed below.
This is a standing bias, not three coincidences. Treat any sentence containing "unresolved," "unprepared," "unseeded," "never established," "never mentioned again," "disappears," "abandoned," "no runway," "deus ex machina," or "convenient" as a HIGH-RISK ASSERTION that may not be emitted until a disconfirming full-text search has been run and its result recorded in the output.

DEFECT 1. FALSE "NEVER MENTIONED AGAIN" CLAIM, ASSERTED FOUR TIMES.
The output claims in concerns[1], genre_contract.failures[0], development_priorities[1], and pass_reason that Máxima's fate is unresolved and that "she is never mentioned again after p.81." The fact_audit classified this "supported."
The page: on p.81 the Coquero has already mutilated her hands and replaced them with fish fins. On p.83, two pages later, the description of his toy shelf reads "un par de títeres hechos con las manos de MÁXIMA." Her severed hands have been made into puppets. That is her fate, stated on the page. On p.103, in the final scene, Socorro looks at the belongings of the dead: "las muletas de MIGUEL, el bañador de MÁXIMA, la guitarra de TORITO, la cigarrera de AMPARO, el cuaderno de dibujos de EMILIANO y el cadáver de TENOCH todavía empalado." Máxima is in the memorial row, and her face is in the polaroid moments later.
The note that was actually available: her death is implied rather than staged. A producer may want the moment on screen. That is a polish note worth one line, not a structural failure worth a quarter of the pass_reason.
Rule: any claim that a named character is "never mentioned again" after page N must be preceded by a case-insensitive full-text search for that character's name across pages N to the end, and the search result must be recorded. If any hit exists, the claim may not be written in that form.

DEFECT 2. FALSE "UNPREPARED" CLAIM THAT ALSO CAUSED A SCENE TO BE MISREAD.
The output claims in concerns[2], development_priorities[2] and pass_reason that Emiliano's betrayal is "entirely unearned," that "no earlier behavior forecasts this choice," and that "his sole character tell is ambition" via a London/Paris line on p.99 delivered "only seconds before he strangles Socorro."
The page: Emiliano abandons the group at gunpoint on pp.66-67. He beats Don Ramón to death around p.90. And on pp.94-95 he walks into the room where the Coquero has Socorro pinned to the floor, she looks at him and stretches out her hand, and the script stages his answer in full: "EMILIANO mira cómo es maltratada con los ojos muy abiertos. Niega con la cabeza y espantado da un paso hacia atrás. Sale del cuarto." That is his defining moral act, four pages before the climax, and it appears nowhere in the coverage.
Rule: before asserting that a character turn lacks runway, build an explicit behavior ledger for that character across the full script, listing every choice they make under pressure with page and quote. Emit the ledger. If it contains two or more prior beats consistent with the turn, the claim must be reframed as a calibration note (the runway is present but thin, or the earlier beats need sharpening) and must cite them.

DEFECT 3. SCENE FUNCTION MISREAD AS A CONSEQUENCE OF DEFECT 2.
The output calls the Coquero's assault of Socorro (pp.94-95) "closer to exploitation than to dread" and says it "functions as sexual menace rather than horror mechanics," and this becomes one of two genre_contract failures and part of pass_reason.
The page: the scene performs two structural jobs simultaneously. It stages Emiliano's refusal (above), and it pays off the cartoon plant, since Socorro escapes by punching the television until the signal returns and the Coquero's fixation pulls him off her. The engine's own horror-contract lens praises that plant and payoff a few sentences earlier without noticing it occurs inside the scene it is condemning.
Rule: before judging a scene as gratuitous or as serving no mechanical function, list what the scene sets up or pays off and what it changes about who each character is. A scene that resolves a planted rule and delivers a character's decisive moral choice is not function-free, whatever its content. Legitimate content and classification concerns remain legitimate: raise them as classification and staging notes (as uncertainties[3] already does well), not as a genre-contract failure.

============================================================
PART TWO: RELATIONSHIP MAPPING FAILURE AND WHAT IT COST
============================================================
DEFECT 4. THE FAMILY STRUCTURE IS INVERTED THROUGHOUT THE SPINE AND SYNOPSIS.
The output says the group crashes "a political party at the home of Ignacio's powerful stepfather," that "Torito punches the stepfather into the pool," and that Miguel is "Ignacio's younger stepbrother."
The page: EL PADRE is Socorro and Torito's biological father (p.10, La Madrastra: "Socorro y Armando. Su padre quiere hablar con ustedes"; p.11, the Padre to Torito: "Tú cállate, Armando"). La Madrastra is their stepmother and is Ignacio and Miguel's mother (p.7, she summons Miguel to speak with "tu hermano," both answer "Sí madre," and she refers to the Padre as "su padrastro"). Miguel greets Socorro and Torito as "mis nuevos hermanitos" (p.10). On p.14 the Padre slaps Socorro and Torito punches HIS OWN FATHER into the pool. The beach house belongs to La Madrastra, which the horror-contract lens states correctly while the synopsis calls it "Ignacio's mother's" house without registering that she is also the protagonist's stepmother.
Rule: build a relationship graph before writing any prose. For every named character, record their relation to every other named character with the page and quote that establishes it. Emit the graph. Never infer a relationship from proximity, shared surname, or who owns a location. Where two characters are step-siblings, state which parent is whose.

DEFECT 5. THE THEME MISSED AS A DIRECT CONSEQUENCE OF DEFECT 4.
The horror-contract lens searched for the monster's Double, concluded it "is present but underwritten," and settled for a loose parallel between the Coquero's abandonment and Torito's. The actual double is structural and exact: every parent in this film is a substitute or an abandoner. Don Ramón is a broken priest raising the Coquero as a surrogate son and is the only person who can command him (pp.88-89). The Padre abandoned Torito, and Torito states it precisely on p.61: "Te fuiste con papá y con su puta, dejándome solo en la calle... Tú y yo no somos nada. Tenoch era mi única familia." And the killing ground is the house of the stepmother who replaced their mother. The monster made by a false father hunts the children ruined by a false family, inside the false mother's house.
Rule: when a lens concludes that a thematic element is "present but underwritten" or "works subconsciously rather than structurally," that is a signal to re-derive it from the relationship graph before writing the conclusion. An underwritten-double finding must list the parallels checked and rejected.

============================================================
PART THREE: GOVERNANCE, THE LAST STRUCTURAL GAP
============================================================
DEFECT 6. THE AUDIT DETECTS BUT CANNOT REPAIR, AND THE DOCUMENT SEALED WITH KNOWN ERRORS INTACT.
The audit caught three real factual errors and all three survived into the sealed text unchanged:
- spine.turn_0 still says Torito punched "Ignacio's stepfather" after the audit stated plainly that the Padre is Socorro and Torito's father.
- spine.turn_2 still says Emiliano was "poisoned" when he took the keys on p.67, after the audit noted the poison trap occurs on p.94.
- spine.protagonist still says "half-sister" after the audit noted the script never establishes this.
A document that contains both an error and the proof of the error is worse than one that contains only the error, because it demonstrates the system knew.
Rules: any audit verdict that identifies a specific factual error in a claim must trigger a repair pass that rewrites the claim, and the seal must be blocked until the rewritten claim passes re-audit. Only interpretive disagreements (the "evaluative judgment, not a factual claim" category the audit used correctly on pass_reason) may seal as partial without a rewrite.

DEFECT 7. SUPPORT_RATE IS STILL INCOHERENT.
support_rate is reported as 1.0 alongside six entries in central_partials. Partials must be weighted below 1.0. A rate that reads 100 percent on a document the system itself flagged for human review is not a metric.

DEFECT 8. RESIDUAL INTERNAL PAGE INCONSISTENCY.
The scene in which Socorro retrieves the keys from inside Tenoch's skull is cited as p.61 in the lemon-coverage lens and as p.59 in continuity_flags. It is on p.61; p.59 is where Torito searches the morral and finds nothing. Every reference to a given scene must resolve to one page. Add a final pass that clusters all page citations by described event and flags any event cited at two different pages.

============================================================
PART FOUR: WHAT THIS OUTPUT GOT RIGHT, PRESERVE IT
============================================================
The logline is accurate and sellable. The Coquero's monster design analysis is strong, including the correct identification of the cartoon rule as a planted and paid-off monster rule. The cartoon/cereal scene (p.93) as the script's best scare and best image is exactly right, and the reasoning (dread from recognition rather than shock) is the best writing in the document. The mercy-killing of Torito as the emotional summit is right. The Act One length concern is right and well quantified. The scare-architecture breakdown of the beach attack sequence is precise and useful. The continuity_flags on the Torito/Armando dual name and on Don Ramón's death removing the monster's only control mechanism are exactly the kind of finding this field exists for; the second one is a genuine story note the writers can use. The commercial hypothesis is grounded and specific. CONSIDER at medium confidence is the right verdict and survives the corrections above, though pass_reason must be rewritten: the Act One length and the classification risk stand, while the Máxima and Emiliano arguments do not.

---

## Engineering notes (what each item became — engine coverage-v1.1)

- **Part One (systematic absence bias)** → two layers. Structural: both the
  coverage and audit prompts now receive a **CHARACTER PAGE INDEX** —
  code-generated by exact uppercase-name search, listing every page each
  character appears on — declared authoritative, so "never mentioned again
  after p.N" is refutable at a glance by either model. Prompt: HOUSE RULE 4
  upgraded with the brief's verbatim HIGH-RISK ASSERTION word list; the
  audit charter's absence rule extended to "never mentioned again /
  unresolved" and pointed at the index.
- **Defect 2** → HOUSE RULE 15 (behavior ledger before any "unearned turn"
  claim; ≥2 consistent prior beats reframe it as "runway present but thin",
  citing pages).
- **Defect 3** → HOUSE RULE 16 (list what a scene sets up/pays off/changes
  before calling it gratuitous; content and rating concerns are
  classification notes, never genre-contract failures when the scene does
  structural work).
- **Defects 4–5** → HOUSE RULE 14 (relationship graph from explicit page +
  quote before any prose; never infer from proximity, surname, or location
  ownership; re-derive "underwritten" thematic findings from the graph).
- **Defect 6** → new **fact-repair stage** (the engine-version bump):
  central claims the audit marks `partially_supported` are rewritten by a
  cheap no-screenplay correction call using only the auditor's notes, then
  the corrected claims are **re-audited** before sealing; only what passes
  re-audit seals, remaining interpretive partials seal with the review flag,
  and a contradiction after rewrite blocks the seal (`needs_review`).
  Contradicted central facts still skip repair and go straight to human
  review — a fundamentally wrong read is never patched in place. Call
  ceiling per script rises from 3 to 5 (2 base + 1 structure/audit repair +
  fact repair + re-audit); the canary bar is updated accordingly.
- **Defect 7** → `support_rate` is now weighted: supported = 1.0,
  partially_supported = 0.5. A review-flagged document can no longer read
  1.0.
- **Defect 8** → HOUSE RULE 13 extended: one page (or range) per scene
  across ALL fields — spine, lenses, continuity_flags alike. (A code-level
  event-clustering pass is not implemented: matching free-text descriptions
  of "the same event" is unreliable in code; the benchmark will measure
  whether the prompt rule suffices.)
- **Part Zero** → regression tests lock the landed fixes (not_applicable
  grades, page numbering, continuity_flags, review teeth).
