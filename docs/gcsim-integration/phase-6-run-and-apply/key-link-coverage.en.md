# gcsim effect key links: overall coverage

Generated: 2026-11-03 / gcsim dictionary commit 3877a1a3 / by `npm run coverage:links` (`scripts/coverage-links.ts`)

For a new character or a gcsim update, only check "Not reviewed" in this document. Details: A (Skill / Burst) = `effect-key-coverage.en.md`, B (passive talents, constellations, weapons, artifacts, elemental resonances) = `master-effect-coverage.en.md`.
Decisions (reasons for not linking, individual exceptions) live in `src/masterdata/keyLinkDecisions.ts` (a list and pointers to where each is kept).

## Not reviewed / pending

- Not reviewed: **0** (none)
- Pending: 1
- Mismatches between action definition links and their inputs (check:action-links): none

## A: Skill / Burst (gcsimEffect, gcsimExtras and gcsimIncluded of action definitions; imported from intermediate data + hand-written lists)

- gcsim effects 309: linked 202 / decided-not-linked 49 / covered-by-master 20 / covered-by-main 19 / grace-window 10 / permanent 5 / covered-by-passive 4
- App targets (action definitions) 334: linked 206 / no-bar 76 / covered-by-passive 16 / not-in-gcsim 15 / app-bar 12 / decided-not-linked 6 / no-event 2 / deferred 1

## B: Passive talents, constellations, weapons, artifacts, elemental resonances (gcsimKeys etc. of definitions; linked automatically from the dictionary)

- gcsim effects 1163: linked 977 / excluded 186
- App targets (definitions) 834: linked 681 / excluded 153
