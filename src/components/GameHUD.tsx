import React from 'react';
import {
  Award,
  ChevronUp,
  Crosshair,
  FastForward,
  Flame,
  HelpCircle,
  Pause,
  Plane,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { sound } from '../game/audio';
import { SCORE_MILESTONES, TOTAL_WAVES, TOWER_CONFIGS, TOWER_SLOTS, TOWER_UPGRADE_TIERS } from '../game/constants';
import { calculateTowerStats, calculateUpgradeCost, getUpgradeTierInfo, isTowerUnlocked } from '../game/rules';
import { GameStats, TargetPriority, TowerInstance, TowerType } from '../game/types';

interface GameHUDProps {
  stats: GameStats;
  supplies: number;
  tacticalPoints: number;
  baseHealth: number;
  maxBaseHealth: number;
  currentWave: number;
  isSpawning: boolean;
  waveProgress: number;
  selectedTower: TowerInstance | null;
  selectedSlotId: string | null;
  gameSpeed: number;
  isMuted: boolean;
  onStartWave: () => void;
  onUpgradeTower: (towerId: string) => void;
  onSellTower: (towerId: string) => void;
  onSetPriority: (towerId: string, priority: TargetPriority) => void;
  onBuildTower: (slotId: string, type: TowerType) => void;
  onTriggerTactical: (type: 'air_strike' | 'artillery_barrage') => void;
  onToggleSpeed: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenTechTree: () => void;
  onDeselect: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  supplies,
  tacticalPoints,
  baseHealth,
  maxBaseHealth,
  currentWave,
  isSpawning,
  waveProgress,
  selectedTower,
  selectedSlotId,
  gameSpeed,
  isMuted,
  onStartWave,
  onUpgradeTower,
  onSellTower,
  onSetPriority,
  onBuildTower,
  onTriggerTactical,
  onToggleSpeed,
  onToggleMute,
  onPause,
  onOpenTechTree,
  onDeselect,
}) => {
  const hpPercent = Math.max(0, Math.min(100, (baseHealth / maxBaseHealth) * 100));

  // Compute selected slot details if any
  const selectedSlot = selectedSlotId ? TOWER_SLOTS.find((s) => s.id === selectedSlotId) : null;

  // Selected tower stats & tier info
  const towerStats = selectedTower
    ? calculateTowerStats(selectedTower.type, selectedTower.level, stats.unlockedMilestoneIds)
    : null;
  const upgradeCost = selectedTower ? calculateUpgradeCost(selectedTower.type, selectedTower.level) : 0;
  const nextTierInfo =
    selectedTower && towerStats?.canUpgrade
      ? getUpgradeTierInfo(selectedTower.type, selectedTower.level + 1)
      : null;

  const towerOrder: TowerType[] = [
    'machine_gun',
    'sniper',
    'artillery',
    'tank',
    'trench_wire',
    'anti_tank_gun',
    'katyusha_rocket',
  ];

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none z-30 font-sans">
      {/* 1. TOP PERIMETER STATUS CLUSTER */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 max-w-full">
        {/* Left: HQ Health & Supplies */}
        <div className="flex items-center gap-2 sm:gap-3 bg-neutral-900/95 border border-neutral-700/80 px-3 py-2 rounded shadow-lg pointer-events-auto backdrop-blur-none">
          {/* Base HP */}
          <div className="flex items-center gap-2 pr-3 border-r border-neutral-700">
            <div
              className={`p-1.5 rounded ${
                hpPercent > 40 ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400 animate-pulse'
              }`}
            >
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-neutral-400 leading-none">
                Integridade QG
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-16 sm:w-24 bg-neutral-800 h-2 rounded overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      hpPercent > 40 ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-bold tabular-nums text-neutral-100">
                  {baseHealth}/{maxBaseHealth}
                </span>
              </div>
            </div>
          </div>

          {/* Supplies / Steel */}
          <div className="flex items-center gap-2 pr-3 border-r border-neutral-700">
            <div className="p-1.5 rounded bg-amber-950/80 text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-neutral-400 leading-none">
                Suprimentos (Aço)
              </div>
              <div className="text-sm font-bold font-mono text-amber-400 tabular-nums">
                {supplies.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Tactical Command Munitions */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-red-950/80 text-red-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-neutral-400 leading-none">
                Munição Tática
              </div>
              <div className="text-sm font-bold font-mono text-red-400 tabular-nums">
                {Math.round(tacticalPoints)} / 100
              </div>
            </div>
          </div>
        </div>

        {/* Center: Wave & Score Readouts */}
        <div className="flex items-center gap-2 bg-neutral-900/95 border border-neutral-700/80 px-3.5 py-2 rounded shadow-lg pointer-events-auto">
          {/* Wave indicator */}
          <div className="pr-3 border-r border-neutral-700 font-mono text-center">
            <div className="text-[10px] uppercase text-neutral-400 leading-none">Onda Atual</div>
            <div className="text-sm font-bold text-neutral-100 tabular-nums mt-0.5">
              {currentWave} <span className="text-neutral-500 text-xs">/ {TOTAL_WAVES}</span>
            </div>
          </div>

          {/* Score & Multiplier */}
          <div className="pr-3 border-r border-neutral-700 font-mono">
            <div className="text-[10px] uppercase text-neutral-400 leading-none flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-400" /> Pontuação
            </div>
            <div className="text-sm font-bold text-amber-400 tabular-nums mt-0.5">
              {stats.score.toLocaleString()} <span className="text-[10px] text-neutral-400">PTS</span>
            </div>
          </div>

          {/* Doutrinas / Tech Tree Button */}
          <button
            type="button"
            onClick={onOpenTechTree}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/50 text-amber-400 text-xs font-mono font-bold transition cursor-pointer"
            title="Abrir Quartel-General de Doutrinas e Pesquisa"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DOUTRINAS</span>
            <span className="px-1.5 py-0.2 bg-amber-500 text-neutral-950 text-[10px] rounded-full font-bold">
              {stats.unlockedMilestoneIds.length}/{SCORE_MILESTONES.length}
            </span>
          </button>
        </div>

        {/* Right: Wave Trigger & Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Next wave trigger */}
          <button
            type="button"
            onClick={onStartWave}
            disabled={isSpawning}
            className={`flex items-center gap-2 px-4 py-2 rounded font-bold font-['Chakra_Petch',sans-serif] uppercase text-xs sm:text-sm tracking-wide transition shadow-md cursor-pointer ${
              isSpawning
                ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-neutral-950 border border-emerald-400 shadow-emerald-600/20'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            {isSpawning ? 'ONDA EM CURSO' : 'INICIAR ONDA [ESPAÇO]'}
          </button>

          {/* Speed Toggle */}
          <button
            type="button"
            onClick={onToggleSpeed}
            aria-label={`Velocidade ${gameSpeed}x`}
            className="p-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-amber-400 transition cursor-pointer text-xs font-mono font-bold flex items-center gap-1"
          >
            <FastForward className="w-4 h-4" />
            <span>{gameSpeed}x</span>
          </button>

          {/* Mute toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Ativar Som' : 'Silenciar'}
            className="p-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-amber-400 transition cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Pause */}
          <button
            type="button"
            onClick={onPause}
            aria-label="Pausar jogo"
            className="p-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-amber-400 transition cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MIDDLE FLOATING INSPECTOR: Selected Tower Upgrade / Slot Build Panel */}
      <div className="flex justify-end pointer-events-none">
        {selectedTower && towerStats && (
          <div className="w-80 bg-neutral-900/95 border border-amber-600/60 rounded-lg p-4 shadow-2xl pointer-events-auto text-neutral-100 font-sans">
            <div className="flex items-start justify-between border-b border-neutral-800 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase text-amber-500 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/40">
                    TIER {selectedTower.level}
                  </span>
                  <h3 className="font-bold text-sm text-neutral-100 font-['Chakra_Petch',sans-serif]">
                    {TOWER_CONFIGS[selectedTower.type].name}
                  </h3>
                </div>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  {towerStats.tierName}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSellTower(selectedTower.id)}
                  className="p-1.5 text-neutral-400 hover:text-red-400 bg-neutral-800 hover:bg-red-950/50 rounded transition cursor-pointer text-xs"
                  title="Vender esta fortificação"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onDeselect}
                  className="p-1.5 text-neutral-400 hover:text-neutral-100 bg-neutral-800 hover:bg-neutral-700 rounded transition cursor-pointer text-xs"
                  title="Fechar inspetor"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Combat Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-mono">
              <div className="p-1.5 bg-neutral-950/80 rounded border border-neutral-800">
                <span className="text-[10px] text-neutral-400 block">DANO</span>
                <span className="font-bold text-amber-400 tabular-nums">{towerStats.damage}</span>
              </div>
              <div className="p-1.5 bg-neutral-950/80 rounded border border-neutral-800">
                <span className="text-[10px] text-neutral-400 block">CADÊNCIA</span>
                <span className="font-bold text-neutral-200 tabular-nums">{towerStats.fireRate}/s</span>
              </div>
              <div className="p-1.5 bg-neutral-950/80 rounded border border-neutral-800">
                <span className="text-[10px] text-neutral-400 block">ALCANCE</span>
                <span className="font-bold text-neutral-200 tabular-nums">{towerStats.range}</span>
              </div>
              <div className="p-1.5 bg-neutral-950/80 rounded border border-neutral-800">
                <span className="text-[10px] text-neutral-400 block">PERFURAÇÃO</span>
                <span className="font-bold text-neutral-200 tabular-nums">
                  {Math.round(towerStats.armorPiercing * 100)}%
                </span>
              </div>
            </div>

            {/* Performance */}
            <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-neutral-400 bg-neutral-950/50 px-2 py-1 rounded">
              <span>Abates: <b className="text-neutral-200">{selectedTower.kills}</b></span>
              <span>Dano Infligido: <b className="text-neutral-200">{selectedTower.totalDamageDealt.toLocaleString()}</b></span>
            </div>

            {/* Target Priority Selector */}
            {selectedTower.type !== 'trench_wire' && (
              <div className="mt-3">
                <div className="text-[10px] uppercase font-mono text-neutral-400 mb-1">
                  Alvo Prioritário:
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                  {(['first', 'strongest', 'closest', 'lowest_hp'] as TargetPriority[]).map((p) => {
                    const labels: Record<TargetPriority, string> = {
                      first: 'Primeiro',
                      strongest: 'Mais Forte',
                      closest: 'Mais Perto',
                      lowest_hp: 'Menor HP',
                    };
                    const isActive = selectedTower.priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onSetPriority(selectedTower.id, p)}
                        className={`py-1 rounded text-center transition cursor-pointer ${
                          isActive
                            ? 'bg-amber-600 text-neutral-950 font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {labels[p]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upgrade action */}
            <div className="mt-3 border-t border-neutral-800 pt-3">
              {towerStats.canUpgrade && nextTierInfo ? (
                <div>
                  <div className="text-[11px] text-neutral-300 font-mono mb-2">
                    <span className="text-amber-400 font-bold">Próximo Nível (Tier {selectedTower.level + 1}):</span>
                    <div className="text-neutral-400 mt-0.5">{nextTierInfo.bonusSummary}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpgradeTower(selectedTower.id)}
                    disabled={supplies < upgradeCost}
                    className={`w-full py-2 px-3 rounded font-bold font-['Chakra_Petch',sans-serif] uppercase text-xs flex items-center justify-between transition cursor-pointer ${
                      supplies >= upgradeCost
                        ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-neutral-950 shadow-md shadow-amber-600/30'
                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <ChevronUp className="w-4 h-4" /> APRIMORAR PARA TIER {selectedTower.level + 1}
                    </span>
                    <span className="font-mono">{upgradeCost} AÇO</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-2 text-xs font-mono font-bold text-amber-400/80 bg-neutral-950/60 rounded border border-neutral-800">
                  ★ TIER MÁXIMO ALCANÇADO ★
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Empty Slot Build Menu */}
        {selectedSlot && !selectedTower && (
          <div className="w-80 bg-neutral-900/95 border border-neutral-700 rounded-lg p-4 shadow-2xl pointer-events-auto text-neutral-100 font-sans">
            <div className="flex items-start justify-between border-b border-neutral-800 pb-2">
              <div>
                <h3 className="font-bold text-sm text-neutral-100 font-['Chakra_Petch',sans-serif] flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4 text-amber-500" />
                  Construir em: {selectedSlot.label}
                </h3>
                {selectedSlot.coverBonus && (
                  <div className="text-[11px] font-mono text-emerald-400 mt-0.5">
                    Bônus: {selectedSlot.coverBonus}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onDeselect}
                className="p-1.5 text-neutral-400 hover:text-neutral-100 bg-neutral-800 hover:bg-neutral-700 rounded transition cursor-pointer text-xs"
                title="Fechar menu"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
              {towerOrder.map((type) => {
                const cfg = TOWER_CONFIGS[type];
                const isUnlocked = isTowerUnlocked(type, stats.unlockedMilestoneIds);
                const canAfford = supplies >= cfg.cost;

                return (
                  <button
                    key={type}
                    type="button"
                    disabled={!isUnlocked || !canAfford}
                    onClick={() => onBuildTower(selectedSlot.id, type)}
                    className={`w-full p-2.5 rounded border text-left transition flex items-center justify-between cursor-pointer ${
                      !isUnlocked
                        ? 'bg-neutral-950/40 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
                        : canAfford
                        ? 'bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700 hover:border-amber-500 text-neutral-200'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-500 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs font-['Chakra_Petch',sans-serif]">
                        <span className="w-4 h-4 rounded bg-neutral-900 border border-neutral-700 text-amber-400 flex items-center justify-center text-[10px] font-mono">
                          {cfg.hotkey}
                        </span>
                        {cfg.name}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                        {cfg.roleHint}
                      </div>
                    </div>

                    <div className="text-right font-mono text-xs">
                      {isUnlocked ? (
                        <span className={`font-bold ${canAfford ? 'text-amber-400' : 'text-neutral-500'}`}>
                          {cfg.cost} Aço
                        </span>
                      ) : (
                        <span className="text-[10px] text-red-400/80">BLOQUEADO</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM STRIP: Tactical Support Abilities & Unit Deck */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-900/95 border border-neutral-700/80 p-2.5 sm:p-3 rounded-lg shadow-2xl pointer-events-auto">
        {/* Tactical Support Air/Artillery Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onTriggerTactical('air_strike')}
            disabled={tacticalPoints < (stats.unlockedMilestoneIds.includes('ms_air_doctrine') ? 39 : 60)}
            className={`flex items-center gap-2 px-3 py-2 rounded border font-mono text-xs font-bold transition cursor-pointer ${
              tacticalPoints >= (stats.unlockedMilestoneIds.includes('ms_air_doctrine') ? 39 : 60)
                ? 'bg-red-950/80 hover:bg-red-900 border-red-600/70 text-red-200 shadow-md shadow-red-950/50'
                : 'bg-neutral-950/60 border-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
            title="Bombardeio com caças P-47 Thunderbolt com foguetes e metralhadoras .50"
          >
            <Plane className="w-4 h-4 text-red-400" />
            <div className="text-left">
              <div className="leading-tight">Ataque Aéreo P-47</div>
              <div className="text-[10px] text-red-400/80">
                {stats.unlockedMilestoneIds.includes('ms_air_doctrine') ? '39' : '60'} Mun.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerTactical('artillery_barrage')}
            disabled={tacticalPoints < (stats.unlockedMilestoneIds.includes('ms_air_doctrine') ? 29 : 45)}
            className={`flex items-center gap-2 px-3 py-2 rounded border font-mono text-xs font-bold transition cursor-pointer ${
              tacticalPoints >= (stats.unlockedMilestoneIds.includes('ms_air_doctrine') ? 29 : 45)
                ? 'bg-amber-950/80 hover:bg-amber-900 border-amber-600/70 text-amber-200 shadow-md shadow-amber-950/50'
                : 'bg-neutral-950/60 border-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
            title="Barragem de Artilharia Pesada com 5 salvas de obuseiros"
          >
            <Flame className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <div className="leading-tight">Barragem 155mm</div>
              <div className="text-[10px] text-amber-400/80">
                {stats.unlockedMilestoneIds.includes('ms_air_doctrine') ? '29' : '45'} Mun.
              </div>
            </div>
          </button>
        </div>

        {/* Defense Unit Quick Placement Deck */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
          {towerOrder.map((type) => {
            const cfg = TOWER_CONFIGS[type];
            const isUnlocked = isTowerUnlocked(type, stats.unlockedMilestoneIds);
            const canAfford = supplies >= cfg.cost;

            return (
              <button
                key={type}
                type="button"
                disabled={!isUnlocked}
                onClick={() => {
                  if (selectedSlotId) {
                    onBuildTower(selectedSlotId, type);
                  }
                }}
                className={`flex flex-col items-center p-2 rounded border transition text-center min-w-[76px] cursor-pointer ${
                  !isUnlocked
                    ? 'bg-neutral-950/50 border-neutral-800 text-neutral-500 opacity-50'
                    : canAfford
                    ? 'bg-neutral-800/90 hover:bg-neutral-700/90 border-neutral-600 text-neutral-200 hover:border-amber-400'
                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                }`}
                title={
                  isUnlocked
                    ? `${cfg.name} (${cfg.cost} Aço) - ${cfg.description}`
                    : `Bloqueado: Requer ${cfg.requiredScoreUnlock} pontos no Quartel-General de Doutrinas`
                }
              >
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-400">
                  <span className="text-[9px] px-1 bg-neutral-950 rounded text-neutral-400">
                    {cfg.hotkey}
                  </span>
                  <span>{cfg.cost}</span>
                </div>
                <div className="text-[11px] font-bold font-['Chakra_Petch',sans-serif] truncate max-w-[85px] mt-0.5">
                  {cfg.name.split(' ')[0]}
                </div>
                <div className="text-[9px] font-mono text-neutral-400 mt-0.5 truncate max-w-[85px]">
                  {isUnlocked ? cfg.roleHint.split('·')[0] : 'Bloqueado'}
                </div>
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
};
