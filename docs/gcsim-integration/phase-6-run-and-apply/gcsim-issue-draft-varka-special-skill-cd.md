# gcsim issue 草稿: ファルカ（Varka）の特殊スキルの 2 つ目の CT（2026-10-01）

投稿先: https://github.com/genshinsim/gcsim/issues/new（issue テンプレートは無い）
投稿はユーザーが行う。`[ ]` の中は、投稿前にユーザーが動画から測って埋める。

---

## Title

Varka: possible mismatch in Four Winds' Ascension (special skill) cooldown — 2nd charge seems to recharge in parallel in-game, not sequentially

## Body

### Summary

I don't own Varka, so I can't test in-game myself. From the video linked below, the cooldown shown after the first Four Winds' Ascension looks inconsistent with how gcsim models the two charges (a sequential cooldown queue). I'd like to ask whether someone who owns Varka could check what lowers that displayed cooldown. Sorry if this turns out to be a misunderstanding on my side.

### What I observed in the video

Video: https://www.youtube.com/watch?v=sWgFv-RnUKI (Varka, three special skills in a row)

The team has Anemo resonance and two Hexerei characters, so the special skill's base cooldown (11 s) is shown as 10.4 s (11 × 0.95, matching gcsim's `anemo-res-cd`).

1. Right after casting the normal skill, the special skill icon shows **10.4 s**.
2. Right after the **first** special skill, the icon shows **6.4 s** (this should be the cooldown of the next charge).
3. Elapsed time from the normal skill to the first special skill: **[ ] s** (measured from the video's battle timer: skill at [ ], first special skill at [ ]). This is approximately 10.4 − 6.4 = 4.0 s.
4. Normal attack hits on an enemy between the skill and the first special skill: **[ ] hits** (the front charge must have been reduced enough to be ready, i.e. at least 5–6 reductions at 1 s each with two Hexerei).

### Two possible explanations

**A. The second charge's cooldown starts counting down in the background when the normal skill is cast (in parallel with the first charge).**
Then after the first special skill the display would be `10.4 − (time since the skill)` = 10.4 − 4.0 ≈ 6.4 s. This matches the video without needing any additional hit-based reduction. In this model, the cooldown reduction from normal attack hits would only apply to the charge that is next in line.

**B. The second charge stays at the full 10.4 s until it becomes the head of the queue, and 6.4 s is reached only by additional reductions (as in gcsim).**
This requires about 4 more reductions applied to the second charge after the first charge is already ready. But the first charge itself needed at least 5–6 reductions to become ready within ~4 s, and the skill is capped at 15 reductions per skill use, so the counts don't seem to add up (4 s of elapsed time + ≥5 hits for the first charge already uses up most of the first 10.4 s).

I could be wrong about B (I can't count the hits exactly), which is why I'm asking for an in-game check.

### How gcsim currently models it (v2.48.0, commit 1e6c1a8621728dfa8d420a861092259e752c4953)

`SetCD` in `internal/template/character/cooldown.go` appends each recharge to a queue, and the queue worker only starts the next entry after the previous one finishes ("the game will first finish recharging the first charge before starting the full cooldown for the second charge"). `varka/skill.go` calls `SetCD(ActionSpecialSkill, 11*60)` once per available charge when the normal skill is cast, so both entries are queued sequentially.

Example from a gcsim run (log excerpt, `cooldown_queue` for `special_skill`, 60 fps; team: Nicole + Varka (hexerei=1) + Venti + Xingqiu, so Anemo resonance applies):

```
8.58 s  special_skill cooldown triggered           cooldown_queue: "627"
8.58 s  special_skill cooldown triggered           cooldown_queue: "627,627"      # 627f = 10.45 s each
 ... (normal attack hits: "forcefully reduced" on the head entry only)
12.03 s special_skill cooldown ready               cooldown_queue: "627"          # second entry is still at the full 10.45 s
13.47 s executed skill (1st special skill)
```

So in gcsim the second charge's cooldown only starts at 12.03 s (when the first charge is ready), and it is still at its full 10.45 s then. If the in-game behavior is "both charges count down from the normal skill cast", the 2nd/3rd special skills would be available much earlier than gcsim allows. As a result, a rotation that appears feasible in-game (normal skill → special skill → special skill within the 12 s window) makes gcsim report the special skill as "not ready" (`Charges(ActionSpecialSkill) == 0`) and wait up to ~10 s.

### Request

Could someone who has Varka check, with Anemo resonance and 2 Hexerei characters (or without Hexerei if easier):

1. Cast the normal skill, note the special skill cooldown shown (expected 10.4 s with Anemo resonance, 11 s without).
2. Wait without attacking, cast the special skill after a known number of seconds `t` **without hitting enemies in between**, and note the cooldown shown right after (compare with `10.4 − t` vs. `10.4`).
3. Optionally repeat with normal attack hits in between to see which charge the reduction applies to.

If the in-game behavior is parallel countdown, the fix may need a way for `SetCD` to run the charges' cooldowns independently (with reductions only on the next-in-line one). I'm happy to provide the full config and more video timestamps, and to try a PR if you think this is the right direction.

Thanks for all the work on gcsim and for adding Varka!

### Environment

- gcsim v2.48.0 (commit 1e6c1a8621728dfa8d420a861092259e752c4953; `internal/characters/varka` has no changes on `main` after that commit as of 2026-10-01)
- Config: [attach the config, e.g. Nicole / Varka (hexerei=1) / Venti / Xingqiu]
