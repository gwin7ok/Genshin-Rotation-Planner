# Skill / Burst effect coverage

Generated: 2026-11-12 / gcsim dictionary commit b107b5dc / by `npm run check:effectkeys` (`scripts/build-effect-coverage.ts`)

Four tables: `effects` (gcsim effects) / `targets` (app-side targets) / `links` (effect ↔ target pairs; a junction table) / `unlinked` (reasons for not linking).
"Not reviewed" = neither linked nor decided not to link (with a reason). This is what to review when gcsim is updated or a new character is added.
Write decisions in `src/masterdata/effectKeyDecisions.ts` and links in `actionEffectKeyOverrides.ts` / `actionEffectExtras.ts`.

## effects (gcsim effects: categories skill / burst / character / attack, plus constructs, shields and damage-over-time found at run time; 310)

| State | Count |
|---|---|
| Linked | 202 |
| gcsim reports the effect, but it is not linked and gets no bar | 50 |
| Handled by the constellation definition in the master | 20 |
| Already shown by the main bar | 19 |
| Grace period / short window (not an effect) | 10 |
| Permanent effect | 5 |
| Handled as a buff (passive talent) | 4 |

Construct names (gcsim source): 7

## targets (the app's Skill / Burst action definitions; 339)

| State | Count |
|---|---|
| Linked | 207 |
| No gcsim effect; no bar | 75 |
| Character not registered in gcsim | 18 |
| Handled as a buff (passive talent) | 16 |
| No gcsim effect; bar from the app value | 12 |
| gcsim reports the effect, but it is not linked and gets no bar | 6 |
| gcsim reports no effect event (tentative) | 4 |
| Deferred | 1 |

## links (effect ↔ target; 247)

Breakdown: main/auto=164 / main/approved=35 / extra/approved=34 / included/approved=9 / character/approved=5
Consistency: links to missing effects / targets 0 / duplicates 0

## Action definitions not reviewed (0)

None

## Effects not reviewed (0; by owner)

