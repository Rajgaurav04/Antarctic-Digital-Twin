import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * DirectionalFlowConduit
 * Renders a physical connection wire / pipe with:
 * 1. A sleek conduit pipe / wire with a central luminous directional core line.
 * 2. Directional chevron arrows spaced along the line pointing in the flow direction.
 * 3. Partial light beams (elongated glowing light segments, NOT balls) travelling along the wire in the moving direction.
 */
export default function DirectionalFlowConduit({
  points = [],
  pipeRadius = 0.12,
  lineColor = '#38bdf8',
  lightColor = '#7dd3fc',
  speed = 2.4,
  numLights = 3,
  lightLength = 1.6,
  isWarning = false,
  warningColor = '#ef4444',
  warningLightColor = '#f87171',
  reverse = false,
  isReducedMotion = false,
  variant = 'fuel',
}) {
  const lightsGroupRef = useRef();

  // Convert points to Vector3 array
  const pathPoints = useMemo(() => {
    const raw = points.map((p) => (p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
    return reverse ? [...raw].reverse() : raw;
  }, [points, reverse]);

  // Compute segments, tangents, orientations, and lengths
  const { segments, totalLength } = useMemo(() => {
    if (pathPoints.length < 2) {
      return { segments: [], totalLength: 0, cumulativeLengths: [0] };
    }

    const segs = [];
    const cum = [0];
    let total = 0;

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i];
      const p2 = pathPoints[i + 1];
      const delta = new THREE.Vector3().subVectors(p2, p1);
      const len = delta.length();
      if (len < 0.001) continue;

      const dir = delta.clone().normalize();
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      // Orientation aligning Y-axis (Three.js cylinder default) with segment direction
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

      // Directional arrow positions along this segment
      const arrowCount = Math.max(1, Math.floor(len / 3.2));
      const arrowPositions = [];
      for (let a = 1; a <= arrowCount; a++) {
        const frac = a / (arrowCount + 1);
        const arrowPos = new THREE.Vector3().lerpVectors(p1, p2, frac);
        arrowPositions.push(arrowPos);
      }

      segs.push({
        p1,
        p2,
        len,
        dir,
        mid,
        quat,
        arrowPositions,
        startDist: total,
        endDist: total + len,
      });

      total += len;
      cum.push(total);
    }

    return { segments: segs, totalLength: total, cumulativeLengths: cum };
  }, [pathPoints]);

  // Animate partial lights moving along the wire in the flow direction
  useFrame((state) => {
    if (!lightsGroupRef.current || segments.length === 0 || totalLength <= 0) return;
    const t = isReducedMotion ? 0 : state.clock.getElapsedTime();

    const meshes = lightsGroupRef.current.children;
    const effectiveSpeed = isWarning ? speed * 0.2 : speed;

    meshes.forEach((mesh, idx) => {
      // Calculate continuous distance along the line
      const spacing = totalLength / numLights;
      let dist = (t * effectiveSpeed + idx * spacing) % totalLength;
      if (dist < 0) dist += totalLength;

      // Find the segment containing this distance
      let currentSeg = segments[0];
      for (let s = 0; s < segments.length; s++) {
        if (dist >= segments[s].startDist && dist <= segments[s].endDist) {
          currentSeg = segments[s];
          break;
        }
      }

      const localFrac = Math.min(1.0, Math.max(0.0, (dist - currentSeg.startDist) / currentSeg.len));
      mesh.position.lerpVectors(currentSeg.p1, currentSeg.p2, localFrac);
      mesh.quaternion.copy(currentSeg.quat);
      // Clip the packet at every bend/end so it cannot protrude into or past a tank.
      const packetLength=Math.min(lightLength,currentSeg.len);
      const clippedLength=Math.max(.02,Math.min(packetLength,2*(dist-currentSeg.startDist),2*(currentSeg.endDist-dist)));
      if(variant==='water')mesh.scale.set(pipeRadius*1.22,clippedLength/2,pipeRadius*1.22);
      else mesh.scale.set(1,clippedLength/lightLength,1);

      // Fade partial light gracefully at start and end of entire line
      const normalizedDist = dist / totalLength;
      const edgeFade = Math.sin(normalizedDist * Math.PI);
      const blink = isWarning && !isReducedMotion ? (Math.sin(t * 8) > 0 ? 1.0 : 0.2) : 1.0;
      if (mesh.material) {
        mesh.material.opacity = (0.35 + 0.55 * edgeFade) * blink;
      }
    });
  });

  if (segments.length === 0) return null;

  const activeLineColor = isWarning ? warningColor : lineColor;
  const activeLightColor = isWarning ? warningLightColor : lightColor;

  return (
    <group>
      {/* 1. PHYSICAL CONDUIT PIPE SEGMENTS & DIRECTIONAL ARROWS */}
      {segments.map((seg, i) => (
        <group key={`seg-${i}`}>
          {/* Outer Protective Conduit Jacket */}
          {variant!=='electric'&&<mesh position={seg.mid} quaternion={seg.quat} castShadow={variant!=='water'} receiveShadow>
            <cylinderGeometry args={[pipeRadius, pipeRadius, seg.len, 16]} />
            <meshStandardMaterial
              color={activeLineColor}
              emissive={activeLineColor}
              emissiveIntensity={.35}
              metalness={.15}
              roughness={.42}
              toneMapped={false}
            />
          </mesh>}

          {/* Inner Glowing Flow Line (Directional Core Wire) */}
          <mesh position={seg.mid} quaternion={seg.quat}>
            <cylinderGeometry args={[pipeRadius * 0.42, pipeRadius * 0.42, seg.len, 12]} />
            <meshBasicMaterial
              toneMapped={false}
              color={activeLineColor}
            />
          </mesh>

          {/* Directional Chevron Arrows Spaced Along the Wire ("Show direction thru a line") */}
          {variant!=='water'&&seg.len>.9&&seg.arrowPositions.map((arrowPos, aIdx) => (
            <mesh key={`arrow-${aIdx}`} position={arrowPos} quaternion={seg.quat}>
              {/* Cone geometry default points up +Y; aligned with segment direction vector */}
              <coneGeometry args={[pipeRadius * 1.55, Math.min(pipeRadius * 2.8, seg.len * .6), 12]} />
              <meshBasicMaterial
                toneMapped={false}
                color={activeLightColor}
              />
            </mesh>
          ))}
        </group>
      ))}

      {pathPoints.map((point,i)=><mesh key={`coupling-${i}`} position={point}>
        <sphereGeometry args={[pipeRadius * (i===0||i===pathPoints.length-1?1.5:1.07),12,8]}/>
        <meshStandardMaterial color={activeLineColor} emissive={activeLineColor} emissiveIntensity={.25} metalness={.25} roughness={.4} toneMapped={false}/>
      </mesh>)}
      {/* 2. PARTIAL LIGHT BEAMS MOVING IN THE CONNECTION WIRE IN THE MOVING DIRECTION */}
      {/* Sleek elongated glowing light cylinders (NOT balls) */}
      <group ref={lightsGroupRef}>
        {Array.from({ length: numLights }).map((_, idx) => (
          <mesh key={`light-${idx}`}>
            {variant==='water'?<sphereGeometry args={[1,12,8]}/>:<cylinderGeometry args={[pipeRadius * 1.38, pipeRadius * 1.38, lightLength, 12]}/>}
            <meshBasicMaterial
              toneMapped={false}
              color={activeLightColor}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
