# Master effect ↔ gcsim key coverage

Generated: 2026-11-12 / gcsim dictionary commit b107b5dc / by `npm run coverage:master-effects`

Covers passive talents, constellations, weapons, artifacts and elemental resonances. Kept in a separate file from `effect_key_coverage.json` (action effects), using the same `effects` / `targets` / `links` / `unlinked` shape so they can be merged later.
"Unreviewed" means a master target or gcsim key effect that is neither linked, excluded with a reason, nor pending.

## gcsim keys (1173)

| Category / state | Count |
|---|---:|
| artifact / excluded | 56 |
| artifact / linked | 82 |
| burst / linked | 12 |
| character / linked | 6 |
| constellation / excluded | 61 |
| constellation / linked | 289 |
| skill / linked | 12 |
| system / linked | 8 |
| talent / excluded | 30 |
| talent / linked | 182 |
| weapon / excluded | 42 |
| weapon / linked | 393 |

## Master targets (840)

| Type / state | Count |
|---|---:|
| artifact / linked | 52 |
| artifact / unsupported | 3 |
| constellation / linked | 246 |
| constellation / unsupported | 22 |
| resonance / linked | 6 |
| resonance / unsupported | 1 |
| talent / linked | 158 |
| talent / unsupported | 113 |
| weapon / linked | 223 |
| weapon / unsupported | 16 |

## links (1021)

| Role | Count |
|---|---:|
| cooldown | 140 |
| effect | 776 |
| extra | 98 |
| resonance | 7 |

## Pending (0)

None

## Unreviewed (0)

None

Consistency: orphan links 0
