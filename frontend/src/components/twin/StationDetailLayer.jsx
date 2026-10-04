import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILDINGS, FUEL_FARMS, WORKFLOWS, getFurniture } from './stationLayout';
import { terrainHeight } from './PolarEnvironment';

// Detail is built in metres, at the existing equipment locations. Repeated parts
// share geometry and instance buffers rather than creating thousands of draw calls.
const C = {steel:'#607985', silver:'#b4c5cc', dark:'#263d48', white:'#e4e9e4', yellow:'#dfab37', red:'#b84c39', blue:'#498ba4', wood:'#a78963'};
const UP = new THREE.Vector3(0,1,0);
function builder() {
  const parts=[];
  const add=(shape,p,s,c=C.steel,r=[0,0,0])=>parts.push({shape,p,s,c,r});
  const box=(p,s,c,r)=>add('box',p,s,c,r);
  const pipe=(a,b,r=.035,c=C.silver)=>{
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
    if(delta.length()<.001)return;
    parts.push({shape:'cylinder',p:from.add(to).multiplyScalar(.5).toArray(),s:[r,delta.length(),r],c,q:new THREE.Quaternion().setFromUnitVectors(UP,delta.normalize())});
  };
  const ring=(p,r,c=C.silver,rotation=[0,0,0])=>add('torus',p,[r,r,r],c,rotation);
  const sphere=(p,s,c)=>add('sphere',p,s,c);
  return {parts,add,box,pipe,ring,sphere};
}

export function VesselHull() {
  const geometries=useMemo(()=>{
    const stations=[[-9,.18],[-7,2.35],[-4,3.2],[3,3.1],[6,2.4],[8,1.1],[9,.12]],vertices=[],indices=[];
    for(const [z,w] of stations)for(const [x,y] of [[-w,1.6],[-w*.65,-.15],[w*.65,-.15],[w,1.6]])vertices.push(x,y,z);
    for(let section=0;section<stations.length-1;section++)for(let side=0;side<3;side++) {
      const a=section*4+side,b=a+1,c=a+4;indices.push(a,c,b,b,c,c+1);
    }
    const hull=new THREE.BufferGeometry();hull.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));hull.setIndex(indices);hull.computeVertexNormals();
    const outline=new THREE.Shape();stations.forEach(([z,w],i)=>i?outline.lineTo(-w,-z):outline.moveTo(-w,-z));
    [...stations].reverse().forEach(([z,w])=>outline.lineTo(w,-z));outline.closePath();
    const deck=new THREE.ShapeGeometry(outline);deck.rotateX(-Math.PI/2);
    return {hull,deck};
  },[]);
  useEffect(()=>()=>Object.values(geometries).forEach(g=>g.dispose()),[geometries]);
  return <group><mesh geometry={geometries.hull} castShadow><meshStandardMaterial color="#933f32" roughness={.48} metalness={.25} side={THREE.DoubleSide}/></mesh><mesh geometry={geometries.deck} position={[0,1.61,0]} receiveShadow><meshStandardMaterial color="#919c9c" roughness={.75}/></mesh></group>;
}

