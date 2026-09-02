import {pathToFileURL} from 'node:url';

const LHS='https://www.arbiterlive.com/School/13250';
const CAL='https://www.arbiterlive.com/School/Calendar/13250';

function oneLine(v){return String(v||'').replace(/\s+/g,' ').trim();}

async function dump(page,label,url){
  const interesting=[];
  const listener=response=>{const u=response.url();if(/arbiterlive\.com/i.test(u)&&/(api|schedule|team|calendar|event|school)/i.test(u)&&interesting.length<120)interesting.push(`${response.status()} ${u}`);};
  page.on('response',listener);
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(3500);
  console.log(`ARBITER ${label} URL: ${page.url()}`);
  console.log(`ARBITER ${label} BODY: ${oneLine(await page.locator('body').innerText()).slice(0,16000)}`);
  const links=await page.locator('a').evaluateAll(as=>as.map(a=>({text:(a.innerText||a.textContent||'').replace(/\s+/g,' ').trim(),href:a.href})).filter(x=>x.href).filter(x=>/(schedule|team|calendar|event|13250|louisburg)/i.test(`${x.text} ${x.href}`)).slice(0,160));
  for(const link of links)console.log(`ARBITER ${label} LINK: ${link.text} -> ${link.href}`);
  const controls=await page.locator('button,[role="tab"],[role="button"],select,input').evaluateAll(xs=>xs.map(x=>({tag:x.tagName,type:x.getAttribute('type')||'',name:x.getAttribute('name')||'',text:(x.innerText||x.textContent||'').replace(/\s+/g,' ').trim(),value:x.value||'',aria:x.getAttribute('aria-label')||''})).filter(x=>x.text||x.value||x.aria).slice(0,160));
  for(const c of controls)console.log(`ARBITER ${label} CONTROL: ${JSON.stringify(c)}`);
  for(const r of [...new Set(interesting)])console.log(`ARBITER ${label} NETWORK: ${r}`);
  page.off('response',listener);
}

export async function discover(){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:'America/Chicago',viewport:{width:1440,height:1100}});
  const page=await context.newPage();
  try{
    await dump(page,'SCHOOL',LHS);
    await dump(page,'CALENDAR',CAL);
  }finally{await context.close();await browser.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)discover().catch(e=>{console.error(e);process.exitCode=1;});
