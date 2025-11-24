
import React, { useMemo, useRef, useLayoutEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, MeshStandardMaterial, CylinderGeometry, SphereGeometry, Vector3, Group, Mesh, MathUtils, MeshLambertMaterial, PlaneGeometry, BufferAttribute, DoubleSide, DodecahedronGeometry, ConeGeometry, CapsuleGeometry, BoxGeometry, IcosahedronGeometry } from 'three';
import { getTerrainHeight, getObstacleAt, hash, getAnimalAt, AnimalType, getRiverInfo, getCloudInfo, getCoinInfo, getBridgeInfo, calculateBaseTerrain, getBridgeX, getEagleInfo } from '../services/mathService';
import { WORLD_CONFIG } from '../types';
import { useGameStore } from '../store';
import { audioService } from '../services/audioService';

const tempObject = new Object3D();
const tempColor = new Color();

// --- FLOWER COLORS (Green Palette for Lush Look) ---
const FLOWER_COLORS = [
  "#4ade80", "#22c55e", "#16a34a", "#15803d",
  "#bef264", "#a3e635", "#84cc16", "#365314"
];

// --- MATERIALS ---
const FlowerMaterial = new MeshLambertMaterial({
  color: "#86efac",
  emissive: "#166534",
  emissiveIntensity: 0.3,
  vertexColors: true,
  transparent: true,
  opacity: 0.8,
  toneMapped: false,
});

