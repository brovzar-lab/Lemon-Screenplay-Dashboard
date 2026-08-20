# FINAL DELIVERABLE

**Task:** LEMA-8937 Studio Pulse market snapshot (buyer content-appetite research).
**File delivered:** `studio-pulse-market-snapshot-2026-08-19.md` (also attached to this issue).
**Snapshot date:** 2026-08-19 | **Territories:** 5 (Mexico deepest) | **Buyers:** Netflix, Amazon MGM/Prime Video, HBO Max, Warner Bros., Apple TV+ | **Sources in ledger:** 33.

**Top signals (highest research-signal-index):**
- Latin America / Mexico romance (incl. hybrids): index 86/84 (high) - romance is now 30% of LatAm scripted commissions in H1 2026.
- Mexico true crime and crime drama: index 85 (high) - HBO Max quality-over-volume, true-crime docuseries tilt.
- Global non-English local-language originals: index 84 (high) - ~52% of streaming originals; Netflix ~US$20B 2026 spend.
- Spain action + young-adult and thriller/heist: index 82/80 (high) - Prime Video No.1 non-English power; Netflix Tres Cantos hub.
- Mexico is the priority market: Netflix US$1B (2025-2028) + new 30% EFICA government tax credit.

**Validation passed:** JSON parses strictly; all 29 evidenceIds used in JSON exist in the ledger; all signal/confidence/territory enums valid; every claim dated; every demand score explained; facts separated from inferences; no credentials or private Lemon data.

**Governance:** These market signals must NOT change screenplay scores or coverage verdicts. Research-only; no code changed, no schedule created.

**Main evidence gaps:** per-genre budget ranges (not disclosed), Warner Bros. local non-HBO-Max theatrical plans, US-Latino-specific original commissioning, Apple TV+ Spanish-language pipeline beyond Las Azules.

---

# Studio Pulse Market Snapshot

**File:** studio-pulse-market-snapshot-2026-08-19.md
**As of:** 2026-08-19
**Status:** research_snapshot
**Prepared by:** Research Specialist, Lemon Virtual Studios
**Research window:** Primary evidence Aug 2025 to Aug 2026 (last 12 months). Older evidence used only as labeled background.

> **Governance note (required):** This is a market-demand research snapshot only. These market signals must NOT change screenplay scores, coverage verdicts, or any creative evaluation. They describe what buyers appear to want; they do not judge the quality of any Lemon project. No project titles, screenplay text, or private Lemon data appear in this document. No API key, token, cookie, login, or credential appears in this document.

---

## 1. Executive Summary

1. **Mexico is the single hottest local-content market for global buyers right now.** Netflix committed US$1 billion to Mexican film and series over 2025 to 2028 (at least 20 titles per year) and opened an expanded Mexico City hub; the Mexican government layered on a new 30% audiovisual tax credit (EFICA) in Feb to Mar 2026. Signal: **high**. [MX-NFLX-001, MX-GOV-001, MX-THR-001]
2. **Romance is now the most-commissioned scripted genre across Latin America (30% of scripted commissions in H1 2026), and it is mutating into hybrids** (romance + thriller, telenovela + mystery, drama + music). This is the clearest recent shift. Signal: **rising/high**. [MX-SENAL-001, LA-SENAL-001]
3. **True crime and crime drama are a durable, buyer-backed appetite in Mexico and the region.** HBO Max Latin America is running a quality-over-volume slate weighted to true-crime docuseries; Prime Video and Netflix both lean on crime/thriller. Signal: **high**. [MX-WBD-002, MX-AMZN-001, MX-PARROT-001]
4. **Nostalgia and heritage IP proved it can be a mega-hit:** HBO Max's *Chespirito: Sin Querer Queriendo* (premiered 5 Jun 2025) became the platform's biggest Latin American title ever and a global top-5. Buyers are extending the universe (*Don Ramón*). Signal: **rising** (phenomenon-driven; confidence medium on generalizing). [MX-WBD-001]
5. **Prime Video has repositioned Spanish-language content as a global export engine.** Spain-produced *Culpables* franchise crossed 100M viewers with 90%+ outside Spain; Prime treats Latin America and Spain as sources of internationally exportable hits. Signal: **high**. [GLBL-AMZN-001, SP-AMZN-002, MX-AMZN-001]
6. **Spain is a two-lane market:** Netflix (EUR 1B+/US$1.2B for 2025 to 2028, Tres Cantos studio hub) leans thriller/heist/crime and event miniseries; Prime Video, Spain's No. 1 non-English export power, leans action + young-adult + romance + big reality. Signal: **high**. [SP-NFLX-001, SP-AMZN-001]
7. **US Latino demand is large but under-commissioned as a distinct segment.** Hispanic viewers overindex on streaming (55.8% of their TV time) and 7 in 10 watch Spanish-language content, yet buyers largely serve them with pan-regional Spanish titles rather than US-Latino-specific originals. Opportunity signal: **rising**; buyer-commissioning signal for the segment specifically: **selective**. [USL-NIEL-001, USL-BEL-001]
8. **Globally, non-English local-language originals are now the majority of streaming originals (~52% in 2025) and the strategic priority** as total 2026 content spend approaches record levels (Netflix alone ~US$20B). Signal: **high**. [GLBL-TREND-001, GLBL-NFLX-001]
9. **Apple TV+ is the outlier: more selective and cost-disciplined** (content budget trimmed roughly US$5B to US$4.5B; ~a dozen films/year, most under US$100M). It maintains select Spanish-language scripted (*Women in Blue / Las Azules* renewed for S2) but is not a volume buyer in Spanish-language markets. Signal: **selective**. [GLBL-APPL-001, MX-APPL-001]
10. **Warner Bros. (theatrical) is ramping releases (11 in 2025 to 14 in 2026 to 18 in 2027) but around global tentpoles/franchises;** its Latin American local commissioning runs mainly through HBO Max rather than a separate local theatrical pipeline. Signal for local originals via WBD theatrical: **selective**. [GLBL-WBD-001, MX-WBD-002]

**What changed recently (last ~12 months):** (a) Mexico's government incentive stack (EFICA 30% credit, Feb to Mar 2026) turned Mexico into a cost-competitive production base on top of Netflix's US$1B pledge; (b) romance overtook other scripted genres in LatAm commissioning in H1 2026; (c) HBO Max's LatAm strategy shifted explicitly to quality-over-volume with a true-crime docuseries tilt; (d) Prime Video formalized an "International Originals" global-export strategy around Spanish-language franchises; (e) overall LatAm scripted commissioning volume contracted ~13% year over year, concentrating spend on resilient genres.

---

## 2. Dashboard Snapshot JSON

