export type GameState = 'title' | 'playing' | 'paused' | 'gameover' | 'victory';

export type TowerType =
  | 'machine_gun'
  | 'sniper'
  | 'artillery'
  | 'tank'
  | 'trench_wire'
  | 'anti_tank_gun'
  | 'katyusha_rocket';

export type TargetPriority = 'first' | 'strongest' | 'closest' | 'lowest_hp';

export interface Position {
  x: number;
  y: number;
}

export interface TowerConfig {
  type: TowerType;
  name: string;
  cost: number;
  range: number;
  damage: number;
  fireRate: number; // shots per second
  splashRadius: number; // 0 for single target
  armorPiercing: number; // 0 to 1 (mitigates enemy armor)
  description: string;
  historicalName: string;
  roleHint: string;
  upgradeCostMultiplier: number;
  hotkey: string;
  requiredScoreUnlock?: number; // Score required to unlock
  unlockMilestoneId?: string;
}

export interface TowerInstance {
  id: string;
  type: TowerType;
  x: number;
  y: number;
  level: number;
  angle: number;
  lastShotTime: number;
  targetId: string | null;
  totalDamageDealt: number;
  kills: number;
  priority: TargetPriority;
  customData?: {
    patrolOffset?: number;
    reloadProgress?: number;
  };
}

export type EnemyType =
  | 'recruit'
  | 'officer'
  | 'sapper'
  | 'shock_troop'
  | 'flamethrower'
  | 'halftrack'
  | 'panzer_tank';

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  maxHp: number;
  speed: number;
  armor: number;
  bounty: number; // supplies
  scoreValue: number; // points awarded
  description: string;
  isArmored: boolean;
  radius: number;
  color: string;
  hasAura?: boolean;
}

export interface EnemyInstance {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  armor: number;
  pathIndex: number;
  distanceTravelled: number;
  angle: number;
  hitFlashTimer: number;
  slowTimer: number;
  buffedByOfficer: boolean;
  isDead: boolean;
  deathTimer: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  targetEnemyId: string | null;
  speed: number;
  progress: number;
  damage: number;
  splashRadius: number;
  armorPiercing: number;
  arcHeight: number;
  type: 'bullet' | 'sniper_tracer' | 'artillery_shell' | 'tank_shell' | 'at_round' | 'rocket';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  type: 'spark' | 'smoke' | 'fire' | 'dirt' | 'blood' | 'shrapnel';
}

export interface Decal {
  x: number;
  y: number;
  radius: number;
  type: 'crater' | 'scorch' | 'treads';
  alpha: number;
  angle: number;
}

export interface WaveDefinition {
  waveNumber: number;
  spawns: {
    enemyType: EnemyType;
    count: number;
    interval: number;
    delayBefore: number;
  }[];
  rewardSupplies: number;
  rewardScore: number;
  description: string;
}

export interface TacticalStrike {
  id: string;
  type: 'artillery_barrage' | 'air_strike';
  targetX: number;
  targetY: number;
  timer: number;
  duration: number;
  strikesCount: number;
}

export interface ScoreMilestone {
  id: string;
  thresholdScore: number;
  title: string;
  description: string;
  icon: string;
  effectType: 'unlock_tower' | 'permanent_buff';
  unlockedTower?: TowerType;
  buffTarget?: TowerType | 'all' | 'tactical';
  buffDescription: string;
}

export interface GameStats {
  score: number;
  highScore: number;
  enemiesKilled: number;
  tanksKilled: number;
  officersKilled: number;
  wavesCleared: number;
  totalDamageDealt: number;
  suppliesEarned: number;
  suppliesSpent: number;
  unlockedMilestoneIds: string[];
}
