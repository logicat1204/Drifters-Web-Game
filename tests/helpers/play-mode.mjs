export async function openPlayMode(page,mode,{world='initial-d',destination,season,travel=true}={}){
 const screen=await page.evaluate(()=>window.touge.state.screen);if(screen!=='menu'&&screen!=='play')await page.locator('#header .brand').click();
 if((await page.evaluate(()=>window.touge.state.screen))!=='play')await page.locator('#main-menu-actions [data-action=play]').click();
 await page.locator(`[data-play-mode=${mode==='offline'?'time':mode}]`).click();await page.locator('#mode-enter').click();await page.waitForFunction(mode=>window.touge.state.screen===(mode==='campaign'?'campaign':mode==='online'?'online':'home'),mode);
 if(mode==='campaign'){
  await page.locator('[data-world='+world+']').waitFor();
  if(season==='ngplus'&&!(await page.locator('#campaign-ngplus').innerText()).includes('Volver')){
   await page.locator('#campaign-ngplus').click();
   if(await page.locator('#campaign-ngplus-dialog').isVisible())await page.locator('#campaign-ngplus-dialog [value=start]').click();
  }
  await page.locator('[data-world='+world+']').click();
  if(season==='rain')await page.locator('[data-season=rain]').click();
  if(destination)await page.locator('[data-chapter='+destination+']').click();
  if(!travel)return;
  await page.locator('#campaign-travel').click();
  await page.locator('#campaign-start').waitFor();
  if(await page.locator('#comic-overlay').isVisible()&&/DE CAMPAÑA/.test(await page.locator('#comic-eyebrow').textContent())){
   const saved=page.waitForResponse(r=>r.url().endsWith('/api/campaign/story')&&r.request().method()==='POST');
   while(await page.locator('#comic-overlay').isVisible())await page.locator('#comic-next').click();await saved;
  }
 }
}
