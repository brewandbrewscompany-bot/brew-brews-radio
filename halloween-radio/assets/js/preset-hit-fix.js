(()=>{
  'use strict';
  let synthetic=false;

  function presetAt(x,y){
    const presets=[...document.querySelectorAll('.tuner-glass .preset[data-frequency]')];
    return presets.find(btn=>{
      const r=btn.getBoundingClientRect();
      return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
    })||null;
  }

  // The tuner has several deep decorative layers. If a browser resolves the physical
  // pointer to one of those layers instead of the visible station button, forward the
  // same click to the preset whose real screen-space box contains the pointer.
  // This does not play audio and does not create playback intent; it only preserves the
  // station-selection action already owned by radio.js.
  document.addEventListener('click',event=>{
    if(synthetic) return;
    const direct=event.target.closest?.('.tuner-glass .preset[data-frequency]');
    if(direct) return;
    const glass=document.querySelector('#tunerGlass');
    if(!glass) return;
    const g=glass.getBoundingClientRect();
    if(event.clientX<g.left||event.clientX>g.right||event.clientY<g.top||event.clientY>g.bottom) return;
    const preset=presetAt(event.clientX,event.clientY);
    if(!preset) return;
    synthetic=true;
    try{ preset.click(); }
    finally{ synthetic=false; }
  },true);
})();
