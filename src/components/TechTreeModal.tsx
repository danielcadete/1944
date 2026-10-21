import React from 'react';
import { X, Award, CheckCircle2, Lock, Shield, Zap, Flame, Eye, Crosshair, Plane } from 'lucide-react';
import { SCORE_MILESTONES } from '../game/constants';
import { GameStats } from '../game/types';

interface TechTreeModalProps {
  stats: GameStats;
  onClose: () => void;
}

export const TechTreeModal: React.FC<TechTreeModalProps> = ({ stats, onClose }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'zap':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'crosshair':
        return <Crosshair className="w-5 h-5 text-red-400" />;
      case 'eye':
        return <Eye className="w-5 h-5 text-sky-400" />;
      case 'flame':
        return <Flame className="w-5 h-5 text-orange-400" />;
      case 'shield':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case 'plane':
        return <Plane className="w-5 h-5 text-indigo-400" />;
      default:
        return <Award className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-950/60 border border-amber-600/40 rounded text-amber-500">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-['Chakra_Petch',sans-serif] uppercase tracking-wide text-neutral-100">
                Quartel-General de Doutrinas & Pesquisa
              </h2>
              <div className="text-xs text-neutral-400 font-mono">
                Acumule pontos em combate para desbloquear novas defesas e aprimoramentos permanentes.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right font-mono">
              <div className="text-xs text-neutral-400 uppercase">Pontuação Atual</div>
              <div className="text-lg font-bold text-amber-400 tabular-nums">
                {stats.score.toLocaleString()} PTS
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar modal"
              className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Milestones list */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {SCORE_MILESTONES.map((m) => {
            const isUnlocked = stats.unlockedMilestoneIds.includes(m.id);
            const progress = Math.min(100, Math.round((stats.score / m.thresholdScore) * 100));

            return (
              <div
                key={m.id}
                className={`p-4 rounded-lg border transition-all ${
                  isUnlocked
                    ? 'bg-amber-950/20 border-amber-600/50 shadow-sm shadow-amber-950/50'
                    : 'bg-neutral-950/60 border-neutral-800 opacity-85'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded border mt-0.5 ${
                        isUnlocked
                          ? 'bg-amber-900/40 border-amber-500/60'
                          : 'bg-neutral-800 border-neutral-700'
                      }`}
                    >
                      {getIcon(m.icon)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm sm:text-base font-['Chakra_Petch',sans-serif] text-neutral-100">
                          {m.title}
                        </span>
                        {isUnlocked ? (
                          <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" /> DESBLOQUEADO
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                            <Lock className="w-3 h-3" /> BLOQUEADO ({m.thresholdScore.toLocaleString()} PTS)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                        {m.description}
                      </p>

                      <div className="mt-2 text-xs font-mono font-semibold text-amber-400 flex items-center gap-1.5">
                        <span className="text-neutral-400">Efeito:</span> {m.buffDescription}
                      </div>
                    </div>
                  </div>

                  {/* Progress status */}
                  <div className="sm:text-right shrink-0 min-w-[130px]">
                    {!isUnlocked && (
                      <div className="w-full">
                        <div className="flex justify-between text-[11px] font-mono text-neutral-400 mb-1">
                          <span>Progresso</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-neutral-800 h-2 rounded overflow-hidden">
                          <div
                            className="bg-amber-500 h-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-[10px] font-mono text-neutral-400 mt-1">
                          Faltam {(m.thresholdScore - stats.score).toLocaleString()} pts
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between text-xs text-neutral-400 font-mono">
          <div>
            Total Desbloqueado: {stats.unlockedMilestoneIds.length} / {SCORE_MILESTONES.length} Doutrinas
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded font-bold cursor-pointer transition"
          >
            Voltar à Batalha
          </button>
        </div>
      </div>
    </div>
  );
};
