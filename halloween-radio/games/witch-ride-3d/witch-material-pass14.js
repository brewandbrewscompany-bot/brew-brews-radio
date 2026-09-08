import * as pc from 'playcanvas';

// Witch Ride 3D — Pass 14 production material layer.
// Keeps the accepted Pass 14 mesh/scale/motion intact and replaces neutral clay at runtime.
const PASS_ID='witch-material-pass14';
const VERSION='pass-14-production-materials-v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function hashName(name){
  let h=2166136261>>>0;
  for(let i=0;i<name.length;i++){h^=name.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function makeMaterial(name,color,gloss,metalness=0,cullNone=false){
  const m=new pc.StandardMaterial();
  m.name=name;
  m.diffuse=new pc.Color(...color);
  m.useMetalness=true;
  m.metalness=metalness;
  m.gloss=gloss;
  if(cullNone)m.cull=pc.CULLFACE_NONE;
  m.update();
  return m;
}
function palette(prefix,colors,gloss,metalness=0,cullNone=false){
  return colors.map((c,i)=>makeMaterial(`${prefix}-${i+1}`,c,gloss,metalness,cullNone));
}
function choose(list,name){return list[hashName(name)%list.length]}
function meshInstances(node){return node?.render?.meshInstances||[]}
function walk(root,fn){fn(root);for(const child of root.children||[])walk(child,fn)}

const materials={
  hair:palette('pass14 auburn hair',[
    [.145,.034,.014],[.185,.046,.016],[.225,.062,.020],[.165,.038,.014],[.255,.078,.025]
  ],.18,0,true),
  hat:palette('pass14 worn charcoal felt',[
    [.035,.029,.041],[.046,.036,.050],[.055,.041,.058]
  ],.055,0,true),
  cape:palette('pass14 heavy burgundy wool',[
    [.105,.010,.018],[.135,.014,.023],[.165,.019,.030],[.115,.011,.021]
  ],.07,0,true),
  cloth:palette('pass14 black plum riding cloth',[
    [.040,.032,.043],[.052,.038,.052],[.031,.027,.035]
  ],.10,0,true),
  leather:palette('pass14 worn riding leather',[
    [.045,.022,.014],[.065,.030,.016],[.082,.038,.018],[.035,.019,.013]
  ],.28,0,false),
  skin:palette('pass14 warm skin',[
    [.42,.255,.185],[.48,.305,.225],[.38,.225,.165]
  ],.24,0,false),
  wood:palette('pass14 crooked broom wood',[
    [.095,.042,.016],[.125,.054,.018],[.155,.067,.020],[.078,.034,.014]
  ],.16,0,false),
  straw:palette('pass14 dry broom straw',[
    [.30,.165,.040],[.39,.225,.055],[.47,.285,.075],[.34,.185,.038],[.52,.315,.085]
  ],.045,0,true),
  metal:palette('pass14 aged clasp metal',[
    [.16,.135,.105],[.11,.095,.080]
  ],.42,.65,false)
};

function classify(name){
  const n=(name||'').toLowerCase();
  if(n.includes('hair_cap')||n.startsWith('hair_main_')||n.startsWith('hair_overlap_')||n.startsWith('mane_'))return 'hair';
  if(n.includes('hat_brim')||n.includes('hat_crown')||n==='hat_tip'||n.startsWith('hat_'))return 'hat';
  if(n.includes('cape')||n.includes('cloak'))return 'cape';
  if(n.includes('clasp')||n.includes('buckle')||n.includes('brooch')||n.includes('metal'))return 'metal';
  if(n.startsWith('boot_')||n.includes('leather')||n.includes('belt')||n.includes('grip'))return 'leather';
  if(n==='head'||n==='neck'||n.startsWith('hand_')||n.startsWith('finger_'))return 'skin';
  if(n.includes('broom_shaft')||n==='broom_handle'||n.includes('broom_wood')||n.includes('handle'))return 'wood';
  if(n==='broom_bristles'||n.startsWith('straw_')||n.startsWith('bristle_')||n.includes('broom_straw'))return 'straw';
  return 'cloth';
}

function apply(witch){
  const counts={hair:0,hat:0,cape:0,cloth:0,leather:0,skin:0,wood:0,straw:0,metal:0,total:0,entities:0};
  walk(witch,node=>{
    const mis=meshInstances(node);
    if(!mis.length)return;
    counts.entities++;
    const type=classify(node.name);
    const mat=choose(materials[type],node.name||type);
    for(const mi of mis){mi.material=mat;counts[type]++;counts.total++}
  });
  return counts;
}

async function install(){
  for(let i=0;i<240;i++){
    const app=pc.app,wr=window.WitchRide3D,meshPass=window.WitchRideWitchCenterpiecePass;
    const witch=app?.root?.findByName?.('Witch Rig');
    if(app&&wr?.ready&&meshPass?.active&&witch){
      const counts=apply(witch);
      if(counts.total<300||counts.hair<20||counts.straw<300||counts.cape<4||counts.wood<1||counts.skin<5||counts.leather<2){
        console.error('Pass 14 material coverage incomplete',counts);
        wr.witchMaterialPass='fallback';
        wr.witchMaterialDetail=counts;
        return;
      }
      window.WitchRideWitchMaterialPass14={
        passId:PASS_ID,version:VERSION,active:true,production:true,uvIndependent:true,
        preservesGameplayScale:true,preservesMesh:true,counts
      };
      wr.witchMaterialPass=VERSION;
      wr.witchMaterialDetail=counts;
      document.body.classList.add('witch-material-pass14-ready');
      console.info('Witch Ride Pass 14 production materials ready',counts);
      return;
    }
    await wait(50);
  }
  console.error('Pass 14 material pass timed out');
}
install();
