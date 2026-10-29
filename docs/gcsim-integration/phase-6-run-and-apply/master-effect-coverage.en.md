# Master effect ↔ gcsim key coverage

Generated: 2026-10-29 / gcsim dictionary commit 4eda9fc5 / by `npm run coverage:master-effects`

Covers passive talents, constellations, weapons, artifacts and elemental resonances. Kept in a separate file from `effect_key_coverage.json` (action effects), using the same `effects` / `targets` / `links` / `unlinked` shape so they can be merged later.
"Unreviewed" means a master target or gcsim key effect that is neither linked, excluded with a reason, nor pending.

## gcsim keys (1141)

| Category / state | Count |
|---|---:|
| artifact / excluded | 56 |
| artifact / linked | 82 |
| burst / linked | 12 |
| character / linked | 4 |
| constellation / excluded | 58 |
| constellation / linked | 273 |
| skill / linked | 12 |
| system / linked | 8 |
| talent / excluded | 30 |
| talent / linked | 181 |
| weapon / excluded | 42 |
| weapon / linked | 383 |

## Master targets (833)

| Type / state | Count |
|---|---:|
| artifact / linked | 52 |
| artifact / unsupported | 3 |
| constellation / linked | 244 |
| constellation / unsupported | 20 |
| resonance / linked | 6 |
| resonance / unsupported | 1 |
| talent / linked | 157 |
| talent / unsupported | 113 |
| weapon / linked | 220 |
| weapon / unsupported | 17 |

## links (992)

| Role | Count |
|---|---:|
| cooldown | 137 |
| effect | 755 |
| extra | 93 |
| resonance | 7 |

## Pending (0)

None

## Unreviewed (0)

None

Consistency: orphan links 0
