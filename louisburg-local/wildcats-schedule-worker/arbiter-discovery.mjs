import {pathToFileURL} from 'node:url';

const CAL='https://www.arbiterlive.com/School/Calendar/13250';

export async function discover(){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:'America/Chicago',viewport:{width:1440,height:1100}});
  const page=await context.newPage();
  let captured=null;
  page.on('request',request=>{
    if(/\/School\/GetEventsByEntity\//i.test(request.url())){
      console.log(`ARBITER EVENTS REQUEST METHOD: ${request.method()}`);
      console.log(`ARBITER EVENTS REQUEST URL: ${request.url()}`);
      console.log(`ARBITER EVENTS REQUEST DATA: ${String(request.postData()||'').slice(0,5000)}`);
    }
  });
  page.on('response',async response=>{
    if(/\/School\/GetEventsByEntity\//i.test(response.url())){
      try{captured=await response.text();}catch(e){captured=`ERROR ${e.message}`;}
    }
  });
  try{
    await page.goto(CAL,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(4500);
    console.log(`ARBITER CALENDAR URL: ${page.url()}`);
    if(!captured)throw new Error('Arbiter calendar event response was not captured');
    console.log(`ARBITER EVENTS RESPONSE: ${captured.slice(0,30000)}`);
  }finally{await context.close();await browser.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)discover().catch(e=>{console.error(e);process.exitCode=1;});
