import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { createPolarWaterTexture } from './polarTextures';

const TERRAIN_SIZE = 160;
const TERRAIN_SEGMENTS = 224;
// Preserve level work areas around the model's interpreted facilities.
const FACILITY_APRONS = {
 maitri:[[0,0,12,8],[-25,-3,4,3],[-18,6,3,1.4],[21,-8,3,1.4],[32,-23,1.75,1.5],[-27,17,6,7.5],[23,22,3,1.4],[30,22,3,1.4],[37,22,3,1.4],[-30,27,3,3],[-36,32,3,1.4],[21,17,2,2]],
 bharati:[[0,0,26,16],[-38,17,6,7.5],[-27,-8,2,2],[36,-34,1.75,1.5],[37,12,5,1.4],[37,17,3,1.4],[-48,25,9,9],[-36,32,3,1.4],[33,21,2,2]]
};

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function terrainHeight(site, x, z) {
  const radius = Math.hypot(x, z);
  const broad = Math.sin(x * 0.065 + 0.8) * 0.58
    + Math.cos(z * 0.072 - 0.4) * 0.48
    + Math.sin((x + z) * 0.043) * 0.37;
  const fine = Math.sin(x * 0.21 + Math.cos(z * 0.13)) * Math.cos(z * 0.19) * 0.2;
  const ridges = Math.pow(Math.max(0, Math.sin((x * 0.55 + z * 0.31) * 0.16)), 4) * 0.55;
  // Broad, connected bedrock rises replace isolated spherical boulders. These
  // landforms interpret the oasis / coastal promontory, not surveyed elevations.
  const ridge = (cx, cz, width, depth, peak) => peak * Math.exp(-(((x-cx)/width)**2 + ((z-cz)/depth)**2));
  const bedrock = site === 'maitri'
    ? ridge(-53,-31,24,11,6.2)+ridge(5,-66,40,13,7)+ridge(59,25,18,34,4.5)
    : ridge(-57,5,20,28,6.5)+ridge(15,64,43,16,5.2)+ridge(64,21,17,30,4.2);
  const outer = smoothstep(site === 'maitri' ? 18 : 34, 76, radius);
  let height = -0.12 + outer * (0.5 + broad * (site === 'maitri' ? 1.8 : 2.3) + fine + ridges * 2.2 + bedrock);

  if (site === 'maitri') {
    // Keep the immediate station apron level, then fold the site back into the oasis.
    const lakeRadius = Math.hypot((x - 38) * 0.92, (z + 27) * 1.08);
    const shorelineBlend = 1 - smoothstep(14.4, 21.5, lakeRadius);
    height = THREE.MathUtils.lerp(height, -0.08, shorelineBlend);
  }

  for(const [cx,cz,hx,hz] of FACILITY_APRONS[site]) {
    const edge=Math.max(Math.abs(x-cx)-hx,Math.abs(z-cz)-hz);
    height=THREE.MathUtils.lerp(-.12,height,smoothstep(1,6,edge));
  }
  return height;
}

export function coastlineZ(x) {
  return -27 + Math.sin(x * 0.055) * 4.8 + Math.sin(x * 0.13 + 1.2) * 2.1;
}

function createSnowTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const random = seededRandom(73119);

  context.fillStyle = '#eaf1f3';
  context.fillRect(0, 0, size, size);

  // Fine ice grain and wind-combed sastrugi, baked once into a small seamless tile.
  for (let index = 0; index < 8200; index += 1) {
    const shade = random() > 0.5 ? '255,255,255' : '104,132,145';
    const alpha = random() * 0.1;
    const pixel = random() > 0.92 ? 2 : 1;
    context.fillStyle = `rgba(${shade},${alpha})`;
    context.fillRect(random() * size, random() * size, pixel, pixel);
  }

  for (let index = 0; index < 72; index += 1) {
    const y = random() * size;
    const drift = (random() - 0.5) * 34;
    context.beginPath();
    context.moveTo(-20, y);
    context.bezierCurveTo(size * 0.28, y + drift, size * 0.68, y - drift, size + 20, y + drift * 0.3);
    context.strokeStyle = `rgba(255,255,255,${0.07 + random() * 0.12})`;
    context.lineWidth = 1 + random() * 3;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createTerrainGeometry(site, coverage) {
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const snow = new THREE.Color(site === 'maitri' ? '#e8eff0' : '#e5eef1');
  const rock = new THREE.Color(site === 'maitri' ? '#827e79' : '#657884');
  const exposedStone = new THREE.Color(site === 'maitri' ? '#565b5b' : '#435761');

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const height = terrainHeight(site, x, z);
    positions.setY(index, height);

    // Coherent, blended snow fields follow the actual terrain; no floating white islands.
    const field=.5+Math.sin(x*.065+Math.sin(z*.048))*.23+Math.cos(z*.071-x*.027)*.18+Math.sin((x+z)*.15)*.045;
    const sheltered=THREE.MathUtils.clamp(field+Math.max(0,-height)*.04,0,1);
    const cover=smoothstep(1-coverage-.14,1-coverage+.14,sheltered);
    const grain=Math.sin(x*.31)*Math.cos(z*.28)*.5+.5;
    const color=rock.clone().lerp(exposedStone,.12+grain*.1).lerp(snow,cover);
    color.multiplyScalar(.97+grain*.06);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  // Leave real openings for Priyadarshini Lake and the Bharati fjord so the shoreline is irregular.
  const originalIndex = geometry.getIndex().array;
  const visibleTriangles = [];
  for (let index = 0; index < originalIndex.length; index += 3) {
    const a = originalIndex[index];
    const b = originalIndex[index + 1];
    const c = originalIndex[index + 2];
    const x = (positions.getX(a) + positions.getX(b) + positions.getX(c)) / 3;
    const z = (positions.getZ(a) + positions.getZ(b) + positions.getZ(c)) / 3;
    const underLake = site === 'maitri' && Math.hypot((x - 38) * 0.92, (z + 27) * 1.08) < 14.8;
    const underFjord = site === 'bharati' && z < coastlineZ(x);
    if (!underLake && !underFjord) visibleTriangles.push(a, b, c);
  }
  geometry.setIndex(visibleTriangles);
  geometry.computeBoundingSphere();
  return geometry;
}

function FjordWater() {
  const waterTexture = useMemo(() => {
    return createPolarWaterTexture({ repeat: [3, 1], anisotropy: 8 });
  }, []);
  useEffect(() => () => waterTexture.dispose(), [waterTexture]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.72, -56]} receiveShadow>
        <planeGeometry args={[168, 64, 1, 1]} />
        <meshPhysicalMaterial
          color="#ffffff"
          emissive="#163c4e"
          emissiveIntensity={0.5}
          map={waterTexture}
          roughness={0.28}
          metalness={0.26}
          clearcoat={0.7}
          clearcoatRoughness={0.18}
          transparent
          opacity={0.96}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 50, -0.48, -35]} scale={[4.2,.2,2.8]} receiveShadow>
          <dodecahedronGeometry args={[1,1]} />
          <meshStandardMaterial color="#d7e8e6" roughness={.8} />
        </mesh>
      ))}
    </group>
  );
}

