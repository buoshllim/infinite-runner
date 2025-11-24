
import { create } from 'zustand';
import { WORLD_CONFIG } from './types';

export type GameMode = 'HEALING' | 'TIME_ATTACK' | null;

interface GameState {
  isPlaying: boolean;
  score: number;
  coins: number;
  jumpRequest: boolean;
  targetX: number; // -1 to 1 (Left to Right normalized)
  speed: number;
  cameraDragOffset: { x: number, y: number }; // x: Yaw (left/right), y: Pitch (up/down)
  
  // Game Modes
  gameMode: GameMode;
  timeRemaining: number;
  isGameOver: boolean;

  // Booster State
  isBoosting: boolean;
  boostCooldown: boolean;
  
  // Magnet State
  isMagnetActive: boolean;
  magnetCooldown: boolean;
  
  // Reset Signal
  resetTrigger: number;

  // Coin Loss Event
  lastCoinLoss: { amount: number, timestamp: number } | null;

  // Physical Penalties
  knockbackForceY: number; // ADDED: Vertical knockback force

  setIsPlaying: (playing: boolean) => void;
  incrementScore: (amount: number) => void;
  collectCoin: () => void;
  addCoins: (amount: number) => void;
  removeCoins: (amount: number) => void; 
  triggerJump: () => void;
  resetJump: () => void;
  setTargetX: (x: number) => void;
  updateSpeed: (delta: number) => void; 
  setRawSpeed: (speed: number) => void; 
  setBoostState: (isBoosting: boolean, cooldown: boolean) => void; 
  setMagnetState: (isActive: boolean, cooldown: boolean) => void;
  setCameraDragOffset: (x: number, y: number) => void;
  
  setGameMode: (mode: GameMode) => void;
  setTimeRemaining: (time: number) => void;
  setGameOver: (isOver: boolean) => void;
  resetGame: () => void;
  
  triggerKnockback: (forceY: number) => void; // ADDED
  resetKnockback: () => void; // ADDED
}

export const useGameStore = create<GameState>((set) => ({
  isPlaying: false,
  score: 0,
  coins: 0,
  jumpRequest: false,
  targetX: 0,
  speed: WORLD_CONFIG.SPEED,
  cameraDragOffset: { x: 0, y: 0 },
  
  gameMode: null,
  timeRemaining: 120, 
  isGameOver: false,

  isBoosting: false,
  boostCooldown: false,
  
  isMagnetActive: false,
  magnetCooldown: false,
  
  resetTrigger: 0,

  lastCoinLoss: null,
  
  knockbackForceY: 0,

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  incrementScore: (amount) => set((state) => ({ score: state.score + amount })),
  collectCoin: () => set((state) => ({ coins: state.coins + 1 })),
  addCoins: (amount) => set((state) => ({ coins: state.coins + amount })),
  
  removeCoins: (amount) => set((state) => {
    const newCoins = Math.max(0, state.coins - amount);
    return { 
        coins: newCoins,
        lastCoinLoss: { amount, timestamp: Date.now() } 
    };
  }),

  triggerJump: () => set({ jumpRequest: true }),
  resetJump: () => set({ jumpRequest: false }),
  setTargetX: (x) => set({ targetX: x }),
  
  updateSpeed: (delta) => set((state) => ({ 
    speed: Math.max(0, Math.min(100, state.speed + delta)) 
  })),
  
  setRawSpeed: (speed) => set({ speed }),

  setBoostState: (isBoosting, boostCooldown) => set({ isBoosting, boostCooldown }),
  setMagnetState: (isMagnetActive, magnetCooldown) => set({ isMagnetActive, magnetCooldown }),

  setCameraDragOffset: (x, y) => set({ cameraDragOffset: { x, y } }),

  setGameMode: (mode) => set({ gameMode: mode }),
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  setGameOver: (isOver) => set({ isGameOver: isOver }),
  
  triggerKnockback: (forceY) => set({ knockbackForceY: forceY }),
  resetKnockback: () => set({ knockbackForceY: 0 }),

  resetGame: () => set((state) => ({ 
      score: 0, 
      coins: 0, 
      isPlaying: false, 
      targetX: 0, 
      speed: WORLD_CONFIG.SPEED, 
      cameraDragOffset: { x: 0, y: 0 },
      isBoosting: false,
      boostCooldown: false,
      isMagnetActive: false,
      magnetCooldown: false,
      timeRemaining: 120,
      isGameOver: false,
      resetTrigger: state.resetTrigger + 1,
      lastCoinLoss: null,
      knockbackForceY: 0
  })),
}));