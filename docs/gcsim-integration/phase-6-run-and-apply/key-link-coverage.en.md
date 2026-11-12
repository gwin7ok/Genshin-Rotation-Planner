# gcsim effect key links: overall coverage

Generated: 2026-11-12 / gcsim dictionary commit b107b5dc / by `npm run coverage:links` (`scripts/coverage-links.ts`)

For a new character or a gcsim update, only check "Not reviewed" in this document. Details: A (Skill / Burst) = `effect-key-coverage.en.md`, B (passive talents, constellations, weapons, artifacts, elemental resonances) = `master-effect-coverage.en.md`.
Decisions (reasons for not linking, individual exceptions) live in `src/masterdata/keyLinkDecisions.ts` (a list and pointers to where each is kept).

## Not reviewed / pending

- Not reviewed: **0** (none)
- Pending: 1
- Mismatches between action definition links and their inputs (check:action-links): none

## A: Skill / Burst (gcsimEffect, gcsimExtras and gcsimIncluded of action definitions; imported from intermediate data + hand-written lists)

- gcsim effects 310: linked 202 / decided-not-linked 50 / covered-by-master 20 / covered-by-main 19 / grace-window 10 / permanent 5 / covered-by-passive 4
- App targets (action definitions) 338: linked 207 / no-bar 75 / not-in-gcsim 17 / covered-by-passive 16 / app-bar 12 / decided-not-linked 6 / no-event 4 / deferred 1

## B: Passive talents, constellations, weapons, artifacts, elemental resonances (gcsimKeys etc. of definitions; linked automatically from the dictionary)

- gcsim effects 1173: linked 984 / excluded 189
- App targets (definitions) 840: linked 685 / excluded 155
