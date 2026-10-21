/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine';
import { GameStats, GameState, TargetPriority, TowerInstance, TowerType } from './game/types';
import { CANVAS_VIRTUAL_HEIGHT, CANVAS_VIRTUAL_WIDTH, INITIAL_BASE_HEALTH, INITIAL_SUPPLIES, INITIAL_TACTICAL_POINTS, TOWER_CONFIGS } from './game/constants';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { PauseModal, VictoryModal, GameOverModal } from './components/StatusModals';
import { TechTreeModal } from './components/TechTreeModal';
import { sound } from './game/audio';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // High-level Game State
  const [gameState, setGameState] = useState<GameState>('title');
  const [isTechTreeOpen, setIsTechTreeOpen] = useState(false);

  // HUD live state (throttled/event-based to avoid 60fps React lag)
  const [supplies, setSupplies] = useState<number>(INITIAL_SUPPLIES);
  const [tacticalPoints, setTacticalPoints] = useState<number>(INITIAL_TACTICAL_POINTS);
  const [baseHealth, setBaseHealth] = useState<number>(INITIAL_BASE_HEALTH);
  const [maxBaseHealth] = useState<number>(INITIAL_BASE_HEALTH);
  const [currentWave, setCurrentWave] = useState<number>(1);
  const [isSpawning, setIsSpawning] = useState<boolean>(false);
  const [waveProgress, setWaveProgress] = useState<number>(0);
  const [selectedTower, setSelectedTower] = useState<TowerInstance | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [gameSpeed, setGameSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());

  const [stats, setStats] = useState<GameStats>({
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
  });

  // Sync state to body dataset
  useEffect(() => {
    document.body.dataset.state = gameState === 'victory' ? 'gameover' : gameState;
  }, [gameState]);

  // Initialize Engine
  const initEngine = useCallback(() => {
    if (!canvasRef.current) return;

    if (engineRef.current) {
      engineRef.current.stop();
    }

    const engine = new GameEngine(canvasRef.current, {
      onStatsUpdate: (newStats) => setStats({ ...newStats }),
      onSuppliesUpdate: (newSupplies) => setSupplies(newSupplies),
      onTacticalPointsUpdate: (tp) => setTacticalPoints(tp),
      onBaseHealthUpdate: (hp, maxHp) => setBaseHealth(hp),
      onWaveUpdate: (w, total, prog, spawning) => {
        setCurrentWave(w);
        setWaveProgress(prog);
        setIsSpawning(spawning);
      },
      onMilestoneUnlocked: (milestone) => {
        // Milestone notifications handled in engine floating texts + badge update
      },
      onGameOver: (endStats) => {
        setStats({ ...endStats });
        setGameState('gameover');
      },
      onVictory: (endStats) => {
        setStats({ ...endStats });
        setGameState('victory');
      },
      onTowerSelected: (t) => setSelectedTower(t),
      onSlotSelected: (slotId) => setSelectedSlotId(slotId),
    });

    engineRef.current = engine;
    engine.start();

    // Reset local UI states
    setSupplies(engine.supplies);
    setTacticalPoints(engine.tacticalPoints);
    setBaseHealth(engine.baseHealth);
    setCurrentWave(1);
    setIsSpawning(false);
    setSelectedTower(null);
    setSelectedSlotId(null);
    setStats({ ...engine.stats });
  }, []);

  // Handle Autostart query parameter `?autostart=1`
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const autostart = urlParams.get('autostart');
    if (autostart === '1' || autostart === 'true') {
      handleStartGame();
    }
  }, []);

  const handleStartGame = () => {
    setGameState('playing');
    initEngine();
  };

  const handleRestart = () => {
    setGameState('playing');
    initEngine();
  };

  const handleResume = () => {
    setGameState('playing');
    if (engineRef.current) {
      engineRef.current.setPaused(false);
    }
  };

  const handlePause = () => {
    if (gameState === 'playing') {
      setGameState('paused');
      if (engineRef.current) {
        engineRef.current.setPaused(true);
      }
    }
  };

  const handleQuitToTitle = () => {
    if (engineRef.current) {
      engineRef.current.stop();
    }
    setGameState('title');
  };

  const handleToggleSpeed = () => {
    const newSpeed = gameSpeed === 1.0 ? 2.0 : 1.0;
    setGameSpeed(newSpeed);
    if (engineRef.current) {
      engineRef.current.setGameSpeed(newSpeed);
    }
  };

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleStartWave = () => {
    if (engineRef.current) {
      engineRef.current.startNextWave();
    }
  };

  const handleBuildTower = (slotId: string, type: TowerType) => {
    if (engineRef.current) {
      engineRef.current.buildTowerAtSlot(slotId, type);
    }
  };

  const handleUpgradeTower = (towerId: string) => {
    if (engineRef.current) {
      engineRef.current.upgradeTower(towerId);
    }
  };

  const handleSellTower = (towerId: string) => {
    if (engineRef.current) {
      engineRef.current.sellTower(towerId);
    }
  };

  const handleSetPriority = (towerId: string, priority: TargetPriority) => {
    if (engineRef.current) {
      engineRef.current.setTowerPriority(towerId, priority);
    }
  };

  const handleTriggerTactical = (type: 'air_strike' | 'artillery_barrage') => {
    if (engineRef.current) {
      // Default center airstrike or artillery coordinates
      const targetX = 580;
      const targetY = 350;
      engineRef.current.triggerTacticalStrike(type, targetX, targetY);
    }
  };

  // Convert Screen (clientX, clientY) to Virtual Canvas Space (1200 x 750)
  const getCanvasCoordinates = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_VIRTUAL_WIDTH / rect.width;
    const scaleY = CANVAS_VIRTUAL_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing' || !engineRef.current) return;
    const { x, y } = getCanvasCoordinates(e);
    engineRef.current.handleCanvasClick(x, y);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing' || !engineRef.current) return;
    const { x, y } = getCanvasCoordinates(e);
    engineRef.current.handleCanvasMouseMove(x, y);
  };

  // Keyboard shortcut hygiene
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore inputs inside text fields
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (gameState === 'title') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleStartGame();
        }
      } else if (gameState === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handlePause();
        } else if (e.code === 'Space') {
          e.preventDefault();
          handleStartWave();
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          handleToggleMute();
        } else if (e.code === 'KeyU' && selectedTower) {
          e.preventDefault();
          handleUpgradeTower(selectedTower.id);
        } else {
          // Hotkeys 1-7 for tower placement
          const keyNum = parseInt(e.key, 10);
          if (keyNum >= 1 && keyNum <= 7 && selectedSlotId) {
            const types: TowerType[] = [
              'machine_gun',
              'sniper',
              'artillery',
              'tank',
              'trench_wire',
              'anti_tank_gun',
              'katyusha_rocket',
            ];
            const chosen = types[keyNum - 1];
            if (chosen) {
              handleBuildTower(selectedSlotId, chosen);
            }
          }
        }
      } else if (gameState === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Space') {
          e.preventDefault();
          handleResume();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, selectedTower, selectedSlotId]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-neutral-950 text-neutral-100 flex items-center justify-center select-none"
    >
      {/* Canvas Viewport (1200 x 750 aspect ratio preserved with letterboxing if needed) */}
      <div className="relative w-full h-full flex items-center justify-center p-0 max-w-full max-h-full">
        <canvas
          ref={canvasRef}
          width={CANVAS_VIRTUAL_WIDTH}
          height={CANVAS_VIRTUAL_HEIGHT}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          className="w-full h-full object-contain cursor-crosshair"
          data-testid="ww2-canvas"
        />
      </div>

      {/* Screen Layer: Title Screen */}
      {gameState === 'title' && (
        <div className="absolute inset-0 z-40">
          <TitleScreen onStartGame={handleStartGame} highScore={stats.highScore} />
        </div>
      )}

      {/* Screen Layer: In-Game Tactical HUD */}
      {gameState === 'playing' && (
        <GameHUD
          stats={stats}
          supplies={supplies}
          tacticalPoints={tacticalPoints}
          baseHealth={baseHealth}
          maxBaseHealth={maxBaseHealth}
          currentWave={currentWave}
          isSpawning={isSpawning}
          waveProgress={waveProgress}
          selectedTower={selectedTower}
          selectedSlotId={selectedSlotId}
          gameSpeed={gameSpeed}
          isMuted={isMuted}
          onStartWave={handleStartWave}
          onUpgradeTower={handleUpgradeTower}
          onSellTower={handleSellTower}
          onSetPriority={handleSetPriority}
          onBuildTower={handleBuildTower}
          onTriggerTactical={handleTriggerTactical}
          onToggleSpeed={handleToggleSpeed}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onOpenTechTree={() => setIsTechTreeOpen(true)}
          onDeselect={() => {
            setSelectedTower(null);
            setSelectedSlotId(null);
            if (engineRef.current) {
              engineRef.current.selectedTowerId = null;
              engineRef.current.selectedSlotId = null;
            }
          }}
        />
      )}

      {/* Modal: Quartel-General de Doutrinas & Pesquisa */}
      {isTechTreeOpen && (
        <TechTreeModal stats={stats} onClose={() => setIsTechTreeOpen(false)} />
      )}

      {/* Modal: Pause */}
      {gameState === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestart}
          onQuitToTitle={handleQuitToTitle}
        />
      )}

      {/* Modal: Victory */}
      {gameState === 'victory' && (
        <VictoryModal
          stats={stats}
          onPlayAgain={handleRestart}
          onQuitToTitle={handleQuitToTitle}
        />
      )}

      {/* Modal: Game Over / Defeat */}
      {gameState === 'gameover' && (
        <GameOverModal
          stats={stats}
          currentWave={currentWave}
          onRetry={handleRestart}
          onQuitToTitle={handleQuitToTitle}
        />
      )}
    </div>
  );
}
