import {chromium} from 'playwright';

const ROOT='https://brewandbrewscompany-bot.github.io/brew-brews-radio/louisburg-local/';
const errors=[];
function check(ok,msg){if(!ok)errors.push(msg);}

async function inspect(viewport,name){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport,isMobile:name==='mobile',hasTouch:name==='mobile'});
  const page=await context.newPage();
  try{
    await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(1200);
    check(/\/louisburg-local\/(?:web-v5\/)?(?:$|[?#])/.test(page.url()),name+': root did not land on V5 entry: '+page.url());
    check((await page.title())==='Louisburg Local',name+': wrong document title: '+await page.title());
    check(await page.locator('#correctionLink').count()===0,name+': stale correctionLink returned');
    const frame=page.frameLocator('#v4frame');
    await frame.locator('body').waitFor({state:'visible',timeout:30000});
    let feedStatus='';
    for(let i=0;i<40;i++){
      feedStatus=await frame.locator('#feedStatus').innerText().catch(()=> '');
      if(/^live\s*·/i.test(feedStatus)||/connection issue/i.test(feedStatus))break;
      await page.waitForTimeout(500);
    }
    check(/^live\s*·/i.test(feedStatus),name+': feed did not reach live state: '+feedStatus);
    const homeCards=await frame.locator('#homeScreen .feedCard').count();
    check(homeCards>0,name+': home feed empty after live state');

    const screens=[
      ['directory','#directoryScreen','.directoryCard'],
      ['events','#eventsScreen','.eventCard'],
      ['deals','#dealsScreen','.dealCard']
    ];
    for(const [nav,screen,card] of screens){
      const button=name==='desktop'
        ? frame.locator('#v5PrimaryNav [data-v5-nav="'+nav+'"]')
        : frame.locator('.bottom [data-nav="'+nav+'"]');
      check(await button.count()===1,name+': visible '+nav+' nav missing');
      if(await button.count()){
        await button.click();
        await page.waitForTimeout(500);
        check(await frame.locator(screen).evaluate(el=>el.classList.contains('active')).catch(()=>false),name+': '+nav+' screen did not activate');
        const cards=await frame.locator(screen+' '+card).count();
        const empty=await frame.locator(screen+' .empty').count();
        check(cards>0||empty>0,name+': '+nav+' screen did not render cards or an empty state');
        if(nav==='directory')check(cards>0,name+': directory rendered no listings');
      }
    }

    const homeButton=name==='desktop'
      ? frame.locator('#v5PrimaryNav [data-v5-nav="home"]')
      : frame.locator('.bottom [data-nav="home"]');
    await homeButton.click(); await page.waitForTimeout(400);

    const topSearch=frame.locator('#v5TopSearch');
    check(await topSearch.count()===1,name+': V5 top search missing');
    if(await topSearch.count()){
      await topSearch.click(); await page.waitForTimeout(150);
      const input=frame.locator('#v5SearchInput');
      await input.fill('WoolWorks');
      await page.waitForTimeout(700);
      const body=(await frame.locator('body').innerText()).toLowerCase();
      check(body.includes('woolworks'),name+': search did not surface WoolWorks');
      await frame.locator('#v5SearchClose').click().catch(()=>{});
    }

    if(name==='desktop'){
      const filter=frame.locator('#v5TopFilter');
      check(await filter.count()===1,name+': top filter button missing');
      if(await filter.count()){
        await filter.click(); await page.waitForTimeout(150);
        const deals=page.locator('#categoryChoices [data-filter-cat="DEALS"]');
        check(await deals.count()===1,name+': deals filter missing');
        if(await deals.count()){
          await deals.click();
          await page.locator('#rightDrawer .close').click();
          await page.waitForTimeout(500);
          const status=(await frame.locator('#feedStatus').innerText().catch(()=>'' )).toLowerCase();
          check(status.includes('matching')||status.includes('live'),name+': filter did not update feed status');
        }
      }
    }

    await page.goto(ROOT+'web-v5/',{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(1400);
    const hf=page.frameLocator('#v4frame');
    if(name==='desktop'){
      const history=hf.locator('#v5PrimaryNav [data-v5-history]');
      check(await history.count()===1,name+': desktop History control missing');
      if(await history.count())await history.click();
    }else{
      const teaser=hf.locator('#historyTeaser');
      check(await teaser.count()===1,name+': mobile History teaser missing');
      if(await teaser.count())await teaser.click();
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(900);
    check(/history\.html/.test(page.url()),name+': History did not navigate the top-level page');
    check(await page.locator('#v4frame').count()===0,name+': History opened inside/nested in V5 instead of top-level');
    const returnLink=page.locator('a.back');
    check(await returnLink.count()===1,name+': History return link missing');
    if(await returnLink.count()){
      await returnLink.click();
      await page.waitForTimeout(900);
      check(/web-v5/.test(page.url()),name+': History return did not reach V5');
    }

    if(name==='mobile'){
      await page.goto(ROOT+'web-v5/',{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForTimeout(1200);
      const f=page.frameLocator('#v4frame');
      const width=await f.locator('body').evaluate(el=>el.scrollWidth);
      check(width<=viewport.width+4,name+': horizontal overflow: '+width+' > '+viewport.width);
      check(await f.locator('.bottom').count()===1,name+': mobile bottom navigation missing');
    }
  }catch(err){
    errors.push(name+': uncaught smoke error: '+String(err?.stack||err));
  }finally{
    await browser.close();
  }
}

await inspect({width:1440,height:1000},'desktop');
await inspect({width:390,height:844},'mobile');

if(errors.length){
  console.error('V5 RELEASE SMOKE FAILED');
  for(const e of errors)console.error('- '+e);
  process.exit(1);
}
console.log('V5 RELEASE SMOKE PASSED: desktop + mobile production entry, sections, search, filters, history and layout checks.');