function Instances({parts,shape,micro=false,viewMode}) {
  const ref=useRef(),elapsed=useRef(0);
  const entries=useMemo(()=>parts.filter(p=>p.shape===shape),[parts,shape]);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    const object=new THREE.Object3D(),color=new THREE.Color();
    entries.forEach((part,i)=>{
      object.position.fromArray(part.p);object.scale.fromArray(part.s);
      if(part.q)object.quaternion.copy(part.q);else object.rotation.set(...part.r);
      object.updateMatrix();ref.current.setMatrixAt(i,object.matrix);
      ref.current.setColorAt(i,color.set(part.c));
    });
    ref.current.instanceMatrix.needsUpdate=true;
    if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;
    ref.current.computeBoundingSphere();
  },[entries]);
  useFrame(({camera},dt)=>{
    elapsed.current+=dt;
    if(!micro||elapsed.current<.25||!ref.current)return;
    elapsed.current=0;
    // Screws and instrument fittings disappear at long distance, with hysteresis.
    const distance=Math.hypot(camera.position.x,camera.position.y-4,camera.position.z);
    ref.current.visible=distance<(ref.current.visible?108:96);
  });
  if(!entries.length)return null;
  return <instancedMesh ref={ref} args={[null,null,entries.length]} castShadow={!micro} receiveShadow>
    {shape==='box'?<boxGeometry args={[1,1,1]}/>:shape==='cylinder'?<cylinderGeometry args={[1,1,1,12]}/>:shape==='torus'?<torusGeometry args={[1,.13,6,18]}/>:<sphereGeometry args={[1,12,8]}/>}
    <meshStandardMaterial color={viewMode==='THERMAL'?'#5987b0':'#ffffff'} metalness={.38} roughness={.56} wireframe={viewMode==='XRAY'}/>
  </instancedMesh>;
}
const SHAPES=['box','cylinder','torus','sphere'];
function Batch({parts,micro,viewMode}) { return SHAPES.map(shape=><Instances key={shape} parts={parts} shape={shape} micro={micro} viewMode={viewMode}/>); }

