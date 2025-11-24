
import React, { useRef, forwardRef, useImperativeHandle, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh, MathUtils, Object3D, InstancedMesh, DynamicDrawUsage, Color } from 'three';
import { WORLD_CONFIG } from '../types';
import { getTerrainHeight, getObstacleAt, getRiverInfo, getCloudInfo, getBridgeInfo } from '../services/mathService';
import { useGameStore } from '../store';
import { audioService } from '../services/audioService';

interface SplashHandle {
  explode: (x: number, z: number) => void;
}

const SplashParticles = forwardRef<SplashHandle, {}>((_, ref) => {
  const count = 40;
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const particles = useMemo(() => new Array(count).fill(0).map(() => ({ pos: new Vector3(0, -100, 0), vel: new Vector3(0, 0, 0), life: 0, active: false })), []);
  useImperativeHandle(ref, () => ({
    explode: (x: number, z: number) => {
      particles.forEach(p => {
        p.active = true; p.life = 1.0;
        p.pos.set(x + (Math.random() - 0.5) * 1.5, -0.4, z + (Math.random() - 0.5) * 1.5);
        p.vel.set((Math.random() - 0.5) * 8, Math.random() * 8 + 5, (Math.random() - 0.5) * 8 + 5);
      });
    }
  }));
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    let activeCount = 0;
    particles.forEach((p, i) => {
      if (p.active) {
        activeCount++; p.vel.y -= 30 * delta; p.pos.addScaledVector(p.vel, delta); p.life -= delta * 1.5;
        if (p.life <= 0 || p.pos.y < -1) { p.active = false; p.pos.set(0, -100, 0); }
        dummy.position.copy(p.pos); const scale = Math.max(0, p.life * 0.4); dummy.scale.set(scale, scale, scale); dummy.rotation.set(Math.random(), Math.random(), Math.random()); dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix);
      } else { dummy.position.set(0, -100, 0); dummy.scale.set(0, 0, 0); dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix); }
    });
    if (activeCount > 0 || meshRef.current.count > 0) meshRef.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} usage={DynamicDrawUsage}>
      <boxGeometry args={[0.15, 0.15, 0.15]} />
      <meshStandardMaterial color="#bfdbfe" emissive="#60a5fa" emissiveIntensity={0.8} roughness={0.1} />
    </instancedMesh>
  );
});

interface DebrisHandle {
  explode: (x: number, z: number, color: string, height: number) => void;
}

const DebrisParticles = forwardRef<DebrisHandle, {}>((_, ref) => {
  const count = 150; 
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const particles = useMemo(() => new Array(count).fill(0).map(() => ({ pos: new Vector3(0, -100, 0), vel: new Vector3(0, 0, 0), rotVel: new Vector3(0, 0, 0), life: 0, active: false, scale: 1, color: new Color() })), []);
  useImperativeHandle(ref, () => ({
    explode: (x: number, z: number, color: string, height: number) => {
      particles.forEach(p => {
        p.active = true; p.life = 1.5 + Math.random(); 
        const spawnY = Math.random() * height;
        p.pos.set(x + (Math.random() - 0.5) * 1.5, spawnY + getTerrainHeight(x, z), z + (Math.random() - 0.5) * 1.5); 
        p.vel.set((Math.random() - 0.5) * 10, (Math.random() * 5) - 2, (Math.random() - 0.5) * 10 + 5);
        p.rotVel.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
        p.scale = Math.random() * 0.4 + 0.2; p.color.set(color); p.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
      });
    }
  }));
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    let activeCount = 0;
    particles.forEach((p, i) => {
      if (p.active) {
        activeCount++; p.vel.y -= 30 * delta; p.pos.addScaledVector(p.vel, delta);
        const terrainY = getTerrainHeight(p.pos.x, p.pos.z);
        if (p.pos.y < terrainY) { p.pos.y = terrainY; p.vel.y *= -0.5; p.vel.x *= 0.8; p.vel.z *= 0.8; }
        p.life -= delta; 
        if (p.life <= 0) { p.active = false; p.pos.set(0, -100, 0); }
        dummy.position.copy(p.pos); const s = p.scale * Math.min(1, p.life); dummy.scale.set(s, s, s); dummy.rotation.x += p.rotVel.x * delta; dummy.rotation.y += p.rotVel.y * delta; dummy.rotation.z += p.rotVel.z * delta; dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix); meshRef.current!.setColorAt(i, p.color);
      } else { dummy.position.set(0, -100, 0); dummy.scale.set(0, 0, 0); dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix); }
    });
    if (activeCount > 0 || meshRef.current.count > 0) { meshRef.current.instanceMatrix.needsUpdate = true; if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true; }
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} usage={DynamicDrawUsage}>
      <boxGeometry args={[0.8, 0.8, 0.8]} /> <meshStandardMaterial flatShading roughness={0.8} />
    </instancedMesh>
  );
});

