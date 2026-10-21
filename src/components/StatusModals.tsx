import React from 'react';
import { Play, RotateCcw, Home, Award, Skull, Trophy, ShieldAlert, Crosshair, Shield } from 'lucide-react';
import { GameStats } from '../game/types';
import { TOTAL_WAVES } from '../game/constants';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ onResume, onRestart, onQuitToTitle }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-6 text-neutral-100 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-500 mb-3">
          <Play className="w-6 h-6 ml-0.5" />
        </div>
        <h2 className="text-2xl font-bold font-['Chakra_Petch',sans-serif] uppercase tracking-wide">
          Batalha Pausada
        </h2>
        <p className="text-xs text-neutral-400 mt-1 font-mono">
          As operações estão suspensas temporariamente.
        </p>

        <div className="mt-6 flex flex-col gap-3 font-['Chakra_Petch',sans-serif]">
          <button
            type="button"
            onClick={onResume}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-neutral-950 font-bold uppercase rounded transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" /> Continuar Combate [Esc]
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold uppercase rounded transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Reiniciar Batalha
          </button>

          <button
            type="button"
            onClick={onQuitToTitle}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-neutral-950 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800 font-bold uppercase rounded transition cursor-pointer text-xs font-mono"
          >
            <Home className="w-4 h-4" /> Menu Principal
          </button>
        </div>
      </div>
    </div>
  );
};

interface VictoryModalProps {
  stats: GameStats;
  onPlayAgain: () => void;
  onQuitToTitle: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({ stats, onPlayAgain, onQuitToTitle }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
      <div className="w-full max-w-lg bg-neutral-900 border border-amber-600/60 rounded-lg shadow-2xl p-6 sm:p-8 text-neutral-100 text-center relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute inset-0 bg-radial from-amber-600/10 via-transparent to-transparent pointer-events-none" />

        <div className="w-16 h-16 mx-auto rounded-full bg-amber-950/80 border-2 border-amber-500 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/20">
          <Trophy className="w-8 h-8" />
        </div>

        <div className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
          MISSÃO CUMPRIDA · VITÓRIA ALIADA
        </div>
        <h2 className="text-3xl font-black font-['Chakra_Petch',sans-serif] uppercase tracking-wide text-neutral-100 mt-1">
          A Frente Está Segura!
        </h2>
        <p className="text-xs text-neutral-300 mt-2 font-mono max-w-sm mx-auto">
          Todas as 12 ondas das forças inimigas foram repelidas com bravura e comando exemplar!
        </p>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-left font-mono">
          <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded">
            <div className="text-[10px] text-neutral-400 uppercase flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-400" /> Pontos
            </div>
            <div className="text-base font-bold text-amber-400 tabular-nums mt-1">
              {stats.score.toLocaleString()}
            </div>
          </div>

          <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded">
            <div className="text-[10px] text-neutral-400 uppercase flex items-center gap-1">
              <Skull className="w-3 h-3 text-red-400" /> Abates
            </div>
            <div className="text-base font-bold text-neutral-200 tabular-nums mt-1">
              {stats.enemiesKilled}
            </div>
          </div>

          <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded">
            <div className="text-[10px] text-neutral-400 uppercase flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" /> Panzers
            </div>
            <div className="text-base font-bold text-neutral-200 tabular-nums mt-1">
              {stats.tanksKilled}
            </div>
          </div>

          <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded">
            <div className="text-[10px] text-neutral-400 uppercase flex items-center gap-1">
              <Crosshair className="w-3 h-3 text-blue-400" /> Doutrinas
            </div>
            <div className="text-base font-bold text-neutral-200 tabular-nums mt-1">
              {stats.unlockedMilestoneIds.length}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 font-['Chakra_Petch',sans-serif]">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-neutral-950 font-bold uppercase rounded transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Jogar Novamente
          </button>

          <button
            type="button"
            onClick={onQuitToTitle}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-bold uppercase transition cursor-pointer"
          >
            <Home className="w-4 h-4" /> Menu Principal
          </button>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  stats: GameStats;
  currentWave: number;
  onRetry: () => void;
  onQuitToTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  currentWave,
  onRetry,
  onQuitToTitle,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
      <div className="w-full max-w-lg bg-neutral-900 border border-red-700/60 rounded-lg shadow-2xl p-6 sm:p-8 text-neutral-100 text-center relative overflow-hidden">
        {/* Red distress glow */}
        <div className="absolute inset-0 bg-radial from-red-600/10 via-transparent to-transparent pointer-events-none" />

        <div className="w-16 h-16 mx-auto rounded-full bg-red-950/80 border-2 border-red-600 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-600/20">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="text-xs font-mono font-bold uppercase tracking-widest text-red-500">
          QUARTEL-GENERAL INVADIDO · DERROTA
        </div>
        <h2 className="text-3xl font-black font-['Chakra_Petch',sans-serif] uppercase tracking-wide text-neutral-100 mt-1">
          A Linha Foi Rompida!
        </h2>
        <p className="text-xs text-neutral-300 mt-2 font-mono max-w-sm mx-auto">
          As defesas não suportaram o ataque inimigo. Reorganize suas trincheiras, artilharia e tanques para contra-atacar.
        </p>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-left font-mono">
          <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded">
            <div className="text-[10px] text-neutral-400 uppercase">Onda Atingida</div>
            <div className="text-base font-bold text-red-400 tabular-nums mt-1">
              {currentWave} / {TOTAL_WAVES}
            </div>
          </div>

          <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded">
            <div className="text-[10px] text-neutral-400 uppercase">Pontuação</div>
            <div className="text-base font-bold text-amber-400 tabular-nums mt-1">
              {stats.score.toLocaleString()}
            </div>
          </div>

          <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded">
            <div className="text-[10px] text-neutral-400 uppercase">Inimigos Abatidos</div>
            <div className="text-base font-bold text-neutral-200 tabular-nums mt-1">
              {stats.enemiesKilled}
            </div>
          </div>

          <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded">
            <div className="text-[10px] text-neutral-400 uppercase">Dano Total</div>
            <div className="text-base font-bold text-neutral-200 tabular-nums mt-1">
              {stats.totalDamageDealt.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 font-['Chakra_Petch',sans-serif]">
          <button
            type="button"
            data-start="true"
            onClick={onRetry}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-bold uppercase rounded transition cursor-pointer shadow-lg shadow-red-700/30"
          >
            <RotateCcw className="w-4 h-4" /> Tentar Novamente
          </button>

          <button
            type="button"
            onClick={onQuitToTitle}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-bold uppercase transition cursor-pointer"
          >
            <Home className="w-4 h-4" /> Menu Principal
          </button>
        </div>
      </div>
    </div>
  );
};