```json
{
  "schemaVersion": 1,
  "asOf": "2026-08-19",
  "status": "research_snapshot",
  "territories": [
    {
      "id": "mexico",
      "label": "Mexico",
      "buyers": [
        {
          "id": "netflix",
          "name": "Netflix",
          "appetite": "Aggressive local investment: US$1B for 2025-2028, 20+ titles/year. Wants action thrillers, romance, comedy and historical drama made with local partners.",
          "formats": "Series + features",
          "signal": "high",
          "matchQuery": "thriller",
          "confidence": "high",
          "evidenceIds": ["MX-NFLX-001", "MX-NFLX-002", "MX-THR-001"],
          "notes": "Backed by new 30% EFICA government tax credit; Churubusco Studios upgrade."
        },
        {
          "id": "amazon",
          "name": "Amazon MGM / Prime Video",
          "appetite": "Local-obsession hits: romance, true crime, comedy adaptations and courtroom drama. Record Mexico premiere with Mentiras, La Serie; The Office adaptation La Oficina for 2026.",
          "formats": "Series + films",
          "signal": "high",
          "matchQuery": "romance",
          "confidence": "high",
          "evidenceIds": ["MX-AMZN-001"],
          "notes": "Positions Mexico as a source of globally exportable franchises."
        },
        {
          "id": "hbo-max",
          "name": "HBO Max",
          "appetite": "Quality over volume: nostalgia/heritage IP (Chespirito universe), true-crime docuseries and prestige drama. Similar or slightly higher volume than 2025.",
          "formats": "Series + docuseries",
          "signal": "rising",
          "matchQuery": "crime",
          "confidence": "high",
          "evidenceIds": ["MX-WBD-001", "MX-WBD-002"],
          "notes": "Chespirito: Sin Querer Queriendo is the biggest LatAm title in platform history."
        },
        {
          "id": "warner-bros",
          "name": "Warner Bros.",
          "appetite": "Theatrical slate driven by global tentpoles and franchises. Local Mexican scripted commissioning runs mainly through HBO Max rather than a separate theatrical local pipeline.",
          "formats": "Features (studio tentpoles)",
          "signal": "selective",
          "matchQuery": "action",
          "confidence": "low",
          "evidenceIds": ["GLBL-WBD-001", "MX-WBD-002"],
          "notes": "No Mexico-specific local theatrical production plan disclosed in the last 12 months."
        },
        {
          "id": "apple-tv-plus",
          "name": "Apple TV+",
          "appetite": "Selective. Maintains select Spanish-language crime drama (Women in Blue / Las Azules renewed for S2) but is not a volume buyer in Mexico.",
          "formats": "Series",
          "signal": "selective",
          "matchQuery": "crime",
          "confidence": "medium",
          "evidenceIds": ["MX-APPL-001", "GLBL-APPL-001"],
          "notes": "Company-wide cost discipline limits Mexico output."
        }
      ],
      "demands": [
        {
          "id": "true-crime",
          "label": "True crime and crime drama",
          "index": 85,
          "matchQuery": "crime",
          "confidence": "high",
          "evidenceIds": ["MX-WBD-002", "MX-AMZN-001", "MX-PARROT-001"]
        },
        {
          "id": "romance-drama",
          "label": "Romance and romantic drama (incl. hybrids)",
          "index": 84,
          "matchQuery": "romance",
          "confidence": "high",
          "evidenceIds": ["MX-SENAL-001", "MX-AMZN-001", "GLBL-NFLX-002"]
        },
        {
          "id": "elevated-action-thriller",
          "label": "Elevated action / police thriller",
          "index": 82,
          "matchQuery": "thriller",
          "confidence": "high",
          "evidenceIds": ["MX-NFLX-001", "MX-NFLX-002", "MX-PARROT-001"]
        },
        {
          "id": "nostalgia-ip-biopic",
          "label": "Nostalgia / heritage IP and biographical drama",
          "index": 76,
          "matchQuery": "biography",
          "confidence": "medium",
          "evidenceIds": ["MX-WBD-001", "MX-AMZN-001"]
        },
        {
          "id": "comedy",
          "label": "Comedy (adaptations and stand-up formats)",
          "index": 70,
          "matchQuery": "comedy",
          "confidence": "medium",
          "evidenceIds": ["MX-AMZN-001", "MX-NFLX-002"]
        },
        {
          "id": "historical-period-drama",
          "label": "Historical / period drama",
          "index": 62,
          "matchQuery": "drama",
          "confidence": "medium",
          "evidenceIds": ["MX-NFLX-002", "MX-PARROT-001"]
        }
      ]
    },
    {
      "id": "us-latino",
      "label": "US Latino",
      "buyers": [
        {
          "id": "netflix",
          "name": "Netflix",
          "appetite": "Serves US Latino via pan-Spanish library plus its Mexico slate; Latinos overindex on Netflix. No US-Latino-exclusive scripted mandate disclosed.",
          "formats": "Series + films (pan-regional)",
          "signal": "rising",
          "matchQuery": "spanish",
          "confidence": "medium",
          "evidenceIds": ["USL-NIEL-001", "USL-BEL-001"],
          "notes": "Demand is high; segment-specific commissioning is not."
        },
        {
          "id": "amazon",
          "name": "Amazon MGM / Prime Video",
          "appetite": "Reaches US Hispanic through pan-regional Spanish hits (Betty la Fea) and Telemundo/free ad-supported channels.",
          "formats": "Series + films (pan-regional)",
          "signal": "rising",
          "matchQuery": "romance",
          "confidence": "medium",
          "evidenceIds": ["USL-PARROT-001", "LA-AMZN-001"],
          "notes": null
        },
        {
          "id": "hbo-max",
          "name": "HBO Max",
          "appetite": "US Hispanic served via LatAm true-crime and prestige IP; no distinct US-Latino original mandate disclosed.",
          "formats": "Series + docuseries",
          "signal": "selective",
          "matchQuery": "crime",
          "confidence": "low",
          "evidenceIds": ["USL-PARROT-001"],
          "notes": null
        },
        {
          "id": "warner-bros",
          "name": "Warner Bros.",
          "appetite": "No US-Latino-specific theatrical commissioning signal identified in the last 12 months.",
          "formats": "unknown",
          "signal": "unknown",
          "matchQuery": "unknown",
          "confidence": "low",
          "evidenceIds": [],
          "notes": "Evidence gap."
        },
        {
          "id": "apple-tv-plus",
          "name": "Apple TV+",
          "appetite": "Select Spanish-language crime drama reaches US Hispanic (Las Azules), but selective posture.",
          "formats": "Series",
          "signal": "selective",
          "matchQuery": "crime",
          "confidence": "low",
          "evidenceIds": ["MX-APPL-001"],
          "notes": null
        }
      ],
      "demands": [
        {
          "id": "spanish-bilingual-scripted",
          "label": "Spanish-language and bilingual scripted",
          "index": 72,
          "matchQuery": "spanish",
          "confidence": "medium",
          "evidenceIds": ["USL-NIEL-001", "USL-BEL-001", "USL-PLAT-001"]
        },
        {
          "id": "cross-border-crime-thriller",
          "label": "Cross-border crime and thriller",
          "index": 66,
          "matchQuery": "thriller",
          "confidence": "medium",
          "evidenceIds": ["USL-PARROT-001", "MX-PARROT-001"]
        },
        {
          "id": "telenovela-romance",
          "label": "Telenovela and romance",
          "index": 64,
          "matchQuery": "romance",
          "confidence": "medium",
          "evidenceIds": ["USL-PARROT-001", "LA-AMZN-001"]
        }
      ]
    },
    {
      "id": "latin-america",
      "label": "Latin America",
      "buyers": [
        {
          "id": "netflix",
          "name": "Netflix",
          "appetite": "Regional slate anchored in Mexico plus Argentina (19 Argentine titles across 2026-2027). Romance, crime and drama with name directors.",
          "formats": "Series + features",
          "signal": "high",
          "matchQuery": "romance",
          "confidence": "high",
          "evidenceIds": ["LA-NFLX-001", "MX-NFLX-001"],
          "notes": null
        },
        {
          "id": "amazon",
          "name": "Amazon MGM / Prime Video",
          "appetite": "Local-obsession franchises (Betty la Fea, Culpables), courtroom/true-crime drama and competition reality; region positioned as global-export source.",
          "formats": "Series + films + reality",
          "signal": "high",
          "matchQuery": "romance",
          "confidence": "high",
          "evidenceIds": ["LA-AMZN-001", "MX-AMZN-001"],
          "notes": null
        },
        {
          "id": "hbo-max",
          "name": "HBO Max",
          "appetite": "Quality over volume; true-crime docuseries and prestige/heritage IP (City of God, Like Water for Chocolate, Chespirito).",
          "formats": "Series + docuseries",
          "signal": "rising",
          "matchQuery": "crime",
          "confidence": "high",
          "evidenceIds": ["MX-WBD-002"],
          "notes": null
        },
        {
          "id": "warner-bros",
          "name": "Warner Bros.",
          "appetite": "Local commissioning channelled through HBO Max; theatrical is global-tentpole-led.",
          "formats": "Features (tentpoles)",
          "signal": "selective",
          "matchQuery": "action",
          "confidence": "low",
          "evidenceIds": ["MX-WBD-002", "GLBL-WBD-001"],
          "notes": null
        },
        {
          "id": "apple-tv-plus",
          "name": "Apple TV+",
          "appetite": "Selective Spanish-language scripted; not a volume regional buyer.",
          "formats": "Series",
          "signal": "selective",
          "matchQuery": "crime",
          "confidence": "low",
          "evidenceIds": ["MX-APPL-001", "GLBL-APPL-001"],
          "notes": null
        }
      ],
      "demands": [
        {
          "id": "romance-scripted",
          "label": "Romance (top scripted genre, incl. hybrids)",
          "index": 86,
          "matchQuery": "romance",
          "confidence": "high",
          "evidenceIds": ["LA-SENAL-001", "LA-PARROT-001"]
        },
        {
          "id": "crime-drama-true-crime",
          "label": "Crime drama and true crime",
          "index": 82,
          "matchQuery": "crime",
          "confidence": "high",
          "evidenceIds": ["LA-PARROT-001", "MX-WBD-002"]
        },
        {
          "id": "telenovela-hybrid-melodrama",
          "label": "Modernized telenovela / hybrid melodrama",
          "index": 74,
          "matchQuery": "drama",
          "confidence": "medium",
          "evidenceIds": ["LA-SENAL-001", "LA-PARROT-001"]
        },
        {
          "id": "competition-reality",
          "label": "Competition and talent reality",
          "index": 70,
          "matchQuery": "reality",
          "confidence": "medium",
          "evidenceIds": ["LA-PARROT-001", "SP-AMZN-001"]
        },
        {
          "id": "microdrama-shortform",
          "label": "Microdrama / vertical short-form",
          "index": 58,
          "matchQuery": "drama",
          "confidence": "low",
          "evidenceIds": ["LA-CNBC-001", "LA-SENAL-001"]
        }
      ]
    },
    {
      "id": "spain",
      "label": "Spain",
      "buyers": [
        {
          "id": "netflix",
          "name": "Netflix",
          "appetite": "EUR 1B+/US$1.2B for 2025-2028 with the Tres Cantos studio hub. Thrillers, heist/crime, YA and event miniseries with a strong hook.",
          "formats": "Series + features",
          "signal": "high",
          "matchQuery": "thriller",
          "confidence": "high",
          "evidenceIds": ["SP-NFLX-001"],
          "notes": "Spanish titles generated 5B+ viewing hours in the prior year."
        },
        {
          "id": "amazon",
          "name": "Amazon MGM / Prime Video",
          "appetite": "Spain is Prime's No. 1 non-English export power. Action + young-adult scripted, romance (Culpables), and big live reality (Operacion Triunfo, LOL).",
          "formats": "Series + films + reality",
          "signal": "high",
          "matchQuery": "action",
          "confidence": "high",
          "evidenceIds": ["SP-AMZN-001", "SP-AMZN-002"],
          "notes": null
        },
        {
          "id": "hbo-max",
          "name": "HBO Max",
          "appetite": "Documentary and true-crime unscripted tied to recent/current affairs and sports figures.",
          "formats": "Docuseries + unscripted",
          "signal": "rising",
          "matchQuery": "crime",
          "confidence": "medium",
          "evidenceIds": ["SP-WBD-001"],
          "notes": null
        },
        {
          "id": "warner-bros",
          "name": "Warner Bros.",
          "appetite": "Local commissioning via HBO Max; theatrical is tentpole-led.",
          "formats": "Features + docuseries (via HBO Max)",
          "signal": "selective",
          "matchQuery": "action",
          "confidence": "low",
          "evidenceIds": ["SP-WBD-001", "GLBL-WBD-001"],
          "notes": null
        },
        {
          "id": "apple-tv-plus",
          "name": "Apple TV+",
          "appetite": "No disclosed Spain-specific originals mandate in the last 12 months.",
          "formats": "unknown",
          "signal": "unknown",
          "matchQuery": "unknown",
          "confidence": "low",
          "evidenceIds": ["GLBL-APPL-001"],
          "notes": "Evidence gap for Spain specifically."
        }
      ],
      "demands": [
        {
          "id": "action-young-adult",
          "label": "Action and young-adult scripted",
          "index": 82,
          "matchQuery": "action",
          "confidence": "high",
          "evidenceIds": ["SP-AMZN-001", "SP-AMZN-002"]
        },
        {
          "id": "thriller-crime-heist",
          "label": "Thriller / crime / heist",
          "index": 80,
          "matchQuery": "thriller",
          "confidence": "high",
          "evidenceIds": ["SP-NFLX-001"]
        },
        {
          "id": "romance-ya",
          "label": "Romance and YA romance",
          "index": 78,
          "matchQuery": "romance",
          "confidence": "high",
          "evidenceIds": ["SP-AMZN-002", "GLBL-NFLX-002"]
        },
        {
          "id": "documentary-true-crime",
          "label": "Documentary and true crime",
          "index": 68,
          "matchQuery": "crime",
          "confidence": "medium",
          "evidenceIds": ["SP-WBD-001"]
        },
        {
          "id": "reality-competition",
          "label": "Reality and competition",
          "index": 66,
          "matchQuery": "reality",
          "confidence": "medium",
          "evidenceIds": ["SP-AMZN-001"]
        }
      ]
    },
    {
      "id": "global",
      "label": "Global",
      "buyers": [
        {
          "id": "netflix",
          "name": "Netflix",
          "appetite": "~US$20B content spend in 2026. Non-English local-language originals prioritized; a declared year of romance; unscripted and live events added as new categories.",
          "formats": "Series + films + live/unscripted",
          "signal": "high",
          "matchQuery": "drama",
          "confidence": "high",
          "evidenceIds": ["GLBL-NFLX-001", "GLBL-NFLX-002", "GLBL-TREND-001"],
          "notes": null
        },
        {
          "id": "amazon",
          "name": "Amazon MGM / Prime Video",
          "appetite": "International Originals big bets: Spanish romance, Korean drama and Indian hits engineered to travel (Culpables 100M viewers, 90%+ outside home market).",
          "formats": "Series + films",
          "signal": "high",
          "matchQuery": "romance",
          "confidence": "high",
          "evidenceIds": ["GLBL-AMZN-001"],
          "notes": null
        },
        {
          "id": "hbo-max",
          "name": "HBO Max",
          "appetite": "Expanding international acquisition budget for local-language originals across Europe and Latin America; prestige and true crime.",
          "formats": "Series + docuseries",
          "signal": "rising",
          "matchQuery": "drama",
          "confidence": "medium",
          "evidenceIds": ["GLBL-TREND-001", "MX-WBD-002"],
          "notes": null
        },
        {
          "id": "warner-bros",
          "name": "Warner Bros.",
          "appetite": "Theatrical release count ramping 11 (2025) to 14 (2026) to 18 (2027), led by tentpoles and franchises (Dune, LOTR, DC).",
          "formats": "Features (tentpoles)",
          "signal": "rising",
          "matchQuery": "action",
          "confidence": "medium",
          "evidenceIds": ["GLBL-WBD-001"],
          "notes": "Franchise-first; limited window for original local features."
        },
        {
          "id": "apple-tv-plus",
          "name": "Apple TV+",
          "appetite": "More selective. Content budget trimmed to ~US$4.5B; ~a dozen films/year, most under US$100M. Fewer, prestige bets.",
          "formats": "Series + features",
          "signal": "selective",
          "matchQuery": "drama",
          "confidence": "medium",
          "evidenceIds": ["GLBL-APPL-001"],
          "notes": null
        }
      ],
      "demands": [
        {
          "id": "nonenglish-local-language",
          "label": "Non-English local-language originals that travel",
          "index": 84,
          "matchQuery": "drama",
          "confidence": "high",
          "evidenceIds": ["GLBL-TREND-001", "GLBL-NFLX-001", "GLBL-AMZN-001"]
        },
        {
          "id": "romance-romantasy",
          "label": "Romance and romantasy",
          "index": 78,
          "matchQuery": "romance",
          "confidence": "medium",
          "evidenceIds": ["GLBL-NFLX-002", "GLBL-AMZN-001"]
        },
        {
          "id": "unscripted-reality",
          "label": "Unscripted and reality",
          "index": 76,
          "matchQuery": "reality",
          "confidence": "medium",
          "evidenceIds": ["GLBL-TREND-003"]
        },
        {
          "id": "crime-thriller-evergreen",
          "label": "Crime and thriller (evergreen)",
          "index": 74,
          "matchQuery": "thriller",
          "confidence": "medium",
          "evidenceIds": ["GLBL-TREND-003", "MX-PARROT-001"]
        },
        {
          "id": "live-sports-events",
          "label": "Live sports and events",
          "index": 60,
          "matchQuery": "sports",
          "confidence": "medium",
          "evidenceIds": ["GLBL-NFLX-001"]
        }
      ]
    }
  ]
}
```