function facadeDetails(site,cutaway) {
  const d=builder(),m=builder(),b=BUILDINGS[site],steel=site==='bharati';
  const floors=steel?[3,6.5]:[1.1];
  if(!cutaway)for(const y of floors)for(const side of [-1,1]) {
    const z=side*(b.halfZ+.12),h=steel?1.6:1.1,base=y+1.1;
    for(let x=-b.halfX+1.2;x<b.halfX;x+=2.4) {
      if(side===1&&Math.abs(x)<1.35&&y===b.floor)continue;
      // Four-sided recessed frames, glazing bead, sill, gasket and opening handle.
      for(const dy of [0,h])d.box([x,base+dy,z],[2.28,.085,.15],C.silver);
      for(const dx of [-1.1,1.1])d.box([x+dx,base+h/2,z],[.075,h,.15],C.dark);
      d.box([x,base-.11,z+side*.11],[2.36,.055,.3],C.silver);
      d.box([x+.55,base+h/2,z+side*.06],[.025,h-.12,.06],C.steel);
      m.box([x+.88,base+h*.45,z+side*.12],[.025,.14,.05],C.dark);
      for(const dx of [-1.06,1.06])for(const dy of [.08,h-.08])m.sphere([x+dx,base+dy,z+side*.09],[.018,.018,.016],C.silver);
    }
    // Panel joints and lower skirting make individual insulated modules legible.
    for(let x=-b.halfX+.2;x<b.halfX;x+=1.2) {
      m.box([x,y+.53,side*(b.halfZ+.13)],[.013,1.05,.015],C.steel);
      for(const dy of [.12,.92])m.sphere([x+.07,y+dy,side*(b.halfZ+.14)],[.022,.022,.012],C.silver);
    }
    d.box([0,y+.06,side*(b.halfZ+.15)],[b.halfX*2,.11,.18],C.dark);
  }
  // Baseplates, four anchor bolts, diagonal braces and structural beam flanges.
  const xs=steel?Array.from({length:11},(_,i)=>-23+i*4.6):[-10,-5,0,5,10];
  for(const x of xs)for(const z of steel?[-13,0,13]:[-6,0,6]) {
    d.box([x,.2,z],[.58,.09,.58],C.steel);
    for(const dx of [-.22,.22])for(const dz of [-.22,.22])m.add('cylinder',[x+dx,.28,z+dz],[.035,.14,.035],C.silver);
    d.box([x,b.floor-.18,z],[.65,.1,.65],C.steel);
    if(x!==xs.at(-1)&&z!==0)d.pipe([x,.4,z],[x+(steel?4.6:5),b.floor-.3,z],.045,C.steel);
  }
  for(const z of steel?[-13,0,13]:[-6,0,6])for(const dy of [-.28,-.08])d.box([0,b.floor+dy,z],[b.halfX*2,.065,.38],C.steel);
  // Grated stair treads, bright nosing, landing rails and entrance lighting.
  const steps=steel?18:8;
  for(let i=0;i<steps;i++) {
    const y=b.floor*(i+1)/steps,z=b.rampEnd-(b.rampEnd-b.halfZ)*(i+.5)/steps;
    d.box([0,y+.011,z+.08],[2.38,.02,.035],C.yellow);
    for(let x=-1;x<1.1;x+=.16)m.box([x,y+.015,z],[.016,.018,(b.rampEnd-b.halfZ)/steps*.7],C.dark);
  }
  for(const side of [-1,1]) {
    d.box([side*1.32,b.floor+1.3,b.halfZ+.24],[.16,2.7,.32],C.silver);
    d.box([side*1.1,b.floor+2.8,b.halfZ+.23],[.4,.09,.4],C.dark);
    d.box([side*1.1,b.floor+2.74,b.halfZ+.3],[.32,.035,.25],C.white);
  }
  if(!cutaway) {
    // Walkable roof service area with HVAC silencers, duct joints and access hatches.
    const roof=steel?b.roof+.2:4.72;
    for(const x of steel?[-16,12]:[-7,7]) {
      d.box([x,roof+.32,-3],[2.5,.6,1.7],C.silver);
      for(let i=0;i<12;i++)m.box([x-1.08+i*.195,roof+.34,-2.12],[.075,.47,.06],C.dark);
      d.box([x,roof+.7,-3],[2.8,.08,1.95],C.steel);
      d.pipe([x,roof+.35,-3],[x,roof+.35,-6],.24,C.silver);
      for(const z of [-4,-5])m.ring([x,roof+.35,z],.27,C.dark,[Math.PI/2,0,0]);
    }
    for(const x of [-b.halfX*.5,b.halfX*.5]) {
      d.box([x,roof+.03,2],[1.4,.08,1.4],C.dark);
      d.box([x,roof+.09,2],[1.24,.06,1.24],C.steel);
      m.box([x+.45,roof+.15,2],[.025,.04,.28],C.yellow);
    }
    for(let x=-b.halfX+.4;x<b.halfX;x+=1.2) {
      if(steel)m.box([x,b.roof+.055,0],[.018,.02,b.halfZ*2],C.steel);
      else for(const side of [-1,1])m.box([x,4.625,side*4.1],[.018,.02,8.2],C.steel,[-side*.06,0,0]);
    }
    for(const side of [-1,1]) {
      d.pipe([-b.halfX,roof-.17,side*(b.halfZ+.16)],[b.halfX,roof-.17,side*(b.halfZ+.16)],.065,C.dark);
      d.pipe([b.halfX-.3,roof-.17,side*(b.halfZ+.16)],[b.halfX-.3,.35,side*(b.halfZ+.16)],.075,C.silver);
    }
    // Communications dish has a curved reflector, feed arm and anchored pedestal.
    const x=steel?6:-3,z=steel?-5:-2,y=steel?12.75:4.8;
    d.box([x,y,z],[1.6,.15,1.6],C.steel);
    d.pipe([x,y,z],[x,y+1.05,z],.16,C.silver);
    d.sphere([x,y+1.75,z],[1.35,.25,1.35],C.white);
    d.ring([x,y+1.75,z],1.35,C.silver,[Math.PI/2,0,0]);
    d.pipe([x-1,y+1.75,z],[x,y+2.5,z],.025,C.dark);
    d.pipe([x+1,y+1.75,z],[x,y+2.5,z],.025,C.dark);
    d.sphere([x,y+2.5,z],[.1,.14,.1],C.dark);
  }
  return {macro:d.parts,micro:m.parts};
}

