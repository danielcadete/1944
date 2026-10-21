import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDamage,
  calculateEndWaveScore,
  calculateScoreGain,
  calculateSellRefund,
  calculateTowerStats,
  calculateUpgradeCost,
  checkLossCondition,
  checkUnlockedMilestones,
  checkWinCondition,
  getUpgradeTierInfo,
  interpolatePathPosition,
  isTargetInRange,
  isTowerUnlocked,
} from './rules';
import { TOWER_CONFIGS, TOTAL_WAVES, SCORE_MILESTONES } from './constants';

test('Tower upgrade tiers scale stats correctly for Machine Gun', () => {
  const tier1 = calculateTowerStats('machine_gun', 1);
  const tier2 = calculateTowerStats('machine_gun', 2);
  const tier3 = calculateTowerStats('machine_gun', 3);

  assert.ok(tier2.damage > tier1.damage, 'Tier 2 damage should be higher than Tier 1');
  assert.ok(tier2.fireRate > tier1.fireRate, 'Tier 2 fire rate should be faster');
  assert.ok(tier3.damage > tier2.damage, 'Tier 3 damage should exceed Tier 2');
  assert.equal(tier3.canUpgrade, false, 'Tier 3 should be max level');
});

test('Tower upgrade tiers for Snipers increase range and crit chance', () => {
  const sniperT1 = calculateTowerStats('sniper', 1);
  const sniperT2 = calculateTowerStats('sniper', 2);
  const sniperT3 = calculateTowerStats('sniper', 3);

  assert.ok(sniperT2.range > sniperT1.range, 'Sniper Tier 2 has larger range');
  assert.ok(sniperT3.critChance > sniperT2.critChance, 'Sniper Tier 3 has higher crit chance');
  assert.equal(sniperT3.critChance, 0.40, 'Tier 3 sniper crit chance should be 40%');
});

test('Artillery and Tank tier upgrades scale blast radius and damage', () => {
  const artyT1 = calculateTowerStats('artillery', 1);
  const artyT3 = calculateTowerStats('artillery', 3);
  assert.ok(artyT3.splashRadius > artyT1.splashRadius, 'Tier 3 Artillery has bigger blast radius');

  const tankT1 = calculateTowerStats('tank', 1);
  const tankT3 = calculateTowerStats('tank', 3);
  assert.ok(tankT3.damage > tankT1.damage, 'Tier 3 Tank has devastating damage');
});

test('Permanent score milestone buffs apply to tower stats', () => {
  const mgWithoutBuff = calculateTowerStats('machine_gun', 1, []);
  const mgWithBuff = calculateTowerStats('machine_gun', 1, ['ms_mg_rate']);

  assert.ok(mgWithBuff.fireRate > mgWithoutBuff.fireRate, 'Milestone should boost MG fire rate by 20%');

  const sniperWithoutBuff = calculateTowerStats('sniper', 1, []);
  const sniperWithBuff = calculateTowerStats('sniper', 1, ['ms_sniper_range']);
  assert.ok(sniperWithBuff.range > sniperWithoutBuff.range, 'Milestone should boost Sniper range');
  assert.ok(sniperWithBuff.critChance > sniperWithoutBuff.critChance, 'Milestone should boost Sniper crit');
});

test('Upgrade costs and sell refunds behave accurately', () => {
  const costTier2 = calculateUpgradeCost('machine_gun', 1);
  assert.equal(costTier2, 130);

  const costTier3 = calculateUpgradeCost('machine_gun', 2);
  assert.equal(costTier3, 210);

  const costMax = calculateUpgradeCost('machine_gun', 3);
  assert.equal(costMax, 0, 'Max tier has 0 upgrade cost');

  const refund = calculateSellRefund('machine_gun', 1);
  assert.equal(refund, Math.round(100 * 0.7)); // 70
});

test('Score milestones unlock based on score thresholds', () => {
  const emptyUnlocks = checkUnlockedMilestones(200, []);
  assert.equal(emptyUnlocks.length, 0);

  const firstMilestone = checkUnlockedMilestones(600, []);
  assert.equal(firstMilestone.length, 1);
  assert.equal(firstMilestone[0].id, 'ms_mg_rate');

  const alreadyUnlocked = checkUnlockedMilestones(600, ['ms_mg_rate']);
  assert.equal(alreadyUnlocked.length, 0);

  const highMilestones = checkUnlockedMilestones(2000, []);
  assert.equal(highMilestones.length, 2); // ms_mg_rate (500) and ms_at_gun (1500)
});

test('Special defenses unlock condition checks work', () => {
  assert.equal(isTowerUnlocked('machine_gun', []), true);
  assert.equal(isTowerUnlocked('anti_tank_gun', []), false);
  assert.equal(isTowerUnlocked('anti_tank_gun', ['ms_at_gun']), true);
  assert.equal(isTowerUnlocked('katyusha_rocket', []), false);
  assert.equal(isTowerUnlocked('katyusha_rocket', ['ms_katyusha']), true);
});

test('Combat damage calculation respects armor and armor piercing', () => {
  // 100 raw damage vs 20 armor with 0% piercing -> 100 - 20 = 80
  const hit1 = calculateDamage(100, 0, 20, false);
  assert.equal(hit1.damage, 80);

  // 100 raw damage vs 20 armor with 50% piercing -> armor is effectively 10 -> 90 damage
  const hit2 = calculateDamage(100, 0.5, 20, false);
  assert.equal(hit2.damage, 90);

  // Critical hit doubles damage (2.2x multiplier)
  const critHit = calculateDamage(100, 0, 20, true);
  assert.equal(critHit.damage, Math.round(80 * 2.2));
  assert.equal(critHit.isCrit, true);
});

test('Path interpolation and range calculation function correctly', () => {
  const waypoints = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];
  const mid = interpolatePathPosition(waypoints, 50);
  assert.equal(mid.x, 50);
  assert.equal(mid.y, 0);
  assert.equal(mid.reachedEnd, false);

  const end = interpolatePathPosition(waypoints, 150);
  assert.equal(end.x, 100);
  assert.equal(end.reachedEnd, true);

  assert.equal(isTargetInRange({ x: 0, y: 0 }, { x: 30, y: 40 }, 50), true);
  assert.equal(isTargetInRange({ x: 0, y: 0 }, { x: 30, y: 40 }, 49), false);
});

test('Win and Loss conditions trigger precisely', () => {
  assert.equal(checkLossCondition(0), true);
  assert.equal(checkLossCondition(-5), true);
  assert.equal(checkLossCondition(10), false);

  assert.equal(checkWinCondition(TOTAL_WAVES, 0, true, 10), true);
  assert.equal(checkWinCondition(TOTAL_WAVES - 1, 0, true, 10), false);
  assert.equal(checkWinCondition(TOTAL_WAVES, 2, true, 10), false);
  assert.equal(checkWinCondition(TOTAL_WAVES, 0, false, 10), false);
  assert.equal(checkWinCondition(TOTAL_WAVES, 0, true, 0), false);
});
