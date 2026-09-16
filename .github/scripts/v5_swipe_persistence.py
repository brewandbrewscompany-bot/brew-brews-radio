from pathlib import Path
import re

p = Path('/tmp/v5.html')
s = p.read_text()

pattern = r"function attachMain\(x(?:,force=false)?\)\{.*?\}\nfunction drawerGestures\(\)"
replacement = r'''function attachMain(x,force=false){
  if(!x||!window.matchMedia('(max-width:899px)').matches)return;
  const win=x.defaultView||window;
  if(force&&win.__v5GestureAbort){try{win.__v5GestureAbort.abort()}catch(e){}win.__v5GestureAbort=null}
  if(win.__v5GestureAbort)return;
  const ctrl=new AbortController();win.__v5GestureAbort=ctrl;
  const opt={passive:true,capture:true,signal:ctrl.signal};
  let sx=0,sy=0,lastX=0,lastY=0,on=false,lastSwipe=0,pid=null;
  const edit=t=>t&&t.closest&&t.closest('input,textarea,select,[contenteditable="true"]');
  const begin=(px,py,id,target)=>{if(edit(target)){on=false;return}sx=lastX=px;sy=lastY=py;pid=id;on=true};
  const move=(px,py)=>{if(!on)return;lastX=px;lastY=py};
  const finish=(px,py)=>{if(!on)return;on=false;const dx=px-sx,dy=py-sy;if(Math.abs(dx)<34||Math.abs(dx)<Math.abs(dy)*1.05||Math.abs(dy)>160)return;lastSwipe=Date.now();dx>0?openDrawer('left'):openDrawer('right')};
  if(win.PointerEvent){
    x.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;begin(e.clientX,e.clientY,e.pointerId,e.target)},opt);
    x.addEventListener('pointermove',e=>{if(!on||e.pointerId!==pid)return;move(e.clientX,e.clientY)},opt);
    x.addEventListener('pointerup',e=>{if(!on||e.pointerId!==pid)return;finish(e.clientX,e.clientY)},opt);
    x.addEventListener('pointercancel',e=>{if(!on||e.pointerId!==pid)return;finish(lastX,lastY)},opt);
  }else{
    x.addEventListener('touchstart',e=>{if(!e.touches||e.touches.length!==1)return;const t=e.touches[0];begin(t.clientX,t.clientY,'touch',e.target)},opt);
    x.addEventListener('touchmove',e=>{if(!on||!e.touches||!e.touches.length)return;const t=e.touches[0];move(t.clientX,t.clientY)},opt);
    x.addEventListener('touchend',e=>{if(!on)return;const t=e.changedTouches&&e.changedTouches[0];finish(t?t.clientX:lastX,t?t.clientY:lastY)},opt);
    x.addEventListener('touchcancel',()=>finish(lastX,lastY),opt);
  }
  x.addEventListener('click',e=>{
    if(Date.now()-lastSwipe<450){e.preventDefault();e.stopImmediatePropagation();return}
    const nav=e.target&&e.target.closest&&e.target.closest('[data-nav],#v5TopSearch,#v5SearchClose');
    if(nav)setTimeout(()=>attachMain(x,true),90)
  },{capture:true,signal:ctrl.signal});
  win.addEventListener('popstate',()=>setTimeout(()=>attachMain(x,true),60),{signal:ctrl.signal});
  win.addEventListener('pageshow',()=>setTimeout(()=>attachMain(x,true),60),{signal:ctrl.signal});
  x.addEventListener('visibilitychange',()=>{if(!x.hidden)setTimeout(()=>attachMain(x,true),60)},{signal:ctrl.signal});
}
function drawerGestures()'''

ns, n = re.subn(pattern, replacement, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'attachMain replacement count={n}')
s = ns

s = s.replace("if(window.matchMedia('(max-width:899px)').matches)attachMain(x);setTimeout(applyDomFilters,0)", "attachMain(x);setTimeout(applyDomFilters,0)", 1)

old = "drawerGestures();frame.addEventListener('load',()=>{inject();setTimeout(inject,500);setTimeout(inject,1200)});"
new = "drawerGestures();frame.addEventListener('load',()=>{inject();setTimeout(inject,500);setTimeout(inject,1200)});window.addEventListener('pageshow',()=>{inject();setTimeout(()=>{const x=d();if(x)attachMain(x,true)},80)});window.addEventListener('popstate',()=>setTimeout(()=>{inject();const x=d();if(x)attachMain(x,true)},80));"
if old not in s:
    raise SystemExit('outer rebind marker missing')
s = s.replace(old, new, 1)

for marker in [
    'function attachMain(x,force=false)',
    "closest('input,textarea,select,[contenteditable=\"true\"]')",
    'attachMain(x,true)',
    "window.addEventListener('pageshow'"
]:
    if marker not in s:
        raise SystemExit('missing marker: ' + marker)

p.write_text(s)