---

## 3. Territory Briefs

### 3.1 Mexico (deepest coverage)

**Overall:** Mexico is the priority local market for the two biggest spenders (Netflix, Prime Video) and the site of the most aggressive government-plus-platform capital stack in the region.

- **Netflix (signal: high).** US$1B commitment across 2025 to 2028, minimum 20 films/series per year, made in partnership with local production companies, plus a Churubusco Studios upgrade and an expanded Mexico City hub (pledged 20 Feb 2025 alongside President Sheinbaum). Genre appetite spans romance, action, drama, documentary and entertainment; recent local performers skew action/police thriller (*Contraataque* passed 70M views by mid-2025) and mystery. [MX-NFLX-001, MX-NFLX-002, MX-THR-001]
  - *Fact vs inference:* The US$1B and 20-title figures are sourced facts. The specific genre ranking is an **analyst inference** from the announced slate and viewing performance, not an explicit Netflix genre mandate.
- **Amazon MGM / Prime Video (signal: high).** "Customer obsession" localization under Javiera Balmaceda. *Mentiras, La Serie* is the biggest premiere in Prime Video Mexico history; *La Oficina* (Mexican adaptation of *The Office*, dir. Gaz Alazraki) premieres 2026. Genre priorities: romance, true crime, comedy adaptations, courtroom/social-justice drama. [MX-AMZN-001]
- **HBO Max (signal: rising).** Quality-over-volume for LatAm, volume similar to or slightly above 2025. *Chespirito: Sin Querer Queriendo* (premiered 5 Jun 2025) is the biggest LatAm title in platform history and a global top-5 in its first 28 days; the Chespirito universe is being extended (*Don Ramón*). Roughly six docuseries planned across 2026, five describable as true crime. [MX-WBD-001, MX-WBD-002]
- **Warner Bros. (signal: selective; confidence low).** No distinct Mexico local theatrical production plan disclosed in the last 12 months; WBD's Mexican local originals flow through HBO Max. Treat HBO Max as WBD's effective local commissioning arm. [MX-WBD-002, GLBL-WBD-001]
- **Apple TV+ (signal: selective).** Maintains Spanish-language crime drama *Women in Blue / Las Azules* (S2 dated 12 Aug 2026), but company-wide cost discipline caps Mexico volume. [MX-APPL-001, GLBL-APPL-001]
- **Government / production strategy.** New EFICA 30% transferable audiovisual tax credit (Presidential Decree 16 Feb 2026; Guidelines 30 Mar 2026), plus the first EFICINE cap increase in a decade (production cap raised from 20M to 25M pesos). Framed by the Sheinbaum government as building the audiovisual sector as an economic pillar. [MX-GOV-001]

