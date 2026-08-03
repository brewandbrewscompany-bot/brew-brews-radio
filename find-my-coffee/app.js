const SHOP_URL = 'https://brewandbrewsco.com/products';

const questions = [
  {key:'drink',icon:'☕',kicker:'Start with your usual',title:'What do you usually drink?',help:'Choose the closest match. You can select more than one.',multi:true,options:[
    ['☕','Latte or cappuccino','Coffee with milk','latte'],['●','Black coffee','No milk','black'],['🧊','Iced coffee','Over ice','cold-brew'],['▣','Espresso','Straight shot','espresso'],['♨','Drip coffee','Everyday brewer','drip'],['?','Something else','We’ll keep it balanced','balanced']
  ]},
  {key:'taste',icon:'◈',kicker:'Build your flavor profile',title:'What flavors do you love?',help:'Select everything that sounds good in your cup.',multi:true,options:[
    ['▰','Chocolate','Cocoa and dark chocolate','chocolate'],['◆','Caramel','Brown sugar and sweetness','caramel'],['●','Nutty','Almond, pecan, roasted nuts','nutty'],['✦','Fruity','Berry or dried fruit','fruity'],['◐','Citrus','Bright and lively','bright'],['✿','Floral','Light aromatic notes','floral'],['▲','Spicy','Warm spice character','spice'],['⬟','Earthy','Deep and rustic','earthy'],['○','Smooth','Soft and easy finish','smooth']
  ]},
  {key:'roast',icon:'🔥',kicker:'Choose your roast lane',title:'How do you like your roast?',help:'This helps us balance brightness, body, and roast character.',multi:false,options:[
    ['◔','Light','Bright and mellow','light'],['◑','Medium','Balanced and smooth','medium'],['◕','Medium-dark','Rich and flavorful','medium-dark'],['●','Dark','Bold and intense','dark']
  ]},
  {key:'adventure',icon:'↗',kicker:'Set your comfort zone',title:'How adventurous are you?',help:'We’ll respect your usual taste—and still show one option outside it.',multi:false,options:[
    ['⌂','Play it safe','Keep me close to what I know','safe'],['≈','A little adventurous','I’ll try something nearby','curious'],['⚡','Bring it on','Show me bold and different','adventurous']
  ]},
  {key:'brew',icon:'▱',kicker:'Finish with your brewer',title:'How do you brew most often?',help:'Choose all that apply. This helps us make the final recommendation useful.',multi:true,options:[
    ['♨','Drip machine','Automatic brewer','drip'],['▥','French press','Full immersion','french-press'],['▽','Pour over','Manual and clean','pour-over'],['▣','Espresso','Pressure brewed','espresso'],['▤','Cold brew','Long steep','cold-brew'],['…','Other','Reusable pod or prepared','balanced']
  ]}
];

let coffees=[];let step=0;let answers={};let wheelTurns=0;
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];