export const Player: React.FC = () => {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  
  const splashRef = useRef<SplashHandle>(null);
  const debrisRef = useRef<DebrisHandle>(null);
  
  const wasAboveWater = useRef(true);
  const lastHitKey = useRef<string>("");
  const smoothedCameraY = useRef(5);
  const shakeIntensity = useRef(0);
  const lastMilestone = useRef(0);
  const currentLookOffset = useRef(new Vector3(0, 0, 0));
  const stepTimer = useRef(0);

  const { camera } = useThree();
  const isPlaying = useGameStore(state => state.isPlaying);
  const incrementScore = useGameStore(state => state.incrementScore);
  const addCoins = useGameStore(state => state.addCoins); 
  const removeCoins = useGameStore(state => state.removeCoins); 
  const score = useGameStore(state => state.score);
  const jumpRequest = useGameStore(state => state.jumpRequest);
  const resetJump = useGameStore(state => state.resetJump);
  const targetX = useGameStore(state => state.targetX);
  const speed = useGameStore(state => state.speed);
  const cameraDragOffset = useGameStore(state => state.cameraDragOffset);
  const resetTrigger = useGameStore(state => state.resetTrigger);
  const knockbackForceY = useGameStore(state => state.knockbackForceY); 
  const resetKnockback = useGameStore(state => state.resetKnockback);

  const velocity = useRef(new Vector3(0, 0, speed));
  const position = useRef(new Vector3(0, 5, 0));
  const isGrounded = useRef(false);
  const wasGrounded = useRef(false);
  const prevResetTrigger = useRef(resetTrigger);

  const BODY_W = 0.45; const BODY_H = 0.70; const BODY_D = 0.25; const HEAD_SZ = 0.35; const LIMB_W = 0.20; const LIMB_H = 0.70;
  const LEG_Y = LIMB_H; const BODY_Y = LEG_Y + BODY_H/2; const HEAD_Y = LEG_Y + BODY_H + HEAD_SZ/2;

  useFrame((state, delta) => {
    // --- RESET LOGIC MOVED INSIDE USEFRAME ---
    if (prevResetTrigger.current !== resetTrigger) {
        position.current.set(0, 5, 0); 
        velocity.current.set(0, 0, 0); 
        isGrounded.current = false; 
        wasGrounded.current = false;
        lastHitKey.current = ""; 
        lastMilestone.current = 0; 
        wasAboveWater.current = true; 
        smoothedCameraY.current = 5; 
        shakeIntensity.current = 0; 
        currentLookOffset.current.set(0, 0, 0);
        stepTimer.current = 0;
        
        if (groupRef.current) { 
            groupRef.current.position.set(0, 5, 0); 
            groupRef.current.rotation.set(0, 0, 0); 
        }
        
        camera.position.set(0, 9.5, -9.5); 
        camera.lookAt(0, 6, 8);
        
        prevResetTrigger.current = resetTrigger;
        return; // Skip physics frame
    }

    if (!isPlaying || !groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const playerGroup = groupRef.current;

    velocity.current.z = MathUtils.lerp(velocity.current.z, speed, delta * 2);
    position.current.x = MathUtils.lerp(position.current.x, targetX * WORLD_CONFIG.LANE_WIDTH, delta * 4);
    position.current.z += velocity.current.z * delta;

    velocity.current.y -= WORLD_CONFIG.GRAVITY * delta;
    
    if (jumpRequest) { velocity.current.y = WORLD_CONFIG.JUMP_FORCE; resetJump(); isGrounded.current = false; audioService.playJump(); }

    // --- APPLY KNOCKBACK ---
    if (knockbackForceY !== 0) {
        velocity.current.y = knockbackForceY; // Force downward velocity
        resetKnockback(); // Clear logic
        isGrounded.current = false;
        shakeIntensity.current = 1.5; // Big shake on impact
    }

    position.current.y += velocity.current.y * delta;

    const terrainHeight = getTerrainHeight(position.current.x, position.current.z);
    
    const bridgeInfo = getBridgeInfo(position.current.x, position.current.z);
    const riverInfo = getRiverInfo(position.current.z);
    const WATER_LEVEL = -0.5;
    
    if (riverInfo.isRiver && !bridgeInfo.isBridge) {
        if (wasAboveWater.current && position.current.y <= WATER_LEVEL + 0.2) {
            splashRef.current?.explode(position.current.x, position.current.z);
            wasAboveWater.current = false;
            audioService.playSplash();
        }
    }
    if (position.current.y > WATER_LEVEL + 0.5) {
        wasAboveWater.current = true;
    }

    let platformHeight = -Infinity;

    if (bridgeInfo.isBridge) {
        platformHeight = Math.max(platformHeight, bridgeInfo.height);
        if (isGrounded.current && velocity.current.z > 1) {
            const runFreq = 8 + (Math.min(speed, 40) * 0.5); 
            const stepInterval = 1 / (runFreq * 2); 
            stepTimer.current += delta;
            if (stepTimer.current >= stepInterval) {
                stepTimer.current = 0;
                audioService.playWoodStep();
            }
        }
    } else {
        stepTimer.current = 0; 
    }

    const cloudInfo = getCloudInfo(position.current.x, position.current.z);
    if (cloudInfo.isCloud) {
        const dx = position.current.x - cloudInfo.x;
        const dz = position.current.z - cloudInfo.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < cloudInfo.radius) {
            const cloudTop = cloudInfo.y + (2.0 * cloudInfo.scale) - 0.5;
            if (velocity.current.y <= 0 && position.current.y >= cloudTop - 0.5) {
                platformHeight = Math.max(platformHeight, cloudTop);
            }
        }
    }

    const gridX = Math.round(position.current.x / 4) * 4;
    const gridZ = Math.round(position.current.z / 8) * 8;
    const obsType = getObstacleAt(gridX, gridZ);
    if (obsType !== 'none') {
      const dx = position.current.x - gridX;
      const dz = position.current.z - gridZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      let hitRadius = 1.0;
      let isLarge = false;
      if (obsType === 'rock') hitRadius = 0.7;
      if (obsType === 'log') hitRadius = 0.5;
      if (obsType.startsWith('structure')) { hitRadius = 2.5; isLarge = true; }
      if (obsType === 'tall_tree' || obsType === 'tall_rock') { hitRadius = 2.0; isLarge = true; }

      if (dist < hitRadius) {
         const obsBaseY = getTerrainHeight(gridX, gridZ);
         let obsHeight = 0; let obsColor = "#5d4037"; 
         if (obsType === 'tree_pine') { obsHeight = 4.5; obsColor = "#3e2723"; }
         else if (obsType === 'tree_oak') { obsHeight = 4; obsColor = "#5d4037"; }
         else if (obsType === 'tree_round') { obsHeight = 4; obsColor = "#5d4037"; }
         else if (obsType === 'tall_tree') { obsHeight = 15; obsColor = "#4e342e"; }
         else if (obsType === 'tall_rock') { obsHeight = 12; obsColor = "#57534e"; }
         else if (obsType === 'structure_cabin') { obsHeight = 7; obsColor = "#78350f"; }
         else if (obsType === 'structure_car') { obsHeight = 2.5; obsColor = "#9a3412"; }
         else if (obsType === 'structure_plane') { obsHeight = 6; obsColor = "#cbd5e1"; }
         else if (obsType === 'structure_heli') { obsHeight = 4; obsColor = "#3f6212"; }
         else if (obsType === 'rock') { obsHeight = 1.0; obsColor = "#78716c"; }
         else if (obsType === 'log') { obsHeight = 0.5; obsColor = "#4a3728"; }

         const topY = obsBaseY + obsHeight;
         if (position.current.y >= topY - 0.5) { platformHeight = Math.max(platformHeight, topY); } 
         else if (position.current.y < topY - 0.5 && dist < (hitRadius * 0.8)) {
           const currentObsKey = `${gridX},${gridZ}`;
           if (lastHitKey.current !== currentObsKey) {
               audioService.playCrash();
               shakeIntensity.current = 0.8; 
               debrisRef.current?.explode(gridX, gridZ, obsColor, obsHeight);
               lastHitKey.current = currentObsKey;
               
               // Coin Loss Logic
               if (isLarge) {
                   const loss = Math.floor(Math.random() * 2) + 2; // 2 or 3
                   removeCoins(loss);
               } else {
                   removeCoins(1);
               }
           }
         }
      }
    }

    const floorY = Math.max(terrainHeight, platformHeight);

    if (position.current.y < floorY) { position.current.y = floorY; velocity.current.y = 0; isGrounded.current = true; } else { isGrounded.current = false; }
    if (isGrounded.current && !wasGrounded.current) { audioService.playLand(); }
    wasGrounded.current = isGrounded.current;

    playerGroup.position.copy(position.current);

    smoothedCameraY.current = MathUtils.lerp(smoothedCameraY.current, position.current.y, delta * 2.0);
    if (shakeIntensity.current > 0) { shakeIntensity.current = MathUtils.lerp(shakeIntensity.current, 0, delta * 5); if (shakeIntensity.current < 0.01) shakeIntensity.current = 0; }
    const shakeX = (Math.random() - 0.5) * shakeIntensity.current;
    const shakeY = (Math.random() - 0.5) * shakeIntensity.current;
    const targetLookX = -cameraDragOffset.x * Math.PI; 
    const targetLookY = cameraDragOffset.y * Math.PI * 0.3;
    currentLookOffset.current.x = MathUtils.lerp(currentLookOffset.current.x, targetLookX, delta * 8);
    currentLookOffset.current.y = MathUtils.lerp(currentLookOffset.current.y, targetLookY, delta * 8);
    const baseOffset = new Vector3(0, 4.5, -9.5);
    baseOffset.applyAxisAngle(new Vector3(1, 0, 0), currentLookOffset.current.y);
    baseOffset.applyAxisAngle(new Vector3(0, 1, 0), currentLookOffset.current.x);
    const camTargetPos = new Vector3(position.current.x * 0.5 + shakeX, smoothedCameraY.current + shakeY, position.current.z).add(baseOffset);
    camera.position.lerp(camTargetPos, delta * 3.5);
    const lookAtTarget = new Vector3(position.current.x * 0.1, smoothedCameraY.current + 1.0, position.current.z + 8);
    camera.lookAt(lookAtTarget);

    if (leftArmRef.current && rightArmRef.current && leftLegRef.current && rightLegRef.current && bodyRef.current && headRef.current) {
      const isJumping = !isGrounded.current && velocity.current.y > -5; 
      const currentSpeed = velocity.current.z;

      if (isJumping) {
        leftArmRef.current.rotation.x = MathUtils.lerp(leftArmRef.current.rotation.x, -2.5, delta * 15);
        leftArmRef.current.rotation.z = MathUtils.lerp(leftArmRef.current.rotation.z, 0, delta * 15);
        rightArmRef.current.rotation.x = MathUtils.lerp(rightArmRef.current.rotation.x, 1.0, delta * 15);
        rightArmRef.current.rotation.z = MathUtils.lerp(rightArmRef.current.rotation.z, 0, delta * 15);
        leftLegRef.current.rotation.x = MathUtils.lerp(leftLegRef.current.rotation.x, -1.2, delta * 15);
        leftLegRef.current.rotation.z = 0;
        rightLegRef.current.rotation.x = MathUtils.lerp(rightLegRef.current.rotation.x, 0.8, delta * 15);
        rightLegRef.current.rotation.z = 0;
        playerGroup.rotation.x = MathUtils.lerp(playerGroup.rotation.x, -0.1, delta * 5);
      } else if (currentSpeed < 0.5) {
        // --- IDLE POSE (Speed ~0) ---
        leftArmRef.current.rotation.x = MathUtils.lerp(leftArmRef.current.rotation.x, 0, delta * 10);
        leftArmRef.current.rotation.z = MathUtils.lerp(leftArmRef.current.rotation.z, 0, delta * 10);
        rightArmRef.current.rotation.x = MathUtils.lerp(rightArmRef.current.rotation.x, 0, delta * 10);
        rightArmRef.current.rotation.z = MathUtils.lerp(rightArmRef.current.rotation.z, 0, delta * 10);
        leftLegRef.current.rotation.x = MathUtils.lerp(leftLegRef.current.rotation.x, 0, delta * 10);
        leftLegRef.current.rotation.z = 0;
        rightLegRef.current.rotation.x = MathUtils.lerp(rightLegRef.current.rotation.x, 0, delta * 10);
        rightLegRef.current.rotation.z = 0;
        
        bodyRef.current.position.y = MathUtils.lerp(bodyRef.current.position.y, BODY_Y, delta * 5);
        headRef.current.position.y = MathUtils.lerp(headRef.current.position.y, HEAD_Y, delta * 5);
        const shoulderY = BODY_Y + (BODY_H/2) - 0.1;
        leftArmRef.current.position.y = MathUtils.lerp(leftArmRef.current.position.y, shoulderY, delta * 5);
        rightArmRef.current.position.y = MathUtils.lerp(rightArmRef.current.position.y, shoulderY, delta * 5);
        const hipY = LEG_Y;
        leftLegRef.current.position.y = MathUtils.lerp(leftLegRef.current.position.y, hipY, delta * 5);
        rightLegRef.current.position.y = MathUtils.lerp(rightLegRef.current.position.y, hipY, delta * 5);
        playerGroup.rotation.x = MathUtils.lerp(playerGroup.rotation.x, 0, delta * 5);
      } else {
        const runFreq = 8 + (Math.min(speed, 40) * 0.5); 
        const amp = Math.min(1.5, 0.5 + speed * 0.02); 
        const limbAngle = Math.sin(time * runFreq) * amp;
        leftArmRef.current.rotation.z = 0; rightArmRef.current.rotation.z = 0; leftLegRef.current.rotation.z = 0; rightLegRef.current.rotation.z = 0;
        leftArmRef.current.rotation.x = -limbAngle; rightArmRef.current.rotation.x = limbAngle; leftLegRef.current.rotation.x = limbAngle; rightLegRef.current.rotation.x = -limbAngle;
        const bob = Math.abs(Math.sin(time * runFreq * 2)) * 0.05;
        bodyRef.current.position.y = BODY_Y + bob; headRef.current.position.y = HEAD_Y + bob;
        const shoulderY = BODY_Y + (BODY_H/2) - 0.1; leftArmRef.current.position.y = shoulderY + bob; rightArmRef.current.position.y = shoulderY + bob;
        const hipY = LEG_Y; leftLegRef.current.position.y = hipY + bob; rightLegRef.current.position.y = hipY + bob;
        playerGroup.rotation.x = MathUtils.lerp(playerGroup.rotation.x, 0, delta * 5);
      }
      const tilt = (position.current.x - (targetX * WORLD_CONFIG.LANE_WIDTH)) * -0.05;
      playerGroup.rotation.z = MathUtils.lerp(playerGroup.rotation.z, tilt, delta * 3);
    }

    if (score > 100 && Math.floor(score / 1000) > lastMilestone.current) {
        lastMilestone.current = Math.floor(score / 1000);
        audioService.playMilestone();
        addCoins(10); 
    }
    incrementScore(delta * velocity.current.z);
  });

  return (
    <>
      <SplashParticles ref={splashRef} />
      <DebrisParticles ref={debrisRef} />
      <group ref={groupRef} position={[0, 5, 0]} name="PlayerGroup">
        <group ref={headRef} position={[0, HEAD_Y, 0]}>
            <mesh castShadow><boxGeometry args={[HEAD_SZ, HEAD_SZ, HEAD_SZ]} /><meshStandardMaterial color="#fbbf24" roughness={0.3} /></mesh>
            <group position={[0, HEAD_SZ/2, 0]}>
                <mesh position={[0, 0.08, 0]}><boxGeometry args={[HEAD_SZ + 0.02, 0.16, HEAD_SZ + 0.02]} /><meshStandardMaterial color="#15803d" /></mesh>
                <mesh position={[0, 0.02, HEAD_SZ/2 + 0.08]}><boxGeometry args={[HEAD_SZ + 0.2, 0.02, 0.2]} /><meshStandardMaterial color="#15803d" /></mesh>
            </group>
            <group position={[0, 0, HEAD_SZ/2 + 0.001]}>
                <mesh position={[-0.08, 0.08, 0]} rotation={[0,0,-0.15]}><boxGeometry args={[0.08, 0.02, 0.01]} /><meshStandardMaterial color="#854d0e" /></mesh>
                <mesh position={[0.08, 0.08, 0]} rotation={[0,0,0.15]}><boxGeometry args={[0.08, 0.02, 0.01]} /><meshStandardMaterial color="#854d0e" /></mesh>
                <mesh position={[-0.07, 0.03, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.01, 16]} /><meshStandardMaterial color="#000" /></mesh>
                <mesh position={[0.07, 0.03, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.01, 16]} /><meshStandardMaterial color="#000" /></mesh>
                <mesh position={[-0.07, 0.035, 0.002]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.008, 0.008, 0.01, 8]} /><meshStandardMaterial color="#fff" /></mesh>
                <mesh position={[0.07, 0.035, 0.002]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.008, 0.008, 0.01, 8]} /><meshStandardMaterial color="#fff" /></mesh>
                <mesh position={[-0.12, -0.02, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.01, 8]} /><meshStandardMaterial color="#fca5a5" transparent opacity={0.6} /></mesh>
                <mesh position={[0.12, -0.02, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.01, 8]} /><meshStandardMaterial color="#fca5a5" transparent opacity={0.6} /></mesh>
                <group position={[0, -0.08, 0]}>
                    <mesh rotation={[Math.PI/2, 0, 3 * Math.PI / 2]}><cylinderGeometry args={[0.08, 0.08, 0.01, 16, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#000" /></mesh>
                    <mesh position={[0, 0.035, 0.002]}><boxGeometry args={[0.12, 0.02, 0.01]} /><meshStandardMaterial color="#fff" /></mesh>
                </group>
            </group>
        </group>
        <mesh ref={bodyRef} position={[0, BODY_Y, 0]} castShadow><boxGeometry args={[BODY_W, BODY_H, BODY_D]} /><meshStandardMaterial color="#dc2626" roughness={0.5} /></mesh>
        <group ref={leftArmRef} position={[-BODY_W/2 - LIMB_W/2, 0, 0]}><mesh position={[0, -LIMB_H/2 + 0.1, 0]} castShadow><boxGeometry args={[LIMB_W, LIMB_H, LIMB_W]} /><meshStandardMaterial color="#fbbf24" /></mesh></group>
        <group ref={rightArmRef} position={[BODY_W/2 + LIMB_W/2, 0, 0]}><mesh position={[0, -LIMB_H/2 + 0.1, 0]} castShadow><boxGeometry args={[LIMB_W, LIMB_H, LIMB_W]} /><meshStandardMaterial color="#fbbf24" /></mesh></group>
        <group ref={leftLegRef} position={[-0.12, 0, 0]}><mesh position={[0, -LIMB_H/2, 0]} castShadow><boxGeometry args={[LIMB_W, LIMB_H, LIMB_W]} /><meshStandardMaterial color="#1d4ed8" /></mesh></group>
        <group ref={rightLegRef} position={[0.12, 0, 0]}><mesh position={[0, -LIMB_H/2, 0]} castShadow><boxGeometry args={[LIMB_W, LIMB_H, LIMB_W]} /><meshStandardMaterial color="#1d4ed8" /></mesh></group>
        
        {/* LARGE TRAVEL BACKPACK */}
        <group position={[0, BODY_Y + 0.05, -BODY_D/2 - 0.15]}>
            {/* Main Body */}
            <mesh castShadow position={[0, 0, 0]}>
                <boxGeometry args={[0.35, 0.5, 0.25]} />
                <meshStandardMaterial color="#78350f" />
            </mesh>
            {/* Top Flap */}
            <mesh castShadow position={[0, 0.28, 0]}>
                <boxGeometry args={[0.37, 0.12, 0.27]} />
                <meshStandardMaterial color="#92400e" />
            </mesh>
            {/* Side Pockets */}
            <mesh castShadow position={[-0.2, -0.1, 0]}>
                <boxGeometry args={[0.1, 0.25, 0.15]} />
                <meshStandardMaterial color="#92400e" />
            </mesh>
            <mesh castShadow position={[0.2, -0.1, 0]}>
                <boxGeometry args={[0.1, 0.25, 0.15]} />
                <meshStandardMaterial color="#92400e" />
            </mesh>
            {/* Bedroll (Top) - MOVED UP */}
            <mesh castShadow position={[0, 0.42, 0]} rotation={[0, 0, Math.PI/2]}>
                <cylinderGeometry args={[0.09, 0.09, 0.38, 8]} />
                <meshStandardMaterial color="#4ade80" />
            </mesh>
            {/* Back Pocket Detail */}
            <mesh position={[0, -0.05, -0.15]}>
                <boxGeometry args={[0.2, 0.2, 0.05]} />
                <meshStandardMaterial color="#5d4037" />
            </mesh>
        </group>
      </group>
    </>
  );
};