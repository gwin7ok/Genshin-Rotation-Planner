import fs from 'fs';
import path from 'path';
import genshin from 'genshin-db';

interface FrameInfo {
  startupFrames: number;
  totalFrames: number;
  cancelableFrames: {
    dash?: number;
    jump?: number;
    swap?: number;
  };
}

interface MasterCharacterRecord {
  id: string;
  name: string;
  englishName: string;
  element: string;
  weaponType: string;
  rarity: number;
  avatarUrl: string;
  skill: {
    name: string;
    cooldown: number;  // CT (秒)
    duration: number;  // 効果継続時間 (秒)
    description: string;
  };
  burst: {
    name: string;
    cooldown: number;  // CT (秒)
    duration: number;  // 効果継続時間 (秒)
    energyCost: number; // 必要エネルギー
    description: string;
  };
  frameData: Record<string, FrameInfo>;
  availableActions: Array<{
    id: string;
    name: string;
    shortName: string;
    type: string;
    defaultDuration: number;
    description: string;
    energyCost?: number;
    startsSkillCooldown?: boolean;
    startsBurstCooldown?: boolean;
    startupFrames?: number;
    totalFrames?: number;
    cancelableFrames?: {
      dash?: number;
      jump?: number;
      swap?: number;
    };
  }>;
}

const ELEMENT_MAP: Record<string, string> = {
  ELEMENT_PYRO: 'pyro',
  ELEMENT_HYDRO: 'hydro',
  ELEMENT_ELECTRO: 'electro',
  ELEMENT_DENDRO: 'dendro',
  ELEMENT_CRYO: 'cryo',
  ELEMENT_ANEMO: 'anemo',
  ELEMENT_GEO: 'geo',
};

const WEAPON_MAP: Record<string, string> = {
  WEAPON_SWORD_ONE_HAND: 'sword',
  WEAPON_CLAYMORE: 'claymore',
  WEAPON_POLE: 'polearm',
  WEAPON_BOW: 'bow',
  WEAPON_CATALYST: 'catalyst',
};

// Helper to extract numeric stats from genshin-db talent labels
function extractTalentStats(combat: any) {
  let cd = 0;
  let holdCd = 0;
  let duration = 0;
  let energy = 0;

  if (!combat?.attributes?.labels) return { cd, holdCd, duration, energy };

  combat.attributes.labels.forEach((lbl: string) => {
    const [title, formula] = lbl.split('|');
    if (!title || !formula) return;
    const matches = [...formula.matchAll(/param(\d+)/g)].map(m => 'param' + m[1]);
    const getVal = (k: string) => combat.attributes.parameters?.[k]?.[0];

    if (title.includes('長押しクールタイム')) {
      if (matches[0] && typeof getVal(matches[0]) === 'number') holdCd = getVal(matches[0]);
    } else if (title.includes('クールタイム')) {
      if (matches.length > 1) {
        if (typeof getVal(matches[0]) === 'number') cd = getVal(matches[0]);
        if (typeof getVal(matches[matches.length - 1]) === 'number') holdCd = getVal(matches[matches.length - 1]);
      } else if (matches[0] && typeof getVal(matches[0]) === 'number') {
        cd = getVal(matches[0]);
      }
    } else if (title.includes('継続時間') || title.includes('持続時間')) {
      if (matches[0] && typeof getVal(matches[0]) === 'number') duration = getVal(matches[0]);
    } else if (title.includes('元素エネルギー') || title.includes('エネルギー')) {
      if (matches[0] && typeof getVal(matches[0]) === 'number') energy = getVal(matches[0]);
    }
  });

  return { cd, holdCd: holdCd || cd, duration, energy };
}