function siteDetails(site) {
  const d=builder(),m=builder(),b=BUILDINGS[site];
  const {position:[fx,,fz],count}=FUEL_FARMS[site];
  // Tank saddles, lifting eyes, fill necks, bands, gauges, spill kerb and bollards.
  for(let i=0;i<count;i++) {
    const x=fx+(i%3-1)*3.1,z=fz-5.5+Math.floor(i/3)*2.65;
    for(const band of [-.76,.76])d.ring([x,1.2,z+band],.918,C.steel);
    for(const side of [-1,1]) {
      d.box([x+side*.69,.46,z],[.11,.48,1.9],C.steel);
      m.ring([x+side*.34,2.1,z],.09,C.silver);
    }
    d.add('cylinder',[x,2.55,z],[.12,.08,.12],C.yellow);
    d.add('cylinder',[x,1.2,z+1.21],[.2,.1,.2],C.silver,[Math.PI/2,0,0]);
    m.ring([x,1.2,z+1.32],.16,C.yellow);
    m.pipe([x+.35,1.2,z+1.32],[x+.35,1.45,z+1.32],.027,C.steel);
    m.ring([x+.35,1.48,z+1.32],.12,C.red,[Math.PI/2,0,0]);
    d.box([x+.54,1.4,z+1.23],[.24,.27,.04],C.dark);
    m.add('cylinder',[x+.54,1.4,z+1.26],[.09,.02,.09],C.white,[Math.PI/2,0,0]);
    m.pipe([x+.54,1.4,z+1.28],[x+.58,1.46,z+1.28],.009,C.dark);
  }
  for(const s of [-1,1]) {
    d.box([fx+s*5.9,.25,fz],[.16,.5,14.8],C.steel);
    d.box([fx,.25,fz+s*7.4],[11.8,.5,.16],C.steel);
    for(let z=-6;z<=6;z+=3) {
      d.add('cylinder',[fx+s*6.3,.57,fz+z],[.1,1.1,.1],C.yellow);
      m.add('cylinder',[fx+s*6.3,.8,fz+z],[.105,.15,.105],C.dark);
    }
  }
  // Functional pipes stay present when workflow animation is off. Color overlays
  // use exactly the same paths; fittings are attached to those paths, never random.
  for(const route of WORKFLOWS[site].filter(r=>r.id!=='logistics')) {
    const paths=[route.nodes,...(route.returnNodes?[route.returnNodes]:[]),...(route.electricalNodes?[route.electricalNodes]:[])];
    for(const [pathIndex,path] of paths.entries())for(let i=1;i<path.length;i++) {
      const a=new THREE.Vector3(...path[i-1]),z=new THREE.Vector3(...path[i]),dir=z.clone().sub(a),len=dir.length();
      const color=route.id==='water'?C.blue:route.id==='heat'?(pathIndex?C.blue:C.red):C.yellow;
      const radius=route.id==='power'&&pathIndex===1?.055:.13;
      d.pipe(a.toArray(),z.toArray(),radius,route.id==='water'?C.silver:C.steel);
      const q=new THREE.Quaternion().setFromUnitVectors(UP,dir.clone().normalize());
      for(let k=1;k<len;k+=2.4) {
        const p=a.clone().addScaledVector(dir,k/len);
        m.parts.push({shape:'cylinder',p:p.toArray(),s:[radius*1.22,.11,radius*1.22],c:color,q});
      }
      if(len<2)continue;
      const p=a.clone().lerp(z,.5);
      const outside=Math.abs(p.x)>b.halfX+.3||Math.abs(p.z)>b.halfZ+.3;
      if(!outside)continue;
      for(let k=1.3;k<len;k+=5) {
        const v=a.clone().addScaledVector(dir,k/len),ground=terrainHeight(site,v.x,v.z)+.14;
        if(v.y<ground+.2||Math.abs(dir.y)>.01)continue;
        d.box([v.x,ground+.04,v.z],[.55,.09,.55],C.steel);
        d.pipe([v.x,ground,v.z],[v.x,v.y-.1,v.z],.045,C.steel);
        m.parts.push({shape:'cylinder',p:v.toArray(),s:[radius*1.3,.055,radius*1.3],c:C.silver,q});
      }
      if(route.id==='power'&&pathIndex===1)continue;
      m.pipe([p.x,p.y,p.z],[p.x,p.y+.26,p.z],.025,C.silver);
      m.ring([p.x,p.y+.28,p.z],.18,color,[Math.PI/2,0,0]);
      m.box([p.x,p.y+.4,p.z],[.24,.17,.08],C.dark);
    }
  }
  // Container service modules retain their doors; add corner castings, ventilation,
  // electrical boxes, weather-sealed cable glands and access landing grates.
  const modules=site==='maitri'?[[-25,-3,8,6],[-18,6,6,2.8],[21,-8,6,2.8],[32,-23,3.5,3],[23,22,6,2.8],[30,22,6,2.8],[37,22,6,2.8]]:[[37,12,10,2.8],[37,17,6,2.8],[36,-34,3.5,3]];
  modules.push([-36,32,6,2.8]);
  for(const [x,z,w,depth] of modules) {
    for(const sx of [-1,1])for(const sz of [-1,1]) {
      d.box([x+sx*(w/2-.05),1.32,z+sz*depth/2],[.15,2.65,.18],C.steel);
      for(const y of [.14,2.53])m.box([x+sx*(w/2-.03),y,z+sz*(depth/2+.08)],[.19,.16,.04],C.dark);
    }
    d.box([x+w/2+.07,1.55,z],[.16,.7,1],C.dark);
    for(let i=0;i<8;i++)m.box([x+w/2+.16,1.27+i*.075,z],[.035,.025,.87],C.silver);
    d.box([x-.85,.12,z+depth/2+.7],[2.4,.18,1.3],C.steel);
    for(let k=-1;k<=1;k+=.13)m.box([x-.85+k,.22,z+depth/2+.7],[.025,.018,1.2],C.dark);
    d.box([x+w/2-.6,1.1,z+depth/2+.1],[.38,.56,.19],C.silver);
    m.box([x+w/2-.6,1.15,z+depth/2+.21],[.26,.19,.018],C.dark);
  }
  // Cargo is identifiable as pallets, strapped cases and sealed instrument boxes.
  for(const [x,z] of [[-34,28],[-35.5,29.8],[-31,30.6]]) {
    for(let i=0;i<5;i++)d.box([x-.6+i*.3,.15,z],[.22,.1,1.3],C.wood);
    for(const dx of [-.5,0,.5])d.box([x+dx,.07,z],[.17,.09,1.2],C.wood);
    d.box([x,.57,z],[1.35,.72,1.15],C.wood);
    for(const dx of [-.42,.42])d.box([x+dx,.59,z],[.065,.76,1.19],C.dark);
    for(const sz of [-1,1])m.box([x,.58,z+sz*.59],[.35,.2,.012],C.white);
  }
  for(const x of [-34,-32,-30]) {
    d.add('cylinder',[x,.5,33.7],[.32,.95,.32],C.blue);
    for(const y of [.15,.75])d.add('cylinder',[x,y,33.7],[.335,.055,.335],C.steel);
    m.add('cylinder',[x+.09,1,33.7],[.035,.018,.035],C.silver);
  }
  // Small weather instrument station: radiation shield, logger, solar panel and anchors.
  const [mx,mz]=site==='maitri'?[21,17]:[33,21];
  d.box([mx,.03,mz],[1,.12,1],C.steel);
  d.box([mx+.17,1.65,mz],[.48,.7,.25],C.silver);
  for(let i=0;i<9;i++)d.add('cylinder',[mx+.45,2.5+i*.045,mz],[.16,.035,.16],C.white);
  d.box([mx+.3,3.45,mz],[.85,.035,.58],C.dark,[.4,0,0]);
  for(let i=0;i<5;i++)m.box([mx-.04+i*.15,3.46,mz],[.013,.035,.57],C.silver,[.4,0,0]);
  for(let i=0;i<3;i++) {
    const angle=i*Math.PI*2/3,x=mx+Math.cos(angle)*3.1,z=mz+Math.sin(angle)*3.1,y=terrainHeight(site,x,z)+.08;
    d.pipe([mx,6.8,mz],[x,y,z],.014,C.steel);
    d.box([x,y,z],[.32,.16,.32],C.steel);
  }
  // Tracked transport: running gear, sprockets, track shoes, roof rack and lamps.
  const vehicle=builder();
  for(const side of [-1,1]) {
    for(let i=0;i<7;i++) {
      const z=-1.65+i*.55;
      vehicle.add('cylinder',[side*1.68,.43,z],[.26,.13,.26],C.steel,[0,0,Math.PI/2]);
      vehicle.add('cylinder',[side*1.76,.43,z],[.09,.035,.09],C.silver,[0,0,Math.PI/2]);
    }
    for(let i=0;i<24;i++)vehicle.box([side*1.38,.61,-1.9+i*.17],[.5,.055,.07],C.steel);
    vehicle.box([side*1.15,1.48,-1.78],[.16,.9,.07],C.dark);
    vehicle.sphere([side*.78,1.09,-2.11],[.15,.14,.06],C.white);
    vehicle.pipe([side*1.1,2.5,-1.5],[side*1.1,2.5,.05],.04,C.silver);
    vehicle.box([side*1.18,1.56,-.8],[.04,.3,.6],C.dark);
  }
  for(let i=0;i<9;i++)vehicle.box([-.65+i*.16,.88,-2.1],[.045,.2,.025],C.dark);
  vehicle.box([0,.7,-2.25],[2.65,.15,.15],C.steel);
  for(const z of [-1.45,-.8,0])vehicle.pipe([-1.1,2.5,z],[1.1,2.5,z],.035,C.silver);
  const offset=site==='maitri'?[-30,0,27]:[-17,0,-3],angle=site==='maitri'?-.6:0;
  const rotation=new THREE.Quaternion().setFromAxisAngle(UP,angle);
  for(const part of vehicle.parts) {
    const q=part.q||new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.r));
    d.parts.push({...part,p:new THREE.Vector3(...part.p).applyQuaternion(rotation).add(new THREE.Vector3(...offset)).toArray(),q:rotation.clone().multiply(q)});
  }
  // Low-profile tracks and snow poles describe the existing cargo approach.
  const cargo=WORKFLOWS[site].find(r=>r.id==='logistics').nodes;
  for(let i=1;i<cargo.length;i++) {
    const a=new THREE.Vector3(...cargo[i-1]),end=new THREE.Vector3(...cargo[i]);
    if(a.y>.3||end.y>.3)continue;
    const delta=end.clone().sub(a),len=delta.length(),right=new THREE.Vector3(delta.z,0,-delta.x).normalize();
    for(let t=1;t<len;t+=2) {
      const p=a.clone().lerp(end,t/len),y=terrainHeight(site,p.x,p.z)+.025;
      for(const side of [-1,1]) {
        const v=p.clone().addScaledVector(right,side*.78);
        m.box([v.x,y,v.z],[.22,.022,1.25],'#748589',[0,Math.atan2(delta.x,delta.z),0]);
      }
      if(Math.round(t)%6===1) {
        const v=p.clone().addScaledVector(right,2.1);
        d.pipe([v.x,y,v.z],[v.x,y+1.1,v.z],.025,C.yellow);
        m.pipe([v.x,y+.85,v.z],[v.x,y+1.1,v.z],.03,C.red);
      }
    }
  }
  if(site==='bharati') {
    const ship=builder();
    for(const side of [-1,1]) {
      for(let z=-7;z<=6;z+=1)ship.pipe([side*2.6,1.7,z],[side*2.6,2.5,z],.024,C.silver);
      for(const y of [2.1,2.5])ship.pipe([side*2.6,y,-7],[side*2.6,y,6],.023,C.white);
      for(let z=-5.6;z<-2;z+=.7)ship.ring([side*2.53,3.4,z],.19,C.dark,[0,Math.PI/2,0]);
      ship.ring([side*2.6,4.1,-3],.33,C.red,[0,Math.PI/2,0]);
      ship.box([side*2.6,4.1,-3],[.09,.07,.65],C.white);
      for(const z of [2,6])for(const x of [-.15,.15])ship.pipe([side*2.1+x,1.6,z],[side*2.1+x,1.9,z],.09,C.dark);
    }
    for(let x=-1.8;x<=1.8;x+=.72)ship.box([x,5.45,-6.59],[.045,.86,.04],C.white);
    for(const x of [-2,2])ship.pipe([x,5.9,-5.8],[x,6.8,-5.8],.03,C.silver);
    ship.pipe([-2,6.8,-5.8],[2,6.8,-5.8],.03,C.silver);
    ship.box([0,7.9,-4],[1.6,.09,.28],C.white);
    const rot=new THREE.Quaternion().setFromAxisAngle(UP,-.4),pos=new THREE.Vector3(56,-.45,-53);
    for(const part of ship.parts) {
      const q=part.q||new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.r));
      d.parts.push({...part,p:new THREE.Vector3(...part.p).applyQuaternion(rot).add(pos).toArray(),q:rot.clone().multiply(q)});
    }
  }
  return {macro:d.parts,micro:m.parts};
}

