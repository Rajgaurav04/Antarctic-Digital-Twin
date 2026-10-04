import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {CanvasTexture} from 'three';

const FAR_COUNT = 1600;
const MID_COUNT = 1200;
const STREAK_COUNT = 600;

const FAR_XZ_LIMIT = 58;
const MID_XZ_LIMIT = 43;
const FAR_HEIGHT = 34;
const MID_HEIGHT = 25;
const NEAR_XZ_LIMIT = 18;
const NEAR_Y_MIN = -8;
const NEAR_Y_MAX = 14;

// A small seeded generator keeps the field stable between mounts and renders.
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createParticleLayer(count, seed, xzLimit, yMin, yMax, withStreaks = false) {
  const random = makeRandom(seed);
  const positions = new Float32Array(count * 3);
  const drift = new Float32Array(count);
  const fall = new Float32Array(count);
  const streakLength = withStreaks ? new Float32Array(count) : null;
  const linePositions = withStreaks ? new Float32Array(count * 6) : null;

  for (let i = 0; i < count; i++) {
    const x = (random() * 2 - 1) * xzLimit;
    const y = yMin + random() * (yMax - yMin);
    const z = (random() * 2 - 1) * xzLimit;
    const index = i * 3;

    positions[index] = x;
    positions[index + 1] = y;
    positions[index + 2] = z;
    drift[i] = 0.58 + random() * 0.84;
    fall[i] = 0.65 + random() * 0.8;

    if (withStreaks) {
      streakLength[i] = 0.7 + random() * 0.75;
      const lineIndex = i * 6;
      linePositions[lineIndex] = x;
      linePositions[lineIndex + 1] = y;
      linePositions[lineIndex + 2] = z;
      linePositions[lineIndex + 3] = x;
      linePositions[lineIndex + 4] = y - 0.3;
      linePositions[lineIndex + 5] = z;
    }
  }

  return {
    positions,
    drift,
    fall,
    streakLength,
    linePositions,
    xzLimit,
    yMin,
    yMax,
  };
}

function moveLayer(layer, count, windX, windZ, windFactor, delta, driftRate, fallRate) {
  const { positions, drift, fall, xzLimit, yMin, yMax } = layer;
  for (let i = 0; i < count; i++) {
    const index = i * 3;
    const speed = drift[i] * windFactor * driftRate * delta;
    let x = positions[index] + windX * speed;
    let y = positions[index + 1] - fall[i] * fallRate * delta;
    let z = positions[index + 2] + windZ * speed;

    if (x > xzLimit) x -= xzLimit * 2;
    else if (x < -xzLimit) x += xzLimit * 2;
    if (z > xzLimit) z -= xzLimit * 2;
    else if (z < -xzLimit) z += xzLimit * 2;
    if (y < yMin) y = yMax;

    positions[index] = x;
    positions[index + 1] = y;
    positions[index + 2] = z;
  }
}

