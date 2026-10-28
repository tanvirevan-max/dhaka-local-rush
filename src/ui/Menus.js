// Menu screens: start (bus select), how-to-play, pause, settings, game over. Plain DOM + event delegation.
// Game.js passes callbacks; this file never touches game state directly.
import { PLAYER_BUSES } from '../config/gameConfig.js';
import { fmtScore, fmtTime } from '../game/utils.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const pct = (v) => Math.round(Math.max(0, Math.min(1, v)) * 100);

const SLIDERS = [
  ['master', 'মাস্টার ভলিউম', 'Master'],
  ['engine', 'ইঞ্জিন', 'Engine'],
  ['traffic', 'ট্রাফিক ও পরিবেশ', 'Traffic & ambience'],
  ['voice', 'কণ্ঠস্বর', 'Voice'],
  ['effects', 'শব্দ প্রভাব', 'Effects'],
];

const REASONS = {
  busted: { bn: 'পুলিশ ধরে ফেলেছে!', en: 'BUSTED', note: 'পুলিশ বাস থামিয়ে দিয়েছে। Police stopped your bus.' },
  wrecked: { bn: 'গাড়ি শেষ!', en: 'WRECKED', note: 'বাসের ক্ষতি সামলানো গেল না। Your bus is too damaged to continue.' },
};

export class Menus {
  /**
   * @param {HTMLElement} root
   * @param {object} api { settings, best(), onPlay(busId), onResume(), onRestart(), onMenu(), onSettings(settings), bengaliVoice():boolean }
   */
  constructor(root, api) {
    this.root = root;
    this.api = api;
    this.screen = null;
    this.backTo = 'start';
    this.result = null;
    root.addEventListener('click', (e) => this._click(e));
    root.addEventListener('input', (e) => this._input(e));
    root.addEventListener('change', (e) => this._input(e));
  }

  get visible() { return !this.root.classList.contains('hidden'); }
  hide() { this.screen = null; this.root.classList.add('hidden'); this.root.innerHTML = ''; }

  _mount(name, html, cls = '') {
    this.screen = name;
    this.root.classList.remove('hidden');
    this.root.innerHTML = `<div class="screen ${name} ${cls}"><div class="card">${html}</div></div>`;
    const first = this.root.querySelector('[data-autofocus]');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  }

  // ---- screens -------------------------------------------------------------------------------------
  showStart() {
    this.backTo = 'start';
    const s = this.api.settings;
    const cards = PLAYER_BUSES.map((b) => {
      const speed = pct(b.maxSpeed / 32), acc = pct(b.accel / 7.2), han = pct(b.steer / 1.3), wt = pct(b.mass / 11500);
      return `<button class="bus-card ${b.id === s.busId ? 'sel' : ''}" data-act="bus" data-id="${b.id}" aria-pressed="${b.id === s.busId}">
        <span class="swatch" style="--c:${hex(b.color)};--a:${hex(b.accent)};--t:${hex(b.trim)}"><i></i><i></i><i></i></span>
        <b>${b.name}</b><small>${b.en}</small>
        <span class="stat"><em>গতি</em><u style="--w:${speed}%"></u></span>
        <span class="stat"><em>এক্সেল</em><u style="--w:${acc}%"></u></span>
        <span class="stat"><em>ঘোরানো</em><u style="--w:${han}%"></u></span>
        <span class="stat"><em>ওজন</em><u style="--w:${wt}%"></u></span>
      </button>`;
    }).join('');
    const best = this.api.best();
    this._mount('start', `
      <div class="logo"><span class="kicker">মিরপুর – বাড্ডা – আগারগাঁও</span><h1>ঢাকা লোকাল রাশ</h1><h2>DHAKA LOCAL RUSH</h2></div>
      <p class="tag">ঢাকার ব্যস্ত রাস্তায় লোকাল বাস চালান। জ্যাম কাটুন, যাত্রী তুলুন, পুলিশকে ফাঁকি দিন!<br><small>Drive a chaotic local bus through Dhaka traffic. Weave, pick up passengers, escape the police.</small></p>
      <div class="bus-row">${cards}</div>
      <div class="best-row">সর্বোচ্চ স্কোর <small>BEST</small> <b>${fmtScore(best)}</b></div>
      <div class="btn-row">
        <button class="btn primary big" data-act="play" data-autofocus>▶ চালু করুন <small>PLAY</small></button>
        <button class="btn" data-act="howto">কীভাবে খেলবেন <small>HOW TO PLAY</small></button>
        <button class="btn" data-act="settings">সেটিংস <small>SETTINGS</small></button>
      </div>
      <p class="foot">WASD / ↑↓←→ চালান · Shift বুস্ট · Space হর্ন · Esc বিরতি &nbsp;|&nbsp; মোবাইলে স্ক্রিনের বাটন ব্যবহার করুন</p>`);
  }

