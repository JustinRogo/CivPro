import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile} from 'node:fs/promises';
const library=JSON.parse(await readFile('data/source-library.json','utf8'));

test('every district opens a stored source and exposes the matching offline package',async({page})=>{
  await page.goto('./');
  for(const row of library.districts){
    await page.goto(`./#/district/${row.id}/sources`);
    await expect(page.locator('#district')).toHaveValue(row.id);
    await expect(page.locator('.source-page')).toBeVisible();
    await expect(page.locator('#source-document option')).toHaveCount(row.documents.length);
  }
  await page.goto('./#/settings');
  await page.locator('#package-filter').fill('Massachusetts');
  await expect(page.locator('.package:visible')).toHaveCount(1);
  await expect(page.locator('[data-install="mad"]')).toBeVisible();
});

test('all districts selectable, source navigation, bookmarks, search, mobile layout',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./#/district/ctd/civil/rule/56?district=ctd');
  await expect(page.locator('#district option')).toHaveCount(95);
  await page.locator('#district').selectOption('mad');
  await expect(page.locator('.source-page')).toBeVisible();
  await expect(page.getByRole('heading',{name:'District of Massachusetts',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Open stored PDF'})).toBeVisible();
  await page.locator('#source-page').fill('20');await page.getByRole('button',{name:'Go',exact:true}).click();
  await expect(page.locator('.source-page h2')).toHaveText('Page 20');
  await page.locator('#source-bookmark').click();
  await page.locator('#source-query').fill('"summary judgment"');await page.getByRole('button',{name:'Search document'}).click();
  await expect(page.locator('.source-result').first()).toBeVisible();
  await page.locator('.source-result').first().click();
  await expect(page.locator('.source-text')).toContainText(/summary judgment/i);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:`test-results/district-${info.project.name}.png`,fullPage:true});
  await page.goto('./#/bookmarks');await expect(page.locator('.bookmark-row')).toHaveCount(1);
  await page.locator('.bookmark-row a').click();await expect(page.locator('.source-page h2')).toHaveText('Page 20');
  await page.goto('./#/search?q=%22summary%20judgment%22&district=mad&scope=district');
  await expect(page.locator('#source-results .source-result').first()).toBeVisible();
  await page.locator('#district').selectOption('ctd');
  await expect(page.locator('#source-results')).toBeEmpty();
  expect(errors).toEqual([]);
});

test('HTML sources and upcoming editions remain distinguishable',async({page})=>{
  await page.goto('./#/district/ord/sources');
  await expect(page.locator('#district')).toHaveValue('ord');
  await expect(page.locator('.source-page h2')).toHaveText('Section 1');
  await expect(page.getByRole('link',{name:'Open stored PDF'})).toHaveCount(0);
  await page.locator('#source-query').fill('discovery');await page.getByRole('button',{name:'Search document'}).click();
  await expect(page.locator('.source-result').first()).toBeVisible();
  await page.locator('#district').selectOption('miwd');
  await expect(page.locator('.source-page h2')).toHaveText('Section 1');
  await expect(page.getByRole('link',{name:'Official web edition'})).toBeVisible();
  await page.locator('#source-document').selectOption({index:1});
  await expect(page.locator('.notice').filter({hasText:'Upcoming edition.'})).toBeVisible();
  await expect(page.locator('.source-page h2')).toHaveText('Page 1');
});

test('district package serves unvisited text and the PDF offline; other districts report unavailable',async({page,context})=>{
  await page.goto('./#/settings?district=mad');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.reload();
  await page.locator('[data-install="mad"]').click();
  await expect(page.locator('.package').filter({has:page.locator('[data-install="mad"]')})).toContainText('Installed');
  await context.setOffline(true);await page.reload();
  await page.goto('./#/district/mad/sources?page=30');await expect(page.locator('.source-page h2')).toHaveText('Page 30');
  const pdf=await page.getByRole('link',{name:'Open stored PDF'}).getAttribute('href');
  expect(await page.evaluate(async url=>{const r=await fetch(url.split('#')[0]);return r.ok&&(await r.text()).startsWith('%PDF-')},pdf)).toBeTruthy();
  await page.locator('#source-query').fill('discovery');await page.getByRole('button',{name:'Search document'}).click();
  await expect(page.locator('.source-result').first()).toBeVisible();
  await page.locator('#district').selectOption('alnd');
  await expect(page.getByRole('heading',{name:'This page is unavailable'})).toBeVisible();
});
