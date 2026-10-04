import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
const layouts=new WeakMap();
import { LABEL_WIDTH as WIDTH, LABEL_HEIGHT as HEIGHT, placeCallouts } from './labelLayout';
function layoutLabels(registry,camera,size,time){
 if(registry.time===time)return;
 registry.time=time;camera.updateMatrixWorld(true);
 const entries=[...registry.entries.values()];
 const bounds=entries[0]?.bounds;
 let building=null;
 if(bounds){
  const corners=[];
  for(const x of [-bounds[0],bounds[0]])for(const y of [0,bounds[3]+.8])for(const z of [-bounds[2]-1,bounds[2]+5])corners.push(new THREE.Vector3(x,y,z).project(camera));
  const visible=corners.filter(v=>v.z>=-1&&v.z<=1);
  if(visible.length){
   const xs=visible.map(v=>(v.x+1)*size.width/2),ys=visible.map(v=>(1-v.y)*size.height/2);
   building={x:Math.min(...xs)-18,y:Math.min(...ys)-18,w:Math.max(...xs)-Math.min(...xs)+36,h:Math.max(...ys)-Math.min(...ys)+36};
   if(visible.length<corners.length)building={x:0,y:0,w:size.width,h:size.height};
  }
 }
 entries.forEach(entry=>{
  entry.group.getWorldPosition(entry.anchor);entry.ndc.copy(entry.anchor).project(camera);
  entry.x=(entry.ndc.x+1)*size.width/2;entry.y=(1-entry.ndc.y)*size.height/2;
  entry.front=entry.ndc.z<=1&&entry.ndc.z>=-1;
  entry.placed=false;
 });
 const positions=placeCallouts(entries.filter(e=>e.front&&e.x>-40&&e.x<size.width+40&&e.y>-40&&e.y<size.height+40),size,building);
 for(const result of positions){
  const entry=registry.entries.get(result.id);entry.placed=result.placed;
  if(!result.placed)continue;
  entry.previous={x:result.x,y:result.y};
  const project=(target,point)=>{target.set(point.x/size.width*2-1,1-point.y/size.height*2,entry.ndc.z).unproject(camera);entry.group.worldToLocal(target);};
  project(entry.output,result);project(entry.edge,result.edge);project(entry.elbow,result.elbow);
 }
}
function routeColor(status){return status.includes('WATER')?'#168cb0':status.includes('LOGISTICS')?'#4f8740':status.includes('HEAT')?'#bc6937':status.includes('POWER')?'#a07a25':'#3b7b84';}
function Callout({label,status,value,alert}){
 const texture=useMemo(()=>{
  const canvas=document.createElement('canvas');canvas.width=WIDTH*4;canvas.height=HEIGHT*4;
  const ctx=canvas.getContext('2d');ctx.scale(4,4);
  const accent=alert?'#b84338':routeColor(status);
  ctx.fillStyle='#f6f9fb';ctx.strokeStyle=alert?'#b84338':'#567583';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.roundRect(.5,.5,WIDTH-1,HEIGHT-1,7);ctx.fill();ctx.stroke();
  ctx.fillStyle=accent;ctx.beginPath();ctx.roundRect(5,8,3,HEIGHT-16,1.5);ctx.fill();
  const category=alert?status:({WATER:'WATER SUPPLY',LOGISTICS:'CARGO & STORES',HEAT:'HEATING LOOP',POWER:'FUEL & POWER'})[status.split(' ')[0]]||'SYSTEM / '+status;
  ctx.fillStyle=accent;ctx.font='600 9px Arial';ctx.fillText(category,15,16,WIDTH-30);
  ctx.font='600 13px Arial';ctx.fillStyle='#203744';
  const words=label.split(' '),lines=[''];
  for(const word of words){const i=lines.length-1,next=(lines[i]+' '+word).trim();if(ctx.measureText(next).width>WIDTH-30&&lines[i]&&lines.length<2)lines.push(word);else lines[i]=next;}
  lines.forEach((line,i)=>ctx.fillText(line,15,lines.length>1?34+i*16:38,WIDTH-30));
  if(value&&lines.length===1){ctx.fillStyle='#496270';ctx.font='11px Arial';ctx.fillText(value,15,53,WIDTH-30);}
  const result=new THREE.CanvasTexture(canvas);result.colorSpace=THREE.SRGBColorSpace;return result;
 },[label,status,value,alert]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <mesh renderOrder={1000}><planeGeometry args={[4.2,4.2*HEIGHT/WIDTH]}/><meshBasicMaterial map={texture} transparent fog={false} depthTest={false} depthWrite={false} toneMapped={false}/></mesh>;
}
export default function HotspotMarker({position,label,subsystemCode,status='NOMINAL',metricValue,metricUnit,onClick,isModalOpen=false,activeHotspot=null,reducedMotion=false,labelVisibility=true,modelBounds=null}){
 const [hovered,setHovered]=useState(false);
 const labelRef=useRef(),dotRef=useRef(),dotMeshRef=useRef(),groupRef=useRef(),leaderRef=useRef();const id=useId();const {camera,size}=useThree();
 const points=useMemo(()=>new Float32Array(9),[]);
 const hide=isModalOpen||(activeHotspot&&activeHotspot!==subsystemCode)||(!labelVisibility&&!hovered);
 const entry=useRef({id,anchor:new THREE.Vector3(),ndc:new THREE.Vector3(),output:new THREE.Vector3(),edge:new THREE.Vector3(),elbow:new THREE.Vector3()});
 useEffect(()=>{
  if(hide)return;
  let registry=layouts.get(camera);if(!registry){registry={entries:new Map(),time:-1};layouts.set(camera,registry);}
  entry.current.group=groupRef.current;entry.current.bounds=modelBounds;registry.entries.set(id,entry.current);registry.time=-1;
  return()=>{registry.entries.delete(id);registry.time=-1;};
 },[camera,hide,id,modelBounds]);
 const world=useRef(new THREE.Vector3());const direction=useRef(new THREE.Vector3());
 const alert=['CRITICAL','WARNING','EMERGENCY'].includes(status);
 const accent=alert?'#b84338':routeColor(status);
 useEffect(()=>()=>{document.body.style.cursor='auto';},[]);
 useFrame(({clock})=>{
  if(labelRef.current){
   const registry=layouts.get(camera);
   if(registry){layoutLabels(registry,camera,size,clock.elapsedTime);labelRef.current.position.copy(entry.current.output);}
   labelRef.current.getWorldPosition(world.current);camera.getWorldDirection(direction.current);
   const depth=world.current.sub(camera.position).dot(direction.current);
   labelRef.current.visible=depth>.1&&entry.current.front!==false&&entry.current.placed===true;
   const worldPerPixel=2*Math.max(.1,depth)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,size.height);
   labelRef.current.scale.setScalar(worldPerPixel*WIDTH/4.2);
   if(leaderRef.current){
    entry.current.elbow.toArray(points,3);entry.current.edge.toArray(points,6);
    leaderRef.current.visible=labelRef.current.visible;
    leaderRef.current.geometry.attributes.position.needsUpdate=true;
   }
  }
  if(dotMeshRef.current){groupRef.current.getWorldPosition(world.current);camera.getWorldDirection(direction.current);const distance=world.current.sub(camera.position).dot(direction.current);dotMeshRef.current.visible=distance>.1;dotMeshRef.current.scale.setScalar(2*Math.max(.1,distance)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,size.height)*3/.13);}
  if(dotRef.current)dotRef.current.emissiveIntensity=alert?(reducedMotion?1:1.2+.8*Math.sin(clock.elapsedTime*Math.PI*2)):(hovered?.7:.3);
 });
 const value=metricValue===undefined?'':`${typeof metricValue==='number'?metricValue.toFixed(1):metricValue} ${metricUnit||''}`;
 return <group ref={groupRef} position={position} onClick={e=>{e.stopPropagation();onClick?.(subsystemCode);}} onPointerOver={e=>{e.stopPropagation();setHovered(true);document.body.style.cursor='pointer';}} onPointerOut={()=>{setHovered(false);document.body.style.cursor='auto';}}>
  <mesh ref={dotMeshRef} renderOrder={1001}><sphereGeometry args={[.13,12,12]}/><meshStandardMaterial ref={dotRef} color={accent} emissive={accent} transparent fog={false} depthTest={false} depthWrite={false} toneMapped={false}/><Billboard><mesh renderOrder={1001}><ringGeometry args={[.15,.22,24]}/><meshBasicMaterial color='#f5f9fb' transparent opacity={.95} fog={false} depthTest={false} depthWrite={false} toneMapped={false}/></mesh></Billboard></mesh>
  {!hide&&<line ref={leaderRef} frustumCulled={false} renderOrder={999}><bufferGeometry><bufferAttribute attach="attributes-position" args={[points,3]}/></bufferGeometry><lineBasicMaterial color={accent} transparent opacity={.95} toneMapped={false} fog={false} depthTest={false} depthWrite={false}/></line>}
  {!hide&&<Billboard ref={labelRef} position={[0,1,0]}><Callout label={label} status={status} value={value} alert={alert}/></Billboard>}
 </group>;
}
