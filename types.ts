export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export const WORLD_CONFIG = {
  SPEED: 10,
  JUMP_FORCE: 18,
  GRAVITY: 40,
  TERRAIN_SCALE: 0.15,
  TERRAIN_HEIGHT: 4,
  CHUNK_SIZE: 60, // Smaller chunks for smoother loading
  RENDER_DISTANCE_CHUNKS: 8, // How many chunks ahead to see
  LANE_WIDTH: 20 // Total width allowed to roam
};