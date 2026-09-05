(()=>{
'use strict';
const shuffleSwitch=document.getElementById('shuffleSwitch');
const repeatSwitch=document.getElementById('repeatSwitch');
const faceButtons=[...document.querySelectorAll('[data-mode-button]')];
if(!faceButtons.length)return;

function sync(){
  const shuffleOn=shuffleSwitch?.getAttribute('aria-pressed')==='true';
  const repeatOn=repeatSwitch?.getAttribute('aria-pressed')==='true';
  faceButtons.forEach(button=>{
    const on=button.dataset.modeButton==='shuffle'?shuffleOn:repeatOn;
    button.classList.toggle('on',on);
    button.setAttribute('aria-pressed',String(on));
  });
}

function bind(kind,switchEl){
  document.querySelectorAll(`[data-mode-button="${kind}"]`).forEach(button=>{
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      switchEl?.click();
      sync();
    });
  });
  if(switchEl){
    new MutationObserver(sync).observe(switchEl,{attributes:true,attributeFilter:['aria-pressed','class']});
  }
}

bind('shuffle',shuffleSwitch);
bind('repeat',repeatSwitch);
sync();
})();
