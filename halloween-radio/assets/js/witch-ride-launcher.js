(()=>{
'use strict';
const drawer=document.getElementById('drawer');
if(!drawer||document.getElementById('witchRideLauncher'))return;

const style=document.createElement('style');
style.textContent=`
.witch-ride-extra{margin:15px 0 4px;padding-top:13px;border-top:1px solid rgba(184,116,56,.24)}
.witch-ride-extra small{display:block;margin-bottom:8px;color:#9e7147;font:700 10px Georgia,"Times New Roman",serif;letter-spacing:.15em;text-transform:uppercase}
.witch-ride-launch{width:100%;padding:11px 12px;border:1px solid rgba(221,133,50,.48);border-radius:9px;background:linear-gradient(180deg,rgba(70,32,12,.72),rgba(14,9,6,.92));color:#f0ae66;font:700 12px Georgia,"Times New Roman",serif;letter-spacing:.08em;cursor:pointer;box-shadow:0 0 14px rgba(255,106,20,.08)}
.witch-ride-launch span{display:block;margin-top:3px;color:#9d7554;font-size:9px;font-weight:400;letter-spacing:.02em}
#witchRideLauncher{position:fixed;z-index:260;inset:0;display:none;background:#000}#witchRideLauncher.open{display:block}
#witchRideLauncher iframe{width:100%;height:100%;border:0;background:#000}
#witchRideClose{position:absolute;z-index:2;right:max(12px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(220,145,73,.45);background:rgba(8,6,5,.78);color:#e8b272;font:24px/1 Georgia;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.5)}
body.witch-ride-open{overflow:hidden}
`;
document.head.appendChild(style);

const extra=document.createElement('div');
extra.className='witch-ride-extra';
extra.innerHTML='<small>Extras</small><button class="witch-ride-launch" type="button">WITCH RIDE<span>2.5D haunted broom run · open game</span></button>';
const closeButton=drawer.querySelector('#closeDrawer');
drawer.insertBefore(extra,closeButton||null);

const launcher=document.createElement('div');
launcher.id='witchRideLauncher';
launcher.setAttribute('aria-hidden','true');
launcher.innerHTML='<button id="witchRideClose" type="button" aria-label="Close Witch Ride">×</button><iframe id="witchRideFrame" title="Witch Ride game" allow="autoplay; fullscreen" loading="eager"></iframe>';
document.body.appendChild(launcher);
const frame=launcher.querySelector('#witchRideFrame');
const close=launcher.querySelector('#witchRideClose');

function openGame(){
  drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');
  if(!frame.src)frame.src='games/witch-ride/';
  launcher.classList.add('open');launcher.setAttribute('aria-hidden','false');
  document.body.classList.add('witch-ride-open');
  close.focus({preventScroll:true});
}
function closeGame(){
  launcher.classList.remove('open');launcher.setAttribute('aria-hidden','true');
  document.body.classList.remove('witch-ride-open');
}
extra.querySelector('.witch-ride-launch').addEventListener('click',openGame);
close.addEventListener('click',closeGame);
window.addEventListener('message',event=>{if(event.data&&event.data.type==='witch-ride-close')closeGame()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&launcher.classList.contains('open')){event.preventDefault();closeGame()}},true);
})();
