const fs = require('fs');
const path = require('path');
const genshin = require('genshin-db');

const filePath = path.join(process.cwd(), 'src/data/characters_master_data.json');
const masterData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

function extractStats(combat) {
  let cd = 0;
  let holdCd = 0;
  let duration = 0;
  let energy = 0;

  if (!combat || !combat.attributes || !combat.attributes.labels) {
    return { cd, holdCd, duration, energy };
  }

  combat.attributes.labels.forEach((lbl) => {
    const parts = lbl.split('|');
    if (parts.length < 2) return;
    const title = parts[0];
    const formula = parts[1];

    const matches = [...formula.matchAll(/param(\d+)/g)].map(m => 'param' + m[1]);
    const getVal = (k) => combat.attributes.parameters && combat.attributes.parameters[k] ? combat.attributes.parameters[k][0] : undefined;

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

let count = 0;
for (const [id, record] of Object.entries(masterData)) {
  if (id.startsWith('__')) continue;
  count++;

  const talent = genshin.talents(id, { resultLanguage: 'Japanese' }) || genshin.talents(record.name, { resultLanguage: 'Japanese' });
  const charJa = genshin.characters(id, { resultLanguage: 'Japanese' }) || genshin.characters(record.name, { resultLanguage: 'Japanese' });

  const skillStats = extractStats(talent ? talent.combat2 : null);
  const burstStats = extractStats(talent ? talent.combat3 : null);

  const skillCD = skillStats.cd || (record.skill ? record.skill.cooldown : 10) || 10;
  const skillHoldCD = skillStats.holdCd || skillCD;
  const skillDur = skillStats.duration || (record.skill ? record.skill.duration : 0) || 0;

  const burstCD = burstStats.cd || (record.burst ? record.burst.cooldown : 15) || 15;
  const burstDur = burstStats.duration || (record.burst ? record.burst.duration : 0) || 0;
  const burstCost = burstStats.energy || (record.burst ? record.burst.energyCost : 60) || 60;

  if (charJa && charJa.name) {
    record.name = charJa.name;
  }

  record.skill = {
    name: (talent && talent.combat2 && talent.combat2.name) || (record.skill ? record.skill.name : '元素スキル'),
    cooldown: skillCD,
    duration: skillDur,
    description: (talent && talent.combat2 && talent.combat2.description) || (record.skill ? record.skill.description : '')
  };

  record.burst = {
    name: (talent && talent.combat3 && talent.combat3.name) || (record.burst ? record.burst.name : '元素爆発'),
    cooldown: burstCD,
    duration: burstDur,
    energyCost: burstCost,
    description: (talent && talent.combat3 && talent.combat3.description) || (record.burst ? record.burst.description : '')
  };

  // Special character overrides
  if (id === 'keqing') {
    record.availableActions = [
      { id: 'keqing_n1', name: '通常攻撃 1段', shortName: 'N1', buttonLabel: 'N1', type: 'normal', defaultDuration: 0.23, cooldown: 0, effectDuration: 0 },
      { id: 'keqing_ca', name: '重撃 (通常1段+重撃)', shortName: 'N1C', buttonLabel: 'N1C', type: 'charged', defaultDuration: 0.68, cooldown: 0, effectDuration: 0 },
      { id: 'keqing_e', name: '元素スキル: 雷楔投擲', shortName: 'E', buttonLabel: 'E(投擲)', type: 'skill', defaultDuration: 0.40, cooldown: 7.5, effectDuration: 5.0, startsSkillCooldown: true },
      { id: 'keqing_ee', name: 'スキル2段目: 瞬間移動斬撃', shortName: 'E', buttonLabel: 'E(斬撃)', type: 'skill', defaultDuration: 0.65, cooldown: 0, effectDuration: 5.0, startsSkillCooldown: false },
      { id: 'keqing_e_ca', name: '遠隔重撃起爆 (暴雷連斬)', shortName: 'CA', buttonLabel: 'E-CA(起爆)', type: 'charged', defaultDuration: 0.68, cooldown: 0, effectDuration: 0 },
      { id: 'keqing_q', name: '元素爆発: 天街巡遊', shortName: 'Q', buttonLabel: 'Q', type: 'burst', defaultDuration: 2.15, cooldown: 12.0, effectDuration: 8.0, startsBurstCooldown: true, energyCost: 40 },
      { id: 'keqing_dash', name: 'ダッシュ', shortName: 'Dash', buttonLabel: 'Dash', type: 'dash', defaultDuration: 0.20, cooldown: 0, effectDuration: 0 },
    ];
    continue;
  }

  if (id === 'nilou') {
    record.availableActions = [
      { id: 'nilou_n1', name: '通常攻撃 1段', shortName: 'N1', buttonLabel: 'N1', type: 'normal', defaultDuration: 0.38, cooldown: 0, effectDuration: 0 },
      { id: 'nilou_ca', name: '重撃', shortName: 'CA', buttonLabel: 'CA', type: 'charged', defaultDuration: 0.65, cooldown: 0, effectDuration: 0 },
      { id: 'nilou_e', name: '元素スキル: 七域のダンス', shortName: 'E', buttonLabel: 'E(始動)', type: 'skill', defaultDuration: 0.85, cooldown: 18.0, effectDuration: 10.0, startsSkillCooldown: true },
      { id: 'nilou_e_water', name: '旋舞ステップ (天を滌う水環)', shortName: 'E', buttonLabel: 'E(水環)', type: 'skill', defaultDuration: 0.90, cooldown: 0, effectDuration: 12.0 },
      { id: 'nilou_q', name: '元素爆発: 浮蓮のダンス·遠夢聆泉', shortName: 'Q', buttonLabel: 'Q', type: 'burst', defaultDuration: 1.80, cooldown: 18.0, effectDuration: 0, startsBurstCooldown: true, energyCost: 70 },
      { id: 'nilou_dash', name: 'ダッシュ', shortName: 'Dash', buttonLabel: 'Dash', type: 'dash', defaultDuration: 0.20, cooldown: 0, effectDuration: 0 },
    ];
    continue;
  }

  // Update or insert actions with specific CT and Duration
  const updatedActions = [];
  let hasHold = false;

  for (const act of (record.availableActions || [])) {
    const isUtility = ['normal', 'charged', 'plunge', 'dash', 'jump', 'swap'].includes(act.type);
    if (act.type === 'skill') {
      updatedActions.push({
        ...act,
        buttonLabel: act.buttonLabel || act.shortName || 'E',
        startsSkillCooldown: true,
        cooldown: skillCD,
        effectDuration: skillDur,
        skillCooldown: skillCD,
        skillDuration: skillDur,
        customSkillCT: skillCD,
        description: act.description || `元素スキル (CT: ${skillCD}秒${skillDur > 0 ? ` / 継続: ${skillDur}秒` : ''})`
      });
    } else if (act.type === 'skill_hold') {
      hasHold = true;
      updatedActions.push({
        ...act,
        buttonLabel: act.buttonLabel || act.shortName || 'Hold E',
        startsSkillCooldown: true,
        cooldown: skillHoldCD,
        effectDuration: skillDur,
        skillCooldown: skillHoldCD,
        skillDuration: skillDur,
        customSkillCT: skillHoldCD,
        description: act.description || `元素スキル長押し (CT: ${skillHoldCD}秒${skillDur > 0 ? ` / 継続: ${skillDur}秒` : ''})`
      });
    } else if (act.type === 'burst') {
      updatedActions.push({
        ...act,
        buttonLabel: act.buttonLabel || act.shortName || 'Q',
        startsBurstCooldown: true,
        cooldown: burstCD,
        effectDuration: burstDur,
        burstCooldown: burstCD,
        burstDuration: burstDur,
        energyCost: burstCost,
        description: act.description || `元素爆発 (CT: ${burstCD}秒 / エネルギー: ${burstCost}${burstDur > 0 ? ` / 継続: ${burstDur}秒` : ''})`
      });
    } else if (isUtility) {
      updatedActions.push({
        ...act,
        buttonLabel: act.buttonLabel || act.shortName,
        cooldown: 0,
        effectDuration: 0,
        skillCooldown: 0,
        burstCooldown: 0,
        startsSkillCooldown: false,
        startsBurstCooldown: false,
      });
    } else {
      updatedActions.push({
        ...act,
        buttonLabel: act.buttonLabel || act.shortName,
      });
    }
  }

  // If character has a distinct hold cooldown and no skill_hold action yet, add it!
  if (skillStats.holdCd && skillStats.holdCd !== skillStats.cd && !hasHold) {
    const skillAction = updatedActions.find(a => a.type === 'skill');
    updatedActions.splice(1, 0, {
      id: id + '_e_hold',
      name: '元素スキル (長押し)',
      shortName: 'Hold E',
      buttonLabel: 'Hold E',
      type: 'skill_hold',
      defaultDuration: Math.min((skillAction ? skillAction.defaultDuration : 0.8) * 1.5, 1.8),
      description: `元素スキル長押し (CT: ${skillHoldCD}秒${skillDur > 0 ? ` / 継続: ${skillDur}秒` : ''})`,
      startsSkillCooldown: true,
      cooldown: skillHoldCD,
      effectDuration: skillDur,
      skillCooldown: skillHoldCD,
      skillDuration: skillDur,
      customSkillCT: skillHoldCD
    });
  }

  record.availableActions = updatedActions;
}

fs.writeFileSync(filePath, JSON.stringify(masterData, null, 2), 'utf-8');
console.log('SUCCESS: Updated ' + count + ' characters in master database with genshin-db values and per-action CT & duration!');
