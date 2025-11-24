
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
  const setCameraDragOffset = useGameStore((state) => state.setCameraDragOffset);
  const coins = useGameStore((state) => state.coins);
  const addCoins = useGameStore((state) => state.addCoins);
  const lastCoinLoss = useGameStore((state) => state.lastCoinLoss); 
  
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const timeRemaining = useGameStore((state) => state.timeRemaining);
  const setTimeRemaining = useGameStore((state) => state.setTimeRemaining);
  const isGameOver = useGameStore((state) => state.isGameOver);
  const setGameOver = useGameStore((state) => state.setGameOver);
  
  const isBoosting = useGameStore((state) => state.isBoosting);
  const boostCooldown = useGameStore((state) => state.boostCooldown);
  const setBoostState = useGameStore((state) => state.setBoostState);

  const isMagnetActive = useGameStore((state) => state.isMagnetActive);
  const magnetCooldown = useGameStore((state) => state.magnetCooldown);
  const setMagnetState = useGameStore((state) => state.setMagnetState);

  const gestureStartX = useRef<number | null>(null);
  const lastX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const currentTargetX = useRef<number>(0);

  const camDragStart = useRef<{ x: number, y: number } | null>(null);
  const isCamDragging = useRef(false);

  const speedIntervalRef = useRef<number | null>(null);
  const pressStartTimeRef = useRef<number>(0);

  const [lossDisplay, setLossDisplay] = useState<{amount: number, key: number} | null>(null);

  useEffect(() => {
    if (lastCoinLoss) {
        setLossDisplay({ amount: lastCoinLoss.amount, key: lastCoinLoss.timestamp });
        const timer = setTimeout(() => setLossDisplay(null), 1000);
        return () => clearTimeout(timer);
    }
  }, [lastCoinLoss]);

  useEffect(() => {
    if (isPlaying && gameMode === 'TIME_ATTACK' && !isGameOver) {
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
  }, [isPlaying, gameMode, isGameOver]);

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
    camDragStart.current = { x: e.clientX, y: e.clientY };
    isCamDragging.current = true;
  };

  const handleCamPointerMove = (e: React.PointerEvent) => {
    if (!isCamDragging.current || !camDragStart.current) return;
    const dx = e.clientX - camDragStart.current.x;
    const dy = e.clientY - camDragStart.current.y;
    const sensitivity = 0.005;
    setCameraDragOffset(dx * sensitivity, Math.max(-0.5, Math.min(1.0, dy * sensitivity)));
  };

  const handleCamPointerUp = () => {
    isCamDragging.current = false;
    camDragStart.current = null;
    setCameraDragOffset(0, 0);
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
      `}</style>

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

      {!isPlaying && !isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto transition-opacity z-50">
          <div className="text-center p-8 bg-white/10 rounded-3xl border border-white/20 shadow-2xl backdrop-blur-md flex flex-col gap-4 max-w-md w-full">
            <h2 className="text-5xl font-extrabold text-white mb-2 drop-shadow-lg">Infinite Runner!</h2>
            <p className="text-green-100 mb-2 text-lg">Choose your journey.</p>
            
            <button 
              onClick={() => handleStart('HEALING')}
              className="px-12 py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-full text-xl font-bold shadow-lg hover:scale-105 transition-transform active:scale-95"
            >
              Healing Mode
            </button>

            <button 
              onClick={() => handleStart('TIME_ATTACK')}
              className="px-12 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full text-xl font-bold shadow-lg hover:scale-105 transition-transform active:scale-95 mb-2"
            >
              Time Attack Mode
            </button>

            {/* Power-up Descriptions */}
            <div className="grid grid-cols-2 gap-4 mt-2 w-full">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col items-center">
                    <div className="text-3xl mb-1">🔥</div>
                    <div className="font-bold text-white text-sm">BOOSTER</div>
                    <p className="text-[10px] text-white/70 leading-tight mt-1">100 coins for speed-up</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col items-center">
                    <div className="text-3xl mb-1">🧲</div>
                    <div className="font-bold text-white text-sm">MAGNET</div>
                    <p className="text-[10px] text-white/70 leading-tight mt-1">150 coins for magnet</p>
                </div>
            </div>

            <p className="mt-4 text-xs text-white/60">Drag Button to Steer • Tap Button to Jump</p>
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
