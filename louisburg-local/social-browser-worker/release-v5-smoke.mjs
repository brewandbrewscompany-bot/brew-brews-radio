import {chromium} from 'playwright';

const ROOT='https://louisburglocalks.com/';
const errors=[];
function check(ok,msg){if(!ok)errors.push(msg);}

async function inspect(viewport,name){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport,isMobile:name==='mobile',hasTouch:name==='mobile'});
  const page=await context.newPage();
  try{
    await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(1200);
    check(/^https:\/\/louisburglocalks\.com\/(?:web-v5\/)?(?:$|[?#])/.test(page.url()),name+': custom domain did not land on V5 entry: '+page.url());
    check((await page.title())==='Louisburg Local',name+': wrong document title: '+await page.title());
    check(await page.locator('#correctionLink').count()===0,name+': stale correctionLink returned');
    let frame=page.frameLocator('#v4frame');
    await frame.locator('body').waitFor({state:'visible',timeout:30000});

    // A push can reach Actions before the custom domain finishes deploying.
    // Wait up to 3 minutes for the new native Today quick control to appear.
    let deployed=false;
    for(let i=0;i<36;i++){
      const nativeToday=await frame.locator('#quickNav [data-cat="TODAY"]').count().catch(()=>0);
      if(nativeToday===1){deployed=true;break}
      await page.waitForTimeout(5000);
      await page.reload({waitUntil:'domcontentloaded',timeout:45000}).catch(()=>{});
      frame=page.frameLocator('#v4frame');
      await frame.locator('body').waitFor({state:'visible',timeout:30000}).catch(()=>{});
    }
    check(deployed,name+': custom domain never received the current V5 native quick-filter build');

    let feedStatus='';
    for(let i=0;i<80;i++){
      feedStatus=await frame.locator('#feedStatus').innerText().catch(()=> '');
      if(/^live\s*·/i.test(feedStatus))break;
      if(i===30&&/connection issue/i.test(feedStatus)){
        await page.reload({waitUntil:'domcontentloaded',timeout:45000}).catch(()=>{});
        await frame.locator('body').waitFor({state:'visible',timeout:30000}).catch(()=>{});
      }
      await page.waitForTimeout(500);
    }
    check(/^live\s*·/i.test(feedStatus),name+': feed did not reach live state after retry window: '+feedStatus);
    const homeCards=await frame.locator('#homeScreen .feedCard').count();
    check(homeCards>0,name+': home feed empty after live state');
    const publicBody=(await frame.locator('#homeScreen').innerText().catch(()=> '')).toUpperCase();
    check(!publicBody.includes('REJECTED - OTHER CITY'),name+': rejected other-city item leaked into public feed');

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
        if(nav==='directory'){
          for(let i=0;i<20;i++){
            const t=await frame.locator('#directoryCount').innerText().catch(()=> '');
            if(/^193\b/.test(t))break;
            await page.waitForTimeout(250);
          }
          const countText=await frame.locator('#directoryCount').innerText().catch(()=> '');
          check(/^193\b/.test(countText),name+': directory snapshot is not 193 verified entries: '+countText);
          const dirText=(await frame.locator('#directoryList').innerText().catch(()=> '')).toLowerCase();
          check(dirText.includes('brew & brews'),name+': Brew & Brews missing from directory');
          check(dirText.includes('cowboy coffee post'),name+': Cowboy Coffee Post missing from directory');
          check(dirText.includes('journey church of the nazarene'),name+': newly added Journey Church missing from directory');
        }
      }
    }

    const homeButton=name==='desktop'
      ? frame.locator('#v5PrimaryNav [data-v5-nav="home"]')
      : frame.locator('.bottom [data-nav="home"]');
    await homeButton.click(); await page.waitForTimeout(400);

    // Quick filters must use the real feed state and show a solid purple selected pill.
    const quickAll=frame.locator('#quickNav [data-cat="ALL"]');
    const quickToday=frame.locator('#quickNav [data-cat="TODAY"]');
    const quickDeals=frame.locator('#quickNav [data-cat="DEALS"]');
    check(await quickAll.count()===1,name+': quick All missing');
    check(await quickToday.count()===1,name+': quick Today missing');
    check(await quickDeals.count()===1,name+': quick Deals missing');

    if(await quickDeals.count()){
      await quickDeals.click(); await page.waitForTimeout(300);
      check(await quickDeals.getAttribute('aria-pressed')==='true',name+': quick Deals did not become selected');
      const purple=await quickDeals.evaluate(el=>getComputedStyle(el).backgroundColor).catch(()=> '');
      check(purple==='rgb(75, 33, 109)',name+': selected quick pill is not brand purple: '+purple);
      const badDeals=await frame.locator('#feed .feedCard').evaluateAll(cards=>cards.filter(card=>{
        const item=window.findItem&&window.findItem(card.dataset.id);
        return !item||!window.catMatch||!window.catMatch(item,'DEALS');
      }).map(card=>card.dataset.id));
      check(badDeals.length===0,name+': quick Deals leaked non-deal cards: '+badDeals.join(','));
    }

    if(await quickToday.count()){
      await quickToday.click(); await page.waitForTimeout(300);
      check(await quickToday.getAttribute('aria-pressed')==='true',name+': quick Today did not become selected');
      const badToday=await frame.locator('#feed .feedCard').evaluateAll(cards=>cards.filter(card=>{
        const item=window.findItem&&window.findItem(card.dataset.id);
        return !item||!window.sectionMatch||!window.sectionMatch(item,'TODAY')||String(item.date||'').slice(0,10)!==window.lbToday();
      }).map(card=>card.dataset.id));
      check(badToday.length===0,name+': quick Today leaked non-today cards: '+badToday.join(','));
    }

    // Drawer must call the same filter engine. Selecting Events + Today must only show matching cards.
    const filterButton=frame.locator('#v5TopFilter');
    check(await filterButton.count()===1,name+': V5 top filter missing');
    if(await filterButton.count()){
      await filterButton.click(); await page.waitForTimeout(120);
      const eventChoice=page.locator('#categoryChoices [data-filter-cat="EVENTS"]');
      const todayChoice=page.locator('#timeChoices [data-filter-time="TODAY"]');
      const sourceAll=page.locator('#sourceChoices [data-filter-source=""]');
      if(await eventChoice.count())await eventChoice.click();
      if(await todayChoice.count())await todayChoice.click();
      if(await sourceAll.count())await sourceAll.click();
      await page.locator('#rightDrawer .close').click();
      await page.waitForTimeout(350);
      const badDrawer=await frame.locator('#feed .feedCard').evaluateAll(cards=>cards.filter(card=>{
        const item=window.findItem&&window.findItem(card.dataset.id);
        return !item||!window.catMatch||!window.sectionMatch||!window.catMatch(item,'EVENTS')||!window.sectionMatch(item,'TODAY')||String(item.date||'').slice(0,10)!==window.lbToday();
      }).map(card=>card.dataset.id));
      check(badDrawer.length===0,name+': drawer Events + Today leaked mismatched cards: '+badDrawer.join(','));
    }

    // Using a quick button after drawer filters must clear stale drawer selections.
    if(await quickAll.count()){
      await quickAll.click(); await page.waitForTimeout(200);
      const activeCat=await page.locator('#categoryChoices .choice.active').getAttribute('data-filter-cat').catch(()=>null);
      const activeTime=await page.locator('#timeChoices .choice.active').getAttribute('data-filter-time').catch(()=>null);
      const activeSource=await page.locator('#sourceChoices .choice.active').getAttribute('data-filter-source').catch(()=>null);
      check(activeCat==='ALL'&&activeTime==='ALL'&&activeSource==='',name+': quick All did not clear stale drawer selections');
    }

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
console.log('V5 RELEASE SMOKE PASSED: custom-domain desktop + mobile entry, quick filters, drawer filters, strict Today dates, selected-state styling, sections, search, history and layout checks.');
