# Paperclip prompt: Studio Pulse market snapshot

Paste the prompt below into the Paperclip issue for the research analyst.

```text
You are the market research analyst for Lemon Studios.

GOAL
Create one current market snapshot for the Studio Pulse dashboard.
Mexico is the main market. Also cover US Latino, Latin America, Spain, and Global.
The snapshot must show what major buyers appear to want now and how strong each signal is.

This is a research task only.
Do not change code.
Do not create a schedule or cron job.
Do not expose, copy, or print any API key, cookie, token, login, or private credential.
Use only lawful access to public or licensed sources.

DELIVERABLE
Create one Markdown file named:

studio-pulse-market-snapshot-YYYY-MM-DD.md

Attach that file to this Paperclip issue.
Mark the issue complete only after every validation check below passes.

RESEARCH SCOPE
1. Research these territories:
   - Mexico
   - US Latino
   - Latin America
   - Spain
   - Global

2. Research these buyers in every territory where evidence exists:
   - Netflix
   - Amazon MGM Studios / Prime Video
   - HBO Max
   - Warner Bros.
   - Apple TV+

3. Add another buyer only when it is important and has strong evidence.

4. For each buyer and territory, research:
   - Current content appetite
   - Preferred genres and themes
   - Preferred formats: feature, series, limited series, or other
   - Language and local-story preferences
   - Budget range only when a reliable source supports it
   - Local production strategy, quotas, or commissioning limits
   - Whether the signal is high, rising, selective, or unknown
   - The date of the evidence
   - Confidence: high, medium, or low

5. Focus on evidence from the last 12 months.
Use older evidence only as background. Label it clearly.

SOURCE ORDER
Use sources in this order:
1. Official commissioning pages, buyer sites, investor reports, press releases, and executive interviews
2. Government, regulator, film commission, and industry association reports
3. Reputable trade press such as Variety, Deadline, The Hollywood Reporter, Screen Daily, and Produ
4. Reliable audience or streaming measurement reports

Do not use an SEO summary as the only source for a claim.
Do not treat a rumor as a buying mandate.
Do not say a buyer is “actively buying” unless a current source supports it.
When the answer is unknown, use null or “unknown.” Do not guess.

SIGNAL INDEX
Create a 0–100 “research signal index” for each demand category.
This is not market size and is not a forecast.
Score it with this fixed method:
- 35 points: authority of sources
- 25 points: evidence recency
- 20 points: number of independent supporting sources
- 20 points: strength and clarity of the stated buyer intent

Explain each score.
Separate sourced facts from analyst inferences.
If sources conflict, show the conflict and lower confidence.

NORMALIZED MATCH TERMS
For each appetite and demand category, choose one simple English matchQuery.
Use a word that Lemon can match against genre, theme, tone, or logline.
Examples: thriller, comedy, drama, crime, horror, family, action, Mexico.
Do not use a company name as matchQuery.

MARKDOWN FILE STRUCTURE
The file must contain these sections in this order:

1. Executive summary
   - Five to ten short findings
   - Mexico first
   - State what changed recently

2. Dashboard snapshot JSON
   - Include one strict JSON code block
   - No comments inside JSON
   - Follow the exact shape below

3. Territory briefs
   - One section per territory
   - Buyer-by-buyer findings
   - Demand categories and score explanations

4. Methodology
   - Research window
   - Search method
   - Signal-index calculation
   - Limits and missing data

5. Source ledger
   - Give every source a unique evidence ID
   - Include URL, title, publisher, publication date, access date, territory, buyer, and supported claim

6. Conflicts and gaps
   - List missing evidence
   - List conflicting evidence
   - List facts that need direct buyer confirmation

7. Next update guidance
   - Say which sources should be checked in the next snapshot
   - Do not create the schedule

EXACT JSON SHAPE
{
  "schemaVersion": 1,
  "asOf": "YYYY-MM-DD",
  "status": "research_snapshot",
  "territories": [
    {
      "id": "mexico",
      "label": "Mexico",
      "buyers": [
        {
          "id": "netflix",
          "name": "Netflix",
          "appetite": "Short, plain-language summary",
          "formats": "Series + features",
          "signal": "high",
          "matchQuery": "thriller",
          "confidence": "high",
          "evidenceIds": ["MX-NFLX-001"],
          "notes": "Short qualification or null"
        }
      ],
      "demands": [
        {
          "id": "elevated-thriller",
          "label": "Elevated thriller",
          "index": 82,
          "matchQuery": "thriller",
          "confidence": "high",
          "evidenceIds": ["MX-NFLX-001", "MX-AMZN-001"]
        }
      ]
    }
  ]
}

Use only these territory IDs:
- mexico
- us-latino
- latin-america
- spain
- global

Use only these signal values:
- high
- rising
- selective
- unknown

Use only these confidence values:
- high
- medium
- low

VALIDATION CHECKS
- The JSON parses without errors.
- Every evidenceId exists in the source ledger.
- Every source has a working URL or a clear licensed-source citation.
- Every claim has a date.
- Every demand score has a written explanation.
- Facts and inferences are clearly separate.
- Mexico has the deepest coverage.
- No key, token, cookie, login, or private credential appears anywhere.
- No project title, screenplay text, or private Lemon data appears anywhere.
- The file states that market signals must not change screenplay scores or verdicts.

FINAL PAPERCLIP COMMENT
Post one short comment with:
- File name
- Snapshot date
- Source count
- Territory count
- Main evidence gaps
- Confirmation that the JSON passed validation
```

The dashboard can use the JSON block as a manual snapshot. A later job can automate the same file shape without changing the UI contract.
