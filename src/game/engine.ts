import { sound } from './audio';
import {
  CANVAS_VIRTUAL_HEIGHT,
  CANVAS_VIRTUAL_WIDTH,
  DEFAULT_PATH_WAYPOINTS,
  ENEMY_CONFIGS,
  INITIAL_BASE_HEALTH,
  INITIAL_SUPPLIES,
  INITIAL_TACTICAL_POINTS,
  SCORE_MILESTONES,
  TOTAL_WAVES,
  TOWER_CONFIGS,
  TOWER_SLOTS,
  WAVES,
} from './constants';
import {
  calculateDamage,
  calculateEndWaveScore,
  calculateScoreGain,
  calculateTowerStats,
  checkLossCondition,
  checkUnlockedMilestones,
  checkWinCondition,
  interpolatePathPosition,
  isTargetInRange,
} from './rules';
import {
  Decal,
  EnemyInstance,
  EnemyType,
  GameStats,
  Particle,
  Position,
  Projectile,
  ScoreMilestone,
  TacticalStrike,
  TowerInstance,
  TowerType,
} from './types';

export interface EngineCallbacks {
  onStatsUpdate: (stats: GameStats) => void;
  onSuppliesUpdate: (supplies: number) => void;
  onTacticalPointsUpdate: (tp: number) => void;
  onBaseHealthUpdate: (hp: number, maxHp: number) => void;
  onWaveUpdate: (wave: number, totalWaves: number, waveProgress: number, isSpawning: boolean) => void;
  onMilestoneUnlocked: (milestone: ScoreMilestone) => void;
  onGameOver: (stats: GameStats) => void;
  onVictory: (stats: GameStats) => void;
  onTowerSelected: (tower: TowerInstance | null) => void;
  onSlotSelected: (slotId: string | null) => void;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private gameSpeed: number = 1.0;

  // Game state
  public supplies: number = INITIAL_SUPPLIES;
  public tacticalPoints: number = INITIAL_TACTICAL_POINTS;
  public baseHealth: number = INITIAL_BASE_HEALTH;
  public maxBaseHealth: number = INITIAL_BASE_HEALTH;
  public currentWaveIndex: number = 0;
  public isSpawningWave: boolean = false;
  public isWaveActive: boolean = false;
  public waveTimeElapsed: number = 0;
  public activeEnemies: EnemyInstance[] = [];
  public towers: TowerInstance[] = [];
  public projectiles: Projectile[] = [];
  public particles: Particle[] = [];
  public decals: Decal[] = [];
  public floatingTexts: FloatingText[] = [];
  public tacticalStrikes: TacticalStrike[] = [];

  // Hitstop & Camera shake
  private hitstopTimer: number = 0;
  private trauma: number = 0; // 0 to 1

  // Player Stats & Scoring
  public stats: GameStats = {
    score: 0,
    highScore: 0,
    enemiesKilled: 0,
    tanksKilled: 0,
    officersKilled: 0,
    wavesCleared: 0,
    totalDamageDealt: 0,
    suppliesEarned: INITIAL_SUPPLIES,
    suppliesSpent: 0,
    unlockedMilestoneIds: [],
  };

  private tookDamageInCurrentWave: boolean = false;
  private currentCombo: number = 0;
  private comboResetTimer: number = 0;

  // Selected entities
  public selectedTowerId: string | null = null;
  public selectedSlotId: string | null = null;
  public hoveredSlotId: string | null = null;
  public buildPreviewType: TowerType | null = null;

  // Spawner queue for current wave
  private spawnQueue: { enemyType: EnemyType; spawnTime: number }[] = [];

  private callbacks: EngineCallbacks;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to get 2D context');
    this.ctx = context;
    this.callbacks = callbacks;

    // Load high score
    try {
      const savedHigh = localStorage.getItem('ww2_td_highscore');
      if (savedHigh) {
        this.stats.highScore = parseInt(savedHigh, 10) || 0;
      }
    } catch {}

