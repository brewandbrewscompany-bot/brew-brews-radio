(()=>{
'use strict';
const state={deferredPrompt:null,installed:matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,swReady:false};
const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream;
const drawer=document.getElementById('drawer');
const closeButton=document.getElementById('closeDrawer');

function toast(title,text){
  const el=document.getElementById('toast');
  const sr=document.getElementById('sr');
  if(!el)return;
  el.innerHTML=`<strong>${title}</strong>${text||''}`;
  el.classList.add('show');
  if(sr)sr.textContent=`${title} ${text||''}`;
  clearTimeout(el.__appTimer);el.__appTimer=setTimeout(()=>el.classList.remove('show'),3400);
}

let installWrap=null,installButton=null;
function ensureInstallButton(){
  if(!drawer||state.installed||installWrap)return;
  installWrap=document.createElement('div');installWrap.className='app-install-extra';
  installWrap.innerHTML='<small>Install</small><button class="app-install-button" type="button">INSTALL HALLOWEEN RADIO<span>Add it to your phone like an app</span></button>';
  const style=document.createElement('style');
  style.textContent='.app-install-extra{margin:15px 0 4px;padding-top:13px;border-top:1px solid rgba(184,116,56,.24)}.app-install-extra small{display:block;margin-bottom:8px;color:#9e7147;font:700 10px Georgia,"Times New Roman",serif;letter-spacing:.15em;text-transform:uppercase}.app-install-button{width:100%;padding:11px 12px;border:1px solid rgba(221,133,50,.48);border-radius:9px;background:linear-gradient(180deg,rgba(70,32,12,.72),rgba(14,9,6,.92));color:#f0ae66;font:700 12px Georgia,"Times New Roman",serif;letter-spacing:.06em;cursor:pointer}.app-install-button span{display:block;margin-top:3px;color:#9d7554;font-size:9px;font-weight:400;letter-spacing:.02em}';
  document.head.appendChild(style);
  drawer.insertBefore(installWrap,closeButton||null);
  installButton=installWrap.querySelector('button');
  installButton.addEventListener('click',async()=>{
    if(state.deferredPrompt){
      const prompt=state.deferredPrompt;state.deferredPrompt=null;
      await prompt.prompt();
      const result=await prompt.userChoice.catch(()=>({outcome:'dismissed'}));
      if(result.outcome==='accepted')toast('Installing','Halloween Radio is being added to your device.');
      else toast('Install Ready','Use Install App from your browser menu whenever you are ready.');
      return;
    }
    if(isiOS)toast('Install on iPhone','Tap Share, then Add to Home Screen.');
    else toast('Install App','Open your browser menu and choose Install app or Add to Home screen.');
  });
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();state.deferredPrompt=event;ensureInstallButton();
});
window.addEventListener('appinstalled',()=>{
  state.installed=true;state.deferredPrompt=null;if(installWrap)installWrap.remove();toast('Installed','Halloween Radio is ready from your home screen.');
});

if(!state.installed)ensureInstallButton();

if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(reg=>{
      state.swReady=true;
      if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
    }).catch(err=>console.warn('Halloween Radio service worker registration failed',err));
  });
}

document.documentElement.classList.toggle('standalone-app',state.installed);
window.__HalloweenRadioPWA={version:'pass25-pwa-v1',state,isiOS,get installButton(){return installButton}};
})();
