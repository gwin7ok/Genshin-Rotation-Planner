import { CharacterConfig } from '../../types/genshin';
import type { RotationState } from './state';
import { t } from '../../i18n';

/** CT違反の検証メッセージ（同じアクションは1件にまとめ、残り秒数は最大値） */
export const addViolationIssueIn = (
  state: RotationState,
  id: string,
  char: CharacterConfig,
  stintId: string,
  actionId: string | undefined,
  time: number,
  severity: 'error' | 'warning',
  title: string,
  what: string,
  remaining: number,
  cycle: number,
) => {
  const { violationRemaining, validationIssues } = state;
  const where = cycle === 0 ? '' : t('messages:ct.violationCycle', { cycle: cycle + 1 });
  const message = t('messages:ct.violationMessage', { what, remaining, where });
  const prev = violationRemaining.get(id);
  if (prev !== undefined) {
    if (remaining > prev) {
      violationRemaining.set(id, remaining);
      const existing = validationIssues.find(v => v.id === id);
      if (existing) existing.message = message;
    }
    return;
  }
  violationRemaining.set(id, remaining);
  validationIssues.push({ id, severity, characterId: char.id, stintId, actionId, time, title, message });
};
