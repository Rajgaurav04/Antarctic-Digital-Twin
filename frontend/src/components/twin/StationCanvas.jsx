import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import MaitriModel from './MaitriModel';
import BharatiModel from './BharatiModel';
import BlizzardParticles from './BlizzardParticles';
import NormalNavigationController from './NormalNavigationController';
import SiteNavigator, { CameraMapTracker } from './SiteNavigator';
import { WEATHER_OPTIONS, sceneWeather } from './stationWeather';
import { stationTour } from './guidedTour';
import { WORKFLOWS } from './stationLayout';
import { Sun, Moon, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import './StationCanvas.css';
function CameraRig({ targetPosition, targetLookAt, waypointTrigger, controlsRef, enabled=true, paused=false, reducedMotion=false, onArrive, onInteraction }) {
 const flight=useRef(null),callbacks=useRef({onArrive,onInteraction});
 callbacks.current={onArrive,onInteraction};
 useEffect(()=>{
  const c=controlsRef.current;if(!enabled||!c||!targetPosition||!targetLookAt)return;
  const start=c.object.position.clone(),end=new THREE.Vector3(...targetPosition);
  const distance=start.distanceTo(end),height=distance>14?Math.max(start.y,end.y,18):Math.max(start.y,end.y);
  const a=start.clone().lerp(end,.32),b=start.clone().lerp(end,.68);
  a.y=height;b.y=height;
  flight.current={curve:new THREE.CubicBezierCurve3(start,a,b,end),startLook:c.target.clone(),endLook:new THREE.Vector3(...targetLookAt),elapsed:0,duration:reducedMotion?0:Math.min(3.6,1.4+distance*.025)};
 },[waypointTrigger,enabled,reducedMotion,controlsRef]);
 useEffect(()=>{
  const c=controlsRef.current;if(!c)return;
  const cancel=()=>{flight.current=null;callbacks.current.onInteraction?.();};
  c.addEventListener('start',cancel);return()=>c.removeEventListener('start',cancel);
 },[controlsRef]);
 useFrame((_,delta)=>{
  const f=flight.current,c=controlsRef.current;if(!enabled||paused||!f||!c)return;
  f.elapsed+=Math.min(delta,.05);
  const t=f.duration?Math.min(1,f.elapsed/f.duration):1;
  const ease=t*t*t*(t*(t*6-15)+10);
  f.curve.getPoint(ease,c.object.position);c.target.lerpVectors(f.startLook,f.endLook,ease);c.update();
  if(t===1){flight.current=null;callbacks.current.onArrive?.();}
 });
 return null;
}

class SceneBoundary extends React.Component {
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onError?.();}
 render(){return this.state.failed?<div className="station-scene-error" role="alert"><h3>The station scene could not be displayed</h3><p>The operations dashboard and sensor diagnostics remain available.</p><button onClick={()=>this.setState({failed:false})}>Retry scene</button></div>:this.props.children;}
}

