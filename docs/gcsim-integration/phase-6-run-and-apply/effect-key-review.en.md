# Skill / Burst definitions without an effect key (with evidence)

Generated: 2026-10-29 / gcsim v2.49.0 (dictionary commit 4eda9fc5) / collected by `scripts/probe-effect-keys.ts`

Each definition was run once with a single character (C0, placeholder weapon); the evidence comes from the log for 15 seconds after the cast.
The verdict is a mechanical classification of the evidence, listed so that misses (a key that actually exists) can be checked.

Verdicts (definitions without keys / not collected): No status (instant / DoT damage, etc.) 100 / Shield 6 / Needs review (effect key candidates) 5 / Not collected (filled in by hand) 3

## A. Characters with no keys for any definition (8 characters)

### Aether (Hydro)
- ❌ Elemental Skill: Aquacrest Saber (hydro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): travelerhydro-spiritbreath-icd, travelerhydro-particle-icd
  - Damage only: Torrent Surge / Spiritbreath Thorn
- ❌ Elemental Skill variant: shortHold0Ticks (hydro_e_shorthold0ticks) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: sourcewater-droplet-icd
  - Only internal keys (particle CD, etc.): travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - Damage only: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ Elemental Skill variant: shortHold (hydro_e_shorthold) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: sourcewater-droplet-icd
  - Only internal keys (particle CD, etc.): travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - Damage only: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ Elemental Skill (max hold): Aquacrest Saber (hydro_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: sourcewater-droplet-icd
  - Only internal keys (particle CD, etc.): travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - Damage only: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ Elemental Burst: Rising Waters (hydro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Rising Waters

### Lumine (Hydro)
- ❌ Elemental Skill: Aquacrest Saber (hydro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): travelerhydro-spiritbreath-icd, travelerhydro-particle-icd
  - Damage only: Torrent Surge / Spiritbreath Thorn
- ❌ Elemental Skill variant: shortHold0Ticks (hydro_e_shorthold0ticks) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: sourcewater-droplet-icd
  - Only internal keys (particle CD, etc.): travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - Damage only: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ Elemental Skill variant: shortHold (hydro_e_shorthold) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: sourcewater-droplet-icd
  - Only internal keys (particle CD, etc.): travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - Damage only: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ Elemental Skill (max hold): Aquacrest Saber (hydro_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: sourcewater-droplet-icd
  - Only internal keys (particle CD, etc.): travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - Damage only: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ Elemental Burst: Rising Waters (hydro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Rising Waters

### Chongyun
- ❌ Elemental Skill: Spirit Blade: Chonghua's Layered Frost (cryo_e) — **Needs review (effect key candidates)**
  - Dictionary effect keys appeared but did not meet the conditions: chongyunfield[skill], chongyun-field[skill]
  - Only talent / constellation statuses: chongyun-a4
  - Only internal keys (particle CD, etc.): chongyun-particle-icd
  - Damage only: Spirit Blade: Chonghua's Layer
- ❌ Elemental Burst: Spirit Blade: Cloud-Parting Star (cryo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Spirit Blade: Cloud-Parting St

### Yae Miko
- ❌ Elemental Skill: Yakan Evocation: Sesshou Sakura (electro_e) — **Needs review (effect key candidates)**
  - Dictionary effect keys appeared but did not meet the conditions: yae_oldest_totem_expiry[character]
  - Only internal keys (particle CD, etc.): yaemiko-particle-icd
  - Damage only: Sesshou Sakura Tick
- ❌ Elemental Burst: Great Secret Art: Tenko Kenshin (electro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Great Secret Art: Tenko Kenshi

### Shikanoin Heizou
- ❌ Elemental Skill: Heartstopper Strike (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): heizou-particle-icd
  - Damage only: Heartstopper Strike
- ❌ Elemental Skill (Hold): Heartstopper Strike (anemo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): heizou-particle-icd
  - Damage only: Heartstopper Strike (Max Stack
- ❌ Elemental Burst: Windmuster Kick (anemo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Windmuster Iris (Aura check) / Fudou Style Vacuum Slugger

### Alhaitham
- ❌ Elemental Skill: Universality: An Elaboration on Form (dendro_e) — **No status (instant / DoT damage, etc.)**
  - Damage only: Universality: An Elaboration o
- ❌ Elemental Skill (Hold): Universality: An Elaboration on Form (dendro_e_hold) — **No status (instant / DoT damage, etc.)**
  - Damage only: Universality: An Elaboration o
- ❌ Elemental Burst: Particular Field: Fetters of Phenomena (dendro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Particular Field: Fetters of P

### Neuvillette
- ❌ Elemental Skill: O Tears, I Shall Repay (hydro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): neuvillette-aligned-icd, neuvillette-particle-icd
  - Damage only: O Tears, I Shall Repay / Spiritbreath Thorn (neuvillett
- ❌ Elemental Burst: O Tides, I Have Returned (hydro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: O Tides, I Have Returned: Skil / O Tides, I Have Returned: Wate

### Chiori
- ❌ Elemental Skill: Fluttering Hasode (geo_e) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: chiori-a1-window
  - Only internal keys (particle CD, etc.): chiori-particle-icd
  - Damage only: Fluttering Hasode (Upward Swee / Fluttering Hasode (Tamato)
- ❌ Elemental Skill (Hold): Fluttering Hasode (geo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: chiori-a1-window
  - Only internal keys (particle CD, etc.): chiori-particle-icd
  - Damage only: Fluttering Hasode (Upward Swee / Fluttering Hasode (Tamato)
- ❌ Elemental Burst: Hiyoku: Twin Blades (geo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Hiyoku: Twin Blades

## B. Characters with keys missing for some definitions (definitions with keys shown for reference) (68 characters)

### Kamisato Ayaka
- ❌ Elemental Skill: Kamisato Art: Hyouka (cryo_e) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: ayaka-a1
  - Only internal keys (particle CD, etc.): ayaka-particle-icd
  - Damage only: Hyouka
- ✅ Elemental Burst: Kamisato Art: Soumetsu (cryo_q): has keys `damage:Soumetsu (Cutting)`

### Jean
- ❌ Elemental Skill: Gale Blade (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): jean-base-particle-icd, jean-extra-particle-icd
  - Damage only: Gale Blade
- ❌ Elemental Skill (Hold): Gale Blade (anemo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): jean-base-particle-icd, jean-extra-particle-icd
  - Damage only: Gale Blade
- ✅ Elemental Burst: Dandelion Breeze (anemo_q): has keys `jean-q`

### Aether (Anemo)
- ❌ Elemental Skill: Palm Vortex (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): traveleranemo-press-particle-icd
  - Damage only: Palm Vortex (Tap)
- ❌ Elemental Skill (Hold): Palm Vortex (anemo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): traveleranemo-hold-particle-icd
  - Damage only: Palm Vortex Initial Cutting (H / Palm Vortex Max Cutting (Hold) / Palm Vortex Max Storm (Hold)
- ✅ Elemental Burst: Gust Surge (anemo_q): has keys `amcburst`

### Aether (Cryo)
- ✅ Elemental Skill: Ice Fog Piercer (cryo_e): has keys `travelercryo-e`
- ❌ Elemental Burst: Frostbound Javelin (cryo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Frostbound Javelin

### Aether (Dendro)
- ❌ Elemental Skill: Razorgrass Blade (dendro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): travelerdendro-particle-icd
  - Damage only: Razorgrass Blade
- ✅ Elemental Burst: Surgent Manifestation (dendro_q): has keys `travelerdendro-q`

### Aether (Pyro)
- ✅ Elemental Skill: Flowfire Blade (pyro_e): has keys `nightsoul-blessing`
- ✅ Elemental Skill (Hold): Flowfire Blade (pyro_e_hold): has keys `travelerpyro-e`
- ❌ Elemental Burst: Plains Scorcher (pyro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Plains Scorcher

### Lisa
- ❌ Elemental Skill: Violet Arc (electro_e) — **No status (instant / DoT damage, etc.)**
  - Damage only: Violet Arc (Press)
- ❌ Elemental Skill (Hold): Violet Arc (electro_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): lisa-particle-icd
  - Damage only: Violet Arc (Hold)
- ✅ Elemental Burst: Lightning Rose (electro_q): has keys `lisaburst`

### Lumine (Anemo)
- ❌ Elemental Skill: Palm Vortex (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): traveleranemo-press-particle-icd
  - Damage only: Palm Vortex (Tap)
- ❌ Elemental Skill (Hold): Palm Vortex (anemo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): traveleranemo-hold-particle-icd
  - Damage only: Palm Vortex Initial Cutting (H / Palm Vortex Max Cutting (Hold) / Palm Vortex Max Storm (Hold)
- ✅ Elemental Burst: Gust Surge (anemo_q): has keys `amcburst`

### Lumine (Cryo)
- ✅ Elemental Skill: Ice Fog Piercer (cryo_e): has keys `travelercryo-e`
- ❌ Elemental Burst: Frostbound Javelin (cryo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Frostbound Javelin

### Lumine (Dendro)
- ❌ Elemental Skill: Razorgrass Blade (dendro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): travelerdendro-particle-icd
  - Damage only: Razorgrass Blade
- ✅ Elemental Burst: Surgent Manifestation (dendro_q): has keys `travelerdendro-q`

### Lumine (Pyro)
- ✅ Elemental Skill: Flowfire Blade (pyro_e): has keys `nightsoul-blessing`
- ✅ Elemental Skill (Hold): Flowfire Blade (pyro_e_hold): has keys `travelerpyro-e`
- ❌ Elemental Burst: Plains Scorcher (pyro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Plains Scorcher

### Barbara
- ✅ Elemental Skill: Let the Show Begin♪ (hydro_e): has keys `barbara-e`
- ❌ Elemental Burst: Shining Miracle♪ (hydro_q) — **No status (instant / DoT damage, etc.)**
  - No status, construct or damage events

### Kaeya
- ❌ Elemental Skill: Frostgnaw (cryo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): kaeya-particle-icd
  - Damage only: Frostgnaw
- ✅ Elemental Burst: Glacial Waltz (cryo_q): has keys `kaeya-q`

### Razor
- ✅ Elemental Skill: Claw and Thunder (electro_e): has keys `razor-sigil`
- ❌ Elemental Skill (Hold): Claw and Thunder (electro_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): razor-hold-particle-icd
  - Damage only: Claw and Thunder (Hold)
- ✅ Elemental Burst: Lightning Fang (electro_q): has keys `razor-q`

### Amber
- ❌ Elemental Skill: Explosive Puppet (pyro_e) — **No status (instant / DoT damage, etc.)**
  - Damage only: Baron Bunny
- ❌ Elemental Skill (Hold): Explosive Puppet (pyro_e_hold) — **No status (instant / DoT damage, etc.)**
  - Damage only: Baron Bunny
- ✅ Elemental Burst: Fiery Rain (pyro_q): has keys `damage:Fiery Rain`

### Venti
- ❌ Elemental Skill: Skyward Sonnet (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Damage only: Skyward Sonnett (Press)
- ❌ Elemental Skill (Hold): Skyward Sonnet (anemo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Damage only: Skyward Sonnett (Hold)
- ✅ Elemental Burst: Wind's Grand Ode (anemo_q): has keys `damage:Wind's Grand Ode`

### Beidou
- ❌ Elemental Skill: Tidecaller (electro_e) — **Shield**
  - Shield events: shield added / shield expired
  - Only internal keys (particle CD, etc.): beidou-particle-icd
  - Damage only: Tidecaller
- ✅ Elemental Burst: Stormbreaker (electro_q): has keys `beidouburst`

### Xiao
- ❌ Elemental Skill: Lemniscatic Wind Cycling (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: xiao-a4
  - Damage only: Lemniscatic Wind Cycling
- ✅ Elemental Burst: Bane of All Evil (anemo_q): has keys `xiaoburst`

### Ningguang
- ✅ Elemental Skill: Jade Screen (geo_e): has keys `construct:NingSkill`
- ❌ Elemental Burst: Starshatter (geo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Starshatter

### Klee
- ❌ Elemental Skill: Jumpy Dumpty (pyro_e) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: a1-icd, a1-spark
  - Only internal keys (particle CD, etc.): a1-icd
  - Damage only: Jumpy Dumpty (Bounce) / Jumpy Dumpty (Mine)
- ✅ Elemental Burst: Sparks 'n' Splash (pyro_q): has keys `kleeq`

### Zhongli
- ✅ Elemental Skill: Dominus Lapidis (geo_e): has keys `construct:ZhongliSkill`
- ✅ Elemental Skill (Hold): Dominus Lapidis (geo_e_hold): has keys `shield:Zhongli Skill`
- ❌ Elemental Burst: Planet Befall (geo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Planet Befall

### Bennett
- ❌ Elemental Skill: Passion Overload (pyro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): bennett-press-particle-icd
  - Damage only: Passion Overload (Press)
- ❌ Elemental Skill (Hold): Passion Overload (pyro_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): bennett-hold-particle-icd
  - Damage only: Passion Overload (Level 1)
- ✅ Elemental Burst: Fantastic Voyage (pyro_q): has keys `bennettburst`

### Ganyu
- ❌ Elemental Skill: Trail of the Qilin (cryo_e) — **No status (instant / DoT damage, etc.)**
  - Damage only: Ice Lotus
- ✅ Elemental Burst: Celestial Shower (cryo_q): has keys `ganyuburst`

### Albedo
- ✅ Elemental Skill: Abiogenesis: Solar Isotoma (geo_e): has keys `construct:AlbedoSkill`
- ❌ Elemental Burst: Rite of Progeniture: Tectonic Tide (geo_q) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: albedo-a4
  - Damage only: Rite of Progeniture: Tectonic 

### Keqing
- ✅ Elemental Skill: Stellar Restoration (electro_e): has keys `keqingstiletto`
- ❌ Elemental Burst: Starward Sword (electro_q) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: keqing-a4
  - Damage only: Starward Sword (Initial) / Starward Sword (Consecutive Sl / Starward Sword (Last Attack)

### Sucrose
- ❌ Elemental Skill: Astable Anemohypostasis Creation - 6308 (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): sucrose-particle-icd
  - Damage only: Astable Anemohypostasis Creati
- ✅ Elemental Burst: Forbidden Creation - Isomer 75 / Type II (anemo_q): has keys `sucroseburst`

### Rosaria
- ❌ Elemental Skill: Ravaging Confession (cryo_e) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: rosaria-a1
  - Only internal keys (particle CD, etc.): rosaria-particle-icd
  - Damage only: Ravaging Confession (Hit 1) / Ravaging Confession (Hit 2)
- ✅ Elemental Burst: Rites of Termination (cryo_q): has keys `rosariaburst`

### Hu Tao
- ✅ Elemental Skill: Guide to Afterlife (pyro_e): has keys `paramita`
- ❌ Elemental Burst: Spirit Soother (pyro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Spirit Soother

### Kaedehara Kazuha
- ❌ Elemental Skill: Chihayaburu (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): kazuha-particle-icd
  - Damage only: Chihayaburu (Press)
- ❌ Elemental Skill (Hold): Chihayaburu (anemo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): kazuha-particle-icd
  - Damage only: Chihayaburu (Hold)
- ✅ Elemental Burst: Kazuha Slash (anemo_q): has keys `kazuha-q`

### Eula
- ✅ Elemental Skill: Icetide Vortex (cryo_e): has keys `eula-grimheart-duration`
- ❌ Elemental Skill (Hold): Icetide Vortex (cryo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): eula-hold-particle-icd
  - Damage only: Icetide Vortex (Hold)
- ✅ Elemental Burst: Glacial Illumination (cryo_q): has keys `eula-q`

### Sayu
- ❌ Elemental Skill: Yoohoo Art: Fuuin Dash (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): sayu-kick-particle-icd
  - Damage only: Fuufuu Windwheel (DoT Press) / Fuufuu Whirlwind (Kick Press)
- ❌ Elemental Skill (Hold): Yoohoo Art: Fuuin Dash (anemo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): sayu-roll-particle-icd, sayu-kick-particle-icd
  - Damage only: Fuufuu Windwheel (DoT Hold) / Fuufuu Whirlwind (Kick Hold)
- ❌ Elemental Skill variant: shortHold (anemo_e_shorthold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): sayu-roll-particle-icd, sayu-kick-particle-icd
  - Damage only: Fuufuu Windwheel (DoT Hold) / Fuufuu Whirlwind (Kick Hold)
- ✅ Elemental Burst: Yoohoo Art: Mujina Flurry (anemo_q): has keys `damage:Muji-Muji Daruma`

### Yelan
- ❌ Elemental Skill: Lingering Lifeline (hydro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): yelan-particle-icd
  - Damage only: Lingering Lifeline
- ✅ Elemental Burst: Depth-Clarion Dice (hydro_q): has keys `yelanburst`

### Aloy
- ✅ Elemental Skill: Frozen Wilds (cryo_e): has keys `rushingice, aloy-rushing-ice`
- ❌ Elemental Burst: Prophecies of Dawn (cryo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Prophecies of Dawn

### Yun Jin
- ❌ Elemental Skill: Opening Flourish (geo_e) — **Shield**
  - Shield events: shield added / shield expired
  - Only internal keys (particle CD, etc.): yunjin-particle-icd
  - Damage only: Opening Flourish (Press)
- ❌ Elemental Skill (Hold, low): Opening Flourish (geo_e_shorthold) — **Shield**
  - Shield events: shield added / shield expired
  - Only internal keys (particle CD, etc.): yunjin-particle-icd
  - Damage only: Opening Flourish (Level 1)
- ❌ Elemental Skill (Hold): Opening Flourish (geo_e_hold) — **Shield**
  - Shield events: shield added / shield expired
  - Only internal keys (particle CD, etc.): yunjin-particle-icd
  - Damage only: Opening Flourish (Level 2)
- ✅ Elemental Burst: Cliffbreaker's Banner (geo_q): has keys `yunjin-q`

### Dori
- ❌ Elemental Skill: Spirit-Warding Lamp: Troubleshooter Cannon (electro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): dori-particle-icd
  - Damage only: Troubleshooter Shot / After-Sales Service Round
- ✅ Elemental Burst: Alcazarzaray's Exactitude (electro_q): has keys `damage:Alcazarzaray's Exactitude: Connector DMG`

### Tighnari
- ✅ Elemental Skill: Vijnana-Phala Mine (dendro_e): has keys `vijnanasuffusion`
- ❌ Elemental Burst: Fashioner's Tanglevine Shaft (dendro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Tanglevine Shaft / Secondary Tanglevine Shaft

### Cyno
- ❌ Elemental Skill: Secret Rite: Chasmic Soulfarer (electro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): cyno-particle-icd
  - Damage only: Secret Rite: Chasmic Soulfarer
- ✅ Elemental Burst: Sacred Rite: Wolf's Swiftness (electro_q): has keys `cyno-q`

### Candace
- ❌ Elemental Skill: Sacred Rite: Heron's Sanctum (hydro_e) — **Shield**
  - Shield events: shield added / shield expired
  - Only internal keys (particle CD, etc.): candace-particle-icd
  - Damage only: Sacred Rite: Heron's Sanctum
- ❌ Elemental Skill (Hold): Sacred Rite: Heron's Sanctum (hydro_e_hold) — **Shield**
  - Shield events: shield added / shield expired
  - Only internal keys (particle CD, etc.): candace-particle-icd
  - Damage only: Sacred Rite: Heron's Sanctum (
- ✅ Elemental Burst: Sacred Rite: Wagtail's Tide (hydro_q): has keys `candace-q`

### Wanderer
- ✅ Elemental Skill: Hanega: Song of the Wind (anemo_e): has keys `windfavored-state, wanderer-plunge-available`
- ❌ Elemental Burst: Kyougen: Five Ceremonial Plays (anemo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Kyougen: Five Ceremonial Plays

### Kaveh
- ❌ Elemental Skill: Artistic Ingenuity (dendro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): kaveh-particle-icd
  - Damage only: Artistic Ingenuity
- ✅ Elemental Burst: Painted Dome (dendro_q): has keys `kaveh-q, kaveh-q-dmg-bonus`

### Baizhu
- ❌ Elemental Skill: Universal Diagnosis (dendro_e) — **No status (instant / DoT damage, etc.)**
  - Damage only: Universal Diagnosis
- ✅ Elemental Burst: Holistic Revivification (dendro_q): has keys `shield:Baizhu Seamless shield`

### Lynette
- ❌ Elemental Skill: Enigmatic Feint (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): lynette-aligned-icd, lynette-particle-icd
  - Damage only: Enigmatic Feint / Surging Blade (lynette)
- ❌ Elemental Skill (Hold): Enigmatic Feint (anemo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): lynette-aligned-icd, lynette-particle-icd
  - Damage only: Enigmatic Feint / Surging Blade (lynette)
- ✅ Elemental Burst: Magic Trick: Astonishing Shift (anemo_q): has keys `lynette-q`

### Lyney
- ❌ Elemental Skill: Bewildering Lights (pyro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): lyney-particle-icd
  - Damage only: Bewildering Lights
- ✅ Elemental Burst: Wondrous Trick: Miracle Parade (pyro_q): has keys `lyney-q, lyney-q-mark`

### Wriothesley
- ✅ Elemental Skill: Icefang Rush (cryo_e): has keys `wriothesley-e`
- ❌ Elemental Burst: Darkgold Wolfbite (cryo_q) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): wriothesley-ousia-icd
  - Damage only: Darkgold Wolfbite / Surging Blade

### Chevreuse
- ✅ Elemental Skill: Short-Range Rapid Interdiction Fire (pyro_e): has keys `chev-skill-heal`
- ✅ Elemental Skill (Hold): Short-Range Rapid Interdiction Fire (pyro_e_hold): has keys `chev-skill-heal`
- ❌ Elemental Burst: Ring of Bursting Grenades (pyro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Explosive Grenade / Secondary Explosive Shell

### Navia
- ❌ Elemental Skill: Ceremonial Crystalshot (geo_e) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: navia-a1-dmg
  - Only internal keys (particle CD, etc.): navia-particle-icd, navia-arkhe-icd
  - Damage only: Rosula Shardshot / Surging Blade
- ❌ Elemental Skill (Hold): Ceremonial Crystalshot (geo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: navia-a1-dmg
  - Only internal keys (particle CD, etc.): navia-particle-icd, navia-arkhe-icd
  - Damage only: Rosula Shardshot / Surging Blade
- ✅ Elemental Burst: As the Sunlit Sky's Singing Salute (geo_q): has keys `navia-artillery`

### Gaming
- ❌ Elemental Skill: Bestial Ascent (pyro_e) — **No status (instant / DoT damage, etc.)**
  - No status, construct or damage events
- ✅ Elemental Burst: Suanni's Gilded Dance (pyro_q): has keys `gaming-q, gaming-man-chai`

### Arlecchino
- ✅ Elemental Skill: All Is Ash (pyro_e): has keys `directive, directive-limit`
- ❌ Elemental Burst: Balemoon Rising (pyro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Balemoon Rising

### Sethos
- ❌ Elemental Skill: Ancient Rite: The Thundering Sands (electro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): sethos-particle-icd
  - Damage only: Ancient Rite: Thunderous Roar 
- ✅ Elemental Burst: Secret Rite: Twilight Shadowpiercer (electro_q): has keys `sethos-burst`

### Clorinde
- ✅ Elemental Skill: Hunter's Vigil (electro_e): has keys `clorinde-night-watch`
- ❌ Elemental Burst: Last Lightfall (electro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Last Lightfall

### Mualani
- ✅ Elemental Skill: Surfshark Wavebreaker (hydro_e): has keys `mualani-surfing`
- ❌ Elemental Burst: Boomsharka-laka (hydro_q) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): nightsoul-burst-icd
  - Damage only: Boomsharka-laka

### Xilonen
- ✅ Elemental Skill: Yohual's Scratch (geo_e): has keys `xilonen-a4`
- ❌ Elemental Burst: Ocelotlicue Point! (geo_q) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: xilonen-a4
  - Only internal keys (particle CD, etc.): nightsoul-burst-icd
  - Damage only: Ocelotlicue Point! / Follow-Up Beat

### Chasca
- ✅ Elemental Skill: Spirit Reins, Shadow Hunt (anemo_e): has keys `nightsoul-blessing`
- ❌ Elemental Burst: Soul Reaper's Fatal Round (anemo_q) — **Needs review (effect key candidates)**
  - Dictionary effect keys appeared but did not meet the conditions: chasca-plunge-available[burst]
  - Only internal keys (particle CD, etc.): nightsoul-burst-icd
  - Damage only: Galesplitting Soulseeker Shell / Soulseeker Shell / Burning Shadowhunt Shell

### Ororon
- ❌ Elemental Skill: Night's Sling (electro_e) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: ororon-a1, ororon-a4
  - Only internal keys (particle CD, etc.): nightsoul-burst-icd
  - Damage only: Spirit Orb DMG
- ✅ Elemental Burst: Dark Voices Echo (electro_q): has keys `supersonic-oculus`

### Mavuika
- ✅ Elemental Skill: The Named Moment (pyro_e): has keys `nightsoul-blessing`
- ✅ Elemental Skill (Hold): The Named Moment (pyro_e_hold): has keys `nightsoul-blessing`
- ⚠️ Elemental Skill variant: recastFramesToBike (pyro_e_recastframestobike) — **Not collected (filled in by hand)**
  - Could not be collected: error encountered on mavuika executing skill: cannot recast E while not in nightsoul blessing
- ⚠️ Elemental Skill variant: recastFramesToRing (pyro_e_recastframestoring) — **Not collected (filled in by hand)**
  - Could not be collected: error encountered on mavuika executing skill: cannot recast E while not in nightsoul blessing
- ✅ Elemental Burst: Hour of Burning Skies (pyro_q): has keys `mavuika-burst`

### Citlali
- ✅ Elemental Skill: Dawnfrost Darkstar (cryo_e): has keys `opal-fire-state`
- ❌ Elemental Burst: Edict of Entwined Splendor (cryo_q) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): nightsoul-burst-icd
  - Damage only: Ice Storm DMG / Spiritvessel Skull DMG

### Lan Yan
- ✅ Elemental Skill: Swallow-Wisp Pinion Dance (anemo_e): has keys `shield:Swallow-Wisp Pinion Dance (Shield)`
- ✅ Elemental Skill (Hold): Swallow-Wisp Pinion Dance (anemo_e_hold): has keys `shield:Swallow-Wisp Pinion Dance (Shield)`
- ❌ Elemental Burst: Lustrous Moonrise (anemo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Lustrous Moonrise

### Varesa
- ✅ Elemental Skill: Riding the Night-Rainbow (electro_e): has keys `follow-up`
- ✅ Elemental Burst: Guardian Vent! (electro_q): has keys `nightsoul-blessing`
- ❌ Special Elemental Burst (Apex Drive) (electro_q_special) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): nightsoul-burst-icd
  - Damage only: Flying Kick

### Escoffier
- ✅ Elemental Skill: Low-Temperature Cooking (cryo_e): has keys `escoffier-skill`
- ⚠️ Elemental Skill (Hold): Low-Temperature Cooking (cryo_e_hold) — **Not collected (filled in by hand)**
  - Could not be collected: ln7: character escoffier: key hold is invalid for action skill
- ❌ Elemental Burst: Scoring Cuts (cryo_q) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: escoffier-a1, escoffier-a4-shred-cryo, escoffier-a4-shred-hydro
  - Damage only: Scoring Cuts

### Ifa
- ✅ Elemental Skill: Airborne Disease Prevention (anemo_e): has keys `nightsoul-blessing`
- ❌ Elemental Burst: Compound Sedation Field (anemo_q) — **No status (instant / DoT damage, etc.)**
  - Only talent / constellation statuses: ifa-a4
  - Only internal keys (particle CD, etc.): nightsoul-burst-icd
  - Damage only: Compound Sedation Field

### Skirk
- ✅ Elemental Skill: Havoc: Warp (cryo_e): has keys `seven-phase-flash`
- ❌ Elemental Skill (Hold): Havoc: Warp (cryo_e_hold) — **Needs review (effect key candidates)**
  - Dictionary effect keys appeared but did not meet the conditions: skirk-hold-e-anim[skill]
- ❌ Elemental Burst: Havoc: Ruin (cryo_q) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): skirk-particle-icd
  - Damage only: Havoc: Ruin (DoT) / Havoc: Ruin (Final)

### Dahlia
- ❌ Elemental Skill: Immersive Ordinance (hydro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): dahlia-particle-icd
  - Damage only: Immersive Ordinance
- ✅ Elemental Burst: Radiant Psalter (hydro_q): has keys `dahlia-favonian-favor`

### Flins
- ✅ Elemental Skill: Ancient Rite: Arcane Light (electro_e): has keys `manifest-flame`
- ✅ Special Elemental Skill "Northland Spearstorm" (after Ancient Rite: Arcane Light) (electro_e_spearstorm): has keys `manifest-flame`
- ❌ Elemental Burst: Ancient Ritual: Cometh the Night (electro_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Cometh the Night (Initial) / Cometh the Night (Mid) / Cometh the Night (Final)
- ❌ Special Elemental Burst (after Spearstorm) (electro_q_special) — **No status (instant / DoT damage, etc.)**
  - Damage only: Cometh the Night (Initial) / Cometh the Night (Mid) / Cometh the Night (Final)

### Aino
- ❌ Elemental Skill: Musecatcher (hydro_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): aino-particle-icd
  - Damage only: Musecatcher 0 / Musecatcher 1
- ✅ Elemental Burst: Precision Hydronic Cooler (hydro_q): has keys `aino-q`

### Zibai
- ✅ Elemental Skill: Heaven and Earth Made Manifest (geo_e): has keys `zibai-skill`
- ❌ Elemental Burst: Tri-Sphere Eminence (geo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Burst / Burst (Lunar-Crystallize)

### Illuga
- ❌ Elemental Skill: Dawnbearing Songbird (geo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): illuga-particle-icd
  - Damage only: Dawnbearing Songbird (Tap)
- ❌ Elemental Skill (Hold): Dawnbearing Songbird (geo_e_hold) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): illuga-particle-icd
  - Damage only: Dawnbearing Songbird (Hold)
- ✅ Elemental Burst: Shadowless Reflection (geo_q): has keys `haunted-night-oriole-song`

### Varka
- ✅ Elemental Skill: Windbound Execution (anemo_e): has keys `sturm-und-drang`
- ✅ Elemental Skill (Hold): Windbound Execution (anemo_e_hold): has keys `sturm-und-drang`
- ❌ Special Elemental Skill (after Windbound Execution) (anemo_e_specialskill) — **Needs review (effect key candidates)**
  - Dictionary effect keys appeared but did not meet the conditions: sturm-und-drang[skill]
  - Only internal keys (particle CD, etc.): varka-particle-icd
  - Damage only: Windbound Execution
- ❌ Elemental Burst: Northwind Avatar (anemo_q) — **No status (instant / DoT damage, etc.)**
  - Damage only: Northwind Avatar

### Prune
- ❌ Elemental Skill: Ring-A-Ding-Ding! Hexhunter Chime (anemo_e) — **No status (instant / DoT damage, etc.)**
  - Only internal keys (particle CD, etc.): prune-particle-icd
  - Damage only: Ring-A-Ding-Ding! Hexhunter Ch
- ✅ Elemental Burst: The Bell Tolls! The Hunt Is On! (anemo_q): has keys `prune-burst`