  showTutorial(from = 'start', onDone = null) {
    this.backTo = from;
    this._onTutorialDone = onDone;
    this._mount('howto', `
      <h2>কীভাবে খেলবেন <small>How to play</small></h2>
      <div class="how-grid">
        <div class="how"><b>🚌 চালান</b><p>গ্যাস চেপে বাস ছোটান। বাঁ-দিক দিয়ে চলুন, ডান দিকে উল্টো পথের গাড়ি আসে।<br><small>Stay on the left carriageway. Oncoming traffic is on the right.</small></p></div>
        <div class="how"><b>⚡ ফাঁক গলুন</b><p>রিকশা, সিএনজি, বাইকের গা ঘেঁষে গেলে নিয়ার-মিস পয়েন্ট। টানা কম্বোতে মাল্টিপ্লায়ার বাড়ে।<br><small>Near misses and tight gaps build a combo multiplier.</small></p></div>
        <div class="how"><b>🚏 যাত্রী তুলুন</b><p>রাস্তার বাঁ-পাশে হলুদ বাস-স্টপে ধীরে থামুন (৭ মি/সে-র নিচে) ১ সেকেন্ড। বোনাস ও গাড়ি মেরামত।<br><small>Stop in the yellow bay at the kerb to board passengers.</small></p></div>
        <div class="how"><b>🚓 পুলিশ</b><p>ধাক্কা বা উল্টো পথে চললে তাপ বাড়ে। ১০০ হলে পুলিশ ধাওয়া করে — দূরে সরে ফাঁকি দিন, নইলে ধরা!<br><small>Heat rises when you crash or drive on the wrong side. Escape or get busted.</small></p></div>
        <div class="how"><b>🔥 বুস্ট</b><p>Shift চেপে ধরলে বুস্ট। এনার্জি ফুরোলে ধীরে ফিরে আসে; বুস্টে ঘোরানো কঠিন।<br><small>Hold Shift. Energy refills slowly; steering is heavier while boosting.</small></p></div>
        <div class="how"><b>💥 ধাক্কা</b><p>ভারী বাস হালকা গাড়ি ঠেলে সরায়, কিন্তু জোরে ধাক্কা লাগলে স্কোর ও বাসের স্বাস্থ্য কমে।<br><small>Hard hits cost score and body integrity. 0 % = wreck.</small></p></div>
      </div>
      <div class="keys">
        <span><kbd>W</kbd><kbd>↑</kbd> গ্যাস</span><span><kbd>S</kbd><kbd>↓</kbd> ব্রেক/রিভার্স</span><span><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> স্টিয়ার</span>
        <span><kbd>Shift</kbd> বুস্ট</span><span><kbd>Space</kbd> হর্ন</span><span><kbd>R</kbd> রিস্টার্ট</span><span><kbd>Esc</kbd> বিরতি</span>
      </div>
      <div class="btn-row"><button class="btn primary" data-act="tutorialDone" data-autofocus>বুঝেছি <small>GOT IT</small></button></div>`);
  }

  showPause() {
    this.backTo = 'pause';
    this._mount('pause', `
      <h2>বিরতি <small>PAUSED</small></h2>
      <div class="btn-col">
        <button class="btn primary" data-act="resume" data-autofocus>▶ চালিয়ে যান <small>RESUME</small></button>
        <button class="btn" data-act="restart">↻ আবার শুরু <small>RESTART</small></button>
        <button class="btn" data-act="howto">কীভাবে খেলবেন <small>HOW TO PLAY</small></button>
        <button class="btn" data-act="settings">সেটিংস <small>SETTINGS</small></button>
        <button class="btn ghost" data-act="menu">মূল মেনু <small>MAIN MENU</small></button>
      </div>`);
  }

