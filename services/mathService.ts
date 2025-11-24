
import { WORLD_CONFIG } from '../types';

// Simple pseudo-random hash for deterministic procedural generation
export function hash(x: number, z: number) {
  let h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453123;
  return h - Math.floor(h);
}

// --- RIVER LOGIC ---
const RIVER_FREQUENCY = 450; // Meters between rivers
const RIVER_WIDTH = 14;      // Width of the river (Jumpable with good timing/speed)

export function getRiverInfo(z: number) {
  // No rivers at the very start
  if (z < 200) return { isRiver: false, bedDepth: 0, centerZ: 0 };

  const localZ = z % RIVER_FREQUENCY;
  const center = RIVER_FREQUENCY / 2; // River is in the middle of the cycle
  const dist = Math.abs(localZ - center);

  if (dist < RIVER_WIDTH) {
      // Parabolic or Cosine riverbed profile
      const t = dist / RIVER_WIDTH;
      const depth = (Math.cos(t * Math.PI / 2)) * 3.5;
      return { isRiver: true, bedDepth: depth, centerZ: Math.floor(z / RIVER_FREQUENCY) * RIVER_FREQUENCY + center };
  }

  return { isRiver: false, bedDepth: 0, centerZ: 0 };
}

// Internal helper for base terrain noise (without river carving)
export function calculateBaseTerrain(x: number, z: number): number {
  const { TERRAIN_SCALE, TERRAIN_HEIGHT } = WORLD_CONFIG;
  
  const y1 = Math.sin(x * TERRAIN_SCALE * 0.5) * Math.cos(z * TERRAIN_SCALE * 0.5);
  const y2 = Math.sin(z * TERRAIN_SCALE * 0.2 + x * TERRAIN_SCALE * 0.2) * 2;
  const y3 = Math.cos(x * TERRAIN_SCALE) * 0.5;
  
  const y4 = Math.sin(x * TERRAIN_SCALE * 3.0) * Math.cos(z * TERRAIN_SCALE * 3.0) * 0.1;
  const y5 = Math.sin(x * TERRAIN_SCALE * 10.0) * Math.cos(z * TERRAIN_SCALE * 10.0) * 0.05; 
  
  return (y1 + y2 + y3 + y4 + y5) * (TERRAIN_HEIGHT / 2.5);
}

// --- BRIDGE LOGIC ---
const BRIDGE_LENGTH = 24; 
const BRIDGE_WIDTH = 6;
const BRIDGE_ARCH_HEIGHT = 3.5;

export function getBridgeX(riverCenterZ: number) {
    // Deterministic random X position for the bridge based on river Z
    // Range: -10 to 10 (keeping within standard playable area)
    const h = hash(riverCenterZ, 999);
    return (h - 0.5) * 20; 
}

export function getBridgeInfo(x: number, z: number) {
  // Find the closest river center relative to this Z
  const center = Math.floor(z / RIVER_FREQUENCY) * RIVER_FREQUENCY + (RIVER_FREQUENCY / 2);
  const dist = z - center;
  
  const bridgeX = getBridgeX(center);

  // Check bounds
  if (Math.abs(dist) < BRIDGE_LENGTH / 2 && Math.abs(x - bridgeX) < BRIDGE_WIDTH / 2) {
      // Base height at the banks (approx 12m away) at the BRIDGE'S X position
      const baseHeight = calculateBaseTerrain(bridgeX, center - 12); 
      
      // Parabolic Arch: y = H * (1 - (x/R)^2)
      const halfL = BRIDGE_LENGTH / 2;
      const normDist = dist / halfL; // -1 to 1
      const archY = BRIDGE_ARCH_HEIGHT * (1 - normDist * normDist); 
      
      return { isBridge: true, height: baseHeight + archY + 0.2 };
  }
  return { isBridge: false, height: -Infinity };
}

// Composed noise function for rolling hills (Deterministic)
export function getTerrainHeight(x: number, z: number): number {
  let h = calculateBaseTerrain(x, z);
  
  // --- RIVER CARVING ---
  const river = getRiverInfo(z);
  if (river.isRiver) {
      h -= river.bedDepth;
  }
  
  // Flatten the "start" area
  let flattenFactor = 1.0;
  const TRANSITION_END = 60; 
  
  if (z < TRANSITION_END) {
     if (z < 0) {
         flattenFactor = 0.2;
     } else {
         const t = z / TRANSITION_END;
         const smoothT = t * t * (3 - 2 * t);
         flattenFactor = 0.2 + (0.8 * smoothT);
     }
  }

  h *= flattenFactor;

  return h;
}

// --- CLOUD LOGIC ---
const CLOUD_STEP_X = 20;
const CLOUD_STEP_Z = 15;