export default function StationCanvas({stationSlug,telemetry,onSelectHotspot,isFullscreen,onToggleFullscreen,cameraTargetPosition,cameraTargetLookAt,waypointTrigger,isModalOpen=false,activeSubsystem=null,onToggleTelemetry,isTourActive=false,onTourActiveChange}) {
 const controlsRef=useRef(),savedView=useRef(null),mapMarkerRef=useRef(),mapHeightRef=useRef();
 const [mapOpen,setMapOpen]=useState(false);
 // Simulation motion is an explicit scene control, independent of OS camera-motion preferences.
 const [sceneMotion,setSceneMotion]=useState(true);
 const [tourOpen,setTourOpen]=useState(false),[tourIndex,setTourIndex]=useState(0),[arrived,setArrived]=useState(false),[tourDone,setTourDone]=useState(false),[navigation,setNavigation]=useState(null),[flightRevision,setFlightRevision]=useState(0),[tourManualFlight,setTourManualFlight]=useState(false);
 const stops=useMemo(()=>stationTour(stationSlug),[stationSlug]);const tourStop=stops[tourIndex]||stops[0];
const [weatherChoice,setWeatherChoice]=useState('auto');
 useEffect(()=>{if(telemetry?.active_incident==='BLIZZARD_ALERT')setWeatherChoice('auto');},[telemetry?.active_incident]);
 const weather=sceneWeather(stationSlug,weatherChoice,telemetry);
 const [viewMode,setViewMode]=useState('NORMAL'),[day,setDay]=useState(true),[cutaway,setCutaway]=useState(false),[floorLevel,setFloorLevel]=useState('science'),[workflow,setWorkflow]=useState('none'),[reduced,setReduced]=useState(false);
 const maitri=stationSlug==='maitri';const overview=useMemo(()=>maitri?[30,26,46]:[54,39,67],[maitri]);const target=useMemo(()=>maitri?[0,2,0]:[0,5,0],[maitri]);const Model=maitri?MaitriModel:BharatiModel;
 const wind=weather.wind,direction=weather.direction;
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)');const f=()=>setReduced(q.matches);f();q.addEventListener('change',f);return()=>q.removeEventListener('change',f);},[]);
 const preset=(position,look)=>{if(tourOpen)setTourManualFlight(true);setNavigation(v=>({position,look,revision:(v?.revision||0)+1}));};
 const closeTour=()=>{setTourOpen(false);onTourActiveChange?.(false);setTourDone(false);if(savedView.current){setWorkflow(savedView.current.workflow);setCutaway(savedView.current.cutaway);setFloorLevel(savedView.current.floorLevel);setViewMode(savedView.current.viewMode);if(savedView.current.position)preset(savedView.current.position,savedView.current.look);savedView.current=null;}};
 const reset=()=>{closeTour();setCutaway(false);preset(overview,target);};
 useEffect(()=>{setWeatherChoice('auto');setTourOpen(false);setTourIndex(0);setTourDone(false);setNavigation(null);savedView.current=null;onTourActiveChange?.(false);setCutaway(false);setFloorLevel('science');setWorkflow('none');},[stationSlug]);
 useEffect(()=>{setNavigation(null);setCutaway(false);setTourOpen(false);if(savedView.current){setWorkflow(savedView.current.workflow);setViewMode(savedView.current.viewMode);savedView.current=null;}onTourActiveChange?.(false);},[waypointTrigger]);
 useEffect(()=>{
  setTourManualFlight(false);
  if(!isTourActive)return;
  setMapOpen(false);
  if(!tourOpen){savedView.current={workflow,cutaway,floorLevel,viewMode,position:controlsRef.current?.object.position.toArray(),look:controlsRef.current?.target.toArray()};setTourIndex(0);setTourOpen(true);setTourDone(false);setArrived(false);setNavigation(null);}
  else {if(tourDone){setTourIndex(0);setTourDone(false);}setNavigation(null);setArrived(false);setFlightRevision(v=>v+1);}
 },[isTourActive]);
 useEffect(()=>{
  if(!tourOpen)return;
  setArrived(false);setWorkflow(tourStop.workflow);setCutaway(!!tourStop.floor);setFloorLevel(tourStop.floor||'science');setViewMode('NORMAL');
 },[tourOpen,tourIndex,stationSlug]);
 useEffect(()=>{
  if(!tourOpen||!isTourActive||!arrived||isModalOpen||document.hidden)return;
  const timer=setTimeout(()=>{
   if(tourIndex<stops.length-1){setArrived(false);setNavigation(null);setTourIndex(i=>i+1);}
   else{setTourDone(true);onTourActiveChange?.(false);}
  },tourStop.duration);
  return()=>clearTimeout(timer);
 },[tourOpen,isTourActive,arrived,isModalOpen,tourIndex,stops.length]);
 useEffect(()=>{const pause=()=>{if(document.hidden)onTourActiveChange?.(false);};document.addEventListener('visibilitychange',pause);return()=>document.removeEventListener('visibilitychange',pause);},[onTourActiveChange]);
 const moveTour=step=>{setTourManualFlight(true);setNavigation(null);setTourDone(false);setArrived(false);setTourIndex(i=>Math.max(0,Math.min(stops.length-1,i+step)));};

 const inspect=(level=floorLevel)=>{onTourActiveChange?.(false);setFloorLevel(level);setCutaway(true);const y=maitri?1.1:level==='living'?6.5:3;preset(maitri?[0,27,15]:[0,48,24],[0,y,0]);};
 const zoom=f=>{const c=controlsRef.current;if(!c)return;onTourActiveChange?.(false);const offset=c.object.position.clone().sub(c.target).multiplyScalar(f);offset.clampLength(2,140);preset(c.target.clone().add(offset).toArray(),c.target.toArray());};
 const selectedRoutes=WORKFLOWS[stationSlug].filter(r=>workflow==='all'||workflow===r.id);
 return <div className="station-workspace">
  <div className="station-commandbar" aria-label="Three-dimensional view controls">
   <div className="station-control-group"><span className="station-tool-label">DISPLAY</span>{[['NORMAL','Real'],['THERMAL','Thermal IR'],['XRAY','X-ray']].map(([id,name])=><button key={id} aria-pressed={viewMode===id} onClick={()=>{onTourActiveChange?.(false);setViewMode(id);}}>{name}</button>)}<button aria-pressed={!day} onClick={()=>setDay(v=>!v)}>{day?<Sun/>:<Moon/>}{day?'Daylight':'Polar night'}</button><button aria-pressed={sceneMotion} aria-label={sceneMotion?'Pause flows and weather':'Play flows and weather'} title='Animate cargo arrows, pipe flows and snowfall' onClick={()=>setSceneMotion(v=>!v)}>{sceneMotion?'Motion on':'Motion paused'}</button></div>
   <div className="station-control-group"><span className="station-tool-label">INSPECT</span><button aria-pressed={cutaway} onClick={()=>cutaway?(setCutaway(false),preset(overview,target)):inspect()}>Interior cutaway</button>{cutaway&&!maitri&&<><button aria-pressed={floorLevel==='science'} onClick={()=>inspect('science')}>Science / services</button><button aria-pressed={floorLevel==='living'} onClick={()=>inspect('living')}>Living floor</button></>}</div>
   <div className="station-control-group station-camera-tools"><button aria-pressed={mapOpen} onClick={()=>{closeTour();setMapOpen(v=>!v);}}>Site map</button>{isFullscreen&&<><button aria-pressed={isTourActive} onClick={()=>onTourActiveChange?.(!isTourActive)}>{isTourActive?'Pause tour':'Auto tour'}</button><button onClick={onToggleTelemetry}>Telemetry</button></>}<button aria-label="Zoom in" onClick={()=>zoom(.8)}><ZoomIn/></button><button aria-label="Zoom out" onClick={()=>zoom(1.25)}><ZoomOut/></button><button aria-label="Reset camera" onClick={reset}><RotateCcw/></button><button aria-label={isFullscreen?'Exit fullscreen':'Fullscreen 3D view'} onClick={onToggleFullscreen}>{isFullscreen?<Minimize2/>:<Maximize2/>}</button></div>
  </div>
  <div className="station-workflowbar"><span className="station-tool-label">WORKFLOWS</span>{[['none','Off'],['all','All routes'],...WORKFLOWS[stationSlug].map(r=>[r.id,({water:'Water supply',power:'Fuel & power',heat:'Heating loop',logistics:'Cargo & stores'})[r.id]])].map(([id,name])=><button key={id} aria-pressed={workflow===id} onClick={()=>{onTourActiveChange?.(false);setWorkflow(id);}}>{name}</button>)}</div>
  <div className="station-weatherbar" aria-label="Scene weather simulation"><span className="station-tool-label">WEATHER</span>{WEATHER_OPTIONS.map(([id,label])=><button key={id} disabled={telemetry?.active_incident==='BLIZZARD_ALERT'&&id!=='auto'&&id!=='blizzard'} aria-pressed={weatherChoice===id} onClick={()=>setWeatherChoice(id)}>{label}</button>)}<span className="station-weather-summary"><span className={weather.id==='blizzard'||weather.temperature<=-30?'dt-danger-value':''}>{weather.temperature.toFixed(0)} °C</span> · <span className={weather.id==='blizzard'||weather.wind>60?'dt-danger-value':''}>{weather.wind.toFixed(0)} km/h</span> · {weather.description}</span>{weatherChoice!=='auto'&&telemetry?.active_incident!=='BLIZZARD_ALERT'&&<small>Scene preview · station readings unchanged</small>}</div>
  <div className="station-render" aria-label={`${stationSlug} explorable station scene`}>
   <SceneBoundary key={stationSlug}>
   <Canvas key={stationSlug} shadows dpr={[1,1.5]} gl={{antialias:true,powerPreference:'high-performance'}} fallback={<div role="alert">Enable browser graphics acceleration to view the station.</div>} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.08;gl.outputColorSpace=THREE.SRGBColorSpace;}}>
    <PerspectiveCamera makeDefault position={overview} fov={48}/>
    <OrbitControls ref={controlsRef} enableDamping dampingFactor={.09} rotateSpeed={.65} panSpeed={.65} screenSpacePanning zoomToCursor minDistance={1.8} maxDistance={145} zoomSpeed={.65} maxPolarAngle={Math.PI/2-.015} target={target}/>
    <CameraRig targetPosition={navigation?.position||(tourOpen?tourStop.camPos:cameraTargetPosition)} targetLookAt={navigation?.look||(tourOpen?tourStop.targetPos:cameraTargetLookAt)} waypointTrigger={`${waypointTrigger}-${tourOpen?tourIndex:'manual'}-${navigation?.revision||0}-${flightRevision}`} controlsRef={controlsRef} paused={isModalOpen||(tourOpen&&!isTourActive&&!tourManualFlight)} reducedMotion={reduced} onArrive={()=>{setArrived(true);setTourManualFlight(false);}} onInteraction={()=>{setTourManualFlight(false);onTourActiveChange?.(false);}}/>

    <NormalNavigationController controlsRef={controlsRef} paused={isModalOpen} reducedMotion={reduced}/>
    {mapOpen&&<CameraMapTracker markerRef={mapMarkerRef} heightRef={mapHeightRef}/>}
    <color attach="background" args={[day?weather.sky:'#071522']}/><fog attach="fog" args={[day?weather.sky:'#071522',day?weather.fog[0]:Math.min(65,weather.fog[0]),day?weather.fog[1]:Math.min(150,weather.fog[1])]}/>
    <ambientLight intensity={viewMode==='THERMAL'?.3:day?.8:.5} color="#dcecf5"/>
    <directionalLight position={[-36,48,40]} intensity={viewMode==='THERMAL'?.6:day?weather.sun:.65} color={day?'#fff5df':'#829bd3'} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-far={150} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70}/>
    <directionalLight position={[15,-8,-15]} intensity={day?.32:.12} color="#c7e4f1"/>
    <BlizzardParticles key="storm-snow-v2" snowfall={weather.snowfall} windSpeed={wind} windDirection={direction} isReducedMotion={!sceneMotion}/>
    <Suspense fallback={null}><Model weather={weather} telemetry={telemetry} onSelectHotspot={onSelectHotspot} viewMode={viewMode} isDaylight={day} isModalOpen={isModalOpen} activeSubsystem={activeSubsystem} cutaway={cutaway} floorLevel={floorLevel} workflow={workflow} reducedMotion={!sceneMotion}/></Suspense>
   </Canvas>
   </SceneBoundary>
   {mapOpen&&<SiteNavigator site={stationSlug} markerRef={mapMarkerRef} heightRef={mapHeightRef} onClose={()=>setMapOpen(false)} onInspect={(position,look)=>{setCutaway(false);preset(position,look);}}/>}
   {tourOpen&&<aside className="station-tour-guide" aria-label="Guided station tour">
    <div className="station-tour-heading"><span>STATION GUIDE · {String(tourIndex+1).padStart(2,'0')} / {stops.length}</span><button aria-label="Close guided tour" onClick={closeTour}>×</button></div>
    <h3>{tourStop.title}</h3><p>{tourStop.description}</p><ul>{tourStop.points.map(point=><li key={point}>{point}</li>)}</ul>
    <div className="station-tour-progress" aria-hidden="true"><span key={`${stationSlug}-${tourIndex}-${arrived}`} style={{animationDuration:`${tourStop.duration}ms`,animationPlayState:isTourActive&&arrived&&!isModalOpen?'running':'paused'}}/></div>
    <div className="station-tour-actions"><button disabled={tourIndex===0} onClick={()=>moveTour(-1)}>Previous</button><button onClick={()=>{if(tourDone){setTourIndex(0);setTourDone(false);setArrived(false);}onTourActiveChange?.(!isTourActive);}}>{tourDone?'Restart tour':isTourActive?'Pause':'Resume'}</button><button disabled={tourIndex===stops.length-1} onClick={()=>moveTour(1)}>Next</button></div>
    <small>{tourDone?'Tour complete · Keep exploring or restart':isModalOpen?'Paused while you inspect a sensor':!isTourActive?'Paused · Explore freely, then resume':arrived?'Introducing this stop · Drag the scene to pause':'Moving to the next station stop…'}</small>
   </aside>}

  </div>
  {viewMode==='THERMAL'&&<div className="station-thermal-key"><span>SCHEMATIC THERMAL VIEW</span><strong>Cool surfaces → warm plant / heat recovery</strong><small>Color indicates equipment heat state, not a measured surface-temperature image.</small></div>}
  <div className="station-fieldnotes"><span>{maitri?'70.7658° S / 11.7358° E':'69.4078° S / 76.1872° E'} · Wind {wind.toFixed(1)} km/h @ {direction.toFixed(0)}°</span><span>{'Drag to orbit · Scroll to zoom · WASD move · Space up · Ctrl down · Shift boost'}</span></div>
  {selectedRoutes.length>0&&<div className="station-route-legend" aria-live="polite">{selectedRoutes.map(r=><div key={r.id}><strong style={{borderLeftColor:r.color}}>{r.name}</strong><small className="station-flow-key">{({logistics:'➜ Green ground arrows · cargo movement',water:'● Blue flowing packets · water supply',power:'━ Amber fuel transfer · gold electrical pulses',heat:'━ Orange warm supply · violet cool return'})[r.id]}</small><span>{r.labels.join(' → ')}</span></div>)}</div>}
  <details className="station-source-note station-sensor-list"><summary>Live sensor diagnostics</summary><div>{[['POWER_CHP','Power / generation'],['BATTERY_STORAGE','Battery / UPS'],['FUEL_STORAGE','Fuel depot'],[maitri?'WATER_INTAKE':'HVAC_GLYCOL',maitri?'Water intake':'Glycol / heat recovery'],['WEATHER','Weather station'],['STRUCTURAL_HEALTH','Structure']].map(([code,label])=><button key={code} onClick={()=>onSelectHotspot?.(code)}>{label}</button>)}</div></details>
  <details className="station-source-note"><summary>Model references & scale</summary><p>Station form and facilities follow NCPOR descriptions and the Bharati operation and maintenance tender. Room positions and nearby infrastructure are interpreted for exploration; this is not a surveyed floor plan. Outlying routes are compressed to keep the site navigable.</p><a href="https://ncpor.res.in/pages/view/260/256-maitri" target="_blank" rel="noreferrer">NCPOR Maitri</a> · <a href="https://ncpor.res.in/upload/tenders/OMRC_Tender_Document_20220113%20(1).PDF" target="_blank" rel="noreferrer">Bharati facilities document</a></details>
 </div>;
}