// Simple Go source parser for gcsim frame definitions
function parseGcsimGoFrames(goText: string): {
  hitmark?: number;
  totalFrames?: number;
  dashCancel?: number;
  jumpCancel?: number;
  swapCancel?: number;
} {
  let hitmark: number | undefined;
  let totalFrames: number | undefined;
  let dashCancel: number | undefined;
  let jumpCancel: number | undefined;
  let swapCancel: number | undefined;

  const hitmarkMatch = goText.match(/(?:hitmark|Hitmark)\s*(?:=|:)\s*(\d+)/i) || goText.match(/Hitmarks?\s*=\s*(?:\[\]int\{|\[\d+\]int\{)(\d+)/i);
  if (hitmarkMatch) {
    hitmark = parseInt(hitmarkMatch[1], 10);
  }

  const sliceMatch = goText.match(/InitAbilSlice\((\d+)\)/) || goText.match(/InitNormalCancelSlice\(\d+,\s*(\d+)\)/);
  if (sliceMatch) {
    totalFrames = parseInt(sliceMatch[1], 10);
  }

  const dashMatch = goText.match(/\[action\.ActionDash\]\s*=\s*(\d+)/);
  if (dashMatch) dashCancel = parseInt(dashMatch[1], 10);

  const jumpMatch = goText.match(/\[action\.ActionJump\]\s*=\s*(\d+)/);
  if (jumpMatch) jumpCancel = parseInt(jumpMatch[1], 10);

  const swapMatch = goText.match(/\[action\.ActionSwap\]\s*=\s*(\d+)/);
  if (swapMatch) swapCancel = parseInt(swapMatch[1], 10);

  return { hitmark, totalFrames, dashCancel, jumpCancel, swapCancel };
}

async function processCharacter(nameKey: string, gcsimCharsSet: Set<string>): Promise<{ id: string; record: MasterCharacterRecord } | null> {
  const charJa = genshin.characters(nameKey, { resultLanguage: 'Japanese' as any });
  const charEn = genshin.characters(nameKey, { resultLanguage: 'English' as any });
  const talent = genshin.talents(nameKey, { resultLanguage: 'Japanese' as any });

  if (!charJa || !charEn) return null;

  const id = charEn.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const element = ELEMENT_MAP[charJa.elementType] || 'pyro';
  const weaponType = WEAPON_MAP[charJa.weaponType] || 'sword';

  const skillStats = extractTalentStats(talent?.combat2);
  const burstStats = extractTalentStats(talent?.combat3);

  const frameData: Record<string, FrameInfo> = {};

  if (gcsimCharsSet.has(id)) {
    try {
      const fetchFile = async (fileName: string) => {
        const res = await fetch(`https://raw.githubusercontent.com/genshinsim/gcsim/main/internal/characters/${id}/${fileName}`);
        return res.ok ? await res.text() : '';
      };

      const [attackText, skillText, burstText] = await Promise.all([
        fetchFile('attack.go'),
        fetchFile('skill.go'),
        fetchFile('burst.go'),
      ]);

      if (attackText) {
        const parsed = parseGcsimGoFrames(attackText);
        frameData['normal'] = {
          startupFrames: parsed.hitmark || 12,
          totalFrames: parsed.totalFrames || 30,
          cancelableFrames: {
            dash: parsed.dashCancel,
            jump: parsed.jumpCancel,
            swap: parsed.swapCancel
          }
        };
      }

      if (skillText) {
        const parsed = parseGcsimGoFrames(skillText);
        frameData['skill'] = {
          startupFrames: parsed.hitmark || 20,
          totalFrames: parsed.totalFrames || 40,
          cancelableFrames: {
            dash: parsed.dashCancel,
            jump: parsed.jumpCancel,
            swap: parsed.swapCancel
          }
        };
      }

      if (burstText) {
        const parsed = parseGcsimGoFrames(burstText);
        frameData['burst'] = {
          startupFrames: parsed.hitmark || 90,
          totalFrames: parsed.totalFrames || 110,
          cancelableFrames: {
            dash: parsed.dashCancel,
            jump: parsed.jumpCancel,
            swap: parsed.swapCancel
          }
        };
      }
    } catch (e) {
      // ignore individual fetch errors
    }
  }

  const skillDurationSec = frameData['skill']?.totalFrames ? Number((frameData['skill'].totalFrames / 60.0).toFixed(2)) : (weaponType === 'claymore' ? 1.1 : 0.8);
  const burstDurationSec = frameData['burst']?.totalFrames ? Number((frameData['burst'].totalFrames / 60.0).toFixed(2)) : 1.5;

  const availableActions = [
    {
      id: `${id}_e`,
      name: talent?.combat2?.name ? `元素スキル: ${talent.combat2.name}` : '元素スキル',
      shortName: 'E',
      type: 'skill',
      defaultDuration: skillDurationSec,
      description: talent?.combat2?.description?.slice(0, 100) || '元素スキル発動',
      startsSkillCooldown: true,
      cooldown: skillStats.cd || 10,
      effectDuration: skillStats.duration || 0,
      skillCooldown: skillStats.cd || 10,
      skillDuration: skillStats.duration || 0,
      startupFrames: frameData['skill']?.startupFrames,
      totalFrames: frameData['skill']?.totalFrames,
      cancelableFrames: frameData['skill']?.cancelableFrames,
    },
    {
      id: `${id}_e_hold`,
      name: talent?.combat2?.name ? `元素スキル(長押し): ${talent.combat2.name}` : '元素スキル(長押し)',
      shortName: 'Hold E',
      type: 'skill_hold',
      defaultDuration: Math.min(skillDurationSec * 1.5, 1.8),
      description: '元素スキル長押し発動',
      startsSkillCooldown: true,
      cooldown: skillStats.holdCd || skillStats.cd || 10,
      effectDuration: skillStats.duration || 0,
      skillCooldown: skillStats.holdCd || skillStats.cd || 10,
      skillDuration: skillStats.duration || 0,
    },
    {
      id: `${id}_q`,
      name: talent?.combat3?.name ? `元素爆発: ${talent.combat3.name}` : '元素爆発',
      shortName: 'Q',
      type: 'burst',
      defaultDuration: burstDurationSec,
      description: talent?.combat3?.description?.slice(0, 100) || '元素爆発発動',
      startsBurstCooldown: true,
      cooldown: burstStats.cd || 15,
      effectDuration: burstStats.duration || 0,
      burstCooldown: burstStats.cd || 15,
      burstDuration: burstStats.duration || 0,
      energyCost: burstStats.energy || 60,
      startupFrames: frameData['burst']?.startupFrames,
      totalFrames: frameData['burst']?.totalFrames,
      cancelableFrames: frameData['burst']?.cancelableFrames,
    },
    {
      id: `${id}_n1`,
      name: '通常攻撃 1段',
      shortName: 'N1',
      type: 'normal',
      defaultDuration: frameData['normal']?.totalFrames ? Number((frameData['normal'].totalFrames / 60.0).toFixed(2)) : 0.4,
      description: '通常攻撃第1段',
      startupFrames: frameData['normal']?.startupFrames,
      totalFrames: frameData['normal']?.totalFrames,
      cancelableFrames: frameData['normal']?.cancelableFrames,
    },
    {
      id: `${id}_ca`,
      name: '重撃',
      shortName: 'CA',
      type: 'charged',
      defaultDuration: 0.8,
      description: '重撃発動',
    },
    {
      id: `${id}_dash`,
      name: 'ダッシュ',
      shortName: 'Dash',
      type: 'dash',
      defaultDuration: 0.2,
      description: 'ダッシュキャンセル',
    }
  ];

  return {
    id,
    record: {
      id,
      name: charJa.name,
      englishName: charEn.name,
      element,
      weaponType,
      rarity: parseInt(String(charJa.rarity || 5), 10) || 5,
      avatarUrl: `https://genshin.jmp.blue/characters/${id}/icon`,
      skill: {
        name: talent?.combat2?.name || '元素スキル',
        cooldown: skillStats.cd || 10,
        duration: skillStats.duration || 0,
        description: talent?.combat2?.description || ''
      },
      burst: {
        name: talent?.combat3?.name || '元素爆発',
        cooldown: burstStats.cd || 15,
        duration: burstStats.duration || 0,
        energyCost: burstStats.energy || 60,
        description: talent?.combat3?.description || ''
      },
      frameData,
      availableActions
    }
  };
}

async function build() {
  console.log('=== Starting Concurrent Genshin Master Data Generation ===');
  const names = genshin.characters('names', { matchCategories: true });
  console.log(`Processing ${names.length} characters from genshin-db...`);

  const gcsimCharsSet = new Set<string>();
  try {
    const res = await fetch('https://api.github.com/repos/genshinsim/gcsim/contents/internal/characters', {
      headers: { 'User-Agent': 'Node-App' }
    });
    if (res.ok) {
      const data = await res.json();
      data.forEach((item: any) => gcsimCharsSet.add(item.name.toLowerCase()));
    }
  } catch (err) {
    console.warn('Failed to list gcsim character directory:', err);
  }

  const masterDatabase: Record<string, MasterCharacterRecord> = {};

  // Process in parallel chunks of 25 characters
  const CHUNK_SIZE = 25;
  for (let i = 0; i < names.length; i += CHUNK_SIZE) {
    const chunk = names.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(chunk.map(name => processCharacter(name, gcsimCharsSet)));
    for (const res of results) {
      if (res) {
        masterDatabase[res.id] = res.record;
      }
    }
    console.log(`Processed ${Math.min(i + CHUNK_SIZE, names.length)} / ${names.length} characters...`);
  }

  const outputPath = path.join(process.cwd(), 'src/data/characters_master_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(masterDatabase, null, 2), 'utf-8');
  console.log(`Successfully generated master data for ${Object.keys(masterDatabase).length} characters at: ${outputPath}`);
}

build();