export default function BlizzardParticles({
  snowfall = 0,
  windSpeed = 30,
  windDirection = 270,
  isReducedMotion = false,
}) {
  const flakeTexture = useMemo(() => {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,30);
    gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.45,'rgba(255,255,255,.85)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return new CanvasTexture(canvas);
  },[]);
  useEffect(()=>()=>flakeTexture.dispose(),[flakeTexture]);
  const farRef = useRef();
  const midRef = useRef();
  const streakRef = useRef();
  const nearPointsRef = useRef();
  const nearGroupRef = useRef();

  const layers = useMemo(() => ({
    far: createParticleLayer(FAR_COUNT, 0x6f4a91, FAR_XZ_LIMIT, 0, FAR_HEIGHT),
    mid: createParticleLayer(MID_COUNT, 0x3ea76d, MID_XZ_LIMIT, 0, MID_HEIGHT),
    near: createParticleLayer(
      STREAK_COUNT,
      0xb17a2d,
      NEAR_XZ_LIMIT,
      NEAR_Y_MIN,
      NEAR_Y_MAX,
      true,
    ),
  }), [FAR_COUNT, MID_COUNT, STREAK_COUNT]);

  const safeWindSpeed = Number.isFinite(windSpeed) ? Math.max(0, windSpeed) : 30;
  const normalizedWind = Math.min(1, safeWindSpeed / 120);
  const density = useMemo(() => {
    const motionScale = isReducedMotion ? 0.62 : 1;
    return {
      far: Math.round((440 + normalizedWind * 1160) * motionScale * snowfall),
      mid: Math.round((180 + normalizedWind * 1020) * motionScale * snowfall),
      near: isReducedMotion ? 0 : Math.round((48 + normalizedWind * 552) * snowfall),
    };
  }, [isReducedMotion, normalizedWind, snowfall]);

  // Meteorological direction is the bearing the wind comes FROM. In this
  // scene +X is east and +Z is south, so the vector points 180 degrees on.
  const windVector = useMemo(() => {
    const bearing = Number.isFinite(windDirection) ? windDirection : 270;
    const radians = (((bearing % 360) + 360) % 360) * (Math.PI / 180);
    return { x: -Math.sin(radians), z: Math.cos(radians) };
  }, [windDirection]);

  useEffect(() => {
    farRef.current?.geometry.setDrawRange(0, density.far);
    midRef.current?.geometry.setDrawRange(0, density.mid);
    streakRef.current?.geometry.setDrawRange(0, density.near * 2);
    nearPointsRef.current?.geometry.setDrawRange(0, density.near);
  }, [density]);

  useFrame((state, frameDelta) => {
    // Keep updates bounded after a suspended tab resumes.
    const delta = Math.min(frameDelta, 0.05);
    const gust=1+normalizedWind*.18*Math.sin(state.clock.elapsedTime*1.7);
    const windFactor = Math.min(3.8, 0.45 + safeWindSpeed * 0.032)*gust;

    if (nearGroupRef.current) {
      nearGroupRef.current.position.x = state.camera.position.x;
      nearGroupRef.current.position.y = state.camera.position.y;
      nearGroupRef.current.position.z = state.camera.position.z;
    }

    if (isReducedMotion || delta <= 0 || snowfall === 0) return;

    moveLayer(layers.far, density.far, windVector.x, windVector.z, windFactor, delta, 4.2, 1.1);
    moveLayer(layers.mid, density.mid, windVector.x, windVector.z, windFactor, delta, 8.5, 2.7);
    farRef.current.geometry.attributes.position.needsUpdate = true;
    midRef.current.geometry.attributes.position.needsUpdate = true;

    const near = layers.near;
    const { positions, drift, fall, streakLength, linePositions } = near;
    const horizontalRate = 17 * windFactor;
    const fallRate = 4.1;
    const streakScale = 0.7 + windFactor * 0.7;
    for (let i = 0; i < density.near; i++) {
      const index = i * 3;
      const x = positions[index] + windVector.x * drift[i] * horizontalRate * delta;
      const y = positions[index + 1] - fall[i] * fallRate * delta;
      const z = positions[index + 2] + windVector.z * drift[i] * horizontalRate * delta;
      let wrappedX = x;
      let wrappedY = y;
      let wrappedZ = z;

      if (wrappedX > NEAR_XZ_LIMIT) wrappedX -= NEAR_XZ_LIMIT * 2;
      else if (wrappedX < -NEAR_XZ_LIMIT) wrappedX += NEAR_XZ_LIMIT * 2;
      if (wrappedZ > NEAR_XZ_LIMIT) wrappedZ -= NEAR_XZ_LIMIT * 2;
      else if (wrappedZ < -NEAR_XZ_LIMIT) wrappedZ += NEAR_XZ_LIMIT * 2;
      if (wrappedY < NEAR_Y_MIN) wrappedY = NEAR_Y_MAX;

      positions[index] = wrappedX;
      positions[index + 1] = wrappedY;
      positions[index + 2] = wrappedZ;

      const velocityX = windVector.x * drift[i] * horizontalRate;
      const velocityY = -fall[i] * fallRate;
      const velocityZ = windVector.z * drift[i] * horizontalRate;
      const inverseLength = 1 / Math.sqrt(
        velocityX * velocityX + velocityY * velocityY + velocityZ * velocityZ,
      );
      const segmentLength = streakScale * streakLength[i];
      const lineIndex = i * 6;

      linePositions[lineIndex] = wrappedX;
      linePositions[lineIndex + 1] = wrappedY;
      linePositions[lineIndex + 2] = wrappedZ;
      linePositions[lineIndex + 3] = wrappedX - velocityX * inverseLength * segmentLength;
      linePositions[lineIndex + 4] = wrappedY - velocityY * inverseLength * segmentLength;
      linePositions[lineIndex + 5] = wrappedZ - velocityZ * inverseLength * segmentLength;
    }
    streakRef.current.geometry.attributes.position.needsUpdate = true;
    nearPointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <>
      <points ref={farRef} frustumCulled={false}>
        <bufferGeometry key={`far-${FAR_COUNT}`}>
          <bufferAttribute
            attach="attributes-position"
            args={[layers.far.positions,3]}
          />
        </bufferGeometry>
        <pointsMaterial
          map={flakeTexture}
          alphaTest={0.03}
          size={0.12}
          color="#dbeafe"
          transparent
          opacity={0.65}
          fog={false}
          toneMapped={false}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      <points ref={midRef} frustumCulled={false}>
        <bufferGeometry key={`mid-${MID_COUNT}`}>
          <bufferAttribute
            attach="attributes-position"
            args={[layers.mid.positions,3]}
          />
        </bufferGeometry>
        <pointsMaterial
          map={flakeTexture}
          alphaTest={0.03}
          size={0.18 + normalizedWind * 0.09}
          color={safeWindSpeed > 85 ? '#f0f9ff' : '#dbeafe'}
          transparent
          opacity={0.9}
          fog={false}
          toneMapped={false}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      <group ref={nearGroupRef} frustumCulled={false}>
        <points ref={nearPointsRef} frustumCulled={false}>
          <bufferGeometry key={`near-flakes-${STREAK_COUNT}`}>
            <bufferAttribute attach="attributes-position" args={[layers.near.positions,3]}/>
          </bufferGeometry>
          <pointsMaterial map={flakeTexture} alphaTest={.03} color="#f3f8fc" size={2.4} sizeAttenuation={false} transparent opacity={.75} fog={false} toneMapped={false} depthWrite={false}/>
        </points>
        <lineSegments ref={streakRef} frustumCulled={false}>
          <bufferGeometry key={`near-${STREAK_COUNT}`}>
            <bufferAttribute
              attach="attributes-position"
              args={[layers.near.linePositions,3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#e0f2fe"
            transparent
            opacity={0.8}
            fog={false}
          toneMapped={false}
          depthWrite={false}
          />
        </lineSegments>
      </group>
    </>
  );
}
