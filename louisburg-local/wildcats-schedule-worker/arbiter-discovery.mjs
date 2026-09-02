import {pathToFileURL} from 'node:url';

export async function discover(){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:'America/Chicago',viewport:{width:1365,height:1000}});
  const page=await context.newPage();
  try{
    await page.goto('https://www.arbiterlive.com/',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(1200);
    const input=page.getByPlaceholder(/search for your school/i).first();
    if(!await input.count())throw new Error('ArbiterLive school search input not found');
    await input.fill('Louisburg High School');
    const button=page.getByRole('button',{name:/search/i}).first();
    if(!await button.count())throw new Error('ArbiterLive search button not found');
    await button.click();
    await page.waitForTimeout(2500);
    const body=(await page.locator('body').innerText()).replace(/\s+/g,' ').trim();
    console.log(`ARBITER DISCOVERY URL: ${page.url()}`);
    console.log(`ARBITER DISCOVERY BODY: ${body.slice(0,4500)}`);
    const links=await page.locator('a').evaluateAll(as=>as.map(a=>({text:(a.innerText||a.textContent||'').replace(/\s+/g,' ').trim(),href:a.href})).filter(x=>x.href&&(/louisburg/i.test(x.text)||/School\//i.test(x.href)||/school/i.test(x.text))).slice(0,60));
    for(const link of links)console.log(`ARBITER DISCOVERY LINK: ${link.text} -> ${link.href}`);
  }finally{await context.close();await browser.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)discover().catch(e=>{console.error(e);process.exitCode=1;});
