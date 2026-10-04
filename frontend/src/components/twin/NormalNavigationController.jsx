import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Vector3} from 'three';

export default function NormalNavigationController({controlsRef,paused=false,reducedMotion=false}) {
 const {camera,gl}=useThree();
 const keys=useRef(new Set()),hover=useRef(false);
 const velocity=useRef(new Vector3());
 const vectors=useMemo(()=>({forward:new Vector3(),right:new Vector3(),desired:new Vector3(),step:new Vector3()}),[]);
 useEffect(()=>{
  const canvas=gl.domElement,oldTabIndex=canvas.getAttribute('tabindex');
  canvas.tabIndex=0;canvas.setAttribute('aria-label','Station 3D view. WASD move, Space up, Control down, Shift boost.');
  const enter=()=>{hover.current=true;},leave=()=>{hover.current=false;keys.current.clear();};
  const focus=()=>canvas.focus({preventScroll:true});
  const clear=()=>{keys.current.clear();velocity.current.set(0,0,0);};
  const supported=new Set(['KeyW','KeyA','KeyS','KeyD','Space','ControlLeft','ControlRight','ShiftLeft','ShiftRight']);
  const down=e=>{
   if(paused||(!hover.current&&document.activeElement!==canvas)||!supported.has(e.code)||e.metaKey||e.altKey)return;
   if(e.target?.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"]'))return;
   e.preventDefault();
   if(!keys.current.size)controlsRef.current?.dispatchEvent({type:'start'});
   keys.current.add(e.code);
  };
  const up=e=>keys.current.delete(e.code);
  canvas.addEventListener('pointerenter',enter);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointerdown',focus);
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  return()=>{clear();canvas.removeEventListener('pointerenter',enter);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointerdown',focus);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);if(oldTabIndex===null)canvas.removeAttribute('tabindex');else canvas.setAttribute('tabindex',oldTabIndex);};
 },[gl,controlsRef,paused]);
 useFrame((_,delta)=>{
  const controls=controlsRef.current;if(!controls||paused)return;
  const k=keys.current,{forward,right,desired,step}=vectors,dt=Math.min(delta,.05);
  camera.getWorldDirection(forward);right.crossVectors(forward,camera.up).normalize();desired.set(0,0,0);
  if(k.has('KeyW'))desired.add(forward);if(k.has('KeyS'))desired.sub(forward);
  if(k.has('KeyD'))desired.add(right);if(k.has('KeyA'))desired.sub(right);
  if(k.has('Space'))desired.y+=1;if(k.has('ControlLeft')||k.has('ControlRight'))desired.y-=1;
  desired.normalize().multiplyScalar(k.has('ShiftLeft')||k.has('ShiftRight')?20:7);
  velocity.current.lerp(desired,reducedMotion?1:1-Math.exp(-12*dt));
  if(velocity.current.lengthSq()<.0001)return;
  step.copy(velocity.current).multiplyScalar(dt);camera.position.add(step);controls.target.add(step);controls.update();
 });
 return null;
}
