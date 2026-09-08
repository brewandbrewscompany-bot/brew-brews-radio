import * as pc from 'playcanvas';

// Witch Ride 3D — Pass 14 textured production material layer.
// Geometry, scale, rig roots, broom direction and motion remain untouched.
const PASS_ID='witch-material-pass14';
const VERSION='pass-14-production-materials-v3-textured';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function hashName(name){
  let h=2166136261>>>0;
  for(let i=0;i<name.length;i++){h^=name.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function choose(list,name){return list[hashName(name)%list.length]}
function meshInstances(node){return node?.render?.meshInstances||[]}
function walk(root,fn){fn(root);for(const child of root.children||[])walk(child,fn)}
function textureAsset(app,filename){
  const url=`assets/textures/${filename}`;
  return new Promise((resolve,reject)=>app.assets.loadFromUrlAndFilename(url,filename,'texture',(err,asset)=>err?reject(new Error(`${filename}: ${err}`)):resolve(asset.resource)));
}
function prepTexture(texture){
  texture.addressU=pc.ADDRESS_REPEAT;
  texture.addressV=pc.ADDRESS_REPEAT;
  texture.anisotropy=4;
  return texture;
}

const textureFiles={
  hair:['witch-hair-v3-albedo.png','witch-hair-v3-normal.png'],
  hat:['witch-hat-felt-albedo.png','witch-hat-felt-normal.png'],
  cape:['witch-cape-wool-albedo.png','witch-cape-wool-normal.png'],
  cloth:['witch-cloth-albedo.png','witch-cloth-normal.png'],
  leather:['witch-leather-v3-albedo.png','witch-leather-v3-normal.png'],
  wood:['broom-wood-v3-albedo.png','broom-wood-v3-normal.png'],
  straw:['broom-straw-v3-albedo.png','broom-straw-v3-normal.png']
};

// Surface response is tuned for the very dark chase scene. Tiny category-colored
// emissive terms preserve material identity in moon shadow without turning the
// rider into a glowing object; albedo + normal maps still provide the visible skin.
const specs={
  hair:{prefix:'pass14 textured dark chestnut auburn hair',tints:[[.62,.52,.46],[.56,.44,.39],[.70,.59,.52],[.51,.40,.36],[.66,.54,.47]],gloss:.27,metalness:0,cullNone:true,tiling:[1.15,2.15],bump:.42,emissive:[.024,.008,.004],emissiveIntensity:.26},
  hat:{prefix:'pass14 textured charcoal felt',tints:[[.72,.69,.76],[.79,.74,.82],[.64,.62,.70]],gloss:.060,metalness:0,cullNone:true,tiling:[2.1,2.1],bump:.38,emissive:[.006,.006,.009],emissiveIntensity:.20},
  cape:{prefix:'pass14 textured deep burgundy wool',tints:[[1,.58,.64],[.94,.49,.56],[1,.67,.70],[.88,.43,.52]],gloss:.080,metalness:0,cullNone:true,tiling:[1.45,2.25],bump:.46,emissive:[.040,.004,.009],emissiveIntensity:.42},
  cloth:{prefix:'pass14 textured charcoal plum riding cloth',tints:[[.72,.67,.76],[.79,.71,.82],[.63,.61,.70]],gloss:.105,metalness:0,cullNone:true,tiling:[1.8,2.2],bump:.30,emissive:[.008,.008,.014],emissiveIntensity:.30},
  leather:{prefix:'pass14 textured worn brown black leather',tints:[[.78,.63,.49],[.90,.70,.51],[.69,.54,.43],[.84,.61,.42]],gloss:.31,metalness:0,cullNone:false,tiling:[1.7,2.0],bump:.42,emissive:[.019,.008,.003],emissiveIntensity:.28},
  skin:{prefix:'pass14 warm natural skin',tints:[[.48,.295,.210],[.54,.345,.250],[.43,.255,.182]],gloss:.24,metalness:0,cullNone:false,tiling:[1,1],bump:0,emissive:[.012,.006,.004],emissiveIntensity:.18},
  wood:{prefix:'pass14 textured crooked aged broom wood',tints:[[.84,.66,.48],[.96,.75,.52],[.74,.57,.42],[1,.81,.57]],gloss:.18,metalness:0,cullNone:false,tiling:[1.0,3.0],bump:.52,emissive:[.014,.006,.002],emissiveIntensity:.22},
  straw:{prefix:'pass14 textured dry natural broom straw',tints:[[1,.86,.61],[.95,.76,.48],[1,.94,.70],[.89,.69,.42],[1,.80,.50]],gloss:.040,metalness:0,cullNone:true,tiling:[1.0,2.8],bump:.34,emissive:[.022,.013,.003],emissiveIntensity:.24},
  metal:{prefix:'pass14 aged clasp metal',tints:[[.18,.150,.110],[.125,.105,.086]],gloss:.44,metalness:.65,cullNone:false,tiling:[1,1],bump:0,emissive:[0,0,0],emissiveIntensity:0}
};

function makeMaterial(name,tint,spec,textures){
  const m=new pc.StandardMaterial();
  m.name=name;
  m.diffuse=new pc.Color(...tint);
  m.useMetalness=true;
  m.metalness=spec.metalness;
  m.gloss=spec.gloss;
  if(spec.emissiveIntensity>0){
    m.emissive=new pc.Color(...spec.emissive);
    m.emissiveIntensity=spec.emissiveIntensity;
  }
  if(spec.cullNone)m.cull=pc.CULLFACE_NONE;
  if(textures?.albedo){
    m.diffuseMap=textures.albedo;
    m.diffuseMapTiling=new pc.Vec2(...spec.tiling);
  }
  if(textures?.normal){
    m.normalMap=textures.normal;
    m.normalMapTiling=new pc.Vec2(...spec.tiling);
    m.bumpiness=spec.bump;
  }
  m.update();
  return m;
}
function buildPalettes(textureSets){
  const out={};
  for(const [type,spec] of Object.entries(specs)){
    out[type]=spec.tints.map((tint,i)=>makeMaterial(`${spec.prefix}-${i+1}`,tint,spec,textureSets[type]||null));
  }
  return out;
}
async function loadTextureSets(app){
  const out={};
  await Promise.all(Object.entries(textureFiles).map(async([type,[albedoName,normalName]])=>{
    const [albedo,normal]=await Promise.all([textureAsset(app,albedoName),textureAsset(app,normalName)]);
    out[type]={albedo:prepTexture(albedo),normal:prepTexture(normal)};
  }));
  return out;
}

function classify(name){
  const n=(name||'').toLowerCase();
  if(n.includes('hair_cap')||n.startsWith('hair_main_')||n.startsWith('hair_overlap_')||n.startsWith('mane_'))return 'hair';
  if(n.includes('hat_brim')||n.includes('hat_crown')||n==='hat_tip'||n.startsWith('hat_'))return 'hat';
  if(n.includes('cape')||n.includes('cloak'))return 'cape';
  if(n.includes('clasp')||n.includes('buckle')||n.includes('brooch')||n.includes('metal'))return 'metal';
  if(n.startsWith('boot_')||n==='seat_wrap'||n.includes('leather')||n.includes('belt')||n.includes('grip'))return 'leather';
  if(n==='head'||n==='neck'||n.startsWith('hand_')||n.startsWith('finger_'))return 'skin';
  if(n.includes('broom_shaft')||n==='broom_handle'||n.includes('broom_wood')||n.includes('handle'))return 'wood';
  if(n==='broom_bristles'||n.startsWith('straw_')||n.startsWith('bristle_')||n.includes('broom_straw'))return 'straw';
  return 'cloth';
}

function apply(witch,materials){
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
      try{
        const textureSets=await loadTextureSets(app);
        const materials=buildPalettes(textureSets);
        const counts=apply(witch,materials);
        if(counts.total<300||counts.hair<20||counts.straw<300||counts.cape<4||counts.wood<1||counts.skin<5||counts.leather<2)throw new Error(`material coverage incomplete ${JSON.stringify(counts)}`);
        const texturedCategories=Object.keys(textureSets).sort();
        window.WitchRideWitchMaterialPass14={
          passId:PASS_ID,version:VERSION,active:true,production:true,uvRequired:true,uvIndependent:false,
          preservesGameplayScale:true,preservesMesh:true,visualBalance:'night-readable-textured-material-separation-refined',
          texturedCategories,textureAssetCount:texturedCategories.length*2,counts
        };
        wr.witchMaterialPass=VERSION;
        wr.witchMaterialDetail=counts;
        document.body.classList.add('witch-material-pass14-ready');
        console.info('Witch Ride Pass 14 textured production materials ready',window.WitchRideWitchMaterialPass14);
        return;
      }catch(err){
        console.error('Pass 14 textured material pass failed',err);
        wr.witchMaterialPass='fallback';
        wr.witchMaterialDetail={};
        return;
      }
    }
    await wait(50);
  }
  console.error('Pass 14 material pass timed out');
}
install();
