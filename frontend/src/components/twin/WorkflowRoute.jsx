import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DirectionalFlowConduit from './DirectionalFlowConduit';

function buildArrowPath(points) {
    let length=0;
    const segments=points.slice(1).map((p,i)=>{
      const from=new THREE.Vector3(...points[i]),to=new THREE.Vector3(...p);
      const direction=to.clone().sub(from),size=direction.length();
      const start=length;length+=size;direction.normalize();
      const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
      const up=new THREE.Vector3().crossVectors(direction,right).normalize();
      const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,direction));
      return {from,to,start,end:length,size,rotation};
    });
    return {segments,length,count:Math.max(1,Math.floor(length/4))};
}
// Flat arrows follow the ground and entrance ramp; they are never rendered as pipes.
function LogisticsArrows({points,color,reducedMotion}) {
  const arrows=useRef(),outlines=useRef();
  const path=useMemo(()=>buildArrowPath(points),[points]);
  const geometry=useMemo(()=>{
    const shape=new THREE.Shape();
    shape.moveTo(-.25,-.85);shape.lineTo(.25,-.85);shape.lineTo(.25,.05);
    shape.lineTo(.65,.05);shape.lineTo(0,.85);shape.lineTo(-.65,.05);shape.lineTo(-.25,.05);shape.closePath();
    return new THREE.ShapeGeometry(shape).rotateX(Math.PI/2);
  },[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const scratch=useRef(new THREE.Object3D());
  useFrame(({clock})=>{
    if(!arrows.current||!outlines.current)return;
    const object=scratch.current;
    const t=reducedMotion?0:clock.getElapsedTime()*1.7;
    for(let i=0;i<path.count;i++){
      const distance=(t+(i+.5)*path.length/path.count)%path.length;
      const segment=path.segments.find(s=>distance<s.end)??path.segments.at(-1);
      object.position.lerpVectors(segment.from,segment.to,(distance-segment.start)/segment.size);
      object.quaternion.copy(segment.rotation);object.scale.setScalar(1);object.updateMatrix();
      arrows.current.setMatrixAt(i,object.matrix);
      object.position.y-=.015;object.scale.setScalar(1.13);object.updateMatrix();
      outlines.current.setMatrixAt(i,object.matrix);
    }
    arrows.current.instanceMatrix.needsUpdate=true;outlines.current.instanceMatrix.needsUpdate=true;
  });
  return <group>
    <instancedMesh ref={outlines} args={[geometry,null,path.count]} frustumCulled={false}><meshBasicMaterial color='#173d28' side={THREE.DoubleSide} toneMapped={false}/></instancedMesh>
    <instancedMesh ref={arrows} args={[geometry,null,path.count]} frustumCulled={false}><meshBasicMaterial color={color} side={THREE.DoubleSide} toneMapped={false}/></instancedMesh>
  </group>;
}

export default function WorkflowRoute({route,reducedMotion,warning}) {
  const common={isReducedMotion:reducedMotion,isWarning:warning};
  if(route.id==='logistics')return <LogisticsArrows points={route.nodes} color={route.color} reducedMotion={reducedMotion}/>;
  if(route.id==='power')return <group>
    <DirectionalFlowConduit isReducedMotion={reducedMotion} points={route.nodes} variant='fuel' pipeRadius={.18} lineColor='#ffbe18' lightColor='#fff0ac' speed={1.6} numLights={6}/>
    <DirectionalFlowConduit {...common} points={route.electricalNodes} variant='electric' pipeRadius={.115} lineColor='#ffea32' lightColor='#fff3af' speed={4.2} numLights={5} lightLength={.75}/>
  </group>;
  if(route.id==='heat')return <group>
    <DirectionalFlowConduit {...common} points={route.nodes} variant='heat' pipeRadius={.19} lineColor='#ff5b21' lightColor='#ffb978' speed={1.8} numLights={5}/>
    <DirectionalFlowConduit {...common} points={route.returnNodes} variant='heat' pipeRadius={.19} lineColor='#7266ff' lightColor='#8dcced' speed={1.4} numLights={5}/>
  </group>;
  return <DirectionalFlowConduit {...common} points={route.nodes} variant='water' pipeRadius={.22} lineColor='#00c8fa' lightColor='#70e5ff' speed={2.1} numLights={8} lightLength={.7}/>;
}
