import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { BUILDINGS, FUEL_FARMS, WORKFLOWS } from './stationLayout';

export function CameraMapTracker({markerRef,heightRef}) {
  const elapsed=useRef(0),direction=useRef(new Vector3());
  useFrame(({camera},dt)=>{
    elapsed.current+=dt;if(elapsed.current<.2)return;elapsed.current=0;
    camera.getWorldDirection(direction.current);
    const angle=Math.atan2(direction.current.x,-direction.current.z)*180/Math.PI;
    markerRef.current?.setAttribute('transform',`translate(${camera.position.x} ${camera.position.z}) rotate(${angle})`);
    if(heightRef.current)heightRef.current.textContent=`Camera height ${camera.position.y.toFixed(1)} m`;
  });
  return null;
}

export default function SiteNavigator({site,markerRef,heightRef,onInspect,onClose}) {
  const b=BUILDINGS[site],maitri=site==='maitri',fuel=FUEL_FARMS[site].position;
  const places=[
    ['Station',0,0,maitri?2:6],
    ['Power plant',maitri?-25:-19.4,maitri?-3:-11.55,maitri?1.5:4],
    ['Fuel farm',fuel[0],fuel[2],1.5],
    ['Water services',maitri?21:5,maitri?-8:-6.05,maitri?1.5:4],
    ['Weather instruments',maitri?21:33,maitri?17:21,4],
    ['Cargo & stores',-34,28,1.5],
  ];
  const inspect=([name,x,z,y])=>{
    const distance=name==='Station'?(maitri?26:52):16;
    onInspect([x+distance*.75,y+distance*.6,z+distance],[x,y,z]);
  };
  return <aside className="station-site-map" aria-label="Station site navigator">
    <div className="station-map-heading"><strong>SITE NAVIGATOR</strong><button aria-label="Close site map" onClick={onClose}>×</button></div>
    <svg viewBox="-70 -70 140 140" role="img" aria-label={`${maitri?'Maitri':'Bharati'} facility layout and camera position`}>
      <defs><pattern id={`grid-${site}`} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#bbcbd0" strokeWidth=".15"/></pattern></defs>
      <rect x="-70" y="-70" width="140" height="140" fill="#e4ecea"/>
      <rect x="-70" y="-70" width="140" height="140" fill={`url(#grid-${site})`}/>
      {maitri?<ellipse cx="38" cy="-27" rx="16" ry="14" fill="#9ccbd5"/>:<path d="M-70-70H70V-27Q40-20 0-27T-70-27Z" fill="#9ccbd5"/>}
      {WORKFLOWS[site].map(route=><polyline key={route.id} points={route.nodes.map(p=>`${p[0]},${p[2]}`).join(' ')} fill="none" stroke={route.color} strokeWidth=".8"/>)}
      <rect x={-b.halfX} y={-b.halfZ} width={b.halfX*2} height={b.halfZ*2} fill="#607e83" stroke="#315966" strokeWidth=".6"/>
      <rect x={fuel[0]-6} y={fuel[2]-7.5} width="12" height="15" rx="1" fill="#bbaa7b"/>
      {places.map((place,i)=><g key={place[0]} transform={`translate(${place[1]} ${place[2]})`} onClick={()=>inspect(place)} role="button" tabIndex={0} aria-label={`Inspect ${place[0]}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(place);}}} className="station-map-target">
        <circle r="2.4" fill="#fff" stroke="#315966" strokeWidth=".7"/>
        <text y="1" textAnchor="middle" fontSize="3" fill="#25444f">{i+1}</text>
      </g>)}
      <g ref={markerRef}><path d="M0-5L2 2 0 1-2 2Z" fill="#d5682e" stroke="#fff" strokeWidth=".6"/></g>
      <path d="M58-43V-58M56-55L58-59 60-55" stroke="#365967" strokeWidth=".8" fill="none"/><text x="58" y="-62" textAnchor="middle" fontSize="4" fill="#365967">N</text>
      <path d="M-61 60H-41M-61 58V62M-41 58V62" stroke="#365967" strokeWidth=".8"/><text x="-51" y="56" fontSize="3" fill="#365967" textAnchor="middle">20 m</text>
    </svg>
    <small ref={heightRef}>Camera height</small>
    <nav aria-label="Inspect station facilities">{places.map((place,i)=><button key={place[0]} onClick={()=>inspect(place)}><span>{String(i+1).padStart(2,'0')}</span>{place[0]}<span>↗</span></button>)}</nav>
    <p>Illustrative layout. Zoom in to inspect fittings, instruments and equipment.</p>
  </aside>;
}
