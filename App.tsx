
import React, { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Cloud } from '@react-three/drei';
import { Group, DirectionalLight, Object3D, Sprite, CanvasTexture, Color, Points, BufferGeometry, Float32BufferAttribute, PointsMaterial, AdditiveBlending } from 'three';
import { Player } from './components/Player';
import { World } from './components/World';
import { useGameStore, GameMode } from './store';
import { WORLD_CONFIG } from './types';
import { audioService } from './services/audioService';

const UI = () => {
  const score = useGameStore((state) => state.score);
  const isPlaying = useGameStore((state) => state.isPlaying);
  const setIsPlaying = useGameStore((state) => state.setIsPlaying);
  const triggerJump = useGameStore((state) => state.triggerJump);
  const resetGame = useGameStore((state) => state.resetGame);
  const setTargetX = useGameStore((state) => state.setTargetX);
  
  const speed = useGameStore((state) => state.speed);
  const updateSpeed = useGameStore((state) => state.updateSpeed);
  const setRawSpeed = useGameStore((state) => state.setRawSpeed);
  const setCameraOffset = useGameStore((state) => state.setCameraOffset);
  const resetCameraOffset = useGameStore((state) => state.resetCameraOffset);
  const cameraOffset = useGameStore((state) => state.cameraOffset);
  const coins = useGameStore((state) => state.coins);
  const addCoins = useGameStore((state) => state.addCoins);
  const lastCoinLoss = useGameStore((state) => state.lastCoinLoss); 
  
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const timeRemaining = useGameStore((state) => state.timeRemaining);
  const setTimeRemaining = useGameStore((state) => state.setTimeRemaining);
  const isGameOver = useGameStore((state) => state.isGameOver);
  const setGameOver = useGameStore((state) => state.setGameOver);
  
  const isIntro = useGameStore((state) => state.isIntro);
  const setIsIntro = useGameStore((state) => state.setIsIntro);

  const isBoosting = useGameStore((state) => state.isBoosting);
  const boostCooldown = useGameStore((state) => state.boostCooldown);
  const setBoostState = useGameStore((state) => state.setBoostState);

  const isMagnetActive = useGameStore((state) => state.isMagnetActive);
  const magnetCooldown = useGameStore((state) => state.magnetCooldown);
  const setMagnetState = useGameStore((state) => state.setMagnetState);

  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioService.setMuted(next);
  };

  const handlePause = () => {
    setIsPaused(true);
    setShowExitConfirm(false);
  };

  const handleResume = () => {
    setIsPaused(false);
    setShowExitConfirm(false);
  };

  const gestureStartX = useRef<number | null>(null);
  const lastX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const currentTargetX = useRef<number>(0);

  const camDragStart = useRef<{ x: number, y: number } | null>(null);
  const isCamDragging = useRef(false);
  const camAccum = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const camZoom = useRef<number>(1.0);
  const activePointers = useRef<Map<number, { x: number, y: number }>>(new Map());
  const lastPinchDist = useRef<number | null>(null);

  const isDefaultCamera = Math.abs(cameraOffset.x) < 0.05 && Math.abs(cameraOffset.y) < 0.05 && Math.abs(cameraOffset.zoom - 1.0) < 0.1;

  const speedIntervalRef = useRef<number | null>(null);
  const pressStartTimeRef = useRef<number>(0);

  const keysRef = useRef<Set<string>>(new Set());
  const kbSteerRef = useRef<number | null>(null);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (!isPlaying || isGameOver) return;
      keysRef.current.add(e.code);
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        triggerJump();
      }
      if (['ArrowLeft','ArrowRight','KeyA','KeyD','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
      if (kbSteerRef.current === null) {
        const loop = () => {
          const keys = keysRef.current;
          const left  = keys.has('ArrowLeft') || keys.has('KeyA');
          const right = keys.has('ArrowRight') || keys.has('KeyD');
          const up    = keys.has('ArrowUp');
          const down  = keys.has('ArrowDown');
          if (left || right) {
            const dir = right ? -1 : 1;
            currentTargetX.current = Math.max(-1, Math.min(1, currentTargetX.current + dir * 0.03));
            setTargetX(currentTargetX.current);
          }
          if (up)   updateSpeed(0.15);
          if (down) updateSpeed(-0.15);
          if (left || right || up || down) {
            kbSteerRef.current = requestAnimationFrame(loop);
          } else {
            kbSteerRef.current = null;
          }
        };
        kbSteerRef.current = requestAnimationFrame(loop);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [isPlaying, isGameOver, triggerJump, setTargetX, updateSpeed]);

  const [lossDisplay, setLossDisplay] = useState<{amount: number, key: number} | null>(null);

  useEffect(() => {
    if (lastCoinLoss) {
        setLossDisplay({ amount: lastCoinLoss.amount, key: lastCoinLoss.timestamp });
        const timer = setTimeout(() => setLossDisplay(null), 1000);
        return () => clearTimeout(timer);
    }
  }, [lastCoinLoss]);

  useEffect(() => {
    if (isPlaying && gameMode === 'TIME_ATTACK' && !isGameOver && !isPaused) {
      const startTime = Date.now();
      const initialRemaining = timeRemaining;
      
      const timer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const newRemaining = Math.max(0, initialRemaining - elapsed);
        
        setTimeRemaining(newRemaining);
        
        if (newRemaining <= 10 && newRemaining > 0) {
             audioService.startSiren();
        }

        if (newRemaining <= 0) {
            clearInterval(timer);
            setGameOver(true);
            setIsPlaying(false);
            setRawSpeed(0); 
            audioService.stopSiren();
            audioService.stopBoostWind();
            audioService.stopMagnetSound(); 
        }
      }, 50); 

      return () => {
          clearInterval(timer);
          audioService.stopSiren();
      }
    }
  }, [isPlaying, gameMode, isGameOver, isPaused]);

  const handleSpeedStart = (direction: 1 | -1) => {
    if (isBoosting || isGameOver) return;

    updateSpeed(direction);
    pressStartTimeRef.current = Date.now();
    
    const loop = () => {
        const now = Date.now();
        const elapsed = now - pressStartTimeRef.current;
        
        let factor = 0.1; 
        if (elapsed > 1000) factor = 0.3;
        if (elapsed > 2000) factor = 0.8;

        updateSpeed(direction * factor);
        speedIntervalRef.current = requestAnimationFrame(loop);
    };
    speedIntervalRef.current = requestAnimationFrame(loop);
  };

  const handleSpeedEnd = () => {
    if (speedIntervalRef.current !== null) {
        cancelAnimationFrame(speedIntervalRef.current);
        speedIntervalRef.current = null;
    }
  };

  const handleStart = (mode: GameMode) => {
    audioService.init(); 
    resetGame();
    setGameMode(mode);
    setIsPlaying(true);
  };

  const handleRestart = () => {
      resetGame();
      setGameMode(null);
  }

  const handleExitToMain = () => {
    audioService.stopBGM();
    audioService.stopSiren();
    audioService.stopBoostWind();
    audioService.stopMagnetSound();
    setIsPaused(false);
    setShowExitConfirm(false);
    resetGame();
    setGameMode(null);
  };

  const handleBoost = () => {
    if (coins < 100 || boostCooldown || isBoosting || isGameOver) return;

    addCoins(-100);
    const preBoostSpeed = useGameStore.getState().speed;
    
    setBoostState(true, true); 
    setRawSpeed(200); 
    audioService.startBoostWind(); 

    setTimeout(() => {
        if (useGameStore.getState().isPlaying && !useGameStore.getState().isGameOver) {
             setRawSpeed(preBoostSpeed);
        }
        useGameStore.getState().setBoostState(false, true); 
        audioService.stopBoostWind(); 
    }, 10000); 

    setTimeout(() => {
        useGameStore.getState().setBoostState(false, false);
    }, 20000); 
  };

  const handleMagnet = () => {
      if (coins < 150 || magnetCooldown || isMagnetActive || isGameOver) return;
      addCoins(-150);
      setMagnetState(true, true);
      audioService.startMagnetSound(); // START SOUND
      
      setTimeout(() => {
          useGameStore.getState().setMagnetState(false, true);
          audioService.stopMagnetSound(); // STOP SOUND
      }, 15000); 

      setTimeout(() => {
          useGameStore.getState().setMagnetState(false, false);
      }, 20000); 
  };

  const handleCamPointerDown = (e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 1) {
      camDragStart.current = { x: e.clientX, y: e.clientY };
      isCamDragging.current = true;
      lastPinchDist.current = null;
    } else if (activePointers.current.size === 2) {
      isCamDragging.current = false;
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleCamPointerMove = (e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size >= 2) {
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current !== null) {
        const ratio = dist / lastPinchDist.current;
        camZoom.current = Math.max(0.3, Math.min(3.0, camZoom.current / ratio));
        setCameraOffset(camAccum.current.x, camAccum.current.y, camZoom.current);
      }
      lastPinchDist.current = dist;
    } else if (activePointers.current.size === 1 && isCamDragging.current && camDragStart.current) {
      const dx = e.clientX - camDragStart.current.x;
      const dy = e.clientY - camDragStart.current.y;
      const sensitivity = 0.005;
      const newX = camAccum.current.x + dx * sensitivity;
      const newY = Math.max(-0.5, Math.min(1.0, camAccum.current.y + dy * sensitivity));
      setCameraOffset(newX, newY, camZoom.current);
    }
  };

  const handleCamPointerUp = (e: React.PointerEvent) => {
    if (activePointers.current.size === 1 && isCamDragging.current && camDragStart.current) {
      const dx = e.clientX - camDragStart.current.x;
      const dy = e.clientY - camDragStart.current.y;
      const sensitivity = 0.005;
      camAccum.current.x += dx * sensitivity;
      camAccum.current.y = Math.max(-0.5, Math.min(1.0, camAccum.current.y + dy * sensitivity));
    }
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) lastPinchDist.current = null;
    if (activePointers.current.size === 0) {
      isCamDragging.current = false;
      camDragStart.current = null;
    } else if (activePointers.current.size === 1) {
      const [, pos] = Array.from(activePointers.current.entries())[0];
      camDragStart.current = { x: pos.x, y: pos.y };
      isCamDragging.current = true;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    camZoom.current = Math.max(0.3, Math.min(3.0, camZoom.current * (1 + e.deltaY * 0.001)));
    setCameraOffset(camAccum.current.x, camAccum.current.y, camZoom.current);
  };

  const handleResetCamera = () => {
    camAccum.current = { x: 0, y: 0 };
    camZoom.current = 1.0;
    resetCameraOffset();
  };

  const handleJoystickDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isGameOver) return;
    gestureStartX.current = e.clientX;
    lastX.current = e.clientX;
    isDragging.current = false;
  };

  const handleJoystickMove = (e: React.PointerEvent) => {
    if (gestureStartX.current === null || lastX.current === null || isGameOver) return;
    e.preventDefault();
    e.stopPropagation();

    const delta = e.clientX - lastX.current;
    const totalDist = Math.abs(e.clientX - gestureStartX.current);
    lastX.current = e.clientX;

    if (totalDist > 5 || Math.abs(delta) > 2) {
        isDragging.current = true;
    }

    if (isDragging.current) {
        const sensitivity = 0.005;
        let newX = currentTargetX.current - (delta * sensitivity);
        newX = Math.max(-1, Math.min(1, newX));
        setTargetX(newX);
        currentTargetX.current = newX;
    }
  };

  const handleJoystickUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isGameOver) return;
    if (!isDragging.current) {
        triggerJump();
    }
    gestureStartX.current = null;
    lastX.current = null;
    isDragging.current = false;
  };

  const km = Math.floor(score / 1000);
  const m = Math.floor(score % 1000);
  const distanceDisplay = km > 0 ? `${km}km ${m}m` : `${m}m`;

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between">
      <style>{`
        @keyframes fast-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
        .animate-fast-blink {
            animation: fast-blink 0.2s linear infinite;
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(24px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
            animation: fadeInUp 1.2s ease-out forwards;
        }
        .animate-fadeInUp-delay {
            opacity: 0;
            animation: fadeInUp 1s ease-out 0.6s forwards;
        }
        .animate-fadeInUp-delay2 {
            opacity: 0;
            animation: fadeInUp 1s ease-out 1.2s forwards;
        }
      `}</style>

      {isIntro && (
        <div
          className="absolute inset-0 z-[400] flex flex-col items-center justify-center pointer-events-auto"
          onClick={() => setIsIntro(false)}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50 pointer-events-none" />
          <div className="relative text-center">
            <h1 className="animate-fadeInUp text-5xl font-extrabold text-white drop-shadow-2xl tracking-widest">
              INFINITE RUNNER
            </h1>
            <p className="animate-fadeInUp-delay text-green-200 text-xl mt-3 drop-shadow-lg">
              Great Nature
            </p>
          </div>
          <p className="animate-fadeInUp-delay2 absolute bottom-24 text-white/80 text-base animate-pulse tracking-widest">
            탭해서 시작
          </p>
        </div>
      )}

      {isPlaying && !isGameOver && (
        <button
          onClick={handlePause}
          className="absolute top-[130px] left-4 z-[200] w-10 h-10 flex items-center justify-center text-xl pointer-events-auto select-none bg-black/30 rounded-full backdrop-blur-sm"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <rect x="5" y="4" width="4" height="16" rx="1"/>
            <rect x="15" y="4" width="4" height="16" rx="1"/>
          </svg>
        </button>
      )}

      {isPaused && isPlaying && !isGameOver && (
        <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
          <div className="bg-white/10 rounded-2xl p-6 border border-white/20 shadow-2xl flex flex-col gap-3 items-center min-w-[200px]">
            {!showExitConfirm ? (
              <>
                <h2 className="text-white text-lg font-bold mb-1">일시정지</h2>
                <button
                  onClick={handleToggleMute}
                  className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-colors"
                >
                  {isMuted ? '🔇 음소거 해제' : '🔊 음소거'}
                </button>
                <button
                  onClick={() => setShowExitConfirm(true)}
                  className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-colors"
                >
                  🏠 나가기
                </button>
                <button
                  onClick={handleResume}
                  className="w-full py-3 rounded-xl bg-green-500/70 border border-green-400/50 text-white font-bold hover:bg-green-500/90 transition-colors"
                >
                  ▶ 계속하기
                </button>
              </>
            ) : (
              <>
                <p className="text-white text-center font-semibold">홈으로 나가시겠어요?<br/><span className="text-white/60 text-sm font-normal">진행 상황이 저장되지 않아요</span></p>
                <div className="flex gap-3 w-full mt-1">
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    className="flex-1 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-colors"
                  >
                    아니요
                  </button>
                  <button
                    onClick={handleExitToMain}
                    className="flex-1 py-3 rounded-xl bg-red-500/70 border border-red-400/50 text-white font-bold hover:bg-red-500/90 transition-colors"
                  >
                    네
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="absolute top-[140px] right-[24px] z-50 pointer-events-none flex flex-col items-end">
        {lossDisplay && (
            <div key={lossDisplay.key} className="text-xl font-bold text-red-500 drop-shadow-md flex items-center gap-1">
                <span>-{lossDisplay.amount}</span>
                <span className="text-lg">🪙</span>
            </div>
        )}
      </div>

      <div
        className="absolute inset-0 z-0 touch-none"
        onPointerDown={handleCamPointerDown}
        onPointerMove={handleCamPointerMove}
        onPointerUp={handleCamPointerUp}
        onPointerLeave={handleCamPointerUp}
        onWheel={handleWheel}
      />

      <div className="p-6 w-full flex justify-between items-start text-white drop-shadow-md pointer-events-none z-20">
        <div>
          <h1 className="text-xl font-bold tracking-wider text-green-100 opacity-80">INFINITE RUNNER</h1>
          <p className="text-sm opacity-70">Great Nature</p>
          
          {gameMode === 'TIME_ATTACK' && (
             <div className={`mt-2 text-2xl font-mono font-bold ${timeRemaining <= 30 ? 'text-red-500 animate-fast-blink' : 'text-white'}`}>
                 {timeRemaining.toFixed(2)}s
             </div>
          )}
        </div>
        
        <div className="flex flex-col items-end">
            <div className="text-2xl font-mono font-bold">{distanceDisplay}</div>
            <div className="flex items-baseline gap-2 opacity-80 mt-1">
                <span className="text-xs uppercase">Speed</span>
                <span className={`text-lg font-bold ${isBoosting ? 'text-red-400 animate-pulse' : ''}`}>{speed.toFixed(0)} km/h</span>
            </div>
            <div className="flex items-baseline gap-2 text-[#FFD700] mt-1 drop-shadow-md">
                <span className="text-xl">●</span>
                <span className="text-lg font-bold">{coins}</span>
            </div>
        </div>
      </div>

      {!isPlaying && !isGameOver && !isIntro && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto transition-opacity z-50">
          <div className="text-center p-6 bg-white/10 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-md flex flex-col gap-3 max-w-sm w-full mx-4">
            <h2 className="text-3xl font-extrabold text-white mb-1 drop-shadow-lg">Infinite Runner!</h2>
            <p className="text-green-100 mb-1 text-base">Choose your journey.</p>
            
            <button 
              onClick={() => handleStart('HEALING')}
              className="px-8 py-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-full text-lg font-bold shadow-lg hover:scale-105 transition-transform active:scale-95"
            >
              Healing Mode
            </button>

            <button 
              onClick={() => handleStart('TIME_ATTACK')}
              className="px-8 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full text-lg font-bold shadow-lg hover:scale-105 transition-transform active:scale-95 mb-1"
            >
              Time Attack Mode
            </button>

            {/* Power-up Descriptions */}
            <div className="grid grid-cols-2 gap-3 mt-1 w-full">
                <div className="bg-white/5 p-2 rounded-xl border border-white/10 flex flex-col items-center">
                    <div className="text-2xl mb-1">🔥</div>
                    <div className="font-bold text-white text-xs">BOOSTER</div>
                    <p className="text-[10px] text-white/70 leading-tight mt-0.5">100 coins for speed-up</p>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/10 flex flex-col items-center">
                    <div className="text-2xl mb-1">🧲</div>
                    <div className="font-bold text-white text-xs">MAGNET</div>
                    <p className="text-[10px] text-white/70 leading-tight mt-0.5">150 coins for magnet</p>
                </div>
            </div>

            <p className="mt-2 text-[10px] text-white/60">Drag Button to Steer • Tap Button to Jump</p>
          </div>
        </div>
      )}

      {isGameOver && (
         <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-auto z-50">
             <div className="text-center p-10 bg-white/10 rounded-3xl border border-white/20 shadow-2xl flex flex-col gap-6 animate-bounce">
                 <h2 className="text-6xl font-extrabold text-red-500 drop-shadow-lg">GAME OVER</h2>
                 <div>
                     <p className="text-white/80 text-lg">Distance Traveled</p>
                     <p className="text-4xl font-mono font-bold text-white">{distanceDisplay}</p>
                 </div>
                 <button 
                    onClick={handleRestart}
                    className="mt-4 px-10 py-3 bg-white text-black rounded-full text-lg font-bold hover:scale-110 transition-transform"
                 >
                    RESTART
                 </button>
             </div>
         </div>
      )}

      {!isGameOver && (
      <div className="p-8 flex justify-between items-end w-full z-20 pointer-events-none">
        
        <div className={`flex flex-col gap-4 mb-2 ml-4 pointer-events-auto transition-opacity ${isBoosting ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
             {!isDefaultCamera && (
               <button
                 onClick={handleResetCamera}
                 className="w-14 h-14 bg-white/30 backdrop-blur-md rounded-full border border-white/50 flex items-center justify-center shadow-lg active:bg-white/50 transition-colors select-none touch-none"
                 title="원래 화면으로"
               >
                 <span className="text-white text-3xl pointer-events-none">⊙</span>
               </button>
             )}
             <button
                onPointerDown={() => handleSpeedStart(1)}
                onPointerUp={handleSpeedEnd}
                onPointerLeave={handleSpeedEnd}
                className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full border border-white/40 flex items-center justify-center active:bg-white/40 transition-colors shadow-lg select-none touch-none"
             >
                <span className="text-white font-bold text-2xl pointer-events-none">▲</span>
             </button>
             <button 
                onPointerDown={() => handleSpeedStart(-1)}
                onPointerUp={handleSpeedEnd}
                onPointerLeave={handleSpeedEnd}
                className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full border border-white/40 flex items-center justify-center active:bg-white/40 transition-colors shadow-lg select-none touch-none"
             >
                <span className="text-white font-bold text-2xl pointer-events-none">▼</span>
             </button>
        </div>

        <div className="relative mr-4">
            
            {/* MAGNET BUTTON */}
            {coins >= 150 && (
                <button
                    onClick={handleMagnet}
                    disabled={magnetCooldown}
                    className={`
                        absolute bottom-56 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full 
                        border-2 border-white/50 shadow-xl pointer-events-auto transition-all transform select-none
                        flex items-center justify-center
                        ${magnetCooldown 
                            ? 'bg-gray-500/50 grayscale opacity-70 scale-90' 
                            : 'bg-gradient-to-tr from-indigo-500 to-purple-400 active:scale-90 hover:scale-110 animate-pulse'}
                    `}
                >
                    <span className="text-3xl filter drop-shadow-md">🧲</span>
                </button>
            )}

            {/* BOOSTER BUTTON */}
            {coins >= 100 && (
                <button
                    onClick={handleBoost}
                    disabled={boostCooldown}
                    className={`
                        absolute bottom-36 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full 
                        border-2 border-white/50 shadow-xl pointer-events-auto transition-all transform select-none
                        flex items-center justify-center
                        ${boostCooldown 
                            ? 'bg-gray-500/50 grayscale opacity-70 scale-90' 
                            : 'bg-gradient-to-tr from-red-600 to-yellow-400 animate-bounce active:scale-90 hover:scale-110'}
                    `}
                >
                    <span className="text-2xl filter drop-shadow-md">🔥</span>
                </button>
            )}

            <div
              onPointerDown={handleJoystickDown}
              onPointerMove={handleJoystickMove}
              onPointerUp={handleJoystickUp}
              onPointerLeave={handleJoystickUp}
              className="w-28 h-28 bg-white/20 backdrop-blur-md rounded-full border-4 border-white/50 shadow-2xl active:bg-white/40 transition-all flex items-center justify-center touch-none relative cursor-pointer pointer-events-auto"
            >
               <div className="w-12 h-12 bg-white/60 rounded-full shadow-inner" />
               <div className="absolute left-2 text-white/70 font-bold text-xl">‹</div>
               <div className="absolute right-2 text-white/70 font-bold text-xl">›</div>
            </div>
        </div>
      </div>
      )}
    </div>
  );
};

const IntroCameraMove = () => {
  const isIntro = useGameStore((state) => state.isIntro);
  const { camera } = useThree();
  useFrame((_, delta) => {
    if (!isIntro) return;
    camera.position.z += 15 * delta;
    camera.lookAt(0, camera.position.y - 3, camera.position.z + 30);
  });
  return null;
};

const FollowingClouds = () => {
  const group = useRef<Group>(null);
  useFrame((state) => { if (group.current) group.current.position.z = state.camera.position.z; });
  return (
      <group ref={group} position={[0, 120, 0]}>
          <Cloud position={[-20, 5, -50]} opacity={0.5} speed={0.2} segments={20} bounds={[10, 2, 10]} color="#ffffff" />
          <Cloud position={[20, 10, -80]} opacity={0.5} speed={0.2} segments={20} bounds={[10, 2, 10]} color="#ffffff" />
          <Cloud position={[0, 15, -30]} opacity={0.3} speed={0.1} segments={10} bounds={[10, 2, 10]} color="#e0f2fe" />
      </group>
  )
}

const Stars = React.forwardRef<Group>((props, ref) => {
  const smallStarGeo = useMemo(() => {
    const geo = new BufferGeometry();
    const count = 1500; 
    const positions = new Float32Array(count * 3);
    for(let i=0; i<count * 3; i++) positions[i] = (Math.random() - 0.5) * 800; 
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geo;
  }, []);
  const bigStarGeo = useMemo(() => {
    const geo = new BufferGeometry();
    const count = 300; 
    const positions = new Float32Array(count * 3);
    for(let i=0; i<count * 3; i++) positions[i] = (Math.random() - 0.5) * 800; 
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geo;
  }, []);
  const starTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0, 0, 64, 64);
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = 'rgba(255, 255, 255, 1)'; ctx.beginPath();
        const cx = 32, cy = 32, r = 28, t = 4;
        ctx.moveTo(cx, cy - r); ctx.quadraticCurveTo(cx + t, cy - t, cx + r, cy); ctx.quadraticCurveTo(cx + t, cy + t, cx, cy + r);
        ctx.quadraticCurveTo(cx - t, cy + t, cx - r, cy); ctx.quadraticCurveTo(cx - t, cy - t, cx, cy - r); ctx.fill();
    }
    return new CanvasTexture(canvas);
  }, []);
  return (
    <group ref={ref}>
      <points geometry={smallStarGeo}><pointsMaterial size={3} map={starTexture} alphaTest={0.1} transparent color="#ffffff" opacity={0} sizeAttenuation={false} fog={false} depthWrite={false} /></points>
      <points geometry={bigStarGeo}><pointsMaterial size={6} map={starTexture} alphaTest={0.1} transparent color="#ffffff" opacity={0} sizeAttenuation={false} fog={false} depthWrite={false} /></points>
    </group>
  )
});

const DayNightCycle = () => {
  const lightRef = useRef<DirectionalLight>(null);
  const sunRef = useRef<Sprite>(null);
  const moonRef = useRef<Sprite>(null);
  const starsRef = useRef<Group>(null);
  const lightTarget = useRef(new Object3D());
  const { scene } = useThree();
  const resetTrigger = useGameStore((state) => state.resetTrigger);
  const timeOffset = useRef(0);
  const lastResetTrigger = useRef(resetTrigger);
  
  const cDay = useMemo(() => new Color("#60a5fa"), []);
  const cSunset = useMemo(() => new Color("#f97316"), []);
  const cNight = useMemo(() => new Color("#0f172a"), []);
  const cSunrise = useMemo(() => new Color("#e879f9"), []);
  const tempColor = useMemo(() => new Color(), []);

  const sunTexture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; const context = canvas.getContext('2d');
    if (context) {
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); gradient.addColorStop(0.15, 'rgba(255, 255, 255, 1)'); gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)'); gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)'); gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    }
    return new CanvasTexture(canvas);
  }, []);

  const moonTextures = useMemo(() => {
    const textures = [];
    for(let i=0; i<5; i++) {
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; const ctx = canvas.getContext('2d');
        if(ctx) {
             const cx = 64, cy = 64, r = 40; ctx.shadowColor = '#ffffdd'; ctx.shadowBlur = 15; ctx.fillStyle = '#ffffee';
             if(i===0) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(cx - 25, cy, r, 0, Math.PI*2); ctx.fill(); } 
             else if(i===1) { ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI/2, Math.PI/2); ctx.fill(); } 
             else if(i===2) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill(); } 
             else if(i===3) { ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI/2, 3*Math.PI/2); ctx.fill(); } 
             else if(i===4) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(cx + 25, cy, r, 0, Math.PI*2); ctx.fill(); }
        }
        textures.push(new CanvasTexture(canvas));
    }
    return textures;
  }, []);

  useEffect(() => {
    scene.add(lightTarget.current);
    if (lightRef.current) lightRef.current.target = lightTarget.current;
    return () => { scene.remove(lightTarget.current); };
  }, [scene]);

  useFrame((state) => {
    const rawTime = state.clock.getElapsedTime();
    if (lastResetTrigger.current !== resetTrigger) {
        timeOffset.current = rawTime;
        lastResetTrigger.current = resetTrigger;
    }
    const time = rawTime - timeOffset.current;

    const pZ = state.camera.position.z;
    const CYCLE_DURATION = 150;
    const rawPhase = (time % CYCLE_DURATION) / CYCLE_DURATION; 
    const cycleCount = Math.floor(time / CYCLE_DURATION);
    const moonPhaseIndex = cycleCount % 5;

    let skyColor = cDay; let nextColor = cDay; let lerpAlpha = 0; let sunY = 80; let moonY = -100; let lightInt = 1.5; let starOpacity = 0;

    if (rawPhase < 0.4) { skyColor = cDay; nextColor = cDay; lerpAlpha = 0; sunY = 80; moonY = -100; lightInt = 1.5; starOpacity = 0; } 
    else if (rawPhase < 0.5) { skyColor = cDay; nextColor = cSunset; lerpAlpha = (rawPhase - 0.4) / 0.1; sunY = 80 - (lerpAlpha * 60); moonY = -100 + (lerpAlpha * 20); lightInt = 1.5 - (lerpAlpha * 0.7); starOpacity = lerpAlpha * 0.3; } 
    else if (rawPhase < 0.6) { skyColor = cSunset; nextColor = cNight; lerpAlpha = (rawPhase - 0.5) / 0.1; sunY = 20 - (lerpAlpha * 40); moonY = -80; lightInt = 0.8 - (lerpAlpha * 0.6); starOpacity = 0.3 + (lerpAlpha * 0.7); } 
    else if (rawPhase < 0.9) { skyColor = cNight; nextColor = cNight; lerpAlpha = 0; sunY = -50; const nightProgress = (rawPhase - 0.6) / 0.3; moonY = Math.sin(nightProgress * Math.PI) * 70; lightInt = 0.2; starOpacity = 1.0; } 
    else { skyColor = cNight; nextColor = cSunrise; moonY = -50; const t = (rawPhase - 0.9) / 0.05; if (t < 1) { lerpAlpha = t; sunY = -50 + (t * 80); lightInt = 0.2 + (t * 0.8); starOpacity = 1.0 - t; } else { skyColor = cSunrise; nextColor = cDay; lerpAlpha = (rawPhase - 0.95) / 0.05; sunY = 30 + (lerpAlpha * 50); lightInt = 1.0 + (lerpAlpha * 0.5); starOpacity = 0; } }

    tempColor.copy(skyColor).lerp(nextColor, lerpAlpha);
    scene.background = tempColor;
    scene.fog.color = tempColor;

    if (sunRef.current) { sunRef.current.position.set(20, sunY, pZ + 400); if (rawPhase > 0.4 && rawPhase < 0.6) sunRef.current.material.color.setRGB(1, 0.8, 0.5); else sunRef.current.material.color.setRGB(1, 1, 1); }
    if (moonRef.current) { moonRef.current.position.set(-20, moonY, pZ + 400); moonRef.current.material.map = moonTextures[moonPhaseIndex]; }
    if (starsRef.current) { starsRef.current.position.set(0, 50, pZ); starsRef.current.rotation.y = time * 0.01; starsRef.current.children.forEach((child: any) => { if (child.material) child.material.opacity = starOpacity; }); }
    if (lightRef.current) { lightRef.current.position.set(50, sunY + 20, pZ + 50); lightTarget.current.position.set(0, 0, pZ + 20); lightRef.current.intensity = lightInt; lightRef.current.target.updateMatrixWorld(); }
  });

  return (
    <>
      <hemisphereLight intensity={0.5} color="#87ceeb" groundColor="#a4d684" />
      <ambientLight intensity={0.3} />
      <directionalLight ref={lightRef} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} shadow-bias={-0.0005} />
      <sprite ref={sunRef} scale={[160, 160, 1]}><spriteMaterial map={sunTexture} transparent fog={false} depthWrite={false} /></sprite>
      <sprite ref={moonRef} scale={[60, 60, 1]}><spriteMaterial transparent fog={false} depthWrite={false} color="#ffffff" /></sprite>
      <Stars ref={starsRef} />
    </>
  );
};

const Scene = () => (
    <>
      <IntroCameraMove />
      <FollowingClouds />
      <DayNightCycle />
      <Player />
      <World />
      <fog attach="fog" args={['#60a5fa', 100, 500]} />
    </>
);

const App = () => (
    <div className="w-full h-full relative bg-blue-400 overflow-hidden select-none">
      <UI />
      <Canvas shadows camera={{ position: [0, 8, -10], fov: 60 }}>
        <Suspense fallback={null}><Scene /></Suspense>
      </Canvas>
    </div>
);

export default App;