function interiorDetails(site,cutaway,floorLevel) {
  const d=builder(),m=builder();
  for(const f of getFurniture(site)) {
    if(cutaway&&site==='bharati'&&(floorLevel==='living'?f.y<5:f.y>5))continue;
    const {x,y,z,w,d:depth,h,type}=f;
    if(['generator','exchanger','diesel-generator'].includes(type))continue; // Details live inside their alert wrapper.
    if(['lab','sample','workbench','console','kitchen'].includes(type)) {
      for(let i=0;i<3;i++) {
        const dx=x-w*.3+i*w*.3;
        m.box([dx,y+h*.4,z+depth*.25],[w*.27,.25,.015],C.silver);
        m.box([dx,y+h*.45,z+depth*.28],[w*.12,.025,.035],C.dark);
      }
      if(type==='lab'||type==='sample') {
        d.box([x+w*.2,y+h+.25,z],[.35,.48,.3],C.dark);
        m.box([x+w*.2,y+h+.35,z+.16],[.24,.15,.02],C.blue);
        for(let i=0;i<6;i++)m.add('cylinder',[x-w*.3+i*.09,y+h+.12,z+.18],[.028,.22,.028],i%2?C.white:C.blue);
        m.box([x,y+h+.06,z-.13],[.32,.1,.24],C.white);
      }
    }
    if(type==='rack')for(let row=0;row<8;row++) {
      const py=y+.3+row*(h-.4)/8;
      m.box([x-w*.35,py,z+depth/2+.04],[.035,.035,.03],row%3?C.blue:C.yellow);
      for(let i=0;i<8;i++)m.box([x-w*.25+i*w*.065,py,z+depth/2+.04],[w*.026,.022,.015],C.dark);
    }
    if(type==='shelf')for(const level of [.4,1.1,1.8].filter(v=>v<h))for(const side of [-1,1]) {
      m.box([x+side*w*.25,y+level,z+depth*.41],[w*.18,.12,.012],C.white);
      m.box([x+side*w*.25,y+level-.02,z+depth*.42],[w*.12,.02,.016],C.dark);
    }
    if(type==='bed') {
      d.box([x-w*.68,y+.32,z-depth*.3],[.32,.65,.42],C.wood);
      m.box([x-w*.68,y+.75,z-depth*.3],[.16,.2,.14],C.white);
      m.box([x,y+.665,z+depth*.15],[w*.9,.016,.035],C.silver);
    }
    if(type==='filter'||type==='pump') {
      m.pipe([x+w*.3,y+.5,z],[x+w*.3,y+h+.1,z],.038,C.silver);
      m.add('cylinder',[x+w*.3,y+h*.7,z+depth*.35],[.08,.04,.08],C.white,[Math.PI/2,0,0]);
      m.ring([x+w*.3,y+h*.7,z+depth*.37],.083,C.steel);
    }
  }
  return {macro:d.parts,micro:m.parts};
}

