/**
 * 固有天賦・命ノ星座・装備・元素共鳴のマスター効果カバレッジ。
 *
 * アクション効果カバレッジとは当面分けて生成する。各行の ID と links/unlinked の形は、
 * 将来カバレッジを統合するときに合わせやすいリレーショナル形式にしてある。
 */
export type MasterEffectTargetType = 'talent' | 'constellation' | 'weapon' | 'artifact' | 'resonance';
export type MasterEffectKeyState = 'linked' | 'excluded' | 'pending' | 'unreviewed';
export type MasterEffectTargetState = 'linked' | 'unsupported' | 'pending' | 'unreviewed';
export type MasterEffectLinkRole = 'effect' | 'extra' | 'cooldown' | 'resonance';

export interface MasterEffectKeyRow {
  id: string;
  category: string;
  kind: 'effect' | 'cooldown' | 'internal';
  ownerType: string;
  ownerKey: string;
  ownerName?: string;
  name?: string;
  durationFrames?: number;
  permanent?: boolean;
  isPattern?: boolean;
  observed?: boolean;
}

export interface MasterEffectTargetRow {
  id: string;
  type: MasterEffectTargetType;
  ownerId: string;
  ownerName: string;
  name: string;
  timing?: 'always' | 'conditional' | 'computed';
  gcsimTarget?: boolean;
  duration?: number;
  gcsimNote?: string;
}

export interface MasterEffectLinkRow {
  effectId: string;
  targetId: string;
  role: MasterEffectLinkRole;
  approval: 'generated' | 'manual';
  note?: string;
}

export interface MasterEffectDisposition {
  side: 'effect' | 'target';
  id: string;
  state: Exclude<MasterEffectKeyState, 'linked'> | Exclude<MasterEffectTargetState, 'linked'>;
  reason: string;
  note: string;
}

export interface MasterEffectCoverage {
  schemaVersion: 1;
  gcsimCommit: string;
  generatedAt: string;
  effects: MasterEffectKeyRow[];
  targets: MasterEffectTargetRow[];
  links: MasterEffectLinkRow[];
  unlinked: MasterEffectDisposition[];
}
