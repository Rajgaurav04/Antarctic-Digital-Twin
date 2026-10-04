import { useMemo } from 'react';
import IncidentPulse from './IncidentPulse';
import { PrecisionEquipment } from './StationDetailLayer';
import { Block, Sign, Tube } from './ArchitecturalParts';
import { BUILDINGS, ROOMS, getFurniture, getPartitionBoxes, partitionAABB, furnitureAABB } from './stationLayout';

export function getInteriorObstacles(site){return [...getPartitionBoxes(site).map(partitionAABB),...getFurniture(site).map(furnitureAABB)];}
function Legs({w,d,h}){return <>{[-1,1].flatMap(x=>[-1,1].map(z=><Block key={`${x}-${z}`} position={[x*(w/2-.08),h/2,z*(d/2-.08)]} size={[.06,h,.06]} color='#52616b' metalness={.65}/>))}</>;}
export function Equipment({f,telemetry}){
 const {w,d,h,type}=f;const metallic='#aab9bc',dark='#243b47';
 const bench=['lab','sample','workbench','console','kitchen'].includes(type);
 return <IncidentPulse throughWalls active={telemetry?.active_incident==='CHP_GEN2_TRIP'&&type==='generator'&&Math.abs(f.x+19.4)<.5 || telemetry?.active_incident==='GLYCOL_PRESSURE_DROP'&&type==='exchanger'} reducedMotion={typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}><group position={[f.x,f.y,f.z]}>
 {bench&&<><Block position={[0,h-.06,0]} size={[w,.12,d]} color={type==='kitchen'?metallic:'#dce2db'} metalness={type==='kitchen'?.65:.1}/><Legs w={w} d={d} h={h-.12}/><Block position={[0,h*.48,-d*.32]} size={[w*.92,h*.75,d*.25]} color='#76898d'/>{[-1,0,1].map(i=><Block key={i} position={[i*w*.28,h*.55,d*.12]} size={[.28,.025,.05]} color='#c4cdce' metalness={.7}/>)}</>}
 {type==='console'&&<><Block position={[0,h+.46,-.12]} size={[1.2,.7,.08]} color='#1b2d38'/><Sign text={`${Math.round(telemetry?.kpis?.power_kw??180)} kW  •  ONLINE`} sub='STATION OPERATIONS / TELEMETRY' position={[0,h+.46,-.071]} width={1.11} height={.57} color='#9bdfc6'/><Block position={[0,h+.03,.19]} size={[.65,.04,.22]} color='#32444d'/><Block position={[0,.48,1]} size={[.58,.12,.55]} color='#4e6672'/><Block position={[0,.85,1.25]} size={[.58,.6,.1]} color='#4e6672'/></>}
 {(type==='lab'||type==='sample')&&<><Block position={[-w*.25,h+.23,0]} size={[.42,.42,.32]} color='#eaeee8'/><Block position={[-w*.25,h+.28,.18]} size={[.25,.11,.025]} color='#4b7c88'/><Tube from={[w*.25,h,0]} to={[w*.25,h+.55,0]} radius={.045} color='#d9ded8'/><Block position={[w*.25,h+.55,0]} size={[.3,.13,.15]} color='#f1f1e7'/>{[-.15,0,.15].map((x,i)=><mesh key={i} position={[x,h+.13,.2]}><cylinderGeometry args={[.045,.05,.22,10]}/><meshStandardMaterial color={['#91bbc3','#d8b779','#aaccc2'][i]} transparent opacity={.7}/></mesh>)}</>}
 {type==='hood'&&<><Block position={[0,.7,0]} size={[w,1.4,d]} color='#d5dfdd'/><Block position={[0,1.43,-.25]} size={[w,.7,.36]} color='#e4eae5'/><Block position={[0,1.1,.26]} size={[w-.15,.65,.03]} color='#a0c7d1' opacity={.22}/><Block position={[0,.81,.32]} size={[w-.2,.05,.1]} color='#8bd2ce' emissive='#8bd2ce'/><Sign text='LAMINAR FLOW' position={[0,1.66,.21]} width={w*.75} height={.22}/></>}
 {type==='autoclave'&&<><Block position={[0,h/2,0]} size={[w,h,d]} color='#c3cccd' metalness={.55}/><mesh position={[0,.75,d/2+.025]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.33,.33,.06,24]}/><meshStandardMaterial color='#647e8c' metalness={.8}/></mesh><Sign text='AUTOCLAVE' position={[0,h-.18,d/2+.04]} width={.75} height={.2}/></>}
 {(type==='bed'||type==='medical')&&<><Block position={[0,.25,0]} size={[w,.3,d]} color='#687b84'/><Legs w={w} d={d} h={.3}/><Block position={[0,.48,0]} size={[w-.06,.22,d-.06]} color='#e2e7df'/><Block position={[0,.64,-d*.33]} size={[w*.72,.14,.42]} color='#f2f2e9'/><Block position={[0,.6,d*.16]} size={[w-.08,.08,d*.52]} color={type==='medical'?'#72a9a9':'#456b83'}/><Block position={[0,.6,-d/2]} size={[w,.75,.08]} color='#849799'/></>}
 {(type==='rack'||type==='locker'||type==='reefer')&&<><Block position={[0,h/2,0]} size={[w,h,d]} color={type==='reefer'?'#d9e0db':dark} metalness={.3}/>{Array.from({length:type==='rack'?8:3},(_,i)=><Block key={i} position={[0,.3+i*(h-.4)/(type==='rack'?8:3),d/2+.02]} size={[w*.78,.065,.025]} color={type==='rack'?'#718891':'#bac7c9'}/>)}<Block position={[w*.3,h*.5,d/2+.04]} size={[.025,.28,.04]} color='#c1d0cd'/>{type==='rack'&&<Sign text='UPS / NETWORK' sub='POWER • LINK • READY' position={[0,h-.15,d/2+.04]} width={w*.9} height={.16} color='#84e0c6'/>}</>}
 {type==='shelf'&&<><Legs w={w} d={d} h={h}/>{[.18,.85,1.55,2.2].filter(y=>y<h).map((y,i)=><group key={i}><Block position={[0,y,0]} size={[w,.045,d]} color='#78909a' metalness={.6}/>{[-.25,.25].map((x,j)=><Block key={j} position={[x*w,y+.22,0]} size={[w*.34,.4,d*.8]} color={['#a3b2a7','#ac997d','#7c9caa'][i%3]}/>)}</group>)}</>}
 {type==='table'&&<><Block position={[0,h,0]} size={[w,.1,d]} color='#baa989'/><Legs w={w} d={d} h={h}/></>}
 {type==='chair'&&<><Legs w={w} d={d} h={.45}/><Block position={[0,.48,0]} size={[w,.1,d]} color='#69817d'/><Block position={[0,.72,-d/2]} size={[w,.55,.07]} color='#69817d'/></>}
 {type==='sofa'&&<><Block position={[0,.35,0]} size={[w,.5,d]} color='#587878'/><Block position={[0,.7,-d*.4]} size={[w,.65,.22]} color='#648888'/>{[-1,1].map(s=><Block key={s} position={[s*w/2,.55,0]} size={[.18,.4,d]} color='#547473'/>)}</>}
 {(type==='generator'||type==='diesel-generator')&&<><Block position={[0,.25,0]} size={[w+.2,.35,d+.2]} color='#344c59'/><Block heat={!(type==='generator'&&telemetry?.active_incident==='CHP_GEN2_TRIP'&&Math.abs(f.x+19.4)<.5)} position={[0,.9,0]} size={[w*.72,1.05,d*.9]} color='#bdad87'/><mesh position={[0,.9,d*.4]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.56,.56,.65,18]}/><meshStandardMaterial color='#617880' metalness={.65}/></mesh>{Array.from({length:8},(_,i)=><Block key={i} position={[w*.37,.6+i*.12,0]} size={[.07,.035,d*.72]} color='#243d45'/>)}<Tube from={[0,1.35,-d*.35]} to={[0,2.55,-d*.35]} radius={.11}/><Sign text={type==='diesel-generator'?'DIESEL GENERATION':'CHP • JET A1'} sub={type==='diesel-generator'?'STATION POWER HOUSE':'100 kVA / HEAT RECOVERY'} position={[0,1.1,d*.47]} width={w*.65} height={.3}/></>}
 {(type==='filter'||type==='pump'||type==='exchanger'||type==='battery'||type==='laundry'||type==='gym')&&<><Block position={[0,.12,0]} size={[w,.18,d]} color='#405865'/>{type==='filter'?<><mesh position={[0,h*.48,0]}><cylinderGeometry args={[w*.34,w*.34,h*.82,20]}/><meshStandardMaterial color='#9cc9c8' metalness={.5} roughness={.4}/></mesh><Tube from={[0,h*.9,0]} to={[0,h+.25,0]} radius={.08} color='#6daec4'/><Sign text='RO / FILTER' position={[0,h*.5,d*.46]} width={w*.7} height={.2}/></>:<><Block heat={type==='exchanger'} position={[0,h*.5,0]} size={[w*.85,h*.8,d*.8]} color={type==='battery'?'#243d4d':'#8da4a9'} metalness={.4}/>{[-.3,0,.3].map((x,i)=><Block key={i} position={[x*w,h*.55,d*.42]} size={[w*.18,h*.6,.04]} color={i===0?'#72bba8':'#4f717c'}/>)}<Sign text={type.toUpperCase()} position={[0,h*.8,d*.44]} width={Math.min(w*.8,2)} height={.24}/></>}</>}
 {type==='kitchen'&&<><Block position={[0,h+.15,-d*.4]} size={[w,.3,.08]} color='#b6c4c4'/><Block position={[-w*.2,h+.012,0]} size={[.65,.02,.4]} color='#557079'/><Tube from={[w*.25,h,0]} to={[w*.25,h+.25,0]} radius={.025} color='#ccd6d8'/></>}
 <PrecisionEquipment f={f}/>
 </group></IncidentPulse>;
}
export default function StationInterior({site,textures,cutaway=false,floorLevel='science',telemetry}){
 const furniture=useMemo(()=>getFurniture(site),[site]);const partitions=useMemo(()=>getPartitionBoxes(site),[site]);const b=BUILDINGS[site];
 const visible=y=>!cutaway||site==='maitri'||(floorLevel==='living'?y>5:y<5);
 const levels=site==='maitri'?[b.floor]:[b.floor,b.upper];
 return <group>
 {levels.filter(visible).map(y=><group key={y}>
  {site==='bharati'&&y===b.upper?<><Block position={[-2.5,y-.11,0]} size={[45,.22,30]} color='#d7dfd7' map={textures.floor}/><Block position={[22.5,y-.11,12]} size={[5,.22,6]} map={textures.floor}/><Block position={[22.5,y-.11,-12]} size={[5,.22,6]} map={textures.floor}/></>:<Block position={[0,y-.11,0]} size={[b.halfX*2,.22,b.halfZ*2]} color='#d7dfd7' map={textures.floor}/>}
  <Block position={[0,y+.013,0]} size={[b.halfX*2-.6,.022,2.8]} map={textures.rubber} color='#b0babc'/>
  <Block position={[0,y+.015,b.halfZ/2]} size={[2.3,.025,b.halfZ-1.5]} map={textures.rubber} color='#bac5c3'/>
  {Array.from({length:site==='maitri'?6:11},(_,i)=>{const x=-b.halfX+2+i*4;return <Block key={i} position={[x,y+2.98,0]} size={[2.5,.025,.12]} color='#f4edd9' emissive='#f4edd9'/>;})}
  <pointLight position={[-b.halfX/2,y+2.8,0]} intensity={65} distance={25} decay={2} color='#e8f4ee'/><pointLight position={[b.halfX/2,y+2.8,0]} intensity={65} distance={25} decay={2} color='#e8f4ee'/>
 </group>)}
 {ROOMS[site].filter(r=>visible(r.y)).map(r=><group key={`${r.id}-${r.y}`}>
  <Block position={[r.x,r.y+.018,r.z]} size={[r.x1-r.x0-.12,.025,r.z1-r.z0-.12]} color={r.accent} opacity={.12}/>
  <Sign text={r.name} sub={r.y>5?'LIVING / OPERATIONS':'SCIENCE / STATION SERVICES'} position={[r.x,r.y+(cutaway?.82:2.55),r.z<0?r.z1+.075:r.z0-.075]} rotation={[0,r.z<0?0:Math.PI,0]} width={Math.min(r.x1-r.x0-.3,3.8)} height={.45} color={r.accent}/>
  {!cutaway&&<Block position={[r.x,r.y+2.65,r.z<0?r.z1:r.z0]} size={[1.6,.5,.16]} color='#d6ddda'/>}
 </group>)}
 {partitions.filter(p=>visible(p.y)).map((p,i)=>{const h=cutaway?.65:p.height;return <Block key={i} position={p.axis==='z'?[p.x,p.y+h/2,(p.z0+p.z1)/2]:[(p.x0+p.x1)/2,p.y+h/2,p.z]} size={p.axis==='z'?[p.width,h,p.z1-p.z0]:[p.x1-p.x0,h,p.width]} color='#d7dfda'/>;})}
 {site==='maitri'&&<Equipment f={{type:'rack',x:-11,y:1.1,z:4,w:.55,d:.3,h:1.8}} telemetry={telemetry}/>}
 {/* Room radiator: the supply/return workflow terminates on this actual heat load. */}
 {visible(site==='maitri'?1.1:6.5)&&<group position={site==='maitri'?[8,1.6,-4]:[17,7.1,10]}>
  <Block size={[1.6,.75,.24]} color='#c7d3d6' heat/>
  {Array.from({length:10},(_,i)=><Block key={i} position={[-.7+i*.155,0,.13]} size={[.04,.66,.04]} color='#789aa8'/>)}
  <Tube from={[0,-.2,0]} to={[.9,-.2,0]} radius={.09} color='#ed6d36'/>
 </group>}
 {furniture.filter(f=>visible(f.y)).map((f,i)=><Equipment key={`${site}-${i}`} f={f} telemetry={telemetry}/>)}
 <Sign text='← RESEARCH / PLANT     LIVING / STORES →' sub='MAIN STATION CIRCULATION' position={[0,b.floor+2.65,-1.35]} width={3.6} height={.5}/>
 </group>;
}
