from __future__ import annotations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'game.js'
text = GAME.read_text(encoding='utf-8')

old_config = "  hairRig=[];for(let i=1;i<=5;i++){const p=rememberMotionPart(witch.findByName?.(`hair_${String(i).padStart(2,'0')}`),i*.73);if(p)hairRig.push(p)}"
new_config = """  const hairMotion=[
    {bank:.02,kick:.04,wind:.10,wobble:.08,stiff:38,damp:11.5},
    {bank:.04,kick:.08,wind:.20,wobble:.18,stiff:35,damp:10.5},
    {bank:.07,kick:.14,wind:.34,wobble:.30,stiff:31,damp:9.5},
    {bank:.10,kick:.22,wind:.55,wobble:.48,stiff:27,damp:8.2},
    {bank:.14,kick:.30,wind:.82,wobble:.72,stiff:23,damp:7.1}
  ];
  hairRig=[];for(let i=1;i<=5;i++){const p=rememberMotionPart(witch.findByName?.(`hair_${String(i).padStart(2,'0')}`),i*.73);if(p){p.motion=hairMotion[i-1];hairRig.push(p)}}"""

old_hair = "  for(let i=0;i<hairRig.length;i++){const h=hairRig[i],strength=.25+i*.028,target=-bank*strength+kick*(.88+i*.055)+Math.sin(time*(3.2+i*.18)+h.phase)*(2.0+i*.15),r=springRoll(h,target,dt,25+i*1.8,6.2+i*.15),b=h.base;h.node.setLocalEulerAngles(b.x+wind*(3.2+i*.42)+Math.sin(time*(4.0+i*.12)+h.phase)*3.1,b.y+Math.sin(time*1.8+h.phase)*.8,b.z+r)}"
new_hair = """  for(let i=0;i<hairRig.length;i++){
    const h=hairRig[i],m=h.motion||{bank:.06,kick:.12,wind:.28,wobble:.24,stiff:30,damp:9};
    const target=-bank*m.bank+kick*m.kick+Math.sin(time*(2.2+i*.12)+h.phase)*m.wobble;
    const r=springRoll(h,target,dt,m.stiff,m.damp),b=h.base;
    const pitch=wind*m.wind+Math.sin(time*(2.6+i*.10)+h.phase)*m.wobble*.55;
    const yaw=Math.sin(time*1.45+h.phase)*m.wobble*.18;
    h.node.setLocalEulerAngles(b.x+pitch,b.y+yaw,b.z+r)
  }"""

old_hat = "  if(hatTip?.node){const r=springRoll(hatTip,-bank*.08+kick*.18+Math.sin(time*1.55)*.9,dt,17,5.2),b=hatTip.base;hatTip.node.setLocalEulerAngles(b.x+Math.sin(time*1.3)*.7,b.y+Math.sin(time*.9)*.5,b.z+r)}"
new_hat = "  if(hatTip?.node){const b=hatTip.base;hatTip.roll=0;hatTip.rollV=0;hatTip.node.setLocalEulerAngles(b.x,b.y,b.z)}"

changed = False
if old_config in text:
    text = text.replace(old_config, new_config, 1)
    changed = True
elif 'const hairMotion=[' not in text:
    raise RuntimeError('Pass 14 hair runtime configuration anchor not found')

if old_hair in text:
    text = text.replace(old_hair, new_hair, 1)
    changed = True
elif 'const h=hairRig[i],m=h.motion||' not in text:
    raise RuntimeError('Pass 14 hair secondary-motion anchor not found')

if old_hat in text:
    text = text.replace(old_hat, new_hat, 1)
    changed = True
elif 'hatTip.node.setLocalEulerAngles(b.x,b.y,b.z)' not in text:
    raise RuntimeError('Pass 14 locked-hat anchor not found')

GAME.write_text(text, encoding='utf-8')
print('PATCHED' if changed else 'ALREADY_PATCHED')