async function init(){
  $$('[data-shop-link]').forEach(a=>a.href=SHOP_URL);
  try{const r=await fetch('data/coffees.json',{cache:'no-store'});coffees=await r.json()}catch(e){console.error(e);coffees=[]}
  document.addEventListener('click',handleAction);
  renderLive();
}
function handleAction(e){
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  const actions={start:startQuiz,next:nextQuestion,back:backQuestion,skip:nextQuestion,restart:restart,home:home,roulette:openRoulette,spin:spin};
  actions[action]?.();
}
function show(name){$$('.view').forEach(v=>v.classList.remove('is-active'));$(`#view-${name}`).classList.add('is-active');window.scrollTo({top:0,behavior:'smooth'})}
function home(){show('start')}function restart(){step=0;answers={};startQuiz()}function openRoulette(){show('roulette')}
function startQuiz(){show('quiz');renderQuestion()}
function renderQuestion(){
  const q=questions[step];const selected=answers[q.key]||[];
  $('#step-counter').textContent=`Question ${step+1} of ${questions.length}`;
  $('#progress-bar').style.width=`${((step+1)/questions.length)*100}%`;
  $('#question-icon').textContent=q.icon;$('#question-kicker').textContent=q.kicker;$('#question-title').textContent=q.title;$('#question-help').textContent=q.help;
  $('#next-label').textContent=step===questions.length-1?'See my matches':'Next question';
  $('#choice-grid').innerHTML=q.options.map(([symbol,label,detail,value])=>`<button class="choice ${selected.includes(value)?'is-selected':''}" data-choice="${value}"><span class="choice-check">${selected.includes(value)?'✓':''}</span><span class="choice-symbol">${symbol}</span><span><b>${label}</b><small>${detail}</small></span></button>`).join('');
  $$('#choice-grid .choice').forEach(btn=>btn.addEventListener('click',()=>toggleChoice(q,btn.dataset.choice)));
  renderLive();
}
function toggleChoice(q,value){let selected=answers[q.key]||[];selected=q.multi?(selected.includes(value)?selected.filter(v=>v!==value):[...selected,value]):[value];answers[q.key]=selected;renderQuestion()}
function nextQuestion(){if(step<questions.length-1){step++;renderQuestion()}else{renderResults();show('results')}}
function backQuestion(){if(step>0){step--;renderQuestion()}else home()}
function tags(){return Object.values(answers).flat()}
function scoreCoffee(c){
  const selected=tags();let score=44;
  selected.forEach(tag=>{
    if(c.tags.includes(tag))score+=8;
    else if(tag==='smooth'&&c.acidity<=4)score+=6;
    else if(tag==='medium'&&['Medium','Medium-Dark'].includes(c.roast))score+=5;
    else if(tag==='medium-dark'&&['Medium-Dark','Dark'].includes(c.roast))score+=5;
    else if(tag==='dark'&&c.roast==='Dark')score+=7;
    else if(tag==='light'&&c.acidity>=6)score+=6;
    else if(tag==='safe'&&c.adventure<=4)score+=5;
    else if(tag==='curious'&&c.adventure>=4&&c.adventure<=7)score+=5;
    else if(tag==='adventurous'&&c.adventure>=7)score+=7;
    else score-=1;
  });
  return Math.max(42,Math.min(98,score));
}
function ranked(){return coffees.filter(c=>c.active).map(c=>({...c,score:scoreCoffee(c)})).sort((a,b)=>b.score-a.score)}
function adventurePick(excluded=[]){const pool=ranked().filter(c=>!excluded.includes(c.id));return pool.sort((a,b)=>b.adventure-a.adventure||b.score-a.score)[0]||ranked()[0]}
function renderLive(){
  if(!coffees.length||!$('#live-matches'))return;
  const top=ranked().slice(0,3);
  $('#live-matches').innerHTML=top.map((c,i)=>`<article class="mini-match"><span class="mini-rank">${i+1}</span><span><b>${c.name}</b><small>${c.roast} · ${c.flavors.slice(0,2).join(' · ')}</small></span><span class="mini-score">${c.score}%</span></article>`).join('');
  const pick=adventurePick(top.map(c=>c.id));
  $('#live-adventure').innerHTML=`<p class="kicker">Adventure pick</p><b>${pick.name}</b><p>${pick.flavors.join(' · ')}</p>`;
}
function renderResults(){
  const top=ranked().slice(0,3);
  $('#results-grid').innerHTML=top.map((c,i)=>`<article class="result-card"><span class="match-badge">${i===0?'BEST MATCH':`MATCH ${i+1}`} · ${c.score}%</span><div class="result-bag">${c.name.toUpperCase()}</div><h3>${c.name}</h3><small>${c.roast} roast</small><div class="flavor-pills">${c.flavors.map(f=>`<span>${f}</span>`).join('')}</div><p>${c.summary}</p><p class="why"><b>Why this one:</b> ${c.why}</p><a class="card-link" href="${c.url==='#'?SHOP_URL:c.url}">View this coffee →</a></article>`).join('');
  const pick=adventurePick(top.map(c=>c.id));
  $('#adventure-result').innerHTML=`<div><p class="kicker">Feeling adventurous?</p><h3>${pick.name}</h3><p>${pick.summary} ${pick.why}</p><div class="flavor-pills">${pick.flavors.map(f=>`<span>${f}</span>`).join('')}</div></div><a class="button button-primary button-large" href="${pick.url==='#'?SHOP_URL:pick.url}">Take the adventure →</a>`;
}
function spin(){
  if(!coffees.length)return;
  const wheel=$('#roulette-wheel');wheelTurns+=5+Math.floor(Math.random()*4);wheel.style.transform=`rotate(${wheelTurns*360+Math.floor(Math.random()*300)}deg)`;
  const active=coffees.filter(c=>c.active);const pick=active[Math.floor(Math.random()*active.length)];
  $('#roulette-result').innerHTML='<p class="kicker">Spinning</p><h3>Finding your surprise.</h3><p>The wheel is choosing from the active Brew & Brews lineup.</p>';
  setTimeout(()=>{$('#roulette-result').innerHTML=`<p class="kicker">Roulette chose</p><h3>${pick.name}</h3><p><b>${pick.roast} roast</b></p><div class="flavor-pills">${pick.flavors.map(f=>`<span>${f}</span>`).join('')}</div><p>${pick.summary}</p><a class="button button-primary" href="${pick.url==='#'?SHOP_URL:pick.url}">I’ll try it →</a>`},3450);
}
init();
