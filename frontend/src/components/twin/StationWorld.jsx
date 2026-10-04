import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import PolarEnvironment from './PolarEnvironment';
import StationInterior, { Equipment } from './StationInterior';
import StationSignage from './StationSignage';
import HotspotMarker from './HotspotMarker';
import IncidentPulse from './IncidentPulse';
import { systemState, weatherWarning } from '../dashboard/data';
import MetAnemometer from './MetAnemometer';
import ExhaustPlume from './ExhaustPlume';
import WorkflowRoute from './WorkflowRoute';
import { Block, Tube, Sign, Stair, useBuildingTextures, BuildingViewContext } from './ArchitecturalParts';
import { BUILDINGS, WORKFLOWS, FUEL_FARMS } from './stationLayout';
import { createIceSurfaceTexture } from './polarTextures';

export function getSupportPositions(site){
 if(site==='maitri')return [-10,-5,0,5,10].flatMap(x=>[-6,0,6].map(z=>[x,z]));
 return Array.from({length:11},(_,i)=>-23+i*4.6).flatMap(x=>Array.from({length:8},(_,j)=>-13+j*26/7).filter(z=>!(Math.abs(x)<.01&&Math.abs(z)>12)).map(z=>[x,z]));
}
function Supports({site}){
 const b=BUILDINGS[site],posts=useMemo(()=>getSupportPositions(site),[site]);const ref=useRef(),feet=useRef();
 useLayoutEffect(()=>{const o=new THREE.Object3D();posts.forEach(([x,z],i)=>{o.position.set(x,b.floor/2,z);o.updateMatrix();ref.current.setMatrixAt(i,o.matrix);o.position.set(x,.05,z);o.updateMatrix();feet.current.setMatrixAt(i,o.matrix);});ref.current.instanceMatrix.needsUpdate=true;feet.current.instanceMatrix.needsUpdate=true;},[posts,b.floor]);
 return <group><instancedMesh ref={ref} args={[null,null,posts.length]} castShadow><cylinderGeometry args={[site==='bharati'?.16:.11,.2,b.floor,12]}/><meshStandardMaterial color='#526875' metalness={.75} roughness={.4}/></instancedMesh><instancedMesh ref={feet} args={[null,null,posts.length]} receiveShadow><boxGeometry args={[.8,.2,.8]}/><meshStandardMaterial color='#87918f' roughness={.9}/></instancedMesh>{[-1,1].flatMap(side=>[-1,1].map(end=><Tube key={`${side}-${end}`} from={[end*(b.halfX-2),.1,side*(b.halfZ-2)]} to={[end*(b.halfX-7),b.floor-.15,side*(b.halfZ-2)]} radius={.07}/>))}</group>;
}
function AutomaticDoor({z,floor,width=2.3}){
 const {camera}=useThree();const left=useRef(),right=useRef();const progress=useRef(0);
 useFrame((_,dt)=>{const near=Math.hypot(camera.position.x,camera.position.z-z)<5&&Math.abs(camera.position.y-(floor+1.7))<2.2;progress.current=THREE.MathUtils.damp(progress.current,near?1:0,8,dt);if(left.current){left.current.position.x=-width/4-progress.current*width*.52;right.current.position.x=width/4+progress.current*width*.52;}});
 return <group position={[0,floor,z]}>{[-1,1].map((s,i)=><group key={s} ref={i?right:left} position={[s*width/4,0,0]}><Block position={[0,1.2,0]} size={[width/2-.035,2.4,.12]} color='#637f87' metalness={.45}/><Block position={[0,1.6,.07]} size={[width/2-.17,.8,.02]} color='#bcdce2' opacity={.32}/><Block position={[s*.28,1,.08]} size={[.04,.25,.04]} color='#dbe2d8'/></group>)}<Sign text='AUTO AIRLOCK' sub='APPROACH TO ENTER' position={[0,2.62,.1]} width={2.1} height={.32}/></group>;
}
function Facade({site,cutaway,textures,viewMode,floorLevel,isDaylight,weather}){
 const b=BUILDINGS[site],steel=site==='bharati',color=viewMode==='THERMAL'?'#368cc3':'#ffffff',wireframe=viewMode==='XRAY';
 const levels=steel?(cutaway?[floorLevel==='living'?6.5:3]:[3,6.5]):[1.1];const windowH=steel?1.6:1.1;
 return <group><Supports site={site}/>
 {levels.map(y=><group key={y}>
  {[-1,1].map(side=><group key={side}>
   {/* Front entrance is an actual opening, not painted onto a solid box. */}
   {(side===1&&y===b.floor?[-1,1]:[0]).map(segment=>{const w=segment?(b.halfX-1.2):b.halfX*2;const x=segment?segment*(1.2+w/2):0;return <group key={segment}>
    <Block position={[x,y+.55,side*b.halfZ]} size={[w,1.1,.2]} color={color} map={steel?textures.cladding:textures.maitri} wireframe={wireframe}/>
    {!cutaway&&<><mesh position={[x,y+1.1+windowH/2,side*(b.halfZ+.015)]}><boxGeometry args={[w,windowH,.08]}/><meshPhysicalMaterial color='#9ebdc8' metalness={.25} roughness={.12} transparent opacity={.25} clearcoat={1} depthWrite={false}/></mesh><Block position={[x,y+2.8,side*b.halfZ]} size={[w,.65,.22]} map={steel?textures.cladding:textures.maitri} color={color} wireframe={wireframe}/></>}
   </group>;})}
   {!cutaway&&Array.from({length:Math.floor(b.halfX*2/2.4)+1},(_,i)=>{const x=-b.halfX+i*2.4;return Math.abs(x)<1.2&&side===1&&y===b.floor?null:<Block key={i} position={[x,y+1.65,side*(b.halfZ+.04)]} size={[.06,3.3,.12]} color='#556e77' metalness={.6}/>;})}
  </group>)}
  {[-1,1].map(side=><Block key={side} position={[side*b.halfX,y+(cutaway?.4:1.6),0]} size={[.2,cutaway?.8:3.2,b.halfZ*2]} map={steel?textures.cladding:textures.maitri} color={color} wireframe={wireframe}/>)}
 </group>)}
 {!cutaway&&<>
  {steel?<><Block position={[-1.65,b.roof,0]} size={[48.7,.28,32]} map={textures.cladding} color="#d1d8d5" metalness={.45}/><Block position={[25.15,b.roof,0]} size={[1.7,.28,32]} map={textures.cladding} color="#d1d8d5"/>{[-1,1].map(s=><Block key={s} position={[23.5,b.roof,s*12.5]} size={[1.6,.28,7]} map={textures.cladding} color="#d1d8d5"/>)}{[-1,1].map(side=><Block key={side} position={[side*25.4,6.6,0]} size={[.25,7.1,30.6]} rotation={[0,0,side*-.105]} color='#566f7c' metalness={.55}/>)}<Block position={[0,10.35,-5]} size={[14,.35,12]} color='#c1cacb'/><Block position={[0,11.5,-5]} size={[10,2.3,7]} color='#8eaaaf' map={textures.cladding}/>{[-3,0,3].map(x=><Block key={x} position={[x,11.5,-1.45]} size={[2,1.2,.05]} color='#294752'/>)}<Sign text='AHU / OBSERVATION TERRACE' position={[0,11.7,-1.39]} width={6} height={.45}/>{[-1,1].map(s=><Tube key={s} from={[-24,11.15,s*15]} to={[24,11.15,s*15]} radius={.035}/>)}<Tube from={[-24,11.15,-15]} to={[-24,11.15,15]}/><Tube from={[24,11.15,-15]} to={[24,11.15,15]}/></>:<>{[-1,1].map(side=><Block key={side} position={[0,4.6,side*4.1]} size={[24.8,.16,8.2]} rotation={[side*-.06,0,0]} map={textures.roof} color='#ffffff' metalness={.4}/>)}</>}
 </>}
 {!cutaway&&weather?.cover>.22&&<group>
  {(steel?[[-1.65,b.roof+.16,0,48.7,32,0],[25.15,b.roof+.16,0,1.7,32,0],[0,12.67,-5,10,7,0]]:[[-0,4.69,-4.1,24.8,8.2,.06],[0,4.69,4.1,24.8,8.2,-.06]]).map(([x,y,z,w,d,rotation],i)=><mesh key={i} position={[x,y,z]} rotation={[rotation,0,0]} receiveShadow><boxGeometry args={[w,.025,d]}/><meshStandardMaterial color="#dce7eb" roughness={.98} transparent opacity={Math.min(.96,(weather.cover-.22)/.7)} depthWrite={false}/></mesh>)}
 </group>}
 {!isDaylight&&[-.7,0,.7].map((t,i)=><group key={i} position={[t*b.halfX,b.ceiling-.2,b.halfZ+.45]}><Block size={[.55,.18,.3]} color='#dcebe0' emissive='#dcebe0'/><pointLight position={[0,-.5,1]} color='#b8d7df' intensity={45} distance={18} decay={2}/></group>)}
 <Stair zStart={b.rampEnd} zEnd={b.halfZ} bottom={0} top={b.floor} steps={steel?18:8}/><AutomaticDoor z={b.halfZ+.15} floor={b.floor}/>
 <pointLight position={[0,b.floor+2,b.halfZ+2]} intensity={isDaylight?0:18} distance={12} color='#d5eee1'/><StationSignage site={site} position={[-b.halfX*.55,b.floor+.57,b.halfZ+.15]} width={steel?5:4} height={steel?1.45:1.1}/>
 {steel&&!cutaway&&[-1,1].flatMap(side=>Array.from({length:13},(_,i)=><Tube key={`${side}-${i}`} from={[-24+i*4,10.3,side*15]} to={[-24+i*4,11.15,side*15]} radius={.025}/>))}
 {steel&&<><Stair x={21.5} zStart={9} zEnd={-9} bottom={3} top={6.5} steps={24}/><Stair x={23.5} zStart={9} zEnd={-9} bottom={6.5} top={b.roof+.14} width={1.4} steps={24}/></>}
 </group>;
}
function Container({position,label,color='#a5b4ae',textures,width=6,depth=2.8,cutaway=false}){
 const plant=label.includes('POWER'),water=label.includes('WATER')||label.includes('PUMP'),camp=label.includes('SUMMER')||label.includes('EMERGENCY'),ups=label.includes('UPS');
 const equipment=plant?'diesel-generator':water?'filter':camp?'bed':ups?'battery':'shelf';
 return <group position={position}>
  <Block position={[0,.02,0]} size={[width,.12,depth]} map={textures.floor}/>
  <Block position={[0,1.3,-depth/2]} size={[width,2.6,.12]} map={textures.cladding} color={color}/>
  {[-1,1].map(side=><group key={side}><Block position={[side*width/2,1.3,0]} size={[.12,2.6,depth]} map={textures.cladding} color={color}/><Block position={[side*(.8+(width/2-.8)/2),1.3,depth/2]} size={[width/2-.8,2.6,.12]} map={textures.cladding} color={color}/></group>)}
  <Block position={[0,2.5,depth/2]} size={[1.6,.2,.12]} color={color}/>
  {!cutaway&&<Block position={[0,2.65,0]} size={[width+.1,.12,depth+.1]} color='#d0d8d1'/>}
  <Sign text={label} position={[0,2.45,depth/2+.08]} width={width*.85} height={.33}/>
  <Block position={[-.85,1.05,depth/2+.55]} size={[.1,2.1,1.1]} color='#4a6975'/>
  {[-1,1].map(side=><Equipment key={side} f={{type:equipment,x:side*(width*.28),z:0,y:.08,w:plant?2:water?1:camp?1.1:1.2,d:plant?Math.min(depth-1,3):camp?Math.min(depth-.4,2.15):.75,h:plant?1.8:camp?.6:2}}/>)}
  <Block position={[0,2.48,0]} size={[width-.4,.025,.08]} color='#e6eddc' emissive='#e6eddc'/><pointLight position={[0,2.2,0]} color='#dbeee0' intensity={8} distance={8} decay={2}/>
 </group>;
}
function Vehicle({position,rotation=0}){return <group position={position} rotation={[0,rotation,0]}><Block position={[0,.6,0]} size={[2.8,.5,4]} color='#c98746'/>{[-1,1].map(s=><group key={s}><Block position={[s*1.35,.3,0]} size={[.55,.55,4.3]} color='#24313a'/>{Array.from({length:8},(_,i)=><Block key={i} position={[s*1.65,.3,-1.8+i*.5]} size={[.03,.5,.08]} color='#59656a'/>)}</group>)}<Block position={[0,1.65,-.75]} size={[2.25,1.7,1.9]} color='#ba683a'/><Block position={[0,1.9,-1.72]} size={[1.95,.85,.04]} color='#89b4c3' metalness={.6}/><Block position={[0,1.4,1.2]} size={[2.3,.9,1.8]} color='#687f87'/><Sign text='FIELD TRANSPORT' position={[0,1.3,2.13]} width={2} height={.3}/></group>;}
function SupplyVessel(){return <group position={[56,-.45,-53]} rotation={[0,-.4,0]}>
 <mesh position={[0,.6,0]} scale={[3.5,1.1,9]} castShadow><sphereGeometry args={[1,20,12]}/><meshStandardMaterial color='#963e27' metalness={.25} roughness={.65}/></mesh>
 <Block position={[0,1.7,0]} size={[6.2,.2,16]} color='#a7aba2'/><Block position={[0,3.7,-4]} size={[5,4,5]} color='#e1e6dd'/><Block position={[0,5.9,-4]} size={[5.6,.65,4.8]} color='#dce5dc'/><Block position={[0,5.45,-6.55]} size={[4.8,.85,.04]} color='#557e8a'/>
 {[-1,1].map(side=><Block key={side} position={[side*2.55,4.6,-4]} size={[.04,.7,4]} color='#587d87'/>)}
 <Tube from={[0,5.7,-4]} to={[0,8,-4]} radius={.08}/><Tube from={[-2.5,7,-4]} to={[2.5,7,-4]}/>
 {[0,1,2].map(i=><Block key={i} position={[0,2.5,i*2.7]} size={[4,1.4,2.3]} color={['#9b8a6c','#668c8c','#a5744b'][i]}/>)}
 <Tube from={[2,1.9,1]} to={[2,6,1]} radius={.13} color='#b89b4a'/><Tube from={[2,6,1]} to={[-2,6,6]} radius={.1} color='#b89b4a'/><Tube from={[-2,6,6]} to={[-2,3,6]} radius={.025}/>
 <Sign text='ANNUAL RESUPPLY / SHIP REFUEL' sub='INDICATIVE LOGISTICS VESSEL' position={[0,2.8,8.1]} width={5} height={.6}/>
 </group>;}
