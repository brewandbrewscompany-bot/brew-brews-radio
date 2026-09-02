import {pathToFileURL} from 'node:url';

const LHS='https://www.arbiterlive.com/School/13250';

function oneLine(v){return String(v||'').replace(/\s+/g,' ').trim();}

export async function discover(){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:'America/Chicago',viewport:{width:1440,height:1100}});
  const page=await context.newPage();
  const interesting=[];
  page.on('response',response=>{
    const u=response.url();
    if(/arbiterlive\.com/i.test(u)&&/(api|schedule|team|calendar|event|school)/i.test(u)&&interesting.length<80)interesting.push(`${response.status()} ${u}`);
  });
  try{
    await page.goto(LHS,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(3500);
    console.log(`ARBITER SCHOOL URL: ${page.url()}`);
    const body=oneLine(await page.locator('body').innerText());
    console.log(`ARBITER SCHOOL BODY: ${body.slice(0,10000)}`);
    const links=await page.locator('a').evaluateAll(as=>as.map(a=>({text:(a.innerText||a.textContent||'').replace(/\s+/g,' ').trim(),href:a.href})).filter(x=>x.href).filter(x=>/(schedule|team|calendar|event|13250|louisburg)/i.test(`${x.text} ${x.href}`)).slice(0,120));
    for(const link of links)console.log(`ARBITER SCHOOL LINK: ${link.text} -> ${link.href}`);
    const buttons=await page.locator('button,[role="tab"],[role="button"]').evaluateAll(xs=>xs.map(x=>(x.innerText||x.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,120));
    for(const b of buttons)console.log(`ARBITER SCHOOL CONTROL: ${b}`);
    const scripts=await page.locator('script[src]').evaluateAll(xs=>xs.map(x=>x.src).filter(Boolean).slice(0,80));
    for(const s of scripts)if(/arbiter|school|main|app|bundle/i.test(s))console.log(`ARBITER SCRIPT: ${s}`);
    for(const r of [...new Set(interesting)])console.log(`ARBITER NETWORK: ${r}`);
  }finally{await context.close();await browser.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)discover().catch(e=>{console.error(e);process.exitCode=1;});
