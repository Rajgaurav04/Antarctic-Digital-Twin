import { useEffect, useMemo, createContext, useContext } from 'react';
import * as THREE from 'three';

export const BuildingViewContext=createContext('NORMAL');
export function Block({position=[0,0,0],size=[1,1,1],color='#d5ddde',map,metalness=.05,roughness=.72,emissive='#000000',opacity=1,rotation,wireframe=false,heat=false}){
  const mode=useContext(BuildingViewContext);const thermal=mode==='THERMAL';const tint=thermal?(heat?'#ed6b32':'#476fac'):color;
  return <mesh position={position} rotation={rotation} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={tint} map={thermal?undefined:map} bumpMap={thermal?undefined:map} bumpScale={map ? .035 : 0} metalness={metalness} roughness={roughness} emissive={thermal&&heat?'#d95122':emissive} emissiveIntensity={thermal&&heat?.65:.45} transparent={opacity<1} opacity={opacity} wireframe={wireframe||mode==='XRAY'}/></mesh>;
}
export function Tube({from,to,radius=.035,color='#617984'}){
  const {mid,q,length}=useMemo(()=>{const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),d=b.clone().sub(a);return{mid:a.add(b).multiplyScalar(.5),q:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()),length:d.length()};},[from,to]);
  return <mesh position={mid} quaternion={q} castShadow><cylinderGeometry args={[radius,radius,length,10]}/><meshStandardMaterial color={color} metalness={.7} roughness={.38}/></mesh>;
}
export function Sign({text,sub='',position,rotation=[0,0,0],width=2,height=.48,color='#d7eef2',background='#17313d',overlay=false}){
 const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const c=canvas.getContext('2d');c.fillStyle=background;c.fillRect(0,0,768,192);c.fillStyle=color;c.fillRect(0,0,10,192);c.font=overlay?'600 58px Arial':'600 44px Arial';c.fillText(text,26,80,714);if(sub){c.font=overlay?'42px Arial':'25px Arial';c.fillStyle='#a9c0c9';c.fillText(sub,26,137,714);}const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;},[text,sub,color,background,overlay]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <mesh position={position} rotation={rotation} renderOrder={overlay?1000:0}><planeGeometry args={[width,height]}/><meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent={overlay} toneMapped={false} depthTest={!overlay} depthWrite={!overlay}/></mesh>;
}
export function useBuildingTextures(){
 const textures=useMemo(()=>{
  const make=(base,kind)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');c.fillStyle=base;c.fillRect(0,0,512,512);let seed=72493;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<10000;i++){c.fillStyle=`rgba(${rand()>.5?'255,255,255':'0,0,0'},${rand()*.055})`;c.fillRect(rand()*512,rand()*512,1,1);}if(kind==='panel'){for(let x=0;x<512;x+=32){c.fillStyle='rgba(12,32,44,.18)';c.fillRect(x,0,2,512);c.fillStyle='rgba(255,255,255,.16)';c.fillRect(x+2,0,1,512);}c.fillStyle='rgba(0,0,0,.14)';c.fillRect(0,0,512,3);}if(kind==='floor'){c.strokeStyle='rgba(50,70,74,.16)';for(let x=0;x<512;x+=128){c.strokeRect(x,0,128,128);c.strokeRect(x,128,128,128);c.strokeRect(x,256,128,128);c.strokeRect(x,384,128,128);}}const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='floor'?6:4,kind==='floor'?6:1);t.anisotropy=4;return t;};
  const reflectionCanvas=document.createElement('canvas');reflectionCanvas.width=512;reflectionCanvas.height=256;
  const rc=reflectionCanvas.getContext('2d'),gradient=rc.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#638ea8');gradient.addColorStop(.46,'#c1d5df');gradient.addColorStop(.53,'#eef2f0');gradient.addColorStop(1,'#718488');rc.fillStyle=gradient;rc.fillRect(0,0,512,256);
  const skyReflection=new THREE.CanvasTexture(reflectionCanvas);skyReflection.colorSpace=THREE.SRGBColorSpace;skyReflection.mapping=THREE.EquirectangularReflectionMapping;
  return {skyReflection,cladding:make('#b6c0c4','panel'),maitri:make('#d49c62','panel'),floor:make('#bdc9c9','floor'),rubber:make('#34424a','floor'),roof:make('#608579','panel')};
 },[]);
 useEffect(()=>()=>Object.values(textures).forEach(t=>t.dispose()),[textures]);return textures;
}
export function Stair({x=0,zStart,zEnd,bottom=0,top,width=2.4,steps=16}){
 const rise=(top-bottom)/steps,run=(zStart-zEnd)/steps;
 return <group>{Array.from({length:steps},(_,i)=><Block key={i} position={[x,bottom+rise*(i+1)-.045,zStart-run*(i+.5)]} size={[width,.09,Math.abs(run)]} color='#82939b' metalness={.55}/>)}{[-1,1].map(side=><group key={side}><Tube from={[x+side*width/2,bottom-.08,zStart]} to={[x+side*width/2,top-.08,zEnd]} radius={.07}/><Tube from={[x+side*width/2,bottom+1,zStart]} to={[x+side*width/2,top+1,zEnd]} color='#bdc9ce'/>{Array.from({length:5},(_,i)=>{const t=i/4;const z=zStart+(zEnd-zStart)*t,y=bottom+(top-bottom)*t;return <Tube key={i} from={[x+side*width/2,y,z]} to={[x+side*width/2,y+1,z]}/>;})}</group>)}</group>;
}