function AuroraCurtain({ color, phase, opacity, reducedMotion }) {
  const meshRef = useRef(null);
  const geometry = useMemo(() => {
    const columns = 54;
    const positions = new Float32Array((columns + 1) * 2 * 3);
    const indices = [];
    for (let column = 0; column <= columns; column += 1) {
      const x = -78 + (column / columns) * 156;
      const wave = Math.sin(column * 0.18 + phase) * 2.2 + Math.sin(column * 0.07 + phase * 2) * 1.4;
      const baseY = 34 + wave;
      const left = column * 6;
      positions[left] = x;
      positions[left + 1] = baseY - 2.7;
      positions[left + 2] = -62 + phase * 3;
      positions[left + 3] = x;
      positions[left + 4] = baseY + 5.4;
      positions[left + 5] = -62 + phase * 3;
      if (column < columns) {
        const a = column * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, [phase]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((state) => {
    if (!meshRef.current || reducedMotion) return;
    meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.035 + phase) * 0.045;
    if (meshRef.current.material) {
      meshRef.current.material.opacity = opacity + Math.sin(state.clock.elapsedTime * 0.45 + phase) * 0.045;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

export default function PolarEnvironment({ site = 'maitri', isDaylight = true, viewMode = 'NORMAL', reducedMotion = false, weather }) {
  const coverage=weather?.cover??.45;
  const terrainGeometry = useMemo(() => createTerrainGeometry(site,coverage), [site,coverage]);
  const snowTexture = useMemo(() => createSnowTexture(), []);
  const skyTint = site === 'maitri' ? '#e5f0f3' : '#d9ebef';

  useEffect(()=>()=>terrainGeometry.dispose(),[terrainGeometry]);
  useEffect(()=>()=>snowTexture.dispose(),[snowTexture]);

  return (
    <group>
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial
          map={snowTexture}
          vertexColors
          color={viewMode === 'THERMAL' ? '#73a9df' : isDaylight ? '#ffffff' : '#9bb9ce'}
          roughness={0.94}
          metalness={0.015}
          wireframe={viewMode === 'XRAY'}
        />
      </mesh>

      {site === 'bharati' && <FjordWater />}

      {isDaylight ? (
        <group>
          <Sky
            distance={450000}
            sunPosition={[-0.72, 0.32, -0.62]}
            inclination={0.48}
            azimuth={0.22}
            rayleigh={weather?.id==='blizzard'?.5:1.4}
            turbidity={weather?.id==='blizzard'?12:weather?.id==='cold'?5:2.5}
            mieCoefficient={0.004}
            mieDirectionalG={0.82}
          />
        </group>
      ) : (
        <group>
          <Stars radius={180} depth={70} count={weather?.id==='blizzard'?0:1500} factor={3.2} saturation={0.12} fade speed={reducedMotion ? 0 : 0.12} />
          {weather?.id!=='blizzard'&&<AuroraCurtain reducedMotion={reducedMotion} color="#4df2ad" phase={0.2} opacity={0.22} />}
          {weather?.id!=='blizzard'&&<AuroraCurtain reducedMotion={reducedMotion} color="#43c7f2" phase={1.9} opacity={0.16} />}
          {weather?.id!=='blizzard'&&<AuroraCurtain reducedMotion={reducedMotion} color="#b996ff" phase={3.6} opacity={0.1} />}
        </group>
      )}

      {isDaylight && (
        <group>
          <hemisphereLight args={[skyTint, '#53606a', 0.45]} />
        </group>
      )}
    </group>
  );
}

