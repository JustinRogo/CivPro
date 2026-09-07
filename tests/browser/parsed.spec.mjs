import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const index=JSON.parse(await readFile('data/parsed-districts/index.json','utf8'));
test('all 93 added districts open rule contents and first and last parsed rules',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const r of index.districts){
    await page.goto(`./#/district/${r.districtId}/civil`);
    await expect(page.locator('.rule-row')).toHaveCount(r.rules);
    await page.locator('.rule-row').first().click();
    await expect(page.locator('.parsed-text')).toBeVisible();
    await expect(page.locator('.reader-heading .notice')).toContainText('Parsed draft');
    await page.goto(`./#/district/${r.districtId}/civil/rule/${r.last}`);
    await expect(page.locator('.parsed-text')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('parsed rules support search, comparison with source, bookmarks and accessible reading',async({page},info)=>{
  await page.goto('./#/search?q=Rule%2056.1&district=mad');
  await expect(page.locator('.search-result')).toHaveCount(1);
  await page.locator('.search-result').click();
  await expect(page.locator('.reader-heading h1')).toHaveText(/SUMMARY JUDGMENT/);
  await expect(page.locator('.parsed-text')).toContainText(/material facts/);
  await page.locator('#bookmark').click();
  await page.screenshot({path:`test-results/parsed-${info.project.name}.png`,fullPage:true});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('link',{name:'Compare with the source document'}).click();await expect(page.locator('.source-page')).toBeVisible();
  await page.goto('./#/bookmarks');await page.locator('.bookmark-row a').click();await expect(page.locator('.parsed-text')).toBeVisible();
});
test('offline package includes structured rules and search without fetching other district indexes',async({page,context})=>{
  const indexes=[];page.on('request',r=>{if(r.url().endsWith('/search.json'))indexes.push(r.url())});
  await page.goto('./#/settings?district=mad');await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.reload();
  await page.locator('#package-filter').fill('Massachusetts');await page.locator('[data-install="mad"]').click();
  await expect(page.locator('.package:visible')).toContainText('Installed');
  await context.setOffline(true);await page.reload();
  await page.goto('./#/district/mad/civil/rule/56.1');await expect(page.locator('.parsed-text')).toBeVisible();
  await page.goto('./#/search?q=Rule%2056.1&district=mad&scope=district');await expect(page.locator('.search-result')).toHaveCount(1);
  expect(indexes.every(u=>u.includes('/mad-civil/')||u.includes('/federal-'))).toBeTruthy();
});