function FuelFarm({site}){
 const {count,position}=FUEL_FARMS[site],lastCap=-5.5+Math.floor((count-1)/3)*2.65+1.15;
 return <group position={position}>
  <Block position={[0,.05,0]} size={[12,.2,15]} color='#86969a'/>
  {Array.from({length:count},(_,i)=>{
   const x=(i%3-1)*3.1,z=-5.5+Math.floor(i/3)*2.65;
   return <group key={i} position={[x,0,z]}>
    <mesh position={[0,1.2,0]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.9,.9,2.3,24]}/><meshStandardMaterial color='#c1c7be' metalness={.6} roughness={.5}/></mesh>
    {[-.8,.8].map(s=><Block key={s} position={[0,.35,s]} size={[1.7,.45,.25]} color='#54717d'/>)}
    <Tube from={[0,2,0]} to={[0,2.5,0]} radius={.06}/>
    <Tube from={[0,1.2,1.12]} to={[0,1.2,1.32]} radius={.105} color='#ffbe18'/>
    <Tube from={[0,1.2,1.32]} to={[5.15-x,1.2,1.32]} radius={.085} color='#ffbe18'/>
    <Block position={[.35,1.2,1.32]} size={[.18,.3,.18]} color='#e4ac45'/>
   </group>;
  })}
  <Tube from={[5.15,1.2,-4.18]} to={[5.15,1.2,lastCap+.17]} radius={.105} color='#ffbe18'/>
  <Sign text={site==='bharati'?'JET A1 / 13 TANK FUEL FARM':'ARCTIC DIESEL / FUEL FARM'} sub='Tank outlets → valve manifold → generator feed' position={[0,2.7,8]} width={9} height={.8}/>
 </group>;
}
function Lake({weather}){const t=useMemo(()=>createIceSurfaceTexture({repeat:[4,4]}),[]);useEffect(()=>()=>{t.map.dispose();t.bumpMap.dispose();},[t]);return <mesh position={[38,-.06,-27]} rotation={[-Math.PI/2,0,0]} receiveShadow><circleGeometry args={[14.5,64]}/><meshPhysicalMaterial map={t.map} bumpMap={t.bumpMap} bumpScale={.045} color={weather?.id==='mild'?'#8abcc9':'#c4dce2'} roughness={weather?.id==='mild'?.3:.72} metalness={.18} clearcoat={.8}/></mesh>;}
function Workflows({site,selected,onSelectHotspot,telemetry,reducedMotion,showLabels=true,isModalOpen,activeSubsystem}){
 const routes=WORKFLOWS[site].filter(w=>selected==='all'||selected===w.id);
 const b=BUILDINGS[site],bounds=useMemo(()=>[b.halfX,b.floor,b.halfZ,b.roof],[b]);
 const incidentRoute=({LAKE_PIPE_FREEZE:'water',CHP_GEN2_TRIP:'power',GLYCOL_PRESSURE_DROP:'heat'})[telemetry?.active_incident];
 return <group>

  {routes.map(w=><group key={w.id}>
   <WorkflowRoute route={w} reducedMotion={reducedMotion} warning={w.id===incidentRoute}/>
   {showLabels&&w.labels.map((label,i)=>{
    // All routes uses only source and destination callouts to avoid a wall of text.
    if(selected==='all'&&i!==0&&i!==w.labels.length-1)return null;
    const n=w.labelPositions?.[i]??w.nodes[w.labelIndices?.[i]??Math.round(i*(w.nodes.length-1)/(w.labels.length-1))];
    return <HotspotMarker key={label} position={[n[0],n[1]+.5,n[2]]} label={label} subsystemCode={w.code} onClick={onSelectHotspot} modelBounds={bounds} status={w.id===incidentRoute?'WARNING':w.id.toUpperCase()+' ROUTE'} reducedMotion={reducedMotion} isModalOpen={isModalOpen} activeHotspot={activeSubsystem}/>;
   })}
  </group>)}
 </group>;
}
export default function StationWorld({site,telemetry,onSelectHotspot,viewMode='NORMAL',isDaylight=true,isModalOpen,activeSubsystem,cutaway=false,floorLevel='science',workflow='none',reducedMotion=false,weather}){
 const textures=useBuildingTextures();const b=BUILDINGS[site],steel=site==='bharati';const wind=weather?.wind??telemetry?.kpis?.wind_speed??20;
 const incident=telemetry?.active_incident;
 const labelBounds=useMemo(()=>[b.halfX,b.floor,b.halfZ,b.roof],[b]);
 const incidentRoute=({LAKE_PIPE_FREEZE:'water',CHP_GEN2_TRIP:'power',GLYCOL_PRESSURE_DROP:'heat'})[incident];
 const hotspots=steel?[
  ['POWER_CHP',[-19.4,4.8,-11.55],'CHP ENERGY CENTRE'],['HVAC_GLYCOL',[-19.3,4.8,-6.05],'GLYCOL / HEAT RECOVERY'],['BATTERY_STORAGE',[-19,5,8],'MLVD / UPS'],['FUEL_STORAGE',[-38,3,17],'JET A1 FUEL FARM'],['WEATHER',[33,8,21],'COASTAL AWS'],['STRUCTURAL_HEALTH',[0,10.4,-5],'OBSERVATION / STRUCTURE'],
 ]:[['POWER_CHP',[-25,4,-3],'DIESEL POWER HOUSE'],['WATER_INTAKE',[32,3,-23],'LAKE WATER INTAKE'],['BATTERY_STORAGE',[-18,3,6],'BESS / UPS'],['FUEL_STORAGE',[-27,3,17],'FUEL FARM'],['WEATHER',[21,8,17],'AWS / WEATHER'],['STRUCTURAL_HEALTH',[0,5,0],'MAIN STATION']];
 return <BuildingViewContext.Provider value={viewMode}><group>
 <PolarEnvironment weather={weather} site={site} isDaylight={isDaylight} viewMode={viewMode} reducedMotion={reducedMotion}/>
 {!steel&&<Lake weather={weather}/>}
 <Facade weather={weather} site={site} cutaway={cutaway} floorLevel={floorLevel} isDaylight={isDaylight} textures={textures} viewMode={viewMode} reducedMotion={reducedMotion}/>
 <StationInterior site={site} textures={textures} cutaway={cutaway} floorLevel={floorLevel} telemetry={telemetry}/>
 {steel?<><group position={[-17,0,-3]}><Block position={[0,1.3,-4]} size={[10,2.6,.16]} color='#607f88'/>{[-1,1].map(s=><Block key={s} position={[s*5,1.3,0]} size={[.16,2.6,8]} color='#607f88'/>)}<Vehicle position={[0,0,0]}/><Sign text='GARAGE / WORKSHOP' position={[0,2.5,4.1]} width={6} height={.5}/></group><group position={[-48,.02,25]}><mesh rotation={[-Math.PI/2,0,0]} receiveShadow><circleGeometry args={[9,48]}/><meshStandardMaterial color='#91a09e' roughness={.9}/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,.025,0]}><ringGeometry args={[6.7,6.9,64]}/><meshBasicMaterial color='#d9dfcc'/></mesh><Sign text='H' position={[0,.035,0]} rotation={[-Math.PI/2,0,0]} width={5} height={5} background='#7d939a' color='#f4ecd0'/><Sign text='WEST HELIPAD / CARGO ARRIVAL' position={[0,1.5,10]} width={8} height={.7}/></group><Container position={[37,0,12]} label='EMERGENCY / SUMMER FACILITY' textures={textures} cutaway={cutaway} width={10} color='#a8b3ae'/><Container position={[37,0,17]} label='FIELD LABORATORY' textures={textures} cutaway={cutaway} color='#a4b6b7'/></>:<><Container position={[-25,0,-3]} label='POWER HOUSE' textures={textures} cutaway={cutaway} width={8} depth={6} color='#8c9991'/>{[-27,-24].map(x=><ExhaustPlume key={x} position={[x,3.4,-4]} windSpeed={wind} windDirection={telemetry?.wind_direction??120} isDaylight={isDaylight}/>)}<Container position={[-18,0,6]} label='UPS / ENERGY STORAGE' textures={textures} cutaway={cutaway} color='#819bad'/><IncidentPulse active={incident==='LAKE_PIPE_FREEZE'} reducedMotion={reducedMotion}><Container position={[21,0,-8]} label='WATER TREATMENT' textures={textures} cutaway={cutaway} color='#a6b7b4'/></IncidentPulse>{[0,1,2].map(i=><Container key={i} position={[23+i*7,0,22]} label='SUMMER CAMP' textures={textures} cutaway={cutaway} color='#b6a27f'/>)}<Vehicle position={[-30,0,27]} rotation={-.6}/></>}
 {steel&&<SupplyVessel/>}
 <FuelFarm site={site}/>
 {!steel&&<Equipment f={{type:'exchanger',x:-21.6,y:.08,z:-5.3,w:.8,d:.8,h:1.8}} telemetry={telemetry}/>}
 {steel&&<group position={[-27,0,-8]}><mesh position={[0,1.1,0]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.75,.75,2.2,24]}/><meshStandardMaterial color='#8b9b99' metalness={.6} roughness={.4}/></mesh><Block position={[0,.3,0]} size={[1.5,.5,1.7]} color='#455e66'/><Tube from={[0,1.7,0]} to={[0,2.2,0]} radius={.06}/><Sign text='JET A1 / DAY TANK' position={[0,2.4,1.2]} width={3.1} height={.45}/></group>}
 <IncidentPulse active={incident==='LAKE_PIPE_FREEZE'} reducedMotion={reducedMotion}><Container position={steel?[36,0,-34]:[32,0,-23]} label={steel?'SEAWATER PUMP':'LAKE PUMP HOUSE'} textures={textures} cutaway={cutaway} width={3.5} depth={3}/></IncidentPulse>
 <IncidentPulse throughWalls active={weatherWarning(telemetry,'wind')} reducedMotion={reducedMotion}><MetAnemometer position={steel?[33,0,21]:[21,0,17]} windSpeed={wind} windDirection={telemetry?.wind_direction??120} isDaylight={isDaylight}/></IncidentPulse>
 <Container position={[-36,0,32]} label='CARGO / FIELD EQUIPMENT' textures={textures} cutaway={cutaway} color='#ad8f6d'/>
 <group position={[-34,0,28]}>{[0,1,2].map(i=><Block key={i} position={[i*1.5,.6,0]} size={[1.2,1.2,1.2]} color={['#a9afa0','#b08f67','#7696a6'][i]} map={textures.cladding}/>)}</group>
 {workflow!=='none'&&<Workflows site={site} selected={workflow} reducedMotion={reducedMotion} telemetry={telemetry} onSelectHotspot={onSelectHotspot} isModalOpen={isModalOpen} activeSubsystem={activeSubsystem}/>}
 {incidentRoute&&workflow!=='all'&&workflow!==incidentRoute&&<Workflows site={site} selected={incidentRoute} showLabels={false} reducedMotion={reducedMotion} telemetry={telemetry} onSelectHotspot={onSelectHotspot}/>}

 {hotspots.map(([code,position,label])=>{
  const system=telemetry?.subsystems?.find(s=>s.code===code);
  const affected=systemState(system||{code},telemetry)!=='Nominal';
  // Critical systems remain discoverable in normal mode and while viewing another route.
  if(workflow!=='none'&&!affected)return null;
  return <HotspotMarker key={code} position={position} label={label} modelBounds={labelBounds} labelVisibility={affected} subsystemCode={code} onClick={onSelectHotspot} isModalOpen={isModalOpen} activeHotspot={activeSubsystem} reducedMotion={reducedMotion} status={affected?'CRITICAL':'NOMINAL'}/>;
 })}
 <Sign text={steel?'BHARATI / LARSEMANN HILLS':'MAITRI / SCHIRMACHER OASIS'} sub='INDIAN ANTARCTIC PROGRAMME' position={[0,.18,b.rampEnd+3]} rotation={[-Math.PI/2,0,0]} width={7} height={1.3} background='#647a80' color='#dde4d6'/>
 </group></BuildingViewContext.Provider>;
}
