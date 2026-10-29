# Skill / Burst effect coverage

Generated: 2026-10-29 / gcsim dictionary commit 4eda9fc5 / by `npm run check:effectkeys` (`scripts/build-effect-coverage.ts`)

Four tables: `effects` (gcsim effects) / `targets` (app-side targets) / `links` (effect ↔ target pairs; a junction table) / `unlinked` (reasons for not linking).
"Not reviewed" = neither linked nor decided not to link (with a reason). This is what to review when gcsim is updated or a new character is added.
Write decisions in `src/masterdata/effectKeyDecisions.ts` and links in `actionEffectKeyOverrides.ts` / `actionEffectExtras.ts`.

## effects (gcsim effects: categories skill / burst / character / attack, plus constructs, shields and damage-over-time found at run time; 305)

| State | Count |
|---|---|
| Linked | 201 |
| gcsim reports the effect, but it is not linked and gets no bar | 49 |
| Handled by the constellation definition in the master | 20 |
| Already shown by the main bar | 19 |
| Grace period / short window (not an effect) | 10 |
| Handled as a buff (passive talent) | 4 |
| Permanent effect | 2 |

Construct names (gcsim source): 7

## targets (the app's Skill / Burst action definitions; 334)

| State | Count |
|---|---|
| Linked | 206 |
| No gcsim effect; no bar | 76 |
| Handled as a buff (passive talent) | 16 |
| Character not registered in gcsim | 15 |
| No gcsim effect; bar from the app value | 12 |
| gcsim reports the effect, but it is not linked and gets no bar | 6 |
| Deferred | 1 |
| Not reviewed | 1 |
| gcsim reports no effect event (tentative) | 1 |

## links (effect ↔ target; 244)

Breakdown: main/auto=163 / main/approved=35 / extra/approved=32 / included/approved=9 / character/approved=5
Consistency: links to missing effects / targets 0 / duplicates 0

## Action definitions not reviewed (1)

- Ifa `action:10000113-anemo_e_cancelplunge`

## Effects not reviewed (0; by owner)