  showSettings(from = this.backTo) {
    this.backTo = from;
    const s = this.api.settings;
    const sliders = SLIDERS.map(([k, bn, en]) => `
      <label class="row"><span>${bn} <small>${en}</small></span>
        <input type="range" min="0" max="1" step="0.05" value="${s[k]}" data-set="${k}" aria-label="${en}">
        <output>${Math.round(s[k] * 100)}</output></label>`).join('');
    const voiceNote = this.api.bengaliVoice()
      ? 'আপনার ব্রাউজারে বাংলা কণ্ঠ পাওয়া গেছে।'
      : 'এই ডিভাইসে বাংলা কণ্ঠ নেই — সংলাপ সাবটাইটেলে দেখানো হবে। (No Bengali TTS voice found: dialogue appears as subtitles.)';
    this._mount('settings', `
      <h2>সেটিংস <small>SETTINGS</small></h2>
      <div class="settings">
        ${sliders}
        <label class="row"><span>গ্রাফিক্স <small>Quality</small></span>
          <select data-set="quality">
            <option value="auto" ${s.quality === 'auto' ? 'selected' : ''}>অটো / Auto</option>
            <option value="high" ${s.quality === 'high' ? 'selected' : ''}>উচ্চ / High</option>
            <option value="low" ${s.quality === 'low' ? 'selected' : ''}>কম / Low (fast)</option>
          </select><output></output></label>
        <label class="row check"><span>ক্যামেরা ঝাঁকুনি <small>Camera shake</small></span><input type="checkbox" data-set="shake" ${s.shake ? 'checked' : ''}><output></output></label>
        <label class="row check"><span>সাবটাইটেল <small>Subtitles</small></span><input type="checkbox" data-set="subtitles" ${s.subtitles ? 'checked' : ''}><output></output></label>
        <p class="note">${voiceNote}</p>
        <p class="note">গ্রাফিক্স পরিবর্তন পরের রান থেকে কার্যকর হবে। <small>Quality changes apply on the next run.</small></p>
      </div>
      <div class="btn-row"><button class="btn primary" data-act="back" data-autofocus>← ফিরে যান <small>BACK</small></button></div>`);
  }

  showGameOver(result, reason = 'wrecked') {
    this.backTo = 'gameover';
    this.result = result;
    const r = REASONS[reason] || REASONS.wrecked;
    const st = result.stats;
    const cell = (bn, en, v) => `<div class="cell"><b>${v}</b><span>${bn} <small>${en}</small></span></div>`;
    this._mount('gameover', `
      <div class="over-head ${reason}"><h1>${r.bn}</h1><h2>${r.en}</h2></div>
      <p class="tag">${r.note}</p>
      <div class="final"><span>স্কোর <small>SCORE</small></span><b>${fmtScore(result.score)}</b>
        ${result.newBest ? '<em class="newbest">নতুন রেকর্ড! <small>NEW BEST</small></em>' : `<span class="bestline">সেরা <small>BEST</small> ${fmtScore(result.best)}</span>`}
      </div>
      <div class="stats">
        ${cell('দূরত্ব', 'Distance', Math.round(st.distance) + ' m')}
        ${cell('সময়', 'Time', fmtTime(st.time))}
        ${cell('নিয়ার মিস', 'Near misses', st.nearMisses)}
        ${cell('ফাঁক গলা', 'Tight gaps', st.tightGaps)}
        ${cell('সর্বোচ্চ কম্বো', 'Best combo', st.maxCombo)}
        ${cell('যাত্রী', 'Passengers', st.passengers)}
        ${cell('পুলিশ ফাঁকি', 'Escapes', st.escapes)}
        ${cell('রুট সম্পূর্ণ', 'Routes', st.routes)}
      </div>
      <div class="btn-row">
        <button class="btn primary big" data-act="restart" data-autofocus>↻ আবার খেলুন <small>PLAY AGAIN</small></button>
        <button class="btn" data-act="menu">মূল মেনু <small>MENU</small></button>
      </div>`);
  }

  // ---- events --------------------------------------------------------------------------------------
  _click(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const a = this.api;
    switch (act) {
      case 'bus':
        a.settings.busId = el.dataset.id;
        a.onSettings(a.settings);
        this.root.querySelectorAll('.bus-card').forEach((c) => { const on = c.dataset.id === el.dataset.id; c.classList.toggle('sel', on); c.setAttribute('aria-pressed', on); });
        break;
      case 'play': a.onPlay(a.settings.busId); break;
      case 'howto': this.showTutorial(this.screen === 'pause' ? 'pause' : 'start'); break;
      case 'tutorialDone': {
        const cb = this._onTutorialDone; this._onTutorialDone = null;
        if (cb) cb(); else if (this.backTo === 'pause') this.showPause(); else this.showStart();
        break;
      }
      case 'settings': this.showSettings(this.screen === 'pause' ? 'pause' : 'start'); break;
      case 'back': if (this.backTo === 'pause') this.showPause(); else this.showStart(); break;
      case 'resume': a.onResume(); break;
      case 'restart': a.onRestart(); break;
      case 'menu': a.onMenu(); break;
      default: break;
    }
  }

  _input(e) {
    const t = e.target;
    const key = t.dataset && t.dataset.set;
    if (!key) return;
    const s = this.api.settings;
    if (t.type === 'checkbox') s[key] = t.checked;
    else if (t.type === 'range') {
      s[key] = Number(t.value);
      const out = t.parentElement.querySelector('output');
      if (out) out.textContent = Math.round(s[key] * 100);
    } else s[key] = t.value;
    this.api.onSettings(s);
  }
}