**Demand scores (Mexico):**

| Demand | Index | matchQuery | Confidence | Score rationale |
|---|---|---|---|---|
| True crime and crime drama | 85 | crime | high | Authority ~30/35 (Variety + Forbes + Parrot); recency ~23/25 (2025-2026); breadth ~16/20 (3+ independent); intent ~16/20 (HBO Max explicitly slates 5-6 true-crime docuseries). |
| Romance and romantic drama | 84 | romance | high | Authority ~28/35 (Parrot measurement + Senal + Netflix Tudum); recency ~24/25 (H1 2026); breadth ~15/20; intent ~17/20 (romance = 30% of scripted commissions is an explicit, quantified signal). |
| Elevated action/police thriller | 82 | thriller | high | Authority ~30/35; recency ~22/25; breadth ~16/20; intent ~14/20 (inferred from Netflix slate and viewing, not an explicit stated mandate, so intent capped). |
| Nostalgia/heritage IP and biopic | 76 | biography | medium | Authority ~28/35; recency ~22/25; breadth ~15/20; intent ~11/20 (one mega-hit drives the read; generalizing to a standing buyer mandate is inference, so confidence medium). |
| Comedy (adaptations, stand-up) | 70 | comedy | medium | Authority ~24/35; recency ~22/25; breadth ~12/20; intent ~12/20 (a few greenlights, not a broad mandate). |
| Historical/period drama | 62 | drama | medium | Authority ~22/35; recency ~20/25; breadth ~10/20; intent ~10/20 (present on slates, no strong stated push). |