const setupFlowerShader = (shader: any) => {
  shader.uniforms.uTime = { value: 0 };
  shader.vertexShader = `
    uniform float uTime;
    ${shader.vertexShader}
  `;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    float sway = sin(uTime * 3.0 + (instanceMatrix[3][0] * 0.5) + (instanceMatrix[3][2] * 0.5)) * 0.15;
    float strength = smoothstep(0.0, 1.0, position.y * 3.0); 
    transformed.x += sway * strength;
    `
  );
  FlowerMaterial.userData.shader = shader;
};
FlowerMaterial.onBeforeCompile = setupFlowerShader;

const CloudMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.75,
    roughness: 0.1,
    flatShading: true,
    depthWrite: false
});

// --- COMPONENTS ---

const SwayingTree = React.memo(({ children, x, y, z }: { children: React.ReactNode, x: number, y: number, z: number }) => {
    const group = useRef<Group>(null);
    const seed = useMemo(() => hash(x, z), [x, z]);
    
    useFrame(({ clock }) => {
        if (!group.current) return;
        const t = clock.getElapsedTime();
        const windX = Math.sin(t * 0.8 + seed * 10.0) * 0.02;
        const windZ = Math.sin(t * 1.2 + seed * 20.0) * 0.04 + Math.sin(t * 2.5 + seed) * 0.01;
        group.current.rotation.z = windZ;
        group.current.rotation.x = windX;
    });

    return <group ref={group} position={[x, y, z]}>{children}</group>;
});

const CloudObject: React.FC<{ x: number, y: number, z: number, scale: number }> = ({ x, y, z, scale }) => {
    return (
        <group position={[x, y, z]} scale={scale}>
            <mesh position={[0, 0, 0]} material={CloudMaterial}><dodecahedronGeometry args={[2.0, 0]} /></mesh>
            <mesh position={[1.5, -0.5, 0.5]} material={CloudMaterial}><dodecahedronGeometry args={[1.4, 0]} /></mesh>
            <mesh position={[-1.5, -0.2, -0.5]} material={CloudMaterial}><dodecahedronGeometry args={[1.5, 0]} /></mesh>
            <mesh position={[0.5, 1.0, -0.5]} material={CloudMaterial}><dodecahedronGeometry args={[1.2, 0]} /></mesh>
            <mesh position={[-0.5, 0.8, 0.8]} material={CloudMaterial}><dodecahedronGeometry args={[1.0, 0]} /></mesh>
        </group>
    )
}

const Coin: React.FC<{ x: number, y: number, z: number, isLarge?: boolean }> = React.memo(({ x, y, z, isLarge = false }) => {
    const groupRef = useRef<Group>(null);
    const [collected, setCollected] = useState(false);
    const addCoins = useGameStore(state => state.addCoins);
    
    useFrame((state, delta) => {
        if (!groupRef.current || collected) return;
        
        // Standard rotation
        groupRef.current.rotation.y += 0.03; 
        
        const player = state.scene.getObjectByName("PlayerGroup");
        if (player) {
            const isMagnetActive = useGameStore.getState().isMagnetActive; 
            
            const dx = player.position.x - groupRef.current.position.x;
            const dy = (player.position.y + 1.0) - groupRef.current.position.y; 
            const dz = player.position.z - groupRef.current.position.z;
            const distSq = dx*dx + dy*dy + dz*dz;
            
            // Magnet Logic
            if (isMagnetActive && distSq < 400) { 
                const moveSpeed = 15 * delta; 
                groupRef.current.position.x += dx * moveSpeed;
                groupRef.current.position.y += dy * moveSpeed;
                groupRef.current.position.z += dz * moveSpeed;
            }

            // Collision Logic
            const threshold = isLarge ? 25.0 : 2.25;
            if (distSq < threshold) { 
                setCollected(true);
                groupRef.current.visible = false;
                addCoins(isLarge ? 10 : 1);
                audioService.playCoin();
            }
        }
    });

    if (collected) return null;
    const scale = isLarge ? 5.0 : 1.0;

    return (
        <group ref={groupRef} position={[x, y, z]} scale={scale}>
            <mesh rotation={[Math.PI/2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.4, 0.4, 0.1, 32]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.3} roughness={0.3} emissive="#d97706" emissiveIntensity={0.6} />
            </mesh>
            <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0]}>
                 <cylinderGeometry args={[0.3, 0.3, 0.12, 32]} />
                 <meshStandardMaterial color="#fcd34d" metalness={0.3} roughness={0.3} emissive="#f59e0b" emissiveIntensity={0.6} />
            </mesh>
        </group>
    );
});

// --- EAGLE COMPONENT ---
const Eagle: React.FC<{ x: number, y: number, z: number }> = React.memo(({ x, y, z }) => {
    const groupRef = useRef<Group>(null);
    const leftWingRef = useRef<Group>(null);
    const rightWingRef = useRef<Group>(null);
    const [hit, setHit] = useState(false);
    
    // 20% chance to be an aggressive, fast eagle
    const isAggressive = useMemo(() => hash(x, z) > 0.8, [x, z]);
    
    const removeCoins = useGameStore(state => state.removeCoins);
    const triggerKnockback = useGameStore(state => state.triggerKnockback);

    useFrame((state, delta) => {
        if (!groupRef.current || hit) return;
        const time = state.clock.getElapsedTime();

        // Flapping Animation
        const flap = Math.sin(time * 15) * 0.5;
        if (leftWingRef.current) leftWingRef.current.rotation.z = flap;
        if (rightWingRef.current) rightWingRef.current.rotation.z = -flap;

        // Homing Movement
        const player = state.scene.getObjectByName("PlayerGroup");
        if (player) {
            const pPos = player.position;
            const ePos = groupRef.current.position;
            
            // Calculate vector to player
            const dx = pPos.x - ePos.x;
            const dy = (pPos.y + 1.0) - ePos.y;
            const dz = pPos.z - ePos.z;
            
            // Detection Range Check
            if (dz > -20 && dz < 220 && dy > -20) { 
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                if (dist > 0) {
                    // Aggressive: 110
                    // Passive: 25
                    const speed = (isAggressive ? 110 : 25) * delta; 
                    ePos.x += (dx / dist) * speed;
                    ePos.y += (dy / dist) * speed;
                    ePos.z += (dz / dist) * speed;
                    
                    // Face player
                    groupRef.current.lookAt(pPos.x, pPos.y, pPos.z);
                }

                // Collision with player
                // Hitbox radius ~1.5m
                if (dist < 1.5) {
                    setHit(true);
                    groupRef.current.visible = false;
                    audioService.playEagle();
                    
                    // Logic: Loose 1-5 coins, Knockback
                    const loss = Math.floor(Math.random() * 5) + 1;
                    removeCoins(loss);
                    
                    // Knockback: Drop height by 5-10m
                    triggerKnockback(-25);
                }
            }
        }
    });

    if (hit) return null;

    return (
        <group ref={groupRef} position={[x, y, z]}>
            {/* Body */}
            <mesh castShadow scale={[1, 1, 1.5]}>
                <sphereGeometry args={[0.5, 8, 8]} />
                <meshStandardMaterial color="#5d4037" />
            </mesh>
            {/* Head */}
            <mesh position={[0, 0.3, 0.6]} castShadow>
                <sphereGeometry args={[0.35, 8, 8]} />
                <meshStandardMaterial color="#f3f4f6" />
            </mesh>
            {/* Beak */}
            <mesh position={[0, 0.2, 0.9]} rotation={[Math.PI/2, 0, 0]}>
                <coneGeometry args={[0.1, 0.4, 8]} />
                <meshStandardMaterial color="#facc15" />
            </mesh>
            
            {/* Left Wing */}
            <group ref={leftWingRef} position={[-0.4, 0.2, 0]}>
                <mesh position={[-0.8, 0, -0.2]} rotation={[0, -0.2, 0]} castShadow>
                    <boxGeometry args={[1.6, 0.1, 0.8]} />
                    <meshStandardMaterial color="#5d4037" />
                </mesh>
                <mesh position={[-1.8, 0, 0.1]} rotation={[0, 0.2, 0]}>
                    <boxGeometry args={[1.0, 0.08, 0.6]} />
                    <meshStandardMaterial color="#1f2937" />
                </mesh>
            </group>

            {/* Right Wing */}
            <group ref={rightWingRef} position={[0.4, 0.2, 0]}>
                 <mesh position={[0.8, 0, -0.2]} rotation={[0, 0.2, 0]} castShadow>
                    <boxGeometry args={[1.6, 0.1, 0.8]} />
                    <meshStandardMaterial color="#5d4037" />
                </mesh>
                 <mesh position={[1.8, 0, 0.1]} rotation={[0, -0.2, 0]}>
                    <boxGeometry args={[1.0, 0.08, 0.6]} />
                    <meshStandardMaterial color="#1f2937" />
                </mesh>
            </group>

            {/* Tail */}
            <mesh position={[0, 0, -0.8]} rotation={[-0.2, 0, 0]}>
                <boxGeometry args={[0.6, 0.1, 0.8]} />
                <meshStandardMaterial color="#f3f4f6" />
            </mesh>
        </group>
    );
});

const TallTree: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    return (
        <SwayingTree x={x} y={y} z={z}>
             <mesh position={[1, 0.5, 0]} rotation={[0,0,-0.5]} castShadow><cylinderGeometry args={[0.3, 0.6, 2]} /><meshStandardMaterial color="#3e2723" /></mesh>
             <mesh position={[-1, 0.5, 0]} rotation={[0,0,0.5]} castShadow><cylinderGeometry args={[0.3, 0.6, 2]} /><meshStandardMaterial color="#3e2723" /></mesh>
             <mesh position={[0, 0.5, 1]} rotation={[0.5,0,0]} castShadow><cylinderGeometry args={[0.3, 0.6, 2]} /><meshStandardMaterial color="#3e2723" /></mesh>
             <mesh position={[0, 0.5, -1]} rotation={[-0.5,0,0]} castShadow><cylinderGeometry args={[0.3, 0.6, 2]} /><meshStandardMaterial color="#3e2723" /></mesh>
             <mesh position={[0, 3, 0]} castShadow receiveShadow><cylinderGeometry args={[1.4, 1.8, 6, 7]} /><meshStandardMaterial color="#4e342e" /></mesh>
             <mesh position={[0, 8, 0]} castShadow receiveShadow><cylinderGeometry args={[1.0, 1.4, 6, 7]} /><meshStandardMaterial color="#4e342e" /></mesh>
             <mesh position={[0, 13, 0]} castShadow receiveShadow><cylinderGeometry args={[0.7, 1.0, 6, 7]} /><meshStandardMaterial color="#4e342e" /></mesh>
             <mesh position={[0.8, 6, 0.2]} rotation={[0,0,-1.2]} castShadow><cylinderGeometry args={[0.1, 0.2, 2]} /><meshStandardMaterial color="#3e2723" /></mesh>
             <mesh position={[-0.7, 9, -0.3]} rotation={[0,0,1.1]} castShadow><cylinderGeometry args={[0.1, 0.15, 1.5]} /><meshStandardMaterial color="#3e2723" /></mesh>
             <mesh position={[0, 14, 0]} castShadow><coneGeometry args={[4.5, 6, 7]} /><meshStandardMaterial color="#14532d" flatShading /></mesh>
             <mesh position={[0, 17, 0]} castShadow><coneGeometry args={[4.0, 5, 7]} /><meshStandardMaterial color="#166534" flatShading /></mesh>
             <mesh position={[0, 20, 0]} castShadow><coneGeometry args={[3.0, 5, 7]} /><meshStandardMaterial color="#15803d" flatShading /></mesh>
             <mesh position={[0, 23, 0]} castShadow><coneGeometry args={[1.5, 4, 7]} /><meshStandardMaterial color="#16a34a" flatShading /></mesh>
        </SwayingTree>
    );
};

const TallRock: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    return (
        <group position={[x, y, z]}>
             <mesh position={[0, 4, 0]} castShadow receiveShadow><dodecahedronGeometry args={[3.5, 0]} /><meshStandardMaterial color="#57534e" flatShading /></mesh>
             <mesh position={[0, 8, 0]} castShadow receiveShadow rotation={[0, 1, 0]}><dodecahedronGeometry args={[2.5, 0]} /><meshStandardMaterial color="#57534e" flatShading /></mesh>
             <mesh position={[0.5, 11, -0.5]} castShadow receiveShadow rotation={[1, 0, 0.5]}><coneGeometry args={[1.5, 5, 5]} /><meshStandardMaterial color="#57534e" flatShading /></mesh>
             <mesh position={[2.5, 1, 0]} castShadow><dodecahedronGeometry args={[1.5, 0]} /><meshStandardMaterial color="#44403c" flatShading /></mesh>
             <mesh position={[-2.0, 1.5, 1.5]} castShadow><dodecahedronGeometry args={[1.2, 0]} /><meshStandardMaterial color="#44403c" flatShading /></mesh>
             <mesh position={[0.5, 5.5, 2.8]}><dodecahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color="#4a5d23" flatShading /></mesh>
             <mesh position={[-1, 9, 1]}><dodecahedronGeometry args={[0.6, 0]} /><meshStandardMaterial color="#4a5d23" flatShading /></mesh>
        </group>
    );
};

const Cabin: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    return (
        <group position={[x, y, z]}>
             <mesh position={[-1.5, 3.5, -1.5]}><cylinderGeometry args={[0.15, 0.15, 7]} /><meshStandardMaterial color="#3f2e25" /></mesh>
             <mesh position={[1.5, 3.5, -1.5]}><cylinderGeometry args={[0.15, 0.15, 7]} /><meshStandardMaterial color="#3f2e25" /></mesh>
             <mesh position={[-1.5, 3.5, 1.5]}><cylinderGeometry args={[0.15, 0.15, 7]} /><meshStandardMaterial color="#3f2e25" /></mesh>
             <mesh position={[1.5, 3.5, 1.5]}><cylinderGeometry args={[0.15, 0.15, 7]} /><meshStandardMaterial color="#3f2e25" /></mesh>
             <mesh position={[0, 3.5, 1.5]} rotation={[0,0,0.4]}><boxGeometry args={[3.2, 0.1, 0.1]} /><meshStandardMaterial color="#3f2e25" /></mesh>
             <mesh position={[0, 3.5, 1.5]} rotation={[0,0,-0.4]}><boxGeometry args={[3.2, 0.1, 0.1]} /><meshStandardMaterial color="#3f2e25" /></mesh>
             <mesh position={[1.5, 3.5, 0]} rotation={[0.4,0,0]}><boxGeometry args={[0.1, 0.1, 3.2]} /><meshStandardMaterial color="#3f2e25" /></mesh>
             <mesh position={[1.5, 3.5, 0]} rotation={[-0.4,0,0]}><boxGeometry args={[0.1, 0.1, 3.2]} /><meshStandardMaterial color="#3f2e25" /></mesh>
             <mesh position={[0, 7, 0]} castShadow><boxGeometry args={[4.2, 0.3, 4.2]} /><meshStandardMaterial color="#5d4037" /></mesh>
             <mesh position={[0, 8.5, 0]} castShadow><boxGeometry args={[3.5, 3, 3.5]} /><meshStandardMaterial color="#78350f" /></mesh>
             <mesh position={[0, 11, 0]} castShadow><coneGeometry args={[3.5, 2.5, 4]} rotation={[0, Math.PI/4, 0]} /><meshStandardMaterial color="#451a03" /></mesh>
             <mesh position={[0, 3.5, 1.7]} rotation={[0.1, 0, 0]}><boxGeometry args={[0.8, 7.5, 0.1]} /><meshStandardMaterial color="#5d4037" /></mesh>
             {[1, 2, 3, 4, 5, 6].map(i => (<mesh key={i} position={[0, i, 1.7 + (i*0.1)]}><boxGeometry args={[0.6, 0.1, 0.15]} /><meshStandardMaterial color="#3e2723" /></mesh>))}
        </group>
    );
};

const Car: React.FC<{ x: number, y: number, z: number, rotation: number }> = ({ x, y, z, rotation }) => {
    return (
        <group position={[x, y + 0.8, z]} rotation={[0.1, rotation, 0.05]}>
             <mesh position={[0, 0, 0]} castShadow><boxGeometry args={[2.2, 0.8, 4.5]} /><meshStandardMaterial color="#7c2d12" /></mesh>
             <mesh position={[0, 0.9, -0.3]} castShadow><boxGeometry args={[1.8, 0.8, 2.5]} /><meshStandardMaterial color="#9a3412" /></mesh>
             <mesh position={[1.1, -0.2, 1.2]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.45, 0.45, 0.3]} /><meshStandardMaterial color="#1f2937" /></mesh>
             <mesh position={[-1.1, -0.2, 1.2]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.45, 0.45, 0.3]} /><meshStandardMaterial color="#1f2937" /></mesh>
             <mesh position={[1.1, -0.2, -1.2]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.45, 0.45, 0.3]} /><meshStandardMaterial color="#1f2937" /></mesh>
             <mesh position={[-1.1, -0.2, -1.2]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.45, 0.45, 0.3]} /><meshStandardMaterial color="#1f2937" /></mesh>
             <mesh position={[0, -0.1, 2.3]}><boxGeometry args={[2.3, 0.2, 0.2]} /><meshStandardMaterial color="#525252" /></mesh>
             <mesh position={[0.6, 0.1, 2.26]}><sphereGeometry args={[0.15]} /><meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.2} /></mesh>
             <mesh position={[-0.6, 0.1, 2.26]}><sphereGeometry args={[0.15]} /><meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.2} /></mesh>
        </group>
    );
};

const PlaneWreck: React.FC<{ x: number, y: number, z: number, rotation: number }> = ({ x, y, z, rotation }) => {
    return (
        <group position={[x, y, z]} rotation={[Math.PI/6, rotation, 0.2]}>
             <mesh position={[0, 5, 0]} castShadow><cylinderGeometry args={[1.8, 1.8, 9, 10]} /><meshStandardMaterial color="#cbd5e1" roughness={0.6} /></mesh>
             <mesh position={[0, 10, 0]} castShadow><sphereGeometry args={[1.78, 10, 10]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
             <mesh position={[0, 10.5, 0.8]}><boxGeometry args={[1.2, 0.8, 0.5]} /><meshStandardMaterial color="#1e293b" /></mesh>
             <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[1.7, 1.0, 1]} /><meshStandardMaterial color="#1e293b" /></mesh>
             <mesh position={[1.5, 4, 0]} rotation={[0, 0, -1.2]} castShadow><boxGeometry args={[6, 0.2, 2.5]} /><meshStandardMaterial color="#94a3b8" /></mesh>
             <mesh position={[3.5, 2.5, 0]} rotation={[0, 0, -1.2]}><cylinderGeometry args={[0.6, 0.6, 1.5]} /><meshStandardMaterial color="#475569" /></mesh>
             <mesh position={[3, -2, 2]} rotation={[0.5, 0.5, 0]}><boxGeometry args={[1, 0.1, 1]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
             <mesh position={[-2, -1, -3]} rotation={[0.2, 0.1, 0.5]}><boxGeometry args={[1.5, 0.1, 0.8]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
        </group>
    );
};

const HeliWreck: React.FC<{ x: number, y: number, z: number, rotation: number }> = ({ x, y, z, rotation }) => {
    return (
        <group position={[x, y + 1.2, z]} rotation={[0.3, rotation, 0.4]}>
             <mesh castShadow><icosahedronGeometry args={[2.2, 1]} /><meshStandardMaterial color="#3f6212" flatShading /></mesh>
             <mesh position={[0, 0.5, 1.5]}><sphereGeometry args={[1.0]} /><meshStandardMaterial color="#111827" roughness={0.2} /></mesh>
             <group position={[0, 0, -2]} rotation={[-0.5, 0, 0]}>
                 <mesh position={[0, 0, -2]}><boxGeometry args={[0.6, 0.6, 5]} /><meshStandardMaterial color="#3f6212" /></mesh>
                 <mesh position={[0.4, 0, -4.5]}><cylinderGeometry args={[0.1, 0.1, 0.2]} rotation={[0,0,Math.PI/2]} /><meshStandardMaterial color="#111" /></mesh>
                 <mesh position={[0.5, 0, -4.5]} rotation={[0,0,0]}><boxGeometry args={[0.1, 2.5, 0.2]} /><meshStandardMaterial color="#111" /></mesh>
             </group>
             <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.2, 0.3, 0.5]} /><meshStandardMaterial color="#1f2937" /></mesh>
             <group position={[0, 2.5, 0]}>
                 <mesh rotation={[0.2, 0, 0]}><boxGeometry args={[8, 0.1, 0.4]} /><meshStandardMaterial color="#111" /></mesh>
                 <mesh rotation={[0, Math.PI/2, -0.3]}><boxGeometry args={[8, 0.1, 0.4]} /><meshStandardMaterial color="#111" /></mesh>
             </group>
             <mesh position={[1.5, -1.8, 0]} rotation={[0,0,-0.2]}><boxGeometry args={[0.2, 0.2, 4]} /><meshStandardMaterial color="#1f2937" /></mesh>
             <mesh position={[-1.5, -1.8, 0]} rotation={[0,0,0.2]}><boxGeometry args={[0.2, 0.2, 4]} /><meshStandardMaterial color="#1f2937" /></mesh>
             <mesh position={[1.5, -1.2, 1]} rotation={[0,0,-0.2]}><cylinderGeometry args={[0.1, 0.1, 1.5]} /><meshStandardMaterial color="#1f2937" /></mesh>
             <mesh position={[-1.5, -1.2, 1]} rotation={[0,0,0.2]}><cylinderGeometry args={[0.1, 0.1, 1.5]} /><meshStandardMaterial color="#1f2937" /></mesh>
        </group>
    );
};

const Bridge: React.FC<{ z: number, x: number }> = React.memo(({ z, x }) => {
    const LENGTH = 24; 
    const WIDTH = 6;
    const SEGMENTS = 16;
    const baseHeight = calculateBaseTerrain(x, z - 12); 

    return (
        <group position={[x, baseHeight + 0.2, z]}>
            {/* Arched Deck & Rails */}
            {[...Array(SEGMENTS)].map((_, i) => {
                const t = i / (SEGMENTS - 1); 
                const dist = (t - 0.5) * LENGTH; 
                const normDist = (dist / (LENGTH/2));
                const height = 3.0 * (1 - normDist * normDist); 
                const slope = -2 * 3.0 * normDist / (LENGTH/2);
                const rotX = Math.atan(slope);

                return (
                    <group key={i} position={[0, height, dist]} rotation={[rotX, 0, 0]}>
                         {/* Plank */}
                        <mesh receiveShadow castShadow>
                            <boxGeometry args={[WIDTH, 0.4, LENGTH/SEGMENTS + 0.1]} />
                            <meshStandardMaterial color="#8d6e63" roughness={0.9} />
                        </mesh>
                        {/* Rail Posts */}
                        <mesh position={[WIDTH/2 - 0.2, 0.6, 0]} castShadow>
                            <boxGeometry args={[0.2, 1.2, 0.2]} />
                            <meshStandardMaterial color="#5d4037" />
                        </mesh>
                        <mesh position={[-WIDTH/2 + 0.2, 0.6, 0]} castShadow>
                            <boxGeometry args={[0.2, 1.2, 0.2]} />
                            <meshStandardMaterial color="#5d4037" />
                        </mesh>
                        {/* Rail Horizontal - Approximation */}
                        <mesh position={[WIDTH/2 - 0.2, 1.1, 0]} rotation={[Math.PI/2,0,0]}>
                             <cylinderGeometry args={[0.1, 0.1, LENGTH/SEGMENTS + 0.2]} />
                             <meshStandardMaterial color="#4e342e" />
                        </mesh>
                         <mesh position={[-WIDTH/2 + 0.2, 1.1, 0]} rotation={[Math.PI/2,0,0]}>
                             <cylinderGeometry args={[0.1, 0.1, LENGTH/SEGMENTS + 0.2]} />
                             <meshStandardMaterial color="#4e342e" />
                        </mesh>
                    </group>
                );
            })}
            
            {/* Support Pillars at ends (Banks) */}
            <mesh position={[WIDTH/2 - 0.5, -4, -LENGTH/2 + 2]}>
                <cylinderGeometry args={[0.4, 0.4, 8]} />
                <meshStandardMaterial color="#3e2723" />
            </mesh>
            <mesh position={[-WIDTH/2 + 0.5, -4, -LENGTH/2 + 2]}>
                <cylinderGeometry args={[0.4, 0.4, 8]} />
                <meshStandardMaterial color="#3e2723" />
            </mesh>
            <mesh position={[WIDTH/2 - 0.5, -4, LENGTH/2 - 2]}>
                <cylinderGeometry args={[0.4, 0.4, 8]} />
                <meshStandardMaterial color="#3e2723" />
            </mesh>
            <mesh position={[-WIDTH/2 + 0.5, -4, LENGTH/2 - 2]}>
                <cylinderGeometry args={[0.4, 0.4, 8]} />
                <meshStandardMaterial color="#3e2723" />
            </mesh>
        </group>
    );
});

const useWander = (x: number, z: number, speedMult: number = 1) => {
    const group = useRef<Group>(null);
    const { speed: wanderSpeed, radius, freq, phase } = useMemo(() => {
        const h = hash(x, z);
        return {
            speed: (0.5 + h * 0.5) * speedMult,
            radius: 2 + hash(z, x) * 2,
            freq: 0.5 + h * 0.5,
            phase: h * Math.PI * 2
        };
    }, [x, z, speedMult]);

    useFrame(({ clock }) => {
        if (!group.current) return;
        const t = clock.getElapsedTime();
        const dx = Math.sin(t * freq + phase) * radius;
        const dz = Math.cos(t * freq * 0.7 + phase) * (radius * 0.5);
        group.current.position.set(x + dx, 0, z + dz);
        const y = getTerrainHeight(group.current.position.x, group.current.position.z);
        group.current.position.y = y;
        
        const nextX = Math.sin((t + 0.1) * freq + phase) * radius;
        const nextZ = Math.cos((t + 0.1) * freq * 0.7 + phase) * (radius * 0.5);
        group.current.lookAt(x + nextX, y, z + nextZ);
    });
    return group;
};

const Bear: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 0.8);
    return <group ref={ref}><mesh castShadow position={[0, 0.8, 0]}><boxGeometry args={[1.2, 1.4, 2]} /><meshStandardMaterial color="#3e2723" /></mesh><mesh position={[0, 1.8, 0.8]}><boxGeometry args={[0.8, 0.8, 0.8]} /><meshStandardMaterial color="#3e2723" /></mesh><mesh position={[0.6, 0, 0.8]}><boxGeometry args={[0.4, 0.8, 0.4]} /><meshStandardMaterial color="#271c19" /></mesh><mesh position={[-0.6, 0, 0.8]}><boxGeometry args={[0.4, 0.8, 0.4]} /><meshStandardMaterial color="#271c19" /></mesh><mesh position={[0.6, 0, -0.8]}><boxGeometry args={[0.4, 0.8, 0.4]} /><meshStandardMaterial color="#271c19" /></mesh><mesh position={[-0.6, 0, -0.8]}><boxGeometry args={[0.4, 0.8, 0.4]} /><meshStandardMaterial color="#271c19" /></mesh></group>
};
const Rabbit: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 1.5);
    return <group ref={ref}><mesh castShadow position={[0, 0.3, 0]}><sphereGeometry args={[0.3, 8, 8]} /><meshStandardMaterial color="#e5e7eb" /></mesh><mesh position={[0, 0.5, 0.2]}><sphereGeometry args={[0.2, 8, 8]} /><meshStandardMaterial color="#e5e7eb" /></mesh><mesh position={[0.1, 0.8, 0.2]} rotation={[0.2,0,0]}><capsuleGeometry args={[0.05, 0.4, 4, 8]} /><meshStandardMaterial color="#fca5a5" /></mesh><mesh position={[-0.1, 0.8, 0.2]} rotation={[0.2,0,0]}><capsuleGeometry args={[0.05, 0.4, 4, 8]} /><meshStandardMaterial color="#fca5a5" /></mesh></group>
};
const Squirrel: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 2.0);
    return <group ref={ref}><mesh castShadow position={[0, 0.25, 0]}><capsuleGeometry args={[0.2, 0.4, 4, 8]} /><meshStandardMaterial color="#d97706" /></mesh><mesh position={[0, 0.3, -0.3]} rotation={[-0.5,0,0]}><capsuleGeometry args={[0.15, 0.5, 4, 8]} /><meshStandardMaterial color="#92400e" /></mesh></group>
};
const Lamb: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 0.7);
    return <group ref={ref}><mesh castShadow position={[0, 0.4, 0]}><dodecahedronGeometry args={[0.5, 0]} /><meshStandardMaterial color="#f3f4f6" /></mesh><mesh position={[0, 0.5, 0.4]}><dodecahedronGeometry args={[0.3, 0]} /><meshStandardMaterial color="#1f2937" /></mesh><mesh position={[0.2, 0.1, 0.2]}><cylinderGeometry args={[0.05, 0.05, 0.4]} /><meshStandardMaterial color="#111" /></mesh><mesh position={[-0.2, 0.1, 0.2]}><cylinderGeometry args={[0.05, 0.05, 0.4]} /><meshStandardMaterial color="#111" /></mesh><mesh position={[0.2, 0.1, -0.2]}><cylinderGeometry args={[0.05, 0.05, 0.4]} /><meshStandardMaterial color="#111" /></mesh><mesh position={[-0.2, 0.1, -0.2]}><cylinderGeometry args={[0.05, 0.05, 0.4]} /><meshStandardMaterial color="#111" /></mesh></group>
};
const Chicken: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 1.2);
    return <group ref={ref}><mesh castShadow position={[0, 0.3, 0]}><sphereGeometry args={[0.3, 8, 8]} /><meshStandardMaterial color="#fff" /></mesh><mesh position={[0, 0.5, 0.2]}><coneGeometry args={[0.05, 0.1, 8]} rotation={[Math.PI/2,0,0]} /><meshStandardMaterial color="#f59e0b" /></mesh><mesh position={[0, 0.6, 0]}><boxGeometry args={[0.05, 0.1, 0.1]} /><meshStandardMaterial color="#dc2626" /></mesh></group>
};
const Duck: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 1.0);
    return <group ref={ref}><mesh castShadow position={[0, 0.25, 0]} scale={[1, 0.8, 1.5]}><sphereGeometry args={[0.3, 8, 8]} /><meshStandardMaterial color="#facc15" /></mesh><mesh position={[0, 0.5, 0.3]}><sphereGeometry args={[0.2, 8, 8]} /><meshStandardMaterial color="#16a34a" /></mesh><mesh position={[0, 0.5, 0.5]}><boxGeometry args={[0.15, 0.05, 0.2]} /><meshStandardMaterial color="#f59e0b" /></mesh></group>
};
const Fox: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 1.4);
    return <group ref={ref}><mesh castShadow position={[0, 0.3, 0]}><boxGeometry args={[0.4, 0.4, 0.8]} /><meshStandardMaterial color="#ea580c" /></mesh><mesh position={[0, 0.5, 0.5]}><dodecahedronGeometry args={[0.25, 0]} /><meshStandardMaterial color="#ea580c" /></mesh><mesh position={[0, 0.4, -0.6]} rotation={[-0.5,0,0]}><coneGeometry args={[0.15, 0.6, 8]} /><meshStandardMaterial color="#fff" /></mesh></group>
};
const Deer: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 1.0);
    return <group ref={ref}><mesh castShadow position={[0, 0.6, 0]}><boxGeometry args={[0.5, 0.6, 1.0]} /><meshStandardMaterial color="#b45309" /></mesh><mesh position={[0, 1.1, 0.6]}><boxGeometry args={[0.3, 0.4, 0.5]} /><meshStandardMaterial color="#b45309" /></mesh><mesh position={[0.15, 1.4, 0.6]} rotation={[0,0,-0.3]}><cylinderGeometry args={[0.02, 0.02, 0.5]} /><meshStandardMaterial color="#f3f4f6" /></mesh><mesh position={[-0.15, 1.4, 0.6]} rotation={[0,0,0.3]}><cylinderGeometry args={[0.02, 0.02, 0.5]} /><meshStandardMaterial color="#f3f4f6" /></mesh><mesh position={[0.2, 0.3, 0.4]}><cylinderGeometry args={[0.08, 0.05, 0.6]} /><meshStandardMaterial color="#3f2e25" /></mesh><mesh position={[-0.2, 0.3, 0.4]}><cylinderGeometry args={[0.08, 0.05, 0.6]} /><meshStandardMaterial color="#3f2e25" /></mesh><mesh position={[0.2, 0.3, -0.4]}><cylinderGeometry args={[0.08, 0.05, 0.6]} /><meshStandardMaterial color="#3f2e25" /></mesh><mesh position={[-0.2, 0.3, -0.4]}><cylinderGeometry args={[0.08, 0.05, 0.6]} /><meshStandardMaterial color="#3f2e25" /></mesh></group>
};
const Hedgehog: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 0.5);
    return <group ref={ref}><mesh castShadow position={[0, 0.15, 0]}><sphereGeometry args={[0.25, 6, 6]} /><meshStandardMaterial color="#57534e" flatShading /></mesh><mesh position={[0, 0.15, 0.2]}><sphereGeometry args={[0.15, 8, 8]} /><meshStandardMaterial color="#d6d3d1" /></mesh></group>
};
const Pig: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 0.8);
    return <group ref={ref}><mesh castShadow position={[0, 0.3, 0]}><boxGeometry args={[0.5, 0.5, 0.8]} /><meshStandardMaterial color="#f9a8d4" /></mesh><mesh position={[0, 0.4, 0.5]}><boxGeometry args={[0.3, 0.3, 0.2]} /><meshStandardMaterial color="#f9a8d4" /></mesh><mesh position={[0, 0.4, 0.6]}><boxGeometry args={[0.1, 0.1, 0.05]} /><meshStandardMaterial color="#be185d" /></mesh></group>
};
const Cat: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    const ref = useWander(x, z, 1.2);
    return <group ref={ref}><mesh castShadow position={[0, 0.25, 0]}><boxGeometry args={[0.3, 0.3, 0.6]} /><meshStandardMaterial color="#9ca3af" /></mesh><mesh position={[0, 0.45, 0.4]}><sphereGeometry args={[0.2, 8, 8]} /><meshStandardMaterial color="#9ca3af" /></mesh><mesh position={[0.1, 0.65, 0.4]} rotation={[0,0,-0.2]}><coneGeometry args={[0.08, 0.2, 4]} /><meshStandardMaterial color="#9ca3af" /></mesh><mesh position={[-0.1, 0.65, 0.4]} rotation={[0,0,0.2]}><coneGeometry args={[0.08, 0.2, 4]} /><meshStandardMaterial color="#9ca3af" /></mesh><mesh position={[0, 0.4, -0.3]} rotation={[0.5,0,0]}><cylinderGeometry args={[0.03, 0.03, 0.5]} /><meshStandardMaterial color="#9ca3af" /></mesh></group>
};

export interface ChunkData {
  obstacles: React.ReactNode[];
  clouds: React.ReactNode[];
  water: React.ReactNode[];
  bridges: React.ReactNode[];
  coins: React.ReactNode[];
  eagles: React.ReactNode[];
  flowerMatrices: Float32Array;
  flowerColors: Float32Array;
  flowerCount: number;
  rockMatrices: Float32Array;
  rockCount: number;
  terrainGeometry: PlaneGeometry;
}

const generateChunkData = (chunkIndex: number): ChunkData => {
  const startZ = chunkIndex * WORLD_CONFIG.CHUNK_SIZE;
  const endZ = startZ + WORLD_CONFIG.CHUNK_SIZE;
  const obstacles: React.ReactNode[] = [];
  const clouds: React.ReactNode[] = [];
  const water: React.ReactNode[] = [];
  const bridges: React.ReactNode[] = [];
  const coins: React.ReactNode[] = [];
  const eagles: React.ReactNode[] = [];
  
  const MAX_FLOWERS = 20; 
  const flowerMatrices = new Float32Array(MAX_FLOWERS * 16);
  const flowerColors = new Float32Array(MAX_FLOWERS * 3);
  let flowerCount = 0;

  const MAX_ROCKS = 4;
  const rockMatrices = new Float32Array(MAX_ROCKS * 16);
  let rockCount = 0;

  const riverSearchStep = 10; 
  const riversFound = new Set<number>();

  for (let z = startZ - 20; z < endZ + 20; z += riverSearchStep) {
      const r = getRiverInfo(z);
      if (r.isRiver && r.centerZ && !riversFound.has(r.centerZ)) {
          riversFound.add(r.centerZ);
          water.push(
            <mesh key={`water-${r.centerZ}`} position={[0, -0.5, r.centerZ]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
                 <planeGeometry args={[150, 15]} />
                 <meshStandardMaterial color="#60a5fa" transparent opacity={0.8} roughness={0.1} metalness={0.5} side={DoubleSide} />
            </mesh>
          );
          const bx = getBridgeX(r.centerZ);
          bridges.push(<Bridge key={`bridge-${r.centerZ}`} z={r.centerZ} x={bx} />);
          
          // --- BRIDGE COINS (ROW) ---
          const numCoins = Math.floor(hash(r.centerZ, 123) * 6) + 5; 
          const bridgeLen = 24;
          const spacing = bridgeLen / (numCoins + 1);
          
          for(let i=1; i<=numCoins; i++) {
              const coinDist = -bridgeLen/2 + i*spacing; 
              const coinZ = r.centerZ + coinDist;
              const halfL = bridgeLen / 2;
              const normDist = coinDist / halfL;
              const archY = 3.0 * (1 - normDist * normDist); 
              const baseY = calculateBaseTerrain(bx, r.centerZ - 12); 
              const coinY = baseY + archY + 0.2 + 0.5; 
              
              coins.push(<Coin key={`bridge-coin-${r.centerZ}-${i}`} x={bx} y={coinY} z={coinZ} />);
          }
      }
  }

  const step = 3; 

  for (let z = startZ; z < endZ; z += step) {
     if (z < 150) continue;

     for (let x = -WORLD_CONFIG.LANE_WIDTH - 25; x < WORLD_CONFIG.LANE_WIDTH + 25; x += step) {
        if (getRiverInfo(z).isRiver) continue;
        
        const coinInfo = getCoinInfo(x, z);
        if (coinInfo.isCoin) {
             const y = getTerrainHeight(coinInfo.x!, coinInfo.z!) + 0.6; 
             coins.push(<Coin key={`coin-${coinInfo.x}-${coinInfo.z}`} x={coinInfo.x!} y={y} z={coinInfo.z!} />);
             continue;
        }

        const h = hash(x, z);
        const offsetX = (h - 0.5) * 2;
        const offsetZ = (hash(z, x) - 0.5) * 2;
        const finalX = x + offsetX;
        const finalZ = z + offsetZ;
        if (getRiverInfo(finalZ).isRiver) continue;
        const type = getObstacleAt(x, z);
        const animal = getAnimalAt(x, z);
        const key = `obj-${Math.round(x)}-${Math.round(z)}`;
        
        if (type.startsWith('tree')) {
             const y = getTerrainHeight(finalX, finalZ);
             const renderY = y + 0.02;
             let treeNode;
             if (type === 'tree_pine') {
                 treeNode = (
                     <SwayingTree key={key} x={finalX} y={renderY} z={finalZ}>
                         <mesh position={[0, 1, 0]} castShadow receiveShadow><cylinderGeometry args={[0.4, 0.6, 2, 6]} /><meshStandardMaterial color="#4a3728" /></mesh>
                         <mesh position={[0, 3, 0]} castShadow><coneGeometry args={[1.5, 3, 7]} /><meshStandardMaterial color="#166534" /></mesh>
                         <mesh position={[0, 4.5, 0]} castShadow><coneGeometry args={[1.2, 2.5, 7]} /><meshStandardMaterial color="#166534" /></mesh>
                     </SwayingTree>
                 )
             } else if (type === 'tree_oak') {
                 treeNode = (
                     <SwayingTree key={key} x={finalX} y={renderY} z={finalZ}>
                         <mesh position={[0, 1.2, 0]} castShadow receiveShadow><cylinderGeometry args={[0.5, 0.7, 2.5, 7]} /><meshStandardMaterial color="#5d4037" /></mesh>
                         <mesh position={[0, 3.5, 0]} castShadow><dodecahedronGeometry args={[1.8, 0]} /><meshStandardMaterial color="#4ade80" /></mesh>
                         <mesh position={[1.2, 3.2, 0]} castShadow><dodecahedronGeometry args={[1.2, 0]} /><meshStandardMaterial color="#4ade80" /></mesh>
                         <mesh position={[-1, 3.8, 0.5]} castShadow><dodecahedronGeometry args={[1.0, 0]} /><meshStandardMaterial color="#4ade80" /></mesh>
                     </SwayingTree>
                 )
             } else {
                 treeNode = (
                     <SwayingTree key={key} x={finalX} y={renderY} z={finalZ}>
                         <mesh position={[0, 1.5, 0]} castShadow receiveShadow><cylinderGeometry args={[0.3, 0.5, 3, 6]} /><meshStandardMaterial color="#5d4037" /></mesh>
                         <mesh position={[0, 3.5, 0]} castShadow><sphereGeometry args={[1.7, 7, 7]} /><meshStandardMaterial color="#22c55e" /></mesh>
                     </SwayingTree>
                 )
             }
             obstacles.push(treeNode);
        } else if (type === 'tall_tree') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<TallTree key={key} x={finalX} y={y} z={finalZ} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 19} z={finalZ} isLarge />);
        } else if (type === 'tall_rock') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<TallRock key={key} x={finalX} y={y} z={finalZ} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 16} z={finalZ} isLarge />);
        } else if (type === 'structure_cabin') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<Cabin key={key} x={finalX} y={y} z={finalZ} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 14} z={finalZ} isLarge />);
        } else if (type === 'structure_car') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<Car key={key} x={finalX} y={y} z={finalZ} rotation={h * 3} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 5} z={finalZ} isLarge />);
        } else if (type === 'structure_plane') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<PlaneWreck key={key} x={finalX} y={y} z={finalZ} rotation={h} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 13} z={finalZ} isLarge />);
        } else if (type === 'structure_heli') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<HeliWreck key={key} x={finalX} y={y} z={finalZ} rotation={h} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 8} z={finalZ} isLarge />);
        } else if (type === 'rock') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(
                 <mesh key={key} position={[finalX, y + 0.3, finalZ]} castShadow receiveShadow>
                     <dodecahedronGeometry args={[0.5 + h * 0.3, 0]} />
                     <meshStandardMaterial color="#78716c" />
                 </mesh>
             );
        } else if (type === 'log') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(
                 <mesh key={key} position={[finalX, y + 0.2, finalZ]} rotation={[0, h * 3, Math.PI/2]} castShadow>
                     <cylinderGeometry args={[0.2, 0.2, 1.2, 8]} />
                     <meshStandardMaterial color="#4a3728" />
                 </mesh>
             );
        }

        const aProps = { key: `anim-${key}`, x: finalX, y: getTerrainHeight(finalX, finalZ) + 0.02, z: finalZ };
        if (animal === 'bear') obstacles.push(<Bear {...aProps} />);
        if (animal === 'rabbit') obstacles.push(<Rabbit {...aProps} />);
        if (animal === 'squirrel') obstacles.push(<Squirrel {...aProps} />);
        if (animal === 'lamb') obstacles.push(<Lamb {...aProps} />);
        if (animal === 'chicken') obstacles.push(<Chicken {...aProps} />);
        if (animal === 'duck') obstacles.push(<Duck {...aProps} />);
        if (animal === 'fox') obstacles.push(<Fox {...aProps} />);
        if (animal === 'deer') obstacles.push(<Deer {...aProps} />);
        if (animal === 'hedgehog') obstacles.push(<Hedgehog {...aProps} />);
        if (animal === 'pig') obstacles.push(<Pig {...aProps} />);
        if (animal === 'cat') obstacles.push(<Cat {...aProps} />);
     }
  }

  for (let z = startZ; z < endZ; z += 15) {
      for (let x = -40; x < 40; x += 20) {
           const cloudInfo = getCloudInfo(x, z);
           if (cloudInfo.isCloud && cloudInfo.z >= startZ && cloudInfo.z < endZ) {
               clouds.push(<CloudObject key={`cloud-${cloudInfo.x}-${cloudInfo.z}`} x={cloudInfo.x} y={cloudInfo.y} z={cloudInfo.z} scale={cloudInfo.scale} />);
               const hCoin = hash(x * 0.111, z * 0.888);
               if (hCoin > 0.7) { 
                   const cloudTopY = cloudInfo.y + (2.5 * cloudInfo.scale); 
                   coins.push(<Coin key={`cloud-coin-${cloudInfo.x}-${cloudInfo.z}`} x={cloudInfo.x} y={cloudTopY} z={cloudInfo.z} isLarge />);
               }
           }
      }
  }
  
  // --- EAGLES LOOP ---
  for (let z = startZ; z < endZ; z += 15) {
      for (let x = -WORLD_CONFIG.LANE_WIDTH - 30; x < WORLD_CONFIG.LANE_WIDTH + 30; x += 15) {
          const eagleInfo = getEagleInfo(x, z);
          if (eagleInfo.isEagle) {
              eagles.push(<Eagle key={`eagle-${x}-${z}`} x={eagleInfo.x} y={eagleInfo.y} z={eagleInfo.z} />);
          }
      }
  }

  const flowerSpacing = 12.0;
  for (let z = startZ; z < endZ; z += flowerSpacing) {
    if (z < 150) continue;
    for (let x = -25; x < 25; x += flowerSpacing) {
        if (getRiverInfo(z).isRiver) continue;
        const h = hash(x * 123.45, z * 678.90);
        if (flowerCount < MAX_FLOWERS && h > 0.7) {
             const y = getTerrainHeight(x, z);
             const offX = (hash(x, z) - 0.5) * 1.0;
             const offZ = (hash(z, x) - 0.5) * 1.0;
             const s = 0.2 + (h - 0.7) * 2.0;
             tempObject.position.set(x + offX, y + 0.05, z + offZ);
             tempObject.rotation.set(0, h * Math.PI * 2, 0);
             tempObject.scale.set(s, s * 0.6, s);
             tempObject.updateMatrix();
             for(let k=0; k<16; k++) {
                 flowerMatrices[flowerCount * 16 + k] = tempObject.matrix.elements[k];
             }
             const colorIdx = Math.floor((h * 100) % FLOWER_COLORS.length);
             tempColor.set(FLOWER_COLORS[colorIdx]);
             tempColor.offsetHSL(0, 0, 0.15); 
             flowerColors[flowerCount * 3 + 0] = tempColor.r;
             flowerColors[flowerCount * 3 + 1] = tempColor.g;
             flowerColors[flowerCount * 3 + 2] = tempColor.b;
             flowerCount++;
        }
        const hRock = hash(x * 43.21, z * 98.76);
        if (rockCount < MAX_ROCKS && hRock > 0.96) {
             const y = getTerrainHeight(x, z);
             const offX = (hash(x, z) - 0.5) * 1.5;
             const offZ = (hash(z, x) - 0.5) * 1.5;
             const s = 0.15 + (hRock - 0.96) * 4.0;
             tempObject.position.set(x + offX, y + 0.1, z + offZ);
             tempObject.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
             tempObject.scale.set(s, s*0.8, s);
             tempObject.updateMatrix();
             for(let k=0; k<16; k++) {
                 rockMatrices[rockCount * 16 + k] = tempObject.matrix.elements[k];
             }
             rockCount++;
        }
    }
  }

  const terrainGeo = new PlaneGeometry(150, WORLD_CONFIG.CHUNK_SIZE, 40, 15);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const centerZ = startZ + WORLD_CONFIG.CHUNK_SIZE / 2;
  for(let i=0; i < posAttr.count; i++){
      const lx = posAttr.getX(i);
      const lz = posAttr.getZ(i);
      const worldX = lx;
      const worldZ = centerZ + lz; 
      const h = getTerrainHeight(worldX, worldZ);
      posAttr.setY(i, h);
  }
  terrainGeo.computeVertexNormals();
  
  return { obstacles, clouds, water, bridges, coins, eagles, flowerMatrices, flowerColors, flowerCount, rockMatrices, rockCount, terrainGeometry: terrainGeo };
};

const WorldChunk = React.memo(({ index }: { index: number }) => {
  const { obstacles, clouds, water, bridges, coins, eagles, flowerMatrices, flowerColors, flowerCount, rockMatrices, rockCount, terrainGeometry } = useMemo(() => generateChunkData(index), [index]);
  const flowerMeshRef = useRef<InstancedMesh>(null);
  const rockMeshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (flowerMeshRef.current && flowerCount > 0) {
        for (let i = 0; i < flowerCount; i++) {
           tempObject.matrix.fromArray(flowerMatrices, i * 16);
           flowerMeshRef.current.setMatrixAt(i, tempObject.matrix);
           tempColor.setRGB(flowerColors[i*3], flowerColors[i*3+1], flowerColors[i*3+2]);
           flowerMeshRef.current.setColorAt(i, tempColor);
        }
        flowerMeshRef.current.instanceMatrix.needsUpdate = true;
        if(flowerMeshRef.current.instanceColor) flowerMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (rockMeshRef.current && rockCount > 0) {
        for (let i = 0; i < rockCount; i++) {
           tempObject.matrix.fromArray(rockMatrices, i * 16);
           rockMeshRef.current.setMatrixAt(i, tempObject.matrix);
        }
        rockMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [flowerMatrices, flowerColors, flowerCount, rockMatrices, rockCount]);

  return (
    <group>
        <mesh position={[0, 0, index * WORLD_CONFIG.CHUNK_SIZE + WORLD_CONFIG.CHUNK_SIZE / 2]} geometry={terrainGeometry || undefined} receiveShadow>
            <meshStandardMaterial color="#86efac" roughness={1} flatShading={true} side={DoubleSide} />
        </mesh>
        {obstacles}
        {clouds}
        {water}
        {bridges}
        {coins}
        {eagles}
        {flowerCount > 0 && <instancedMesh ref={flowerMeshRef} args={[undefined, undefined, flowerCount]} receiveShadow material={FlowerMaterial}><sphereGeometry args={[0.3, 5, 5]} /></instancedMesh>}
        {rockCount > 0 && <instancedMesh ref={rockMeshRef} args={[undefined, undefined, rockCount]} castShadow receiveShadow><dodecahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color="#4a5d23" roughness={0.9} /></instancedMesh>}
    </group>
  );
});

const WorldUpdater = () => {
    const { camera } = useThree();
    const [visibleChunks, setVisibleChunks] = useState<number[]>([]);
    const lastChunkIndex = useRef<number>(-999);
    const resetTrigger = useGameStore(state => state.resetTrigger);
    const prevResetTrigger = useRef(resetTrigger);
    const timeOffset = useRef(0);
    
    useFrame((state) => {
        if (prevResetTrigger.current !== resetTrigger) {
             lastChunkIndex.current = -999;
             prevResetTrigger.current = resetTrigger;
             timeOffset.current = state.clock.getElapsedTime();
        }

        if (FlowerMaterial.userData.shader) {
            FlowerMaterial.userData.shader.uniforms.uTime.value = state.clock.getElapsedTime() - timeOffset.current;
        }

        const playerZ = camera.position.z + 8;
        const currentChunk = Math.floor(playerZ / WORLD_CONFIG.CHUNK_SIZE);

        if (currentChunk !== lastChunkIndex.current) {
            lastChunkIndex.current = currentChunk;
            const newChunks: number[] = [];
            for (let i = -1; i <= WORLD_CONFIG.RENDER_DISTANCE_CHUNKS; i++) {
                newChunks.push(currentChunk + i);
            }
            setVisibleChunks(newChunks);
        }
    });

    return (
        <group>
            {visibleChunks.map(index => (<WorldChunk key={`chunk-${index}-${resetTrigger}`} index={index} />))}
        </group>
    )
}

export const World = () => {
  return (
    <group>
      <WorldUpdater />
    </group>
  );
};
