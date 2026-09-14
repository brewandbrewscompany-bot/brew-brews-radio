(()=>{
  'use strict';
  const radio=window.__BB_RADIO__;
  if(!radio) return;
  const body=document.body;
  const audio=document.getElementById('audio');
  const byId=id=>document.getElementById(id);
  const screen=()=>body.classList.add('has-dynamic-screen');
  const station=()=>{body.classList.add('has-station-change');screen()};
  const tune=()=>{body.classList.add('tuning-touched','has-station-change');screen()};
  const volume=()=>body.classList.add('volume-touched');

  // Match the approved rendered resting state without creating playback intent.
  radio.setVolume(.33);
  const volumeRange=byId('volumeRange');
  if(volumeRange) volumeRange.value='.33';

  byId('playBtn')?.addEventListener('click',screen);
  byId('prevBtn')?.addEventListener('click',screen);
  byId('nextBtn')?.addEventListener('click',screen);
  byId('progress')?.addEventListener('input',screen);

  document.querySelectorAll('.station-preset').forEach(button=>{
    button.addEventListener('click',station);
  });

  [byId('tuneRange'),byId('tunerRange'),byId('tuneKnob')].filter(Boolean).forEach(control=>{
    control.addEventListener('pointerdown',tune,{passive:true});
    control.addEventListener('input',tune,{passive:true});
    control.addEventListener('change',tune,{passive:true});
  });

  [volumeRange,byId('volumeKnob')].filter(Boolean).forEach(control=>{
    control.addEventListener('pointerdown',volume,{passive:true});
    control.addEventListener('input',volume,{passive:true});
    control.addEventListener('change',volume,{passive:true});
  });

  if(audio){
    audio.addEventListener('play',()=>{body.classList.add('is-playing');screen()});
    audio.addEventListener('pause',()=>body.classList.remove('is-playing'));
    audio.addEventListener('ended',()=>body.classList.remove('is-playing'));
  }

  document.documentElement.dataset.radioSkin='approved-photoreal';
})();