export default function StationDetailLayer({site,cutaway,floorLevel,viewMode}) {
  const data=useMemo(()=>{
    const groups=[facadeDetails(site,cutaway),siteDetails(site),interiorDetails(site,cutaway,floorLevel)];
    return {macro:groups.flatMap(g=>g.macro),micro:groups.flatMap(g=>g.micro)};
  },[site,cutaway,floorLevel]);
  return <group><Batch parts={data.macro} viewMode={viewMode}/><Batch parts={data.micro} micro viewMode={viewMode}/></group>;
}

// These parts inherit the equipment's own IncidentPulse material and silhouette.
export function PrecisionEquipment({f}) {
  const parts=useMemo(()=>{
    const d=builder(),{w,d:depth,h,type}=f;
    if(type==='generator'||type==='diesel-generator') {
      for(const side of [-1,1])for(let i=0;i<4;i++) {
        const z=-depth*.28+i*depth*.18;
        d.add('cylinder',[side*w*.3,1.43,z],[.13,.17,.13],C.silver);
        d.pipe([side*w*.3,1.48,z],[side*w*.4,1.08,z+.12],.04,C.dark);
      }
      for(let i=0;i<7;i++)d.ring([0,.9,depth*.35+i*.04],.575,C.silver);
      d.box([w*.42,1.27,depth*.1],[.38,.4,.2],C.steel);
      d.box([w*.42,1.33,depth*.21],[.28,.17,.025],C.dark);
      for(const x of [-w*.4,w*.4])for(const z of [-depth*.42,depth*.42]) {
        d.add('cylinder',[x,.39,z],[.09,.13,.09],C.dark);
        d.add('cylinder',[x,.48,z],[.045,.05,.045],C.silver);
      }
      d.add('cylinder',[0,2.1,-depth*.35],[.22,.65,.22],C.silver);
      for(const y of [1.83,2.38])d.add('cylinder',[0,y,-depth*.35],[.24,.035,.24],C.steel);
      d.pipe([-w*.4,.65,-depth*.25],[-w*.4,1.2,-depth*.25],.035,C.yellow);
    } else if(type==='exchanger') {
      for(let i=0;i<20;i++)d.box([-w*.36+i*w*.037,h*.51,0],[.025,h*.68,depth*.83],i%2?C.silver:C.steel);
      for(const x of [-w*.3,w*.3])for(const y of [.3,h*.8])d.pipe([x,y,-depth*.46],[x,y,depth*.5],.035,C.dark);
      for(const side of [-1,1]) {
        d.pipe([side*w*.4,h*.4,0],[side*(w*.4+.35),h*.4,0],.09,side>0?C.red:C.blue);
        d.ring([side*(w*.4+.2),h*.4,0],.14,C.silver,[0,Math.PI/2,0]);
      }
    }
    return d.parts;
  },[f.w,f.d,f.h,f.type]);
  if(!parts.length)return null;
  return <group>{parts.map((part,i)=><mesh key={i} position={part.p} scale={part.s} rotation={part.q?undefined:part.r} quaternion={part.q} castShadow>
    {part.shape==='box'?<boxGeometry args={[1,1,1]}/>:part.shape==='cylinder'?<cylinderGeometry args={[1,1,1,12]}/>:<torusGeometry args={[1,.08,6,18]}/>}
    <meshStandardMaterial color={part.c} metalness={.5} roughness={.45}/>
  </mesh>)}</group>;
}
