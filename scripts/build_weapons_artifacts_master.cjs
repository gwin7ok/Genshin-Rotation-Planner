const genshin = require('genshin-db');
const fs = require('fs');
const path = require('path');

const WEAPON_TYPE_MAP = {
  'WEAPON_SWORD_ONE_HAND': 'sword',
  'WEAPON_CLAYMORE': 'claymore',
  'WEAPON_POLEARM': 'polearm',
  'WEAPON_BOW': 'bow',
  'WEAPON_CATALYST': 'catalyst',
  'Sword': 'sword',
  'Claymore': 'claymore',
  'Polearm': 'polearm',
  'Bow': 'bow',
  'Catalyst': 'catalyst'
};

function buildMasterFiles() {
  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

  // 1. Build Weapons
  const weaponNames = genshin.weapons('names', { matchCategories: true }) || [];
  const weaponsList = [];

  for (const nameKey of weaponNames) {
    try {
      const wJa = genshin.weapons(nameKey, { resultLanguage: 'Japanese' });
      const wEn = genshin.weapons(nameKey, { resultLanguage: 'English' });
      if (!wJa || !wEn) continue;

      const rarity = parseInt(wJa.rarity, 10);
      if (rarity < 3) continue; // Only 3, 4, 5 star weapons for combat app

      const id = wEn.name.toLowerCase().replace(/['"-]/g, '').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
      const rawType = wJa.weaponType || wEn.weaponType || 'Sword';
      const weaponType = WEAPON_TYPE_MAP[rawType] || 'sword';

      let baseAttack = undefined;
      let subStat = undefined;
      try {
        const stats90 = wJa.stats(90);
        if (stats90) {
          baseAttack = Math.round(stats90.attack || 0);
          if (wJa.substat && stats90.specialized) {
            let specVal = stats90.specialized;
            if (typeof specVal === 'number') {
              specVal = specVal > 1 ? specVal.toString() : `${(specVal * 100).toFixed(1)}%`;
            }
            subStat = `${wJa.substat} ${specVal}`;
          }
        }
      } catch (err) {
        // ignore
      }

      const effectText = wJa.effect || '';
      let buffEffect = undefined;
      const durationMatch = effectText.match(/(\d+(?:\.\d+)?)\s*秒間?/);
      if (durationMatch) {
        const durationSec = parseFloat(durationMatch[1]);
        let color = '#3b82f6';
        if (effectText.includes('チャージ') || effectText.includes('元素エネルギー')) {
          color = '#c084fc';
        } else if (effectText.includes('熟知') || effectText.includes('元素反応')) {
          color = '#10b981';
        }

        buffEffect = {
          id: `${id}_buff`,
          name: `${wJa.name}: 効果`,
          duration: durationSec,
          statEffect: wJa.effectName || 'バフ効果',
          description: effectText,
          color: color
        };
      }

      weaponsList.push({
        id,
        name: wJa.name,
        weaponType,
        rarity,
        passiveName: wJa.effectName || 'なし',
        description: effectText || '効果なし',
        baseAttack,
        subStat,
        buffEffect,
        isCustom: false,
        updatedAt: nowStr
      });
    } catch (e) {
      console.warn(`Error processing weapon ${nameKey}:`, e);
    }
  }

  // 2. Build Artifacts
  const artifactNames = genshin.artifacts('names', { matchCategories: true }) || [];
  const artifactsList = [];

  for (const nameKey of artifactNames) {
    try {
      const aJa = genshin.artifacts(nameKey, { resultLanguage: 'Japanese' });
      const aEn = genshin.artifacts(nameKey, { resultLanguage: 'English' });
      if (!aJa || !aEn) continue;

      const idBase = aEn.name.toLowerCase().replace(/['"-]/g, '').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
      const id = idBase.endsWith('_4p') ? idBase : `${idBase}_4p`;

      let maxRarity = 5;
      if (Array.isArray(aJa.rarityList)) {
        maxRarity = Math.max(...aJa.rarityList.map(r => parseInt(r, 10)));
      }

      const effect2pText = aJa.effect2Pc || aJa['2pc'] || '';
      const effect4pText = aJa.effect4Pc || aJa['4pc'] || '';
      if (!effect2pText && !effect4pText) continue;

      let buffEffect = undefined;
      const durationMatch = effect4pText.match(/(\d+(?:\.\d+)?)\s*秒間?/);
      if (durationMatch) {
        buffEffect = {
          id: `${id}_buff`,
          name: `${aJa.name} 4: 効果`,
          duration: parseFloat(durationMatch[1]),
          statEffect: '4セット効果バフ',
          description: effect4pText,
          color: '#ec4899'
        };
      }

      artifactsList.push({
        id,
        name: `${aJa.name} 4セット`,
        rarity: maxRarity >= 5 ? 5 : 4,
        effect2p: effect2pText || 'なし',
        effect4p: effect4pText || 'なし',
        buffEffect,
        isCustom: false,
        updatedAt: nowStr
      });
    } catch (e) {
      console.warn(`Error processing artifact ${nameKey}:`, e);
    }
  }

  fs.writeFileSync(path.join(__dirname, '../src/data/weapons_master_data.json'), JSON.stringify(weaponsList, null, 2));
  fs.writeFileSync(path.join(__dirname, '../src/data/artifacts_master_data.json'), JSON.stringify(artifactsList, null, 2));

  console.log(`Successfully generated ${weaponsList.length} weapons and ${artifactsList.length} artifact sets!`);
}

buildMasterFiles();