    this.initPreplacedDecals();
  }

  private initPreplacedDecals() {
    // Cratering and war scars
    this.decals = [
      { x: 300, y: 180, radius: 26, type: 'crater', alpha: 0.6, angle: 0.4 },
      { x: 520, y: 380, radius: 32, type: 'crater', alpha: 0.7, angle: 1.2 },
      { x: 750, y: 190, radius: 28, type: 'crater', alpha: 0.5, angle: 2.1 },
      { x: 920, y: 360, radius: 34, type: 'crater', alpha: 0.65, angle: 0.8 },
      { x: 450, y: 480, radius: 22, type: 'scorch', alpha: 0.8, angle: 0 },
    ];
  }

  public start() {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  public setGameSpeed(speed: number) {
    this.gameSpeed = speed;
  }

  public getGameSpeed(): number {
    return this.gameSpeed;
  }

  // Starts the next wave
  public startNextWave(): boolean {
    if (this.isSpawningWave) return false;
    if (this.currentWaveIndex >= WAVES.length) return false;

    const waveDef = WAVES[this.currentWaveIndex];
    this.isSpawningWave = true;
    this.isWaveActive = true;
    this.waveTimeElapsed = 0;
    this.tookDamageInCurrentWave = false;
    this.spawnQueue = [];

    // Schedule spawns
    waveDef.spawns.forEach((group) => {
      let t = group.delayBefore;
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({
          enemyType: group.enemyType,
          spawnTime: t,
        });
        t += group.interval;
      }
    });

    // Sort by spawnTime
    this.spawnQueue.sort((a, b) => a.spawnTime - b.spawnTime);

    sound.playWaveAlert();
    this.callbacks.onWaveUpdate(this.currentWaveIndex + 1, TOTAL_WAVES, 0, true);
    return true;
  }

  // Call tactical airstrike or artillery barrage
  public triggerTacticalStrike(type: 'artillery_barrage' | 'air_strike', targetX: number, targetY: number): boolean {
    let cost = type === 'air_strike' ? 60 : 45;
    if (this.stats.unlockedMilestoneIds.includes('ms_air_doctrine')) {
      cost = Math.round(cost * 0.65); // -35% cost
    }

    if (this.tacticalPoints < cost) {
      return false;
    }

    this.tacticalPoints -= cost;
    this.callbacks.onTacticalPointsUpdate(this.tacticalPoints);

    if (type === 'air_strike') {
      sound.playAirstrike();
      this.tacticalStrikes.push({
        id: 'strike_' + Math.random(),
        type: 'air_strike',
        targetX,
        targetY,
        timer: 0,
        duration: 1.8,
        strikesCount: 0,
      });
      this.trauma = Math.min(1.0, this.trauma + 0.4);
    } else {
      sound.playArtillery();
      this.tacticalStrikes.push({
        id: 'barrage_' + Math.random(),
        type: 'artillery_barrage',
        targetX,
        targetY,
        timer: 0,
        duration: 2.2,
        strikesCount: 0,
      });
      this.trauma = Math.min(1.0, this.trauma + 0.5);
    }

    return true;
  }

  // Build a tower at a slot
  public buildTowerAtSlot(slotId: string, type: TowerType): boolean {
    const slot = TOWER_SLOTS.find((s) => s.id === slotId);
    if (!slot) return false;
    const existing = this.towers.find((t) => t.id === slotId);
    if (existing) return false;

    const config = TOWER_CONFIGS[type];
    if (this.supplies < config.cost) return false;

    this.supplies -= config.cost;
    this.stats.suppliesSpent += config.cost;
    this.callbacks.onSuppliesUpdate(this.supplies);
    this.callbacks.onStatsUpdate(this.stats);

    const newTower: TowerInstance = {
      id: slotId,
      type,
      x: slot.x,
      y: slot.y,
      level: 1,
      angle: -Math.PI / 2,
      lastShotTime: 0,
      targetId: null,
      totalDamageDealt: 0,
      kills: 0,
      priority: 'first',
    };

    this.towers.push(newTower);
    this.selectedTowerId = slotId;
    this.callbacks.onTowerSelected(newTower);
    sound.playBuild();

    // Spawn construction dirt/wood particles
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      this.particles.push({
        x: slot.x,
        y: slot.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 3 + Math.random() * 3,
        color: '#a16207',
        alpha: 1,
        type: 'dirt',
      });
    }

    return true;
  }

  // Upgrade selected tower
  public upgradeTower(towerId: string): boolean {
    const tower = this.towers.find((t) => t.id === towerId);
    if (!tower) return false;
    const stats = calculateTowerStats(tower.type, tower.level, this.stats.unlockedMilestoneIds);
    if (!stats.canUpgrade) return false;

    const nextTier = tower.level + 1;
    const cost = calculateTowerStats(tower.type, tower.level).canUpgrade
      ? calculateTowerStats(tower.type, tower.level).damage // or tiers
      : 0;

    // Use tier cost
    const upgradeCost = TOWER_CONFIGS[tower.type].cost * Math.pow(TOWER_CONFIGS[tower.type].upgradeCostMultiplier, tower.level);
    const finalCost = Math.round(upgradeCost);

    if (this.supplies < finalCost) return false;

    this.supplies -= finalCost;
    this.stats.suppliesSpent += finalCost;
    tower.level = nextTier;

    this.callbacks.onSuppliesUpdate(this.supplies);
    this.callbacks.onStatsUpdate(this.stats);
    this.callbacks.onTowerSelected({ ...tower });
    sound.playUpgrade();

    // Golden sparks
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x: tower.x,
        y: tower.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 2.5 + Math.random() * 3,
        color: '#fbbf24',
        alpha: 1,
        type: 'spark',
      });
    }

    this.floatingTexts.push({
      x: tower.x,
      y: tower.y - 25,
      text: `TIER ${tower.level}!`,
      color: '#fbbf24',
      life: 1.0,
      maxLife: 1.0,
      size: 16,
    });

    return true;
  }

  // Sell tower
  public sellTower(towerId: string): boolean {
    const index = this.towers.findIndex((t) => t.id === towerId);
    if (index === -1) return false;
    const tower = this.towers[index];
    const refund = Math.round(TOWER_CONFIGS[tower.type].cost * 0.7 * tower.level);

    this.supplies += refund;
    this.towers.splice(index, 1);
    this.selectedTowerId = null;

    this.callbacks.onSuppliesUpdate(this.supplies);
    this.callbacks.onTowerSelected(null);
    sound.playBuild();

    this.floatingTexts.push({
      x: tower.x,
      y: tower.y - 20,
      text: `+${refund} Aço`,
      color: '#34d399',
      life: 0.9,
      maxLife: 0.9,
      size: 14,
    });

    return true;
  }

  // Change tower target priority
  public setTowerPriority(towerId: string, priority: TowerInstance['priority']) {
    const tower = this.towers.find((t) => t.id === towerId);
    if (tower) {
      tower.priority = priority;
      this.callbacks.onTowerSelected({ ...tower });
    }
  }

  // Add score and check milestone thresholds
  private addScore(amount: number) {
    this.stats.score += amount;
    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
      try {
        localStorage.setItem('ww2_td_highscore', String(this.stats.highScore));
      } catch {}
    }

    // Check newly unlocked milestones
    const newMilestones = checkUnlockedMilestones(this.stats.score, this.stats.unlockedMilestoneIds);
    if (newMilestones.length > 0) {
      newMilestones.forEach((m) => {
        this.stats.unlockedMilestoneIds.push(m.id);
        sound.playMilestoneUnlock();
        this.callbacks.onMilestoneUnlocked(m);

        this.floatingTexts.push({
          x: CANVAS_VIRTUAL_WIDTH / 2,
          y: 120,
          text: `★ DOUTRINA DESBLOQUEADA: ${m.title}!`,
          color: '#facc15',
          life: 2.2,
          maxLife: 2.2,
          size: 18,
        });
      });
    }

    this.callbacks.onStatsUpdate(this.stats);
  }

  // Core Simulation Loop
  private loop = (timestamp: number) => {
    if (!this.isRunning) return;

    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Clamped dt (never exceed 0.05s)
    const dt = Math.min(rawDt, 0.05);

    if (!this.isPaused) {
      // Sim-level hitstop handling
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        const effectiveDt = dt * this.gameSpeed;
        this.update(effectiveDt);
      }
    }

    // Camera shake decay (ticks continuously in real dt)
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.5);
    }

    this.render();
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    // 1. Spawning
    if (this.isSpawningWave) {
      this.waveTimeElapsed += dt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].spawnTime <= this.waveTimeElapsed) {
        const next = this.spawnQueue.shift()!;
        this.spawnEnemy(next.enemyType);
      }

      if (this.spawnQueue.length === 0) {
        this.isSpawningWave = false;
        this.callbacks.onWaveUpdate(this.currentWaveIndex + 1, TOTAL_WAVES, 1.0, false);
      } else {
        const total = WAVES[this.currentWaveIndex].spawns.reduce((sum, g) => sum + g.count, 0);
        const remaining = this.spawnQueue.length;
        const progress = Math.max(0, Math.min(1.0, (total - remaining) / total));
        this.callbacks.onWaveUpdate(this.currentWaveIndex + 1, TOTAL_WAVES, progress, true);
      }
    }

    // Combo timer
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) {
        this.currentCombo = 0;
      }
    }

    // Tactical points trickle (+1 TP every 2 seconds)
    this.tacticalPoints = Math.min(100, this.tacticalPoints + dt * 0.7);
    this.callbacks.onTacticalPointsUpdate(Math.round(this.tacticalPoints));

    // 2. Update Enemies
    const officers = this.activeEnemies.filter((e) => e.type === 'officer' && !e.isDead);

    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];

      // Death animation
      if (enemy.isDead) {
        enemy.deathTimer -= dt;
        if (enemy.deathTimer <= 0) {
          this.activeEnemies.splice(i, 1);
        }
        continue;
      }

      // Hit flash decay
      if (enemy.hitFlashTimer > 0) {
        enemy.hitFlashTimer -= dt;
      }

      // Slow timer decay (barbed wire)
      let speedMultiplier = 1.0;
      if (enemy.slowTimer > 0) {
        enemy.slowTimer -= dt;
        speedMultiplier = 0.45; // 55% slow
      }

      // Check Officer Aura: if within 140px of any officer
      let isBuffed = false;
      for (const off of officers) {
        if (off.id !== enemy.id) {
          const dx = off.x - enemy.x;
          const dy = off.y - enemy.y;
          if (dx * dx + dy * dy <= 140 * 140) {
            isBuffed = true;
            break;
          }
        }
      }
      enemy.buffedByOfficer = isBuffed;
      if (isBuffed) {
        speedMultiplier *= 1.3;
      }

      // Advance along path
      enemy.distanceTravelled += enemy.speed * speedMultiplier * dt;
      const pos = interpolatePathPosition(DEFAULT_PATH_WAYPOINTS, enemy.distanceTravelled);
      enemy.x = pos.x;
      enemy.y = pos.y;
      enemy.angle = pos.angle;

      // Reached Allied HQ Bunker!
      if (pos.reachedEnd) {
        const damageToBase = enemy.type === 'panzer_tank' ? 5 : enemy.type === 'halftrack' ? 3 : 1;
        this.baseHealth = Math.max(0, this.baseHealth - damageToBase);
        this.tookDamageInCurrentWave = true;
        this.trauma = Math.min(1.0, this.trauma + 0.6);
        this.hitstopTimer = 0.06;
        sound.playExplosion(true);

        this.floatingTexts.push({
          x: pos.x - 30,
          y: pos.y,
          text: `-${damageToBase} QG!`,
          color: '#ef4444',
          life: 1.2,
          maxLife: 1.2,
          size: 20,
        });

        this.callbacks.onBaseHealthUpdate(this.baseHealth, this.maxBaseHealth);

        // Remove enemy
        this.activeEnemies.splice(i, 1);

        if (checkLossCondition(this.baseHealth)) {
          this.callbacks.onGameOver(this.stats);
          return;
        }
      }
    }

    // 3. Update Towers & Target Acquisition
    const currentTime = performance.now() / 1000;
    for (const tower of this.towers) {
      const stats = calculateTowerStats(tower.type, tower.level, this.stats.unlockedMilestoneIds);

      // Trench wire slows and damages in radius automatically
      if (tower.type === 'trench_wire') {
        for (const enemy of this.activeEnemies) {
          if (enemy.isDead) continue;
          if (isTargetInRange(tower, enemy, stats.range)) {
            enemy.slowTimer = 0.6;
            // Continuous bleed damage
            const bleedDmg = Math.max(1, Math.round(stats.damage * dt));
            enemy.hp -= bleedDmg;
            tower.totalDamageDealt += bleedDmg;
            this.stats.totalDamageDealt += bleedDmg;

            if (enemy.hp <= 0) {
              this.killEnemy(enemy, tower);
            }
          }
        }
        continue;
      }

      // Find best target based on priority
      const candidates = this.activeEnemies.filter((e) => !e.isDead && isTargetInRange(tower, e, stats.range));

      let target: EnemyInstance | null = null;
      if (candidates.length > 0) {
        if (tower.priority === 'first') {
          // furthest along the path
          candidates.sort((a, b) => b.distanceTravelled - a.distanceTravelled);
          target = candidates[0];
        } else if (tower.priority === 'strongest') {
          candidates.sort((a, b) => b.hp - a.hp);
          target = candidates[0];
        } else if (tower.priority === 'closest') {
          candidates.sort((a, b) => {
            const da = (a.x - tower.x) ** 2 + (a.y - tower.y) ** 2;
            const db = (b.x - tower.x) ** 2 + (b.y - tower.y) ** 2;
            return da - db;
          });
          target = candidates[0];
        } else if (tower.priority === 'lowest_hp') {
          candidates.sort((a, b) => a.hp - b.hp);
          target = candidates[0];
        }
      }

      tower.targetId = target ? target.id : null;

      if (target) {
        // Rotate turret towards target
        const targetAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
        tower.angle = targetAngle;

        // Check fire rate
        const timeSinceShot = currentTime - tower.lastShotTime;
        const cooldown = 1.0 / stats.fireRate;

        if (timeSinceShot >= cooldown) {
          tower.lastShotTime = currentTime;
          this.fireTowerShot(tower, target, stats);
        }
      }
    }

    // 4. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.progress += proj.speed * dt;

      if (proj.progress >= 1.0) {
        // Projectile reached target!
        this.handleProjectileImpact(proj);
        this.projectiles.splice(i, 1);
      } else {
        // Update current position
        proj.x = proj.startX + (proj.targetX - proj.startX) * proj.progress;
        proj.y = proj.startY + (proj.targetY - proj.startY) * proj.progress;

        // Trail smoke/sparks
        if (proj.type === 'artillery_shell' || proj.type === 'rocket') {
          this.particles.push({
            x: proj.x,
            y: proj.y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 0.25,
            maxLife: 0.25,
            size: proj.type === 'rocket' ? 4 : 3,
            color: proj.type === 'rocket' ? '#f97316' : '#94a3b8',
            alpha: 0.6,
            type: 'smoke',
          });
        }
      }
    }

    // 5. Update Tactical Strikes
    for (let i = this.tacticalStrikes.length - 1; i >= 0; i--) {
      const strike = this.tacticalStrikes[i];
      strike.timer += dt;

      if (strike.type === 'air_strike') {
        // P-47 Thunderbolt rocket & strafe passes
        if (strike.timer > 0.4 && strike.strikesCount === 0) {
          strike.strikesCount++;
          this.explodeAt(strike.targetX - 50, strike.targetY, 90, 180, 0.8);
          this.hitstopTimer = 0.04;
        } else if (strike.timer > 0.7 && strike.strikesCount === 1) {
          strike.strikesCount++;
          this.explodeAt(strike.targetX, strike.targetY, 110, 240, 0.85);
          this.hitstopTimer = 0.05;
        } else if (strike.timer > 1.0 && strike.strikesCount === 2) {
          strike.strikesCount++;
          this.explodeAt(strike.targetX + 50, strike.targetY, 90, 180, 0.8);
          this.hitstopTimer = 0.04;
        }
      } else {
        // Artillery barrage: 5 heavy shells raining down
        const shellInterval = 0.35;
        const requiredShells = Math.floor(strike.timer / shellInterval);
        while (strike.strikesCount < requiredShells && strike.strikesCount < 5) {
          strike.strikesCount++;
          const offsetX = (Math.random() - 0.5) * 120;
          const offsetY = (Math.random() - 0.5) * 90;
          this.explodeAt(strike.targetX + offsetX, strike.targetY + offsetY, 80, 160, 0.75);
          sound.playExplosion(false);
          this.trauma = Math.min(1.0, this.trauma + 0.25);
        }
      }

      if (strike.timer >= strike.duration) {
        this.tacticalStrikes.splice(i, 1);
      }
    }

    // 6. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = p.life / p.maxLife;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }

    // 7. Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 25 * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 8. Check Wave Clear (only when a wave was actively started)
    if (this.isWaveActive && !this.isSpawningWave && this.spawnQueue.length === 0 && this.activeEnemies.length === 0) {
      this.isWaveActive = false;
      if (this.currentWaveIndex < WAVES.length) {
        this.handleWaveCompleted();
      }
    }
  }

  private handleWaveCompleted() {
    const waveDef = WAVES[this.currentWaveIndex];
    const waveNum = this.currentWaveIndex + 1;
    this.stats.wavesCleared = waveNum;

    const scoreResults = calculateEndWaveScore(
      waveNum,
      waveDef.rewardScore,
      this.baseHealth,
      this.maxBaseHealth,
      this.tookDamageInCurrentWave
    );

    this.addScore(scoreResults.totalScore);
    this.supplies += waveDef.rewardSupplies;
    this.stats.suppliesEarned += waveDef.rewardSupplies;

    this.callbacks.onSuppliesUpdate(this.supplies);

    let message = `ONDA ${waveNum} VENCIDA! +${waveDef.rewardSupplies} Aço · +${scoreResults.totalScore} Pts`;
    if (!this.tookDamageInCurrentWave) {
      message += ' ★ DEFESA IMPECÁVEL!';
    }

    this.floatingTexts.push({
      x: CANVAS_VIRTUAL_WIDTH / 2,
      y: CANVAS_VIRTUAL_HEIGHT / 2 - 40,
      text: message,
      color: '#4ade80',
      life: 2.5,
      maxLife: 2.5,
      size: 20,
    });

    this.currentWaveIndex++;

    if (checkWinCondition(this.currentWaveIndex, 0, true, this.baseHealth)) {
      this.callbacks.onVictory(this.stats);
    } else {
      this.callbacks.onWaveUpdate(this.currentWaveIndex + 1, TOTAL_WAVES, 0, false);
    }
  }

  private fireTowerShot(
    tower: TowerInstance,
    target: EnemyInstance,
    stats: ReturnType<typeof calculateTowerStats>
  ) {
    const isCrit = Math.random() < stats.critChance;

    if (tower.type === 'machine_gun') {
      sound.playMachineGun();
      this.projectiles.push({
        id: 'bullet_' + Math.random(),
        x: tower.x,
        y: tower.y,
        startX: tower.x,
        startY: tower.y,
        targetX: target.x + (Math.random() - 0.5) * 12,
        targetY: target.y + (Math.random() - 0.5) * 12,
        targetEnemyId: target.id,
        speed: 7.5,
        progress: 0,
        damage: stats.damage,
        splashRadius: 0,
        armorPiercing: stats.armorPiercing,
        arcHeight: 0,
        type: 'bullet',
      });
      // Muzzle flash particle
      this.particles.push({
        x: tower.x + Math.cos(tower.angle) * 16,
        y: tower.y + Math.sin(tower.angle) * 16,
        vx: Math.cos(tower.angle) * 30,
        vy: Math.sin(tower.angle) * 30,
        life: 0.08,
        maxLife: 0.08,
        size: 5,
        color: '#fbbf24',
        alpha: 1,
        type: 'fire',
      });
    } else if (tower.type === 'sniper') {
      sound.playSniper();
      this.projectiles.push({
        id: 'sniper_' + Math.random(),
        x: tower.x,
        y: tower.y,
        startX: tower.x,
        startY: tower.y,
        targetX: target.x,
        targetY: target.y,
        targetEnemyId: target.id,
        speed: 14.0, // High supersonic velocity
        progress: 0,
        damage: isCrit ? Math.round(stats.damage * 2.5) : stats.damage,
        splashRadius: 0,
        armorPiercing: stats.armorPiercing,
        arcHeight: 0,
        type: 'sniper_tracer',
      });
      if (isCrit) {
        this.floatingTexts.push({
          x: target.x,
          y: target.y - 18,
          text: 'CRÍTICO!',
          color: '#ef4444',
          life: 0.8,
          maxLife: 0.8,
          size: 15,
        });
      }
    } else if (tower.type === 'artillery') {
      sound.playArtillery();
      this.projectiles.push({
        id: 'artillery_' + Math.random(),
        x: tower.x,
        y: tower.y,
        startX: tower.x,
        startY: tower.y,
        targetX: target.x,
        targetY: target.y,
        targetEnemyId: null,
        speed: 1.8,
        progress: 0,
        damage: stats.damage,
        splashRadius: stats.splashRadius,
        armorPiercing: stats.armorPiercing,
        arcHeight: 80,
        type: 'artillery_shell',
      });
    } else if (tower.type === 'tank') {
      sound.playTankShot();
      this.trauma = Math.min(1.0, this.trauma + 0.15);
      this.projectiles.push({
        id: 'tank_' + Math.random(),
        x: tower.x,
        y: tower.y,
        startX: tower.x,
        startY: tower.y,
        targetX: target.x,
        targetY: target.y,
        targetEnemyId: null,
        speed: 5.5,
        progress: 0,
        damage: stats.damage,
        splashRadius: stats.splashRadius,
        armorPiercing: stats.armorPiercing,
        arcHeight: 0,
        type: 'tank_shell',
      });
    } else if (tower.type === 'anti_tank_gun') {
      sound.playAntiTank();
      this.trauma = Math.min(1.0, this.trauma + 0.2);
      this.projectiles.push({
        id: 'at_' + Math.random(),
        x: tower.x,
        y: tower.y,
        startX: tower.x,
        startY: tower.y,
        targetX: target.x,
        targetY: target.y,
        targetEnemyId: null,
        speed: 9.0,
        progress: 0,
        damage: stats.damage,
        splashRadius: stats.splashRadius,
        armorPiercing: stats.armorPiercing,
        arcHeight: 0,
        type: 'at_round',
      });
    } else if (tower.type === 'katyusha_rocket') {
      sound.playKatyushaRocket();
      // Fire 3 rockets with slight spread
      for (let r = 0; r < 3; r++) {
        setTimeout(() => {
          if (!this.isRunning) return;
          this.projectiles.push({
            id: 'rocket_' + Math.random(),
            x: tower.x,
            y: tower.y,
            startX: tower.x,
            startY: tower.y,
            targetX: target.x + (Math.random() - 0.5) * 50,
            targetY: target.y + (Math.random() - 0.5) * 50,
            targetEnemyId: null,
            speed: 2.2 + r * 0.4,
            progress: 0,
            damage: Math.round(stats.damage * 0.8),
            splashRadius: stats.splashRadius,
            armorPiercing: stats.armorPiercing,
            arcHeight: 60,
            type: 'rocket',
          });
        }, r * 80);
      }
    }
  }

  private handleProjectileImpact(proj: Projectile) {
    if (proj.splashRadius > 0) {
      // Area of Effect splash explosion
      this.explodeAt(proj.targetX, proj.targetY, proj.splashRadius, proj.damage, proj.armorPiercing);
      sound.playExplosion(proj.damage > 120);
    } else {
      // Single target hit
      const target = this.activeEnemies.find((e) => e.id === proj.targetEnemyId && !e.isDead);
      if (target) {
        const result = calculateDamage(proj.damage, proj.armorPiercing, target.armor, false);
        target.hp -= result.damage;
        target.hitFlashTimer = 0.08;
        this.stats.totalDamageDealt += result.damage;

        // Blood/dirt hit burst
        for (let i = 0; i < 4; i++) {
          this.particles.push({
            x: target.x,
            y: target.y,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            life: 0.2,
            maxLife: 0.2,
            size: 2.5,
            color: '#dc2626',
            alpha: 1,
            type: 'blood',
          });
        }

        if (target.hp <= 0) {
          this.killEnemy(target);
        }
      }
    }
  }

  private explodeAt(x: number, y: number, radius: number, rawDamage: number, armorPiercing: number) {
    // Add permanent/fade crater decal
    this.decals.push({
      x,
      y,
      radius: Math.min(45, radius * 0.45),
      type: 'crater',
      alpha: 0.75,
      angle: Math.random() * Math.PI * 2,
    });
    if (this.decals.length > 25) this.decals.shift();

    // Heavy explosion particles
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 3 + Math.random() * 5,
        color: i % 2 === 0 ? '#f97316' : '#fbbf24',
        alpha: 1,
        type: 'fire',
      });
    }

    // Damage all enemies in radius with falloff
    for (const enemy of this.activeEnemies) {
      if (enemy.isDead) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius) {
        const dist = Math.sqrt(distSq);
        const falloff = 1.0 - (dist / radius) * 0.4; // At edge deals at least 60%
        const finalRaw = rawDamage * falloff;
        const result = calculateDamage(finalRaw, armorPiercing, enemy.armor, false);
        enemy.hp -= result.damage;
        enemy.hitFlashTimer = 0.1;
        this.stats.totalDamageDealt += result.damage;

        if (enemy.hp <= 0) {
          this.killEnemy(enemy);
        }
      }
    }
  }

  private killEnemy(enemy: EnemyInstance, killingTower?: TowerInstance) {
    if (enemy.isDead) return;
    enemy.isDead = true;
    enemy.deathTimer = 0.35; // Topple animation

    this.stats.enemiesKilled++;
    if (enemy.type === 'panzer_tank') {
      this.stats.tanksKilled++;
      this.hitstopTimer = 0.08;
      this.trauma = Math.min(1.0, this.trauma + 0.4);
      sound.playExplosion(true);
    } else if (enemy.type === 'officer') {
      this.stats.officersKilled++;
    }

    // Combo and score
    this.currentCombo++;
    this.comboResetTimer = 2.5; // combo window
    const scoreEarned = calculateScoreGain(enemy.type, false, this.currentCombo);
    this.addScore(scoreEarned);

    // Bounty supplies
    const cfg = ENEMY_CONFIGS[enemy.type];
    this.supplies += cfg.bounty;
    this.stats.suppliesEarned += cfg.bounty;
    this.callbacks.onSuppliesUpdate(this.supplies);

    if (killingTower) {
      killingTower.kills++;
    }

    // Floating text
    this.floatingTexts.push({
      x: enemy.x,
      y: enemy.y - 15,
      text: `+${scoreEarned} Pts (+${cfg.bounty} Aço)`,
      color: '#fbbf24',
      life: 0.8,
      maxLife: 0.8,
      size: 13,
    });

    // Flamethrower death explosion: fuel tank detonates!
    if (enemy.type === 'flamethrower') {
      this.explodeAt(enemy.x, enemy.y, 65, 90, 0.5);
      sound.playExplosion(false);
    }

    // Halftrack death spawns 2 recruits
    if (enemy.type === 'halftrack') {
      for (let r = 0; r < 2; r++) {
        const spawned: EnemyInstance = {
          id: 'sp_recruit_' + Math.random(),
          type: 'recruit',
          x: enemy.x + (r === 0 ? -15 : 15),
          y: enemy.y + (r === 0 ? -15 : 15),
          hp: 45,
          maxHp: 45,
          speed: 68,
          armor: 2,
          pathIndex: enemy.pathIndex,
          distanceTravelled: enemy.distanceTravelled - 10 * r,
          angle: enemy.angle,
          hitFlashTimer: 0,
          slowTimer: 0,
          buffedByOfficer: false,
          isDead: false,
          deathTimer: 0,
        };
        this.activeEnemies.push(spawned);
      }
    }
  }

  private spawnEnemy(type: EnemyType) {
    const cfg = ENEMY_CONFIGS[type];
    const initialPos = DEFAULT_PATH_WAYPOINTS[0];
    const newEnemy: EnemyInstance = {
      id: 'enemy_' + Math.random(),
      type,
      x: initialPos.x,
      y: initialPos.y,
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
      speed: cfg.speed,
      armor: cfg.armor,
      pathIndex: 0,
      distanceTravelled: 0,
      angle: 0,
      hitFlashTimer: 0,
      slowTimer: 0,
      buffedByOfficer: false,
      isDead: false,
      deathTimer: 0,
    };
    this.activeEnemies.push(newEnemy);
  }

  // Canvas Rendering
  private render() {
    const ctx = this.ctx;
    ctx.save();

    // Camera shake application
    if (this.trauma > 0) {
      const shakeMagnitude = this.trauma * this.trauma * 14;
      const ox = (Math.random() * 2 - 1) * shakeMagnitude;
      const oy = (Math.random() * 2 - 1) * shakeMagnitude;
      ctx.translate(ox, oy);
    }

    // 1. Draw Battlefield Terrain (Mud, Trenches, Roads)
    this.renderTerrain(ctx);

    // 2. Draw Decals (Craters, Scorch marks)
    this.renderDecals(ctx);

    // 3. Draw Placement Slots & Range Previews
    this.renderSlots(ctx);

    // 4. Draw Waypoint Route & Trenches
    this.renderPath(ctx);

    // 5. Draw Towers
    for (const tower of this.towers) {
      this.renderTower(ctx, tower);
    }

    // 6. Draw Enemies
    for (const enemy of this.activeEnemies) {
      this.renderEnemy(ctx, enemy);
    }

    // 7. Draw Projectiles
    this.renderProjectiles(ctx);

    // 8. Draw Tactical Strikes
    this.renderTacticalStrikes(ctx);

    // 9. Draw Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 10. Draw Floating Numbers
    for (const ft of this.floatingTexts) {
      ctx.save();
      const progress = ft.life / ft.maxLife;
      ctx.globalAlpha = Math.min(1.0, progress * 1.5);
      ctx.font = `bold ${ft.size}px 'Chakra Petch', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  private renderTerrain(ctx: CanvasRenderingContext2D) {
    // Base mud/dirt earth tone
    ctx.fillStyle = '#26211a';
    ctx.fillRect(0, 0, CANVAS_VIRTUAL_WIDTH, CANVAS_VIRTUAL_HEIGHT);

    // Topographic/dirt contour gradients
    const grad = ctx.createRadialGradient(
      CANVAS_VIRTUAL_WIDTH / 2,
      CANVAS_VIRTUAL_HEIGHT / 2,
      50,
      CANVAS_VIRTUAL_WIDTH / 2,
      CANVAS_VIRTUAL_HEIGHT / 2,
      700
    );
    grad.addColorStop(0, 'rgba(60, 52, 42, 0.4)');
    grad.addColorStop(1, 'rgba(20, 17, 13, 0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_VIRTUAL_WIDTH, CANVAS_VIRTUAL_HEIGHT);

    // Trench network grid lines & tactical coordinate marks
    ctx.strokeStyle = 'rgba(120, 100, 80, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_VIRTUAL_WIDTH; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_VIRTUAL_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_VIRTUAL_HEIGHT; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_VIRTUAL_WIDTH, y);
      ctx.stroke();
    }
  }

  private renderDecals(ctx: CanvasRenderingContext2D) {
    for (const decal of this.decals) {
      ctx.save();
      ctx.translate(decal.x, decal.y);
      ctx.rotate(decal.angle);
      ctx.globalAlpha = decal.alpha;

      // Outer scorched rim
      ctx.fillStyle = '#171410';
      ctx.beginPath();
      ctx.arc(0, 0, decal.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner crater depth
      ctx.fillStyle = '#0a0907';
      ctx.beginPath();
      ctx.arc(0, 0, decal.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderPath(ctx: CanvasRenderingContext2D) {
    const pts = DEFAULT_PATH_WAYPOINTS;
    if (pts.length < 2) return;

    // Dirt trench road bed
    ctx.save();
    ctx.strokeStyle = '#382f24';
    ctx.lineWidth = 42;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    // Trench channel
    ctx.strokeStyle = '#221c16';
    ctx.lineWidth = 30;
    ctx.stroke();

    // Wooden duckboards along center of path
    ctx.strokeStyle = '#45382b';
    ctx.lineWidth = 14;
    ctx.setLineDash([8, 12]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Allied HQ Bunker at destination
    const hq = pts[pts.length - 1];
    ctx.save();
    ctx.translate(hq.x - 30, hq.y);

    // Bunker concrete walls
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(-35, -45, 70, 90);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 3;
    ctx.strokeRect(-35, -45, 70, 90);

    // Sandbag perimeter
    ctx.fillStyle = '#a16207';
    for (let sy = -40; sy <= 40; sy += 18) {
      ctx.beginPath();
      ctx.ellipse(-42, sy, 7, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Allied Star / Emblem (geometric 5-point star)
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    for (let s = 0; s < 5; s++) {
      const aOuter = (s * 4 * Math.PI) / 5 - Math.PI / 2;
      const sx = Math.cos(aOuter) * 12;
      const sy = -10 + Math.sin(aOuter) * 12;
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px "Chakra Petch", sans-serif';
    ctx.fillText('QG ALIADO', 0, 18);

    // Health bar above bunker
    const barWidth = 60;
    const hpRatio = Math.max(0, this.baseHealth / this.maxBaseHealth);
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(-barWidth / 2, -60, barWidth, 7);
    ctx.fillStyle = hpRatio > 0.4 ? '#22c55e' : '#ef4444';
    ctx.fillRect(-barWidth / 2, -60, barWidth * hpRatio, 7);
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 1;
    ctx.strokeRect(-barWidth / 2, -60, barWidth, 7);

    ctx.restore();
    ctx.restore();
  }

  private renderSlots(ctx: CanvasRenderingContext2D) {
    for (const slot of TOWER_SLOTS) {
      const isOccupied = this.towers.some((t) => t.id === slot.id);
      const isSelected = this.selectedSlotId === slot.id;
      const isHovered = this.hoveredSlotId === slot.id;

      if (!isOccupied) {
        ctx.save();
        ctx.translate(slot.x, slot.y);

        // Sandbag ring
        ctx.strokeStyle = isSelected ? '#fbbf24' : isHovered ? '#60a5fa' : 'rgba(161, 98, 7, 0.4)';
        ctx.fillStyle = 'rgba(30, 26, 20, 0.85)';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Sandbags visual texture
        ctx.fillStyle = '#78350f';
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 26, Math.sin(a) * 26, 6, 9, a, 0, Math.PI * 2);
          ctx.fill();
        }

        // Plus icon or label
        ctx.fillStyle = isSelected ? '#fbbf24' : '#9ca3af';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', 0, 0);

        ctx.restore();
      }
    }

    // Selected tower range ring
    if (this.selectedTowerId) {
      const t = this.towers.find((tw) => tw.id === this.selectedTowerId);
      if (t) {
        const stats = calculateTowerStats(t.type, t.level, this.stats.unlockedMilestoneIds);
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
        ctx.fillStyle = 'rgba(250, 204, 21, 0.05)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(t.x, t.y, stats.range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private renderTower(ctx: CanvasRenderingContext2D, tower: TowerInstance) {
    const isSelected = this.selectedTowerId === tower.id;
    ctx.save();
    ctx.translate(tower.x, tower.y);

    // Selected ring
    if (isSelected) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 1. Base / Emplacement
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sandbags around base
    ctx.fillStyle = '#854d0e';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 20, Math.sin(a) * 20, 5, 8, a, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Rotating Turret / Gun Barrel
    ctx.save();
    ctx.rotate(tower.angle);

    if (tower.type === 'machine_gun') {
      // Dual barrel M2 Browning
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(4, -4, 18, 3);
      ctx.fillRect(4, 1, 18, 3);
      // Gun mount
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (tower.type === 'sniper') {
      // Long rifle barrel + sniper scope
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, -2, 28, 4);
      // Scope glint
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(10, -5, 8, 2);
      // Sniper nest camouflage netting
      ctx.fillStyle = '#3f6212';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (tower.type === 'artillery') {
      // Heavy 105mm Howitzer barrel with muzzle brake
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, -6, 26, 12);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(24, -8, 5, 16); // muzzle brake
      // Heavy recoil spring housing
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(-2, 0, 13, 0, Math.PI * 2);
      ctx.fill();
    } else if (tower.type === 'tank') {
      // Sherman tank turret
      ctx.fillStyle = '#365314'; // olive drab
      ctx.fillRect(-14, -12, 24, 24);
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 2;
      ctx.strokeRect(-14, -12, 24, 24);
      // Cannon
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(8, -3.5, 24, 7);
      // Hatch
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(-2, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (tower.type === 'anti_tank_gun') {
      // Gun shield + long anti-tank barrel
      ctx.fillStyle = '#334155';
      ctx.fillRect(4, -14, 5, 28); // armor plate shield
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, -3, 30, 6); // high velocity barrel
    } else if (tower.type === 'katyusha_rocket') {
      // Multi-rail rack with rockets
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-10, -10, 24, 20);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(2, -8, 18, 3);
      ctx.fillRect(2, -3, 18, 3);
      ctx.fillRect(2, 2, 18, 3);
      ctx.fillRect(2, 7, 18, 3);
    } else if (tower.type === 'trench_wire') {
      // Trench & Barbed wire barricade
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-18, -6, 36, 12);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-18, -6);
      ctx.lineTo(18, 6);
      ctx.moveTo(-18, 6);
      ctx.lineTo(18, -6);
      ctx.stroke();
    }

    ctx.restore();

    // Level pips (Tier 1, 2, 3)
    for (let lvl = 0; lvl < tower.level; lvl++) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(-8 + lvl * 8, 26, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyInstance) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle);

    // Hit flash: pure white overlay
    if (enemy.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, ENEMY_CONFIGS[enemy.type].radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Death dissolve / topple
    if (enemy.isDead) {
      ctx.globalAlpha = Math.max(0, enemy.deathTimer / 0.35);
      ctx.scale(1.2, 0.4); // flatten on ground
    }

    // Officer Aura ring
    if (enemy.type === 'officer' && !enemy.isDead) {
      ctx.save();
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
      ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw unit model by type
    if (enemy.type === 'recruit' || enemy.type === 'officer' || enemy.type === 'sapper') {
      // Body / uniform
      ctx.fillStyle = ENEMY_CONFIGS[enemy.type].color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      // Stalhelm Helmet
      ctx.fillStyle = enemy.type === 'officer' ? '#ca8a04' : '#334155';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rifle
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(4, 3, 12, 2.5);

      if (enemy.type === 'sapper') {
        // Red dynamite pack
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-7, -4, 5, 8);
      }
    } else if (enemy.type === 'shock_troop') {
      // Steel body shield & armor
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Shield plate
      ctx.fillStyle = '#64748b';
      ctx.fillRect(5, -10, 5, 20);
    } else if (enemy.type === 'flamethrower') {
      // Fuel canisters on back
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      // Dual gas tanks
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-10, -7, 6, 5);
      ctx.fillRect(-10, 2, 6, 5);
      // Flame nozzle
      ctx.fillStyle = '#78350f';
      ctx.fillRect(4, 2, 14, 3);
    } else if (enemy.type === 'halftrack') {
      // Armored half-track vehicle
      ctx.fillStyle = '#52525b';
      ctx.fillRect(-18, -11, 36, 22);
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 2;
      ctx.strokeRect(-18, -11, 36, 22);
      // Front wheels & rear tracks
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-16, -13, 8, 4);
      ctx.fillRect(-16, 9, 8, 4);
      ctx.fillRect(2, -13, 14, 4);
      ctx.fillRect(2, 9, 14, 4);
      // Machine gunner hatch
      ctx.fillStyle = '#71717a';
      ctx.beginPath();
      ctx.arc(2, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === 'panzer_tank') {
      // Panzer IV heavy hull
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(-24, -16, 48, 32);
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-24, -16, 48, 32);
      // Treads
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-24, -18, 48, 4);
      ctx.fillRect(-24, 14, 48, 4);
      // Heavy Turret & 75mm Cannon
      ctx.fillStyle = '#27272a';
      ctx.beginPath();
      ctx.arc(2, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(10, -3.5, 28, 7);
      // German Balkenkreuz cross on hull
      ctx.fillStyle = '#e4e4e7';
      ctx.fillRect(-12, -4, 8, 2);
      ctx.fillRect(-9, -7, 2, 8);
    }

    ctx.restore();

    // Health bar above enemy (not rotated)
    if (!enemy.isDead && enemy.hp < enemy.maxHp) {
      const barW = Math.max(22, ENEMY_CONFIGS[enemy.type].radius * 2);
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(enemy.x - barW / 2, enemy.y - ENEMY_CONFIGS[enemy.type].radius - 12, barW, 4);
      ctx.fillStyle = ratio > 0.4 ? '#22c55e' : '#ef4444';
      ctx.fillRect(enemy.x - barW / 2, enemy.y - ENEMY_CONFIGS[enemy.type].radius - 12, barW * ratio, 4);
      ctx.restore();
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D) {
    for (const proj of this.projectiles) {
      ctx.save();
      if (proj.type === 'bullet') {
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (proj.type === 'sniper_tracer') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(proj.startX, proj.startY);
        ctx.lineTo(proj.x, proj.y);
        ctx.stroke();
      } else if (proj.type === 'artillery_shell') {
        // High parabolic arc with shadow
        const arcY = Math.sin(proj.progress * Math.PI) * proj.arcHeight;
        // Shadow on ground
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(proj.x, proj.y, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Shell in air
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y - arcY, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (proj.type === 'tank_shell' || proj.type === 'at_round') {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (proj.type === 'rocket') {
        const arcY = Math.sin(proj.progress * Math.PI) * proj.arcHeight;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y - arcY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderTacticalStrikes(ctx: CanvasRenderingContext2D) {
    for (const strike of this.tacticalStrikes) {
      ctx.save();
      // Target reticle on ground
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(strike.targetX, strike.targetY, 70, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(strike.targetX - 20, strike.targetY);
      ctx.lineTo(strike.targetX + 20, strike.targetY);
      ctx.moveTo(strike.targetX, strike.targetY - 20);
      ctx.lineTo(strike.targetX, strike.targetY + 20);
      ctx.stroke();

      ctx.restore();
    }
  }

  // Handle click on canvas
  public handleCanvasClick(worldX: number, worldY: number) {
    // 1. Check if clicked an existing tower
    for (const tower of this.towers) {
      const dx = tower.x - worldX;
      const dy = tower.y - worldY;
      if (dx * dx + dy * dy <= 28 * 28) {
        this.selectedTowerId = tower.id;
        this.selectedSlotId = null;
        this.callbacks.onTowerSelected({ ...tower });
        this.callbacks.onSlotSelected(null);
        return;
      }
    }

    // 2. Check if clicked an empty slot
    for (const slot of TOWER_SLOTS) {
      const isOccupied = this.towers.some((t) => t.id === slot.id);
      if (!isOccupied) {
        const dx = slot.x - worldX;
        const dy = slot.y - worldY;
        if (dx * dx + dy * dy <= 30 * 30) {
          this.selectedSlotId = slot.id;
          this.selectedTowerId = null;
          this.callbacks.onSlotSelected(slot.id);
          this.callbacks.onTowerSelected(null);
          return;
        }
      }
    }

    // Deselect if clicked empty ground
    this.selectedTowerId = null;
    this.selectedSlotId = null;
    this.callbacks.onTowerSelected(null);
    this.callbacks.onSlotSelected(null);
  }

  public handleCanvasMouseMove(worldX: number, worldY: number) {
    let hovered: string | null = null;
    for (const slot of TOWER_SLOTS) {
      const isOccupied = this.towers.some((t) => t.id === slot.id);
      if (!isOccupied) {
        const dx = slot.x - worldX;
        const dy = slot.y - worldY;
        if (dx * dx + dy * dy <= 30 * 30) {
          hovered = slot.id;
          break;
        }
      }
    }
    this.hoveredSlotId = hovered;
  }
}
