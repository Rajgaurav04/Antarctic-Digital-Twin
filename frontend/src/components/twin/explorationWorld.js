import { BUILDINGS, getFurniture, getPartitionBoxes, partitionAABB, furnitureAABB } from './stationLayout';
import { terrainHeight, coastlineZ } from './PolarEnvironment';

const wall=(minX,maxX,minZ,maxZ,minY,maxY)=>({minX,maxX,minZ,maxZ,minY,maxY});
export function getExplorationWorld(site){
 const b=BUILDINGS[site];const hx=b.halfX,hz=b.halfZ;
 const obstacles=[...getPartitionBoxes(site).map(partitionAABB),...getFurniture(site).map(furnitureAABB),
  wall(-hx-.2,-hx+.2,-hz,hz,b.floor,b.roof),wall(hx-.2,hx+.2,-hz,hz,b.floor,b.roof),
  wall(-hx,hx,-hz-.2,-hz+.2,b.floor,b.roof),wall(-hx,-1.2,hz-.2,hz+.2,b.floor,b.roof),wall(1.2,hx,hz-.2,hz+.2,b.floor,b.roof),
 ];
 // Outdoor logistics equipment is collidable, independently of UI overlay state.
 const boxes=site==='maitri'?[[-25,-3,8,6,2.8],[-18,6,6,2.8,2.8],[21,-8,6,2.8,2.8],[32,-23,3.5,3,2.8],[-27,17,12,15,2.4],[-36,32,6,2.8,2.8],...Array.from({length:3},(_,i)=>[23+i*7,22,6,2.8,2.8])]:[[-38,17,12,15,2.4],[37,12,10,2.8,2.8],[37,17,6,2.8,2.8],[36,-34,3.5,3,2.8],[-36,32,6,2.8,2.8]];
 boxes.forEach(([x,z,w,d,h])=>{
  if(w===12&&d===15){obstacles.push(wall(x-w/2,x+w/2,z-d/2,z+d/2,0,h));return;}
  obstacles.push(wall(x-w/2-.08,x-w/2+.08,z-d/2,z+d/2,0,h),wall(x+w/2-.08,x+w/2+.08,z-d/2,z+d/2,0,h),wall(x-w/2,x+w/2,z-d/2-.08,z-d/2+.08,0,h),wall(x-w/2,x-.8,z+d/2-.08,z+d/2+.08,0,h),wall(x+.8,x+w/2,z+d/2-.08,z+d/2+.08,0,h));
 });
 if(site==='bharati'){
  obstacles.push(wall(-27.8,-26.2,-9.1,-6.9,0,2.2));
  obstacles.push(wall(-5,5,-8.5,-1.5,10.35,12.7));
  obstacles.push(wall(-22.1,-21.9,-7,1,0,2.7),wall(-12.1,-11.9,-7,1,0,2.7),wall(-22,-12,-7.1,-6.9,0,2.7));
  for(let i=0;i<11;i++)for(let j=0;j<8;j++){const x=-23+i*4.6,z=-13+j*26/7;if(Math.abs(x)<.01&&Math.abs(z)>12)continue;obstacles.push(wall(x-.2,x+.2,z-.2,z+.2,0,3));}
 }
 const inRect=(x,z,hx,hz)=>Math.abs(x)<=hx&&Math.abs(z)<=hz;
 const stair=(x,z,x0,width,zStart,zEnd,bottom,top)=>Math.abs(x-x0)<width/2&&z<=zStart&&z>=zEnd?bottom+(zStart-z)/(zStart-zEnd)*(top-bottom):null;
 function surfaces(x,z){
  const values=[terrainHeight(site,x,z)];
  boxes.forEach(([cx,cz,w,d])=>{if(Math.abs(x-cx)<w/2&&Math.abs(z-cz)<d/2)values.push(.08);});
  if(inRect(x,z,hx,hz)){
   values.push(b.floor);
   if(site==='bharati'){
    if(!(x>=20&&x<=25&&Math.abs(z)<9))values.push(b.upper);
    if(!(x>=22.75&&x<=24.25&&Math.abs(z)<9))values.push(b.roof+.14);
   }
  }
  const entry=stair(x,z,0,2.4,b.rampEnd,hz,0,b.floor);if(entry!==null)values.push(entry);
  if(site==='bharati'){
   const inner=stair(x,z,21.5,2.4,9,-9,3,6.5);if(inner!==null)values.push(inner);
   const roof=stair(x,z,23.5,1.4,9,-9,6.5,b.roof+.14);if(roof!==null)values.push(roof);
  }
  for(const o of obstacles)if(x>o.minX&&x<o.maxX&&z>o.minZ&&z<o.maxZ&&o.maxY-o.minY<2.6)values.push(o.maxY);
  return values;
 }
 return {obstacles,surfaces,spawn:b.spawn,canVisit:(x,z)=>Math.abs(x)<72&&Math.abs(z)<72&&(site!=='bharati'||z>coastlineZ(x)+.5)};
}
export function collides(world,x,z,feet,radius=.28){
 if(!world.canVisit(x,z))return true;
 return world.obstacles.some(o=>{
  if(feet>=o.maxY-.035||feet+1.7<=o.minY+.02)return false;
  const cx=Math.max(o.minX,Math.min(x,o.maxX)),cz=Math.max(o.minZ,Math.min(z,o.maxZ));return (x-cx)**2+(z-cz)**2<radius**2;
 });
}
export function supportHeight(world,x,z,feet,step=.32){return Math.max(...world.surfaces(x,z).filter(y=>y<=feet+step));}