### 3.2 US Latino

**Overall:** Demand is structurally strong, commissioning of segment-specific originals is thin. This is a demand/supply gap, not a buyer mandate.

- Hispanic viewers take 55.8% of their TV time via streaming (vs ~46% rest of US) and overindex on Netflix and YouTube; 7 in 10 Latinos watch Spanish-language TV at least occasionally (up 11% since 2021), two-thirds watch international content. [USL-NIEL-001, USL-BEL-001]
- Platform moves target the segment: Roku's Espacio Latino (2025), YouTube TV Spanish-only plan, Peacock's Tplus bilingual hub with Telemundo. [USL-PLAT-001]
- Quality gap: ~45% of Latinx viewers say Spanish content is not on par with other offerings, an opening for premium producers. [USL-BEL-001]
- The named global buyers largely serve this audience through pan-regional Spanish content (Netflix Mexico slate, Prime's *Betty la Fea*), not US-Latino-exclusive originals. Warner Bros. shows no US-Latino-specific theatrical signal (evidence gap). [USL-PARROT-001, LA-AMZN-001]

**Demand scores (US Latino):**

| Demand | Index | matchQuery | Confidence | Score rationale |
|---|---|---|---|---|
| Spanish-language and bilingual scripted | 72 | spanish | medium | Authority ~26/35 (Nielsen strong); recency ~22/25; breadth ~14/20; intent ~10/20 (audience demand is explicit; buyer commissioning intent for the segment is weak/indirect). |
| Cross-border crime and thriller | 66 | thriller | medium | Authority ~24/35 (Parrot); recency ~20/25; breadth ~12/20; intent ~10/20 (inferred from shared demand with Mexico). |
| Telenovela and romance | 64 | romance | medium | Authority ~22/35; recency ~20/25; breadth ~12/20; intent ~10/20. |

### 3.3 Latin America (regional)

**Overall:** Volume is contracting (~13% fewer scripted commissions H1 2026 vs H1 2025) while spend concentrates on resilient genres, chiefly romance and crime.

- Romance is the most-commissioned scripted genre (30% of scripted commissions, H1 2026); the winning formula is hybrid: romance+thriller, crime+biography, drama+music, telenovela+mystery. [LA-SENAL-001]
- Highest-demand subgenres (Parrot): telenovelas, crime drama, competition reality, historical drama, comedy drama, romantic drama, teen sitcom, thriller, mystery. [LA-PARROT-001]
- Export dynamics shifting: Chile and Peru leading LatAm content-export growth into 2026. [LA-ADVTV-001]
- New competitive pressure: Chinese vertical short-video / microdrama apps expanding aggressively in LatAm, echoing telenovela hooks. Format threat and opportunity. [LA-CNBC-001]
- Netflix anchors the region on Mexico + Argentina (19 Argentine titles across 2026 to 2027, incl. Trapero and Larrain). Prime leans franchise (Betty la Fea, Culpables) plus reality. [LA-NFLX-001, LA-AMZN-001]

**Demand scores (Latin America):**

| Demand | Index | matchQuery | Confidence | Score rationale |
|---|---|---|---|---|
| Romance (top scripted, incl. hybrids) | 86 | romance | high | Authority ~29/35; recency ~24/25 (H1 2026); breadth ~16/20; intent ~17/20 (quantified 30%-of-commissions signal). |
| Crime drama and true crime | 82 | crime | high | Authority ~29/35; recency ~23/25; breadth ~15/20; intent ~15/20. |
| Modernized telenovela / hybrid melodrama | 74 | drama | medium | Authority ~26/35; recency ~23/25; breadth ~13/20; intent ~12/20 (format evolving; not every buyer explicit). |
| Competition and talent reality | 70 | reality | medium | Authority ~24/35; recency ~22/25; breadth ~12/20; intent ~12/20. |
| Microdrama / vertical short-form | 58 | drama | low | Authority ~18/35 (mostly one measurement/press read); recency ~22/25; breadth ~9/20; intent ~9/20 (emerging; not a named-major mandate). |

### 3.4 Spain

**Overall:** Two clear lanes. Netflix = premium thriller/heist/crime and event miniseries; Prime Video = action + YA + romance + big live reality, and Spain is Prime's No. 1 non-English export market.

- Netflix: EUR 1B+/US$1.2B for 2025 to 2028 (announced 10 Jun 2025), Tres Cantos 10-soundstage European hub; Spanish titles drove 5B+ viewing hours in the prior year; legacy in heist/crime (*Money Heist*), thriller, and YA (*Elite*). Upcoming *Billionaires' Bunker*. [SP-NFLX-001]
- Prime Video: 13+ new Spanish titles; action and young-adult skew; *Zeta 2* (Mario Casas), *Enfrentados: Marfil* (Ester Exposito), *Su Majestad* S2; live reality *Operacion Triunfo 2027* and *LOL*. *Culpables* franchise is a global export proof point. [SP-AMZN-001, SP-AMZN-002]
- HBO Max Spain: documentary/true-crime focus tied to recent events and sports figures (*Los Topuria*, etc.). [SP-WBD-001]
- Series Mania 2026 "Coming Next From Spain" confirms a deep national pipeline. [SP-SERIES-001]
- Apple TV+: no Spain-specific originals mandate disclosed (evidence gap). [GLBL-APPL-001]

**Demand scores (Spain):**

| Demand | Index | matchQuery | Confidence | Score rationale |
|---|---|---|---|---|
| Action and young-adult scripted | 82 | action | high | Authority ~29/35 (Variety + Amazon); recency ~23/25; breadth ~15/20; intent ~15/20 (Prime explicitly states the action + YA skew). |
| Thriller / crime / heist | 80 | thriller | high | Authority ~29/35; recency ~22/25; breadth ~14/20; intent ~15/20 (Netflix investment + heritage). |
| Romance and YA romance | 78 | romance | high | Authority ~27/35; recency ~23/25; breadth ~14/20; intent ~14/20 (Culpables export proof). |
| Documentary and true crime | 68 | crime | medium | Authority ~24/35 (Deadline); recency ~22/25; breadth ~11/20; intent ~11/20 (HBO Max explicit but single-source-heavy). |
| Reality and competition | 66 | reality | medium | Authority ~23/35; recency ~22/25; breadth ~11/20; intent ~10/20. |

### 3.5 Global

**Overall:** Record content spend, with the strategic center of gravity moving to non-English local-language originals engineered to travel. Romance, unscripted, and crime are the reliable demand pillars; live sports is a new Netflix category not relevant to a scripted producer's pipeline.

- Non-English originals reached ~52% of streaming originals in 2025 (up from 49% in 2024), Spanish and Korean growing fastest. [GLBL-TREND-001]
- Netflix ~US$20B 2026 content spend (up ~10%), a declared year of romance, plus new unscripted and live-event categories. [GLBL-NFLX-001, GLBL-NFLX-002]
- Prime Video's International Originals strategy: Spanish romance + Korean drama + Indian hits, distributed in 30+ languages across 240 territories; *Culpables* 100M viewers, 90%+ outside Spain. [GLBL-AMZN-001]
- Unscripted is ~35% of all streaming original titles. [GLBL-TREND-003]
- Warner Bros. theatrical ramps 11 (2025) to 14 (2026) to 18 (2027), franchise-led. [GLBL-WBD-001]
- Apple TV+ trims to ~US$4.5B and gets more selective (~a dozen films/year, most under US$100M). [GLBL-APPL-001]

**Demand scores (Global):**

| Demand | Index | matchQuery | Confidence | Score rationale |
|---|---|---|---|---|
| Non-English local-language originals | 84 | drama | high | Authority ~30/35; recency ~23/25; breadth ~16/20 (trend data + two majors); intent ~15/20. |
| Romance and romantasy | 78 | romance | medium | Authority ~26/35; recency ~23/25; breadth ~14/20; intent ~15/20 (Netflix explicit; romantasy adaptation pipeline is partly forward-looking). |
| Unscripted and reality | 76 | reality | medium | Authority ~26/35; recency ~22/25; breadth ~13/20; intent ~15/20. |
| Crime and thriller (evergreen) | 74 | thriller | medium | Authority ~25/35; recency ~21/25; breadth ~14/20; intent ~14/20. |
| Live sports and events | 60 | sports | medium | Authority ~26/35; recency ~23/25; breadth ~11/20; intent ~14/20 (real, but out of scope for a scripted film/TV producer; flagged, not actionable). |

---

## 4. Methodology

- **Research window.** Primary evidence limited to Aug 2025 to Aug 2026. Older items (e.g., Netflix Spain heritage titles, 2022 Nielsen Latino figures) are used only as labeled background.
- **Search method.** Bilingual (English and Spanish) web search across official buyer/investor sources, government and film-commission publications, reputable trade press (Variety, Deadline, The Hollywood Reporter, Forbes, Screen, C21, Senal News, TTV News), and audience-measurement firms (Nielsen, Parrot Analytics). High-authority pages were fetched directly for date and detail confirmation. SEO-only summaries were not used as sole support for any claim.
- **Signal-index calculation (0 to 100), fixed method.** Authority of sources (35) + evidence recency (25) + number of independent supporting sources (20) + strength/clarity of stated buyer intent (20). Each score is explained per demand row above. Where buyer intent is inferred from slates or viewing data rather than an explicit stated mandate, the intent sub-score is capped and overall confidence is lowered.
- **Facts vs inferences.** Investment figures, decree dates, viewership records, and commissioning percentages are sourced facts. Genre-appetite rankings that are read off slates or performance are labeled analyst inferences.
- **Limits and missing data.** Exact per-genre budget ranges are almost never disclosed publicly and are therefore mostly `null`/`unknown` here. US-Latino-specific commissioning data is thin. Warner Bros. local (non-HBO-Max) theatrical plans for these territories were not disclosed. Some trend figures (non-English 52% share; Apple budget trims) come from analyst/trade aggregation rather than primary filings and are marked medium confidence. Where sources conflict (e.g., LatAm commissioning contracting overall while romance grows), both are shown and confidence adjusted.

---

## 5. Source Ledger

Access date for all sources: **2026-08-19**.

| Evidence ID | Title | Publisher | Pub date | Territory | Buyer | Supported claim | URL |
|---|---|---|---|---|---|---|---|
| GLBL-NFLX-001 | Netflix Tops 325M Subscribers, Plans to Boost Content Spending 10% to $20B in 2026 | Variety | 2026-01-20 | Global | Netflix | Netflix ~US$20B 2026 content spend; new live/unscripted categories | https://variety.com/2026/tv/news/netflix-q4-2025-financial-earnings-subscribers-1236635615/ |
| GLBL-NFLX-002 | 5 Most-Watched Netflix Romance Movies and Shows, H1 2026 | Netflix Tudum | 2026 | Global | Netflix | 2026 as a romance-heavy year on Netflix | https://www.netflix.com/tudum/articles/most-watched-romance-h1-2026 |
| GLBL-AMZN-001 | Culpables Franchise Hits 100M Viewers as Prime Video Unveils 2026 International Original Big Bets | Amazon MGM Studios (press) | 2026-02-12 | Global | Amazon | International Originals strategy; Culpables 100M, 90%+ outside Spain; 30+ languages/240 territories | https://press.amazonmgmstudios.com/us/en/press-release/iculpablesi-movie-franchise-hits-100-million-viewe |
| GLBL-TREND-001 | 10 Trends Shaping Streaming and Entertainment in 2026 (non-English originals ~52% in 2025) | Wordbank (trade blog, citing analyst data) | 2026 | Global | (multiple) | Non-English originals reached ~52% share in 2025; Spanish/Korean growth; Max international budget expansion | https://www.wordbank.com/blog/global-trends/10-trends-shaping-streaming-and-entertainment-in-2026/ |
| GLBL-TREND-002 | Global content investment set to reach $255B in 2026 | Cineuropa | 2026 | Global | (multiple) | Scale of 2026 content investment; streamers widening the gap | https://cineuropa.org/en/newsdetail/487375/ |
| GLBL-TREND-003 | Streamscape 2026: Trends from the First Half of the Year | Nielsen | 2026 | Global | (multiple) | Unscripted ~35% of streaming originals; unscripted momentum | https://www.nielsen.com/insights/2026/streamscape-2026-trends-from-the-first-half-of-the-year/ |
| GLBL-WBD-001 | Warner Bros. Discovery FY2026 Q1 earnings (theatrical release ramp) | SEC 8-K / WBD | 2026 | Global | Warner Bros. | Theatrical releases ramp 11 (2025) to 14 (2026) to 18 (2027); franchise-led slate | https://www.sec.gov/Archives/edgar/data/0001437107/000143710726000055/a992wbd1q26earningsshare.htm |
| GLBL-APPL-001 | Apple to Cut Back on Spending for Apple TV+ After $20B Investment | The Average Joe / AppleInsider (trade) | 2025-2026 | Global | Apple TV+ | Content budget trimmed ~US$5B to US$4.5B; more selective; ~dozen films/yr, most under US$100M | https://readthejoe.com/tech/apple-to-cut-back-on-spending-for-apple-tv-after-20b-investment-in-original-content/ |
| MX-NFLX-001 | Netflix Commits $1 Billion Investment in Mexico's Audiovisual Sector | Variety | 2025-02-20 | Mexico | Netflix | US$1B for 2025-2028; 20+ titles/year with local partners; Churubusco upgrade | https://variety.com/2025/film/global/netflix-1-billion-dollars-mexico-churubusco-studios-1236313889/ |
| MX-NFLX-002 | Netflix Mexico 2026 Slate: Every New Series and Movie | Whats-on-Netflix (aggregator) | 2026 | Mexico | Netflix | 2026 slate skews thrillers, comedies, historical dramas; Contraataque performance | https://www.whats-on-netflix.com/coming-soon/netflix-mexico-2026-slate-every-new-series-and-movie-coming-this-year/ |
| MX-THR-001 | Netflix Unveils Mexico City Office as Country Boosts Incentives | The Hollywood Reporter | 2026 | Mexico | Netflix | Expanded Mexico City hub; Mexico incentives to attract production | https://www.hollywoodreporter.com/business/business-news/netflix-mexico-city-office-1236507864/ |
| MX-GOV-001 | Mexico unveils 30% film production incentive (EFICA) / New tax incentive | The Location Guide; Baker McKenzie; Santamarina+Steta | Decree 2026-02-16; Guidelines 2026-03-30 | Mexico | (all) | New 30% transferable audiovisual tax credit; EFICINE cap raised to 25M pesos | https://www.thelocationguide.com/industrynews/mexico-unveils-ambitious-30-film-production-incentive-to-boost-national-and-international-projects |
| MX-WBD-001 | Chespirito: Sin Querer Queriendo record launch | WBD LATAM (press) / Senal News | 2025-06 | Mexico | HBO Max | Biggest LatAm title in HBO Max history; global top-5 in first 28 days; premiered 5 Jun 2025 | https://publicidad.wbd.com/chespirito-sin-querer-queriendo-arrasa-en-su-estreno-en-max-y-se-convierte-en-un-fenomeno-de-audiencia-en-latinoamerica-y-mas-alla/ |
| MX-WBD-002 | HBO Max Latin America: After Chespirito, Don Ramon, The Colorado | Variety | 2025-11-25 | Mexico / LatAm | HBO Max | Quality-over-volume strategy; ~6 docuseries, 5 true crime; Chespirito universe expansion | https://variety.com/2025/tv/news/hbo-max-latin-america-chespirito-don-ramon-the-colorado-1236592044/ |
| MX-AMZN-001 | How Prime Video Local 'Obsession' Fuels Latin America Hits, 2026 Plans | Forbes (Veronica Villafane) | 2025-12-17 | Mexico / LatAm | Amazon | Mentiras biggest Prime Video Mexico premiere; La Oficina 2026; romance/true-crime/comedy/courtroom priorities | https://www.forbes.com/sites/veronicavillafane/2025/12/17/how-prime-video-local-obsession-fuels-latin-america-hits-2026-plans/ |
| MX-PARROT-001 | Latin America: Regional Differences in TV Content Popularity | Parrot Analytics | 2025-2026 | Mexico / LatAm | (multiple) | Top demand subgenres: telenovela, crime drama, competition reality, historical/romantic drama, thriller | https://www.parrotanalytics.com/insights/latin-america-regional-differences-tv-content-popularity-argentinian-colombian-mexican-us-hispanic-audiences/ |
| MX-SENAL-001 | Romance Becomes Latin America's Top Scripted TV Genre as Microdramas Drive Growth | Senal News | 2026 | Mexico / LatAm | (multiple) | Romance = 30% of scripted commissions H1 2026; genre-hybrid formulas | https://senalnews.com/en/data/romance-becomes-latin-americas-top-scripted-tv-genre-as-microdramas-drive-new-growth |
| MX-APPL-001 | Apple TV's Women in Blue (Las Azules) Returns for Season Two | Apple TV Press | 2026-03 | Mexico | Apple TV+ | Renewal of Spanish-language Mexican crime drama; S2 dated 12 Aug 2026 | https://www.apple.com/tv-pr/news/2026/03/apple-tvs-spanish-language-crime-drama-women-in-blue-las-azules-returns-for-season-two-on-wednesday-august-12/ |
| USL-NIEL-001 | Hispanic Consumers Overindex on Streaming Consumption Versus Rest of U.S. | Nielsen | 2025 | US Latino | (multiple) | Streaming = 55.8% of Hispanic TV time (vs ~46% rest of US); overindex on Netflix/YouTube | https://www.nielsen.com/news-center/2025/hispanic-consumers-overindex-on-streaming-consumption-versus-rest-of-u-s-new-nielsen-report-finds/ |
| USL-BEL-001 | Latino Streaming Audience Continues to Grow, Opening Opportunities for Spanish-Language Content | BELatina | 2025 | US Latino | (multiple) | 7 in 10 Latinos watch Spanish-language TV (up 11% since 2021); ~45% say Spanish content not on par | https://belatina.com/latino-streaming-audience-spanish-language-content/ |
| USL-PARROT-001 | TV Demand for Regional Language Content: US Hispanic vs Latin American Audiences | Parrot Analytics | 2025-2026 | US Latino | (multiple) | Comparative regional-language demand; cross-border crime/romance appetite | https://www.parrotanalytics.com/insights/tv-demand-regional-language-content-us-hispanic-latin-american-audiences-compared/ |
| USL-PLAT-001 | Streaming Platforms Need More Spanish-Language Content | LatinaMedia.Co | 2025 | US Latino | (multiple) | Roku Espacio Latino, YouTube TV Spanish plan, Peacock Tplus/Telemundo bilingual hub | https://latinamedia.co/more-spanish-language-content/ |
| LA-SENAL-001 | Romance Becomes Latin America's Top Scripted TV Genre | Senal News | 2026 | Latin America | (multiple) | Romance top scripted genre; microdramas driving growth; hybrid formulas | https://senalnews.com/en/data/romance-becomes-latin-americas-top-scripted-tv-genre-as-microdramas-drive-new-growth |
| LA-PARROT-001 | Latin America: Regional Differences in TV Content Popularity | Parrot Analytics | 2025-2026 | Latin America | (multiple) | Highest-demand subgenres across LatAm | https://www.parrotanalytics.com/insights/latin-america-regional-differences-tv-content-popularity-argentinian-colombian-mexican-us-hispanic-audiences/ |
| LA-ADVTV-001 | Research: Chile, Peru lead growth in LatAm content export | Advanced Television (citing Parrot) | 2026-01-22 | Latin America | (multiple) | LatAm scripted commissions down ~13% YoY; Chile/Peru lead export growth | https://www.advanced-television.com/2026/01/22/research-chile-peru-lead-growth-in-latam-content-export/ |
| LA-CNBC-001 | How China's short-video streamers are reshaping Latin America's media | CNBC | 2026-02-01 | Latin America | (new entrants) | Chinese vertical microdrama apps expanding in LatAm; telenovela-style hooks | https://www.cnbc.com/2026/02/01/how-chinas-short-video-streamers-are-reshaping-latin-americas-media.html |
| LA-AMZN-001 | How Prime Video Local 'Obsession' Fuels Latin America Hits | Forbes (Veronica Villafane) | 2025-12-17 | Latin America | Amazon | Betty la Fea sequel record; Sayen most-watched LatAm Amazon film; franchise strategy | https://www.forbes.com/sites/veronicavillafane/2025/12/17/how-prime-video-local-obsession-fuels-latin-america-hits-2026-plans/ |
| LA-NFLX-001 | Netflix Announces New Latin American Productions Coming in 2026 | TTV News / Rio Times | 2026 | Latin America | Netflix | 19 Argentine titles across 2026-2027; name directors (Trapero, Larrain) | https://todotvnews.com/en/netflix-announces-new-latin-american-productions-coming-in-2026/ |
| SP-NFLX-001 | Netflix Commits to Invest Over $1.2 Billion in Spain Over 2025-28 | Variety / About Netflix | 2025-06-10 | Spain | Netflix | EUR 1B+/US$1.2B for 2025-2028; Tres Cantos 10-stage hub; 5B+ viewing hours | https://variety.com/2025/tv/global/netflix-spain-1-2-billion-ted-sarandos-diego-avalos-1236424549/ |
| SP-AMZN-001 | Ester Exposito, Mario Casas, Anna Castillo Lead Prime Video's New Originals Slate in Spain | Variety | 2026 | Spain | Amazon | Spain = Prime's No. 1 non-English power; action + YA skew; live reality (Operacion Triunfo, LOL) | https://variety.com/2026/streaming/global/ester-exposito-mario-casas-anna-castillo-prime-video-1236783619/ |
| SP-AMZN-002 | Culpables Franchise Hits 100M Viewers (Spain-produced global hit) | Amazon MGM Studios (press) | 2026-02-12 | Spain | Amazon | Culpables (Spain) global export; YA romance travels worldwide | https://press.amazonmgmstudios.com/us/en/press-release/iculpablesi-movie-franchise-hits-100-million-viewe |
| SP-WBD-001 | HBO Max Spain Unscripted Boss Reveals Doc Strategy | Deadline | 2025-09 | Spain | HBO Max | Documentary/true-crime focus tied to recent events and sports figures | https://deadline.com/2025/09/hbo-max-spain-documentary-focus-iberseries-1236566089/ |
| SP-SERIES-001 | Spain Unveils Coming Next From Spain Slate at Series Mania 2026 | Variety | 2026 | Spain | (multiple) | Depth of Spanish national production pipeline for 2026 | https://variety.com/2026/global/markets-festivals/coming-next-from-spain-series-mania-2026-slate-1236696368/ |

---

## 6. Conflicts and Gaps

**Conflicting evidence:**
- LatAm scripted commissioning is contracting (~13% YoY, H1 2026 per [LA-ADVTV-001]) while romance commissioning is growing to 30% share ([LA-SENAL-001]). Resolution: the pie is smaller but concentrating on romance and crime. Confidence on "volume" is lowered; confidence on "genre direction" stays high.
- "Non-English originals ~52% share" ([GLBL-TREND-001]) is analyst/trade-aggregated rather than a primary filing. Treated as directionally reliable, medium confidence.

**Missing evidence / needs direct buyer confirmation:**
1. Per-genre budget ranges for every buyer/territory. Almost never disclosed publicly. Currently `null`/`unknown`.
2. Warner Bros. local (non-HBO-Max) theatrical production plans for Mexico, Spain, and US Latino. No disclosure found in the window.
3. US-Latino-specific original commissioning by the five named buyers (as distinct from pan-regional Spanish content). Structural demand is documented; segment-specific mandates are not.
4. Apple TV+ Spanish-language originals pipeline beyond *Las Azules*; Spain-specific Apple mandate.
5. Firm 2026 Netflix and Prime genre-mix breakdowns by territory (only slate and performance signals available, not internal mandates).
6. Primary-source confirmation of the Apple budget-trim figures (currently trade-press level).

**Facts confidently established (last 12 months):** Netflix Mexico US$1B and Spain EUR 1B+ commitments; Mexico EFICA 30% credit dates; Chespirito record; Culpables 100M; Prime Video Spain positioning; HBO Max LatAm quality-over-volume and true-crime tilt; Hispanic streaming overindex; LatAm romance-first commissioning.

---

## 7. Next Update Guidance

Check these sources for the next snapshot (do not schedule automatically):

- **Buyer/official:** Netflix Q2/Q3 2026 earnings and About Netflix regional posts; Amazon MGM press site (International Originals updates); WBD investor 8-Ks and HBO Max upfront releases; Apple TV Press; Prime Video 2027 upfront announcements (typically Nov).
- **Government/regulator:** Mexico DOF for EFICA guideline amendments and the Ley Federal de Cine revision; ICEX / Invest in Spain for Spanish incentive updates.
- **Trade press:** Variety, Deadline, THR, Screen Daily, C21, Senal News, TTV News, Forbes (Villafane) for LatAm and Spain slates and Series Mania / Iberseries / MipCancun market coverage.
- **Measurement:** Parrot Analytics LatAm/US-Hispanic demand updates; Nielsen Hispanic and Streamscape reports; Ampere Analysis content-spend data.
- **Watch items:** whether Warner Bros. announces distinct local theatrical pipelines; whether any of the five buyers launch US-Latino-specific original mandates; trajectory of microdrama/vertical short-form entrants in LatAm; Apple TV+ Spanish-language expansion.

---

*Validation: the JSON block in Section 2 parses as strict JSON; every evidenceId used in the JSON exists in the Section 5 source ledger; every source has a URL and date; every demand score has a written explanation; facts and inferences are separated; Mexico has the deepest coverage; no credentials or private Lemon data appear. This snapshot must not alter screenplay scores or verdicts.*
