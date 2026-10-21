import {
  ENEMY_CONFIGS,
  SCORE_MILESTONES,
  TOTAL_WAVES,
  TOWER_CONFIGS,
  TOWER_UPGRADE_TIERS,
} from './constants';
import { EnemyType, Position, ScoreMilestone, TowerType } from './types';

/**
 * Retrieves tier definition for a tower (Tier 1, 2, or 3)
 */
export function getUpgradeTierInfo(type: TowerType, tier: number) {
  const tiers = TOWER_UPGRADE_TIERS[type];
  if (!tiers || tiers.length === 0) {
    throw new Error(`No tiers found for tower type ${type}`);
  }
  const clamped = Math.max(1, Math.min(tiers.length, tier));
  return tiers[clamped - 1];
}

/**
 * Calculates effective stats for a tower instance, incorporating:
 * 1. Base tower config
 * 2. Tower tier upgrades (Tier 1-3)
 * 3. Permanent buffs from unlocked score milestones
 */
export function calculateTowerStats(
  type: TowerType,
  level: number,
  unlockedMilestoneIds: string[] = []
) {
  const base = TOWER_CONFIGS[type];
  if (!base) {
    throw new Error(`Unknown tower type: ${type}`);
  }

  const tierInfo = getUpgradeTierInfo(type, level);

  let damage = base.damage * tierInfo.damageMultiplier;
  let fireRate = base.fireRate * tierInfo.fireRateMultiplier;
  let range = base.range * tierInfo.rangeMultiplier;
  let splashRadius = base.splashRadius * tierInfo.splashMultiplier;
  let armorPiercing = Math.min(1.0, base.armorPiercing + tierInfo.armorPiercingBonus);
  let critChance = tierInfo.critChance;

  // Apply permanent global doctrine buffs from score milestones:
  // 1. ms_mg_rate: +20% fire rate to all Machine Guns
  if (unlockedMilestoneIds.includes('ms_mg_rate') && type === 'machine_gun') {
    fireRate *= 1.2;
  }
  // 2. ms_sniper_range: +20% range and +15% crit chance to Snipers
  if (unlockedMilestoneIds.includes('ms_sniper_range') && type === 'sniper') {
    range *= 1.2;
    critChance = Math.min(1.0, critChance + 0.15);
  }
  // 3. ms_tank_armor: +25% damage to Tanks
  if (unlockedMilestoneIds.includes('ms_tank_armor') && type === 'tank') {
    damage *= 1.25;
  }

  return {
    damage: Math.round(damage),
    fireRate: Number(fireRate.toFixed(2)),
    range: Math.round(range),
    splashRadius: Math.round(splashRadius),
    armorPiercing: Number(armorPiercing.toFixed(2)),
    critChance: Number(critChance.toFixed(2)),
    tierName: tierInfo.name,
    tierDescription: tierInfo.description,
    bonusSummary: tierInfo.bonusSummary,
    canUpgrade: level < (TOWER_UPGRADE_TIERS[type]?.length || 3),
  };
}

/**
 * Calculates cost to upgrade from currentLevel to currentLevel + 1
 */
export function calculateUpgradeCost(type: TowerType, currentLevel: number): number {
  const tiers = TOWER_UPGRADE_TIERS[type];
  if (!tiers || currentLevel >= tiers.length) {
    return 0; // Max tier reached
  }
  // Cost for the next tier
  return tiers[currentLevel].cost;
}

/**
 * Calculates refund when selling a tower
 */
export function calculateSellRefund(type: TowerType, level: number): number {
  const base = TOWER_CONFIGS[type];
  if (!base) return 0;
  let totalCost = base.cost;
  const tiers = TOWER_UPGRADE_TIERS[type];
  if (tiers) {
    for (let l = 1; l < level && l < tiers.length; l++) {
      totalCost += tiers[l].cost;
    }
  }
  return Math.round(totalCost * 0.7);
}

/**
 * Checks which score milestones have been unlocked based on player score
 */
export function checkUnlockedMilestones(
  currentScore: number,
  alreadyUnlockedIds: string[]
): ScoreMilestone[] {
  return SCORE_MILESTONES.filter(
    (m) => currentScore >= m.thresholdScore && !alreadyUnlockedIds.includes(m.id)
  );
}

/**
 * Checks if a specific tower type is unlocked by player score/milestones
 */
