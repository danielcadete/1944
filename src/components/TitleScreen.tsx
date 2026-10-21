import React from 'react';
import { Shield, Crosshair, Award, Flame, Volume2, VolumeX, Star } from 'lucide-react';
import { sound } from '../game/audio';

interface TitleScreenProps {
  onStartGame: () => void;
  highScore: number;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStartGame, highScore }) => {
  const [isMuted, setIsMuted] = React.useState(sound.getMuted());

  const handleToggleMute = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6 md:p-12 overflow-hidden bg-neutral-950 text-neutral-100 select-none">
      {/* Background Military War Table Aesthetic */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `radial-gradient(#52525b 1px, transparent 1px), radial-gradient(#3f3f46 1px, #0a0a0a 1px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: '0 0, 20px 20px',
          }}
        />
      </div>

      {/* Atmospheric War Fog and Vignette */}
      <div className="absolute inset-0 bg-radial from-amber-950/10 via-neutral-950/60 to-neutral-950 pointer-events-none" />

      {/* Top Bar with Audio & Highscore */}
      <div className="relative z-10 w-full max-w-5xl flex items-center justify-between border-b border-amber-900/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-amber-950/60 border border-amber-600/40 flex items-center justify-center text-amber-500">
            <Star className="w-4 h-4 fill-amber-500" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-500/80 font-mono font-semibold">
              Teatro de Operações Europeu · 1944
            </div>
            <div className="text-sm font-bold text-neutral-300 font-serif">
              Setor das Ardenas · Linha de Defesa Aliada
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/80 border border-neutral-800 rounded font-mono text-xs">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-neutral-400">RECORDE:</span>
            <span className="text-amber-400 font-bold tabular-nums text-sm">
              {highScore.toLocaleString()} PTS
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Ativar som' : 'Silenciar áudio'}
            className="p-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-amber-400 transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Hero Centerpiece & Title Lockup */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto max-w-3xl">
        {/* Bespoke inline SVG Title Lockup */}
        <div className="mb-4">
          <svg className="w-20 h-20 mx-auto text-amber-500" viewBox="0 0 100 100" fill="none">
            {/* Laurel Wreath */}
            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.6" />
            {/* Crosshairs */}
            <line x1="15" y1="50" x2="85" y2="50" stroke="currentColor" strokeWidth="2" opacity="0.8" />
            <line x1="50" y1="15" x2="50" y2="85" stroke="currentColor" strokeWidth="2" opacity="0.8" />
            <circle cx="50" cy="50" r="26" stroke="currentColor" strokeWidth="2" />
            <circle cx="50" cy="50" r="6" fill="currentColor" />
            {/* Military Star */}
            <polygon points="50,22 53,30 62,30 55,36 58,44 50,39 42,44 45,36 38,30 47,30" fill="#f59e0b" />
          </svg>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight uppercase text-neutral-100 font-['Chakra_Petch',sans-serif] drop-shadow-md">
          Linha de Trincheiras <span className="text-amber-500">1944</span>
        </h1>
        <div className="mt-2 text-sm sm:text-base font-semibold uppercase tracking-widest text-amber-400/90 font-mono">
          Estratégia de Defesa & Artilharia da 2ª Guerra Mundial
        </div>

        <p className="mt-4 text-xs sm:text-sm text-neutral-400 max-w-xl leading-relaxed">
          Assuma o comando da frente de batalha. Posicione metralhadoras em sacos de areia, atiradores de elite snipers,
          obuseiros pesados e tanques de guerra blindados. Defenda o Quartel-General contra ondas sucessivas de infantaria,
          sapadores e os temidos tanques Panzer!
        </p>

        {/* Feature badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs font-mono">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900/90 border border-neutral-700/60 rounded text-neutral-300">
            <Crosshair className="w-3.5 h-3.5 text-amber-400" /> Metralhadoras & Snipers
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900/90 border border-neutral-700/60 rounded text-neutral-300">
            <Flame className="w-3.5 h-3.5 text-orange-400" /> Obuseiros & Artilharia
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900/90 border border-neutral-700/60 rounded text-neutral-300">
            <Shield className="w-3.5 h-3.5 text-emerald-400" /> Tanques & Canhões Antitanque
          </span>
        </div>

        {/* Primary Start CTA */}
        <div className="mt-8">
          <button
            type="button"
            data-start="true"
            onClick={onStartGame}
            className="group relative inline-flex items-center gap-3 px-10 py-4 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-neutral-950 font-bold uppercase tracking-wider text-base sm:text-lg rounded transition-all shadow-lg shadow-amber-600/30 hover:shadow-amber-500/50 cursor-pointer font-['Chakra_Petch',sans-serif]"
          >
            <Star className="w-5 h-5 fill-neutral-950 text-neutral-950" />
            INICIAR BATALHA
            <span className="text-xs bg-amber-950/40 text-amber-950 px-2 py-0.5 rounded font-mono font-bold">
              ESPAÇO / ENTER
            </span>
          </button>
        </div>
      </div>

      {/* Flat Control Hints Line in Bottom Margin */}
      <div className="relative z-10 w-full max-w-5xl border-t border-neutral-800 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 font-mono gap-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-500">COMANDOS:</span>
          <span>1-7 Selecionar Torre · Espaço Iniciar Onda · P/Esc Pausa · M Mudo</span>
        </div>
        <div className="text-neutral-400">
          Versão 1.4.0 · 12 Ondas Históricas
        </div>
      </div>
    </div>
  );
};