export function getCloudInfo(x: number, z: number) {
  const gridX = Math.round(x / CLOUD_STEP_X) * CLOUD_STEP_X;
  const gridZ = Math.round(z / CLOUD_STEP_Z) * CLOUD_STEP_Z;

  const h = hash(gridX * 0.123, gridZ * 0.123);
  
  // Reduced probability to spawn fewer clouds (from 0.85 to 0.92)
  if (h > 0.92) {
      const cloudY = 35 + (hash(gridZ, gridX) * 20); 
      const scale = 1.5 + hash(gridX, gridZ) * 1.5;  
      const radius = 2.5 * scale; 
      
      return { isCloud: true, x: gridX, y: cloudY, z: gridZ, scale, radius };
  }

  return { isCloud: false, x: gridX, y: 0, z: gridZ, scale: 0, radius: 0 };
}

// --- EAGLE LOGIC ---
export function getEagleInfo(x: number, z: number) {
    // We assume X and Z are already grid-snapped by the caller loop for efficiency
    if (z < 200) return { isEagle: false };

    const h = hash(x * 0.555, z * 0.333);
    
    // Reduced spawn rate: 4% (was 10%)
    if (h > 0.96) {
        // Height: 25m to 55m to cover high obstacles and clouds
        const randomHeight = 25 + (hash(z, x) * 30); 
        return { isEagle: true, x, y: randomHeight, z };
    }
    return { isEagle: false };
}

export type ObstacleType = 'tree_pine' | 'tree_oak' | 'tree_round' | 'rock' | 'log' | 'tall_tree' | 'tall_rock' | 'structure_cabin' | 'structure_car' | 'structure_plane' | 'structure_heli' | 'none';

export function getObstacleAt(x: number, z: number): ObstacleType {
  // No obstacles on bridge or in river
  if (getBridgeInfo(x, z).isBridge) return 'none';
  if (getRiverInfo(z).isRiver) return 'none';

  const gridX = Math.round(x / 4) * 4;
  const gridZ = Math.round(z / 8) * 8;

  if (Math.abs(x - gridX) > 1 || Math.abs(z - gridZ) > 1) return 'none';
  if (z < 150) return 'none';

  const h = hash(gridX, gridZ);
  const distFromCenter = Math.abs(gridX);

  if (h > 0.995) { 
      const subType = hash(gridZ, gridX); 
      if (subType > 0.85) return 'structure_heli';
      if (subType > 0.70) return 'structure_plane';
      if (subType > 0.55) return 'structure_car';
      if (subType > 0.40) return 'structure_cabin';
      if (subType > 0.20) return 'tall_rock';
      return 'tall_tree';
  }

  if (distFromCenter < 12) {
    if (h > 0.96) return 'rock';
    if (h > 0.92 && h <= 0.96) return 'log';
    return 'none';
  }

  if (h > 0.65) {
     if (h > 0.90) return 'tree_pine';
     if (h > 0.78) return 'tree_oak';
     return 'tree_round';
  }
  if (h > 0.60) return 'rock';
  
  return 'none';
}

export type AnimalType = 'bear' | 'rabbit' | 'squirrel' | 'lamb' | 'chicken' | 'duck' | 'fox' | 'deer' | 'hedgehog' | 'pig' | 'cat' | 'none';

export function getAnimalAt(x: number, z: number): AnimalType {
  // No animals on bridge or in river
  if (getBridgeInfo(x, z).isBridge) return 'none';
  if (getRiverInfo(z).isRiver) return 'none';

  const gridX = Math.round(x / 8) * 8; 
  const gridZ = Math.round(z / 15) * 15;

  if (Math.abs(x - gridX) > 2 || Math.abs(z - gridZ) > 2) return 'none';
  if (z < 150) return 'none';
  if (Math.abs(gridX) > 15) return 'none';

  const h = hash(gridX + 500, gridZ + 500);
  
  if (h > 0.98) return 'bear';
  if (h > 0.96) return 'deer';
  if (h > 0.94) return 'fox';
  if (h > 0.92) return 'pig'; 
  if (h > 0.90) return 'lamb';
  if (h > 0.88) return 'cat'; 
  if (h > 0.86) return 'duck';
  if (h > 0.84) return 'chicken';
  if (h > 0.81) return 'hedgehog'; 
  if (h > 0.77) return 'squirrel';
  if (h > 0.70) return 'rabbit'; 

  return 'none';
}

export function getCoinInfo(x: number, z: number) {
  if (z < 150) return { isCoin: false };
  
  // Allow coins on bridge
  const isBridge = getBridgeInfo(x, z).isBridge;
  if (getRiverInfo(z).isRiver && !isBridge) return { isCoin: false };

  const gridX = Math.round(x / 4) * 4;
  const gridZ = Math.round(z / 4) * 4;

  if (Math.abs(x - gridX) > 1 || Math.abs(z - gridZ) > 1) return { isCoin: false };

  if (getObstacleAt(gridX, gridZ) !== 'none') return { isCoin: false };
  if (getAnimalAt(gridX, gridZ) !== 'none') return { isCoin: false };

  const h = hash(gridX * 0.987, gridZ * 0.654);
  
  if (h > 0.95) {
      return { isCoin: true, x: gridX, z: gridZ };
  }

  return { isCoin: false };
}