export function isTowerUnlocked(type: TowerType, unlockedMilestoneIds: string[]): boolean {
  const config = TOWER_CONFIGS[type];
  if (!config) return false;
  if (!config.requiredScoreUnlock || !config.unlockMilestoneId) {
    return true; // Available from start
  }
  return unlockedMilestoneIds.includes(config.unlockMilestoneId);
}

/**
 * Calculates score awarded when an enemy is eliminated
 */
export function calculateScoreGain(
  enemyType: EnemyType,
  isCritical: boolean = false,
  comboCount: number = 0
): number {
  const baseValue = ENEMY_CONFIGS[enemyType]?.scoreValue || 50;
  const critMultiplier = isCritical ? 1.5 : 1.0;
  const comboBonus = Math.min(2.0, 1.0 + comboCount * 0.05); // up to +100% combo bonus
  return Math.round(baseValue * critMultiplier * comboBonus);
}

/**
 * Calculates score awarded at the end of a wave
 */
export function calculateEndWaveScore(
  waveNumber: number,
  rewardScore: number,
  healthRemaining: number,
  maxHealth: number,
  tookDamageInWave: boolean
): { totalScore: number; waveReward: number; flawlessBonus: number; healthBonus: number } {
  const flawlessBonus = !tookDamageInWave ? Math.round(rewardScore * 0.5) : 0;
  const healthPercent = Math.max(0, healthRemaining / maxHealth);
  const healthBonus = Math.round(rewardScore * 0.25 * healthPercent);
  const totalScore = rewardScore + flawlessBonus + healthBonus;

  return {
    totalScore,
    waveReward: rewardScore,
    flawlessBonus,
    healthBonus,
  };
}

/**
 * Calculates damage dealt to an enemy taking into account armor and armor piercing
 */
export function calculateDamage(
  rawDamage: number,
  armorPiercing: number,
  enemyArmor: number,
  isCritical: boolean = false
): { damage: number; isCrit: boolean } {
  const effectiveArmor = Math.max(0, enemyArmor * (1 - Math.min(1, Math.max(0, armorPiercing))));
  const baseMitigated = Math.max(1, rawDamage - effectiveArmor);
  const finalDamage = isCritical ? Math.round(baseMitigated * 2.2) : Math.round(baseMitigated);
  return {
    damage: finalDamage,
    isCrit: isCritical,
  };
}

/**
 * Checks if target position is within radial range
 */
export function isTargetInRange(towerPos: Position, targetPos: Position, range: number): boolean {
  const dx = targetPos.x - towerPos.x;
  const dy = targetPos.y - towerPos.y;
  return dx * dx + dy * dy <= range * range;
}

/**
 * Calculates total length of a polyline waypoint path
 */
export function calculateTotalPathLength(waypoints: Position[]): number {
  if (waypoints.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/**
 * Interpolates coordinates and heading angle along waypoints given distance traveled
 */
export function interpolatePathPosition(
  waypoints: Position[],
  distance: number
): { x: number; y: number; angle: number; reachedEnd: boolean } {
  if (waypoints.length === 0) {
    return { x: 0, y: 0, angle: 0, reachedEnd: true };
  }
  if (waypoints.length === 1 || distance <= 0) {
    return { x: waypoints[0].x, y: waypoints[0].y, angle: 0, reachedEnd: false };
  }

  let accumulated = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segmentLen = Math.sqrt(dx * dx + dy * dy);

    if (accumulated + segmentLen >= distance) {
      const segT = (distance - accumulated) / segmentLen;
      const x = p1.x + dx * segT;
      const y = p1.y + dy * segT;
      const angle = Math.atan2(dy, dx);
      return { x, y, angle, reachedEnd: false };
    }

    accumulated += segmentLen;
  }

  const last = waypoints[waypoints.length - 1];
  const secondLast = waypoints[waypoints.length - 2];
  return {
    x: last.x,
    y: last.y,
    angle: Math.atan2(last.y - secondLast.y, last.x - secondLast.x),
    reachedEnd: true,
  };
}

/**
 * Checks if the player has won the game
 */
export function checkWinCondition(
  currentWave: number,
  activeEnemiesCount: number,
  spawningDone: boolean,
  baseHealth: number
): boolean {
  if (baseHealth <= 0) return false;
  return currentWave >= TOTAL_WAVES && spawningDone && activeEnemiesCount === 0;
}

/**
 * Checks if the player has lost
 */
export function checkLossCondition(baseHealth: number): boolean {
  return baseHealth <= 0;
}
