import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('library, source citations, federal-only mode, and reverse links',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');await expect(page.getByRole('heading',{name:'The rules. In context.'})).toBeVisible();
  const a11y=await new AxeBuilder({page}).analyze();expect(a11y.violations).toEqual([]);
  await page.screenshot({path:`test-results/home-${info.project.name}.png`,fullPage:true,animations:'disabled'});
  await page.goto('./#/federal/frcp/rule/56?district=ctd');
  await expect(page.getByRole('heading',{name:'Summary Judgment',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/D. Conn. L. Civ. R. 56/})).toBeVisible();
  await expect(page.locator('.comparison')).toBeVisible();
  await expect(page.locator('.comparison')).toContainText('twelve (12) double-spaced pages');
  await expect(page.locator('.rule-body')).not.toContainText('twelve (12) double-spaced pages');
  await page.screenshot({path:`test-results/reader-${info.project.name}.png`,fullPage:true});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Bookmark',exact:false}).click();
  await page.locator('#district').selectOption('none');
  await expect(page.locator('.related-panel')).toContainText('Select a district');
  await page.goto('./#/district/ctd/civil/rule/56?district=ctd');
  await expect(page.locator('#district')).toHaveValue('ctd');
  await expect(page.locator('.related-panel')).toContainText('Fed. R. Civ. P. 56');
  await page.goto('./#/bookmarks');await expect(page.locator('.bookmark-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('citation and Boolean search, paragraph links, history, and print',async({page})=>{
  await page.goto('./#/search?q=Rule%2026(b)(1)&district=ctd');
  await expect(page.locator('.search-result')).toHaveCount(2);
  await page.locator('.search-result').filter({hasText:'Fed. R. Civ. P. 26'}).click();
  await expect(page.locator('[data-anchor="b/1"]')).toBeFocused();
  await expect(page.locator('[data-anchor="b/1"]')).toContainText('proportional');
  await page.goBack();await expect(page.locator('#query')).toHaveValue('Rule 26(b)(1)');
  await page.locator('#query').fill('"summary judgment" AND NOT "twelve"');
  await expect(page.locator('.search-result').first()).toBeVisible();
  await expect(page.locator('#results-info')).not.toContainText('Searching');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.goto('./#/federal/frcp/rule/56');await expect(page.locator('.rule-body')).toBeVisible();
  await page.emulateMedia({media:'print'});await expect(page.locator('.rail')).not.toBeVisible();await expect(page.locator('.rule-body')).toBeVisible();
});
test('settings, dark appearance, accessibility, and unsupported district',async({page})=>{
  await page.goto('./#/settings');await page.locator('#theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.goto('./#/federal/frcp/rule/56?district=nyd');await expect(page.getByRole('heading',{name:'Unsupported district'})).toBeVisible();
});
test('verified packages support fresh offline reader and search; removal preserves bookmarks',async({page,context})=>{
  await page.goto('./#/federal/frcp/rule/56?district=ctd');await page.getByRole('button',{name:'Bookmark',exact:false}).click();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});
  await page.reload();await page.goto('./#/settings');
  await page.locator('[data-install="federal"]').click();
  await expect(page.locator('.package').first()).toContainText('Installed');
  await page.locator('[data-install="ctd"]').click();
  await expect(page.locator('.package').nth(1)).toContainText('Installed');
  await context.setOffline(true);
  await page.goto('./#/federal/frcp/rule/4.1?district=ctd');await expect(page.getByRole('heading',{name:'Serving Other Process',exact:true})).toBeVisible();
  await page.goto('./#/district/ctd/civil/rule/83.10?district=ctd');await expect(page.getByRole('heading',{name:'CIVIL PRO BONO PANEL',exact:true})).toBeVisible();
  await page.goto('./#/search?q=FRCP%2056&district=ctd');await expect(page.locator('.search-result')).toHaveCount(1);await expect(page.locator('#coverage')).toBeEmpty();
  await page.goto('./#/settings');await page.locator('[data-delete="ctd"]').click();await expect(page.locator('.package').nth(1)).toContainText('Not downloaded');
  await page.goto('./#/district/ctd/civil/rule/5?district=ctd');await expect(page.getByRole('heading',{name:'This page is unavailable'})).toBeVisible();
  await page.goto('./#/bookmarks');await expect(page.locator('.bookmark-row')).toHaveCount(1);
});


test('same-number district rule is expanded beside federal text and stacks on mobile',async({page},info)=>{
  await page.goto('./#/federal/frcp/rule/3?district=ctd');
  const panel=page.locator('.reader-paired .related-panel');
  await expect(panel).toContainText('D. Conn. L. Civ. R. 3');
  await expect(panel).toContainText('Same rule number');
  await expect(panel.locator('.comparison')).toBeVisible();
  const federal=await page.locator('.reader-paired>article').boundingBox();
  const local=await panel.boundingBox();
  if(info.project.name==='mobile')expect(local.y).toBeGreaterThanOrEqual(federal.y+federal.height);
  else expect(local.x).toBeGreaterThanOrEqual(federal.x+federal.width);
  await page.locator('#district').selectOption('none');
  await expect(page.locator('.reader-paired')).toHaveCount(0);
  await expect(page.locator('.comparison')).toHaveCount(0);
});
