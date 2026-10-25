// Real-interaction QA: keyboard paging, quiz clicks, narration playback, subtitles, chrome state.
// Run from a folder where `playwright` resolves, e.g.:
//   node --experimental-vm-modules "<proj>/build/qa_flow.mjs" http://localhost:8792/
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
import fs from 'node:fs';
const require = createRequire('D:/secondbrain/Skills/huashu-design/node_modules/noop.js');
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:8792/';
const out = path.join(HERE, '..', 'qa');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const SYS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const launchOpts = { args: ['--autoplay-policy=no-user-gesture-required'] };
let browser;
try { browser = await chromium.launch(launchOpts); }
catch { browser = await chromium.launch({ ...launchOpts, executablePath: SYS.find(p => fs.existsSync(p)) }); }
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url);
await page.waitForTimeout(600);

check('start overlay shown', await page.isVisible('#start'));
await page.click('#goSelf');

// DICE cards appear one letter per step (D, I, C, E), then the callout
await page.evaluate(() => window.__deck.go(2, 1));
const seq = [];
for (let k = 0; k < 5; k++) {
  await page.waitForTimeout(80);
  seq.push(await page.evaluate(() => [...document.querySelectorAll('.slide.active .dcard.on .L')].map(e => e.textContent[0]).join('') + (document.querySelector('.slide.active .callout.on') ? '+' : '')));
  await page.keyboard.press('ArrowRight');
}
check('DICE reveals one letter per step', seq.join(',') === ',D,DI,DIC,DICE', seq.join(','));
const diceBeats = await page.evaluate(() => window.BEATS.filter(b => b.slide === 3).map(b => b.step).join(''));
check('DICE narration beats map to steps 1-6', diceBeats === '123456', diceBeats);
await page.evaluate(() => window.__deck.go(0, 1));

// page to scenario ③ (slide 7) step 1 with the keyboard
const state = () => page.evaluate(() => ({ cur: [...document.querySelectorAll('.slide')].findIndex(s => s.classList.contains('active')) + 1, step: window.__deck.step, chap: document.getElementById('chap').textContent, num: document.getElementById('num').textContent, sq: [...document.querySelectorAll('#sq i')].map(i => i.className || '-').join(',') }));
for (let i = 0; i < 40; i++) {
  const s = await state();
  if (s.cur === 7 && s.step === 1) break;
  await page.keyboard.press('ArrowRight');
}
let s = await state();
check('keyboard reaches slide 7 step 1', s.cur === 7 && s.step === 1, JSON.stringify(s));
check('chapter pill follows slide', s.chap === '情境 ③', s.chap);
check('page number follows slide', s.num === '07 / 13', s.num);
check('scenario squares: 2 done, 3rd current', s.sq.startsWith('done,done,now'), s.sq);
const hiddenBefore = await page.evaluate(() => [...document.querySelectorAll('.slide.active .opt')].filter(o => o.classList.contains('shown')).length);
check('verdicts hidden before answering', hiddenBefore === 0, `${hiddenBefore} shown`);
await page.screenshot({ path: path.join(out, 'flow_s07_question.png') });

// quiz: click B only
await page.click('.slide.active .opt:nth-child(2)');
await page.waitForTimeout(500);
const shown = await page.evaluate(() => [...document.querySelectorAll('.slide.active .opt')].map(o => o.classList.contains('shown') ? 1 : 0).join(''));
check('clicking B reveals only B', shown === '010', shown);
await page.screenshot({ path: path.join(out, 'flow_s07_clickB.png') });

// narration playback from this point
await page.click('#bPlay');
await page.waitForTimeout(3500);
const play = await page.evaluate(() => { const v = document.getElementById('voice'); const b = document.getElementById('bgm'); return { src: v.getAttribute('src'), t: v.currentTime, paused: v.paused, sub: document.getElementById('sub').textContent, subOn: document.getElementById('sub').classList.contains('on'), bgmPlaying: !b.paused, bgmVol: b.volume }; });
check('narration plays the beat for the step on screen', play.src === 'audio/tts/s07b1.mp3' && play.t > 1 && !play.paused, JSON.stringify(play));
check('subtitle visible with text', play.subOn && play.sub.length > 3, play.sub);
check('music bed playing and ducked under voice', play.bgmPlaying && play.bgmVol < 1, `vol ${play.bgmVol}`);
await page.screenshot({ path: path.join(out, 'flow_s07_playing.png') });

// jump near the end of the beat to check auto-advance to the next step
// let the beat finish naturally (python http.server has no Range support, so seeking is unreliable)
await page.waitForFunction(() => document.getElementById('voice').getAttribute('src') !== 'audio/tts/s07b1.mp3', null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(300);
s = await state();
const src2 = await page.evaluate(() => document.getElementById('voice').getAttribute('src'));
check('auto-advance to next beat/step', s.step === 2 && src2 === 'audio/tts/s07b2.mp3', `${JSON.stringify(s)} ${src2}`);
await page.keyboard.press(' ');
const paused = await page.evaluate(() => document.getElementById('voice').paused);
check('space pauses', paused);

// hash deep link + scorecard
await page.goto(url.replace(/#.*$/, '') + '?nostart#11');
await page.waitForTimeout(500);
s = await state();
check('hash deep link #11', s.cur === 11 && s.chap === '六題成績單', JSON.stringify(s));
check('all six squares done on scorecard', s.sq === 'done,done,done,done,done,done', s.sq);

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
