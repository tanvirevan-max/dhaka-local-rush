// In-game HUD (plain DOM, styled by src/styles.css). Everything is bilingual: Bangla first, small English hint.
// Game.js calls hud.update(state) every frame; DOM writes are cached so unchanged values cost nothing.
import { fmtScore, isTouchDevice } from '../game/utils.js';

const WHO = {
  helper: 'হেল্পার', driver: 'চালক', rick: 'রিকশাওয়ালা', ped: 'পথচারী', pass: 'যাত্রী', police: 'পুলিশ',
};

const TEMPLATE = /* html */ `
<div class="hud">
  <div class="hud-top">
    <div class="panel score-panel">
      <div class="lbl">স্কোর <small>SCORE</small></div>
      <div class="val" data-k="score">0</div>
      <div class="sub">সেরা <small>BEST</small> <b data-k="best">0</b></div>
    </div>
    <div class="combo hidden" data-k="combo">
      <div class="mult" data-k="mult">x1.5</div>
      <div class="combo-meta"><span data-k="comboN">3</span> কম্বো <small>COMBO</small></div>
      <div class="combo-bar"><i data-k="comboBar"></i></div>
    </div>
    <div class="top-right">
      <div class="zone-chip" data-k="zone"><b data-k="zoneName">বাড্ডা</b><small data-k="zoneEn">Badda</small><div class="zone-bar"><i data-k="zoneBar"></i></div></div>
      <button class="icon-btn" data-k="pause" aria-label="Pause">❚❚</button>
    </div>
  </div>

  <div class="police hidden" data-k="police">
    <div class="police-head"><span class="siren"></span><b data-k="policeTitle">পুলিশ পিছনে!</b><span class="stars" data-k="stars"></span></div>
    <div class="meter heat" data-k="heatRow"><label>তাপ <small>HEAT</small></label><div class="bar"><i data-k="heatBar"></i></div></div>
    <div class="meter bust" data-k="bustRow"><label>ধরা <small>BUSTED</small></label><div class="bar"><i data-k="bustBar"></i></div></div>
    <div class="meter escape" data-k="escRow"><label>পালানো <small>ESCAPE</small></label><div class="bar"><i data-k="escBar"></i></div></div>
  </div>

  <div class="mission">
    <div class="route"><span>রুট <small>ROUTE</small></span><div class="bar"><i data-k="routeBar"></i></div><span class="pax">🧍 <b data-k="pax">0</b></span></div>
    <div class="next hidden" data-k="next">
      <span class="stop-ic">🚏</span><span data-k="nextText">বাস স্টপ ৮০ মি</span>
      <div class="dwell"><i data-k="dwellBar"></i></div>
    </div>
    <div class="jam hidden" data-k="jam">⚠ সামনে জ্যাম <small>JAM AHEAD</small></div>
  </div>

  <div class="gauges">
    <div class="speed"><b data-k="speed">0</b><small>কিমি/ঘ <em>km/h</em></small></div>
    <div class="bars">
      <div class="meter boost" data-k="boostRow"><label>বুস্ট <small>BOOST</small></label><div class="bar"><i data-k="boostBar"></i></div></div>
      <div class="meter hull" data-k="hullRow"><label>গাড়ি <small>BODY</small></label><div class="bar"><i data-k="hullBar"></i></div></div>
    </div>
  </div>

  <div class="popups" data-k="popups"></div>
  <div class="subtitle hidden" data-k="sub"><span class="who" data-k="subWho"></span><span data-k="subText"></span></div>
  <div class="banner hidden" data-k="banner"><small data-k="bannerKicker"></small><b data-k="bannerName"></b><span data-k="bannerEn"></span></div>
  <div class="vignette" data-k="vig"></div>

  <div class="touch">
    <div class="touch-left">
      <button class="tbtn steer" data-a="left" aria-label="Left">◀</button>
      <button class="tbtn steer" data-a="right" aria-label="Right">▶</button>
    </div>
    <div class="touch-mid">
      <button class="tbtn small" data-a="horn" aria-label="Horn">📯<span>হর্ন</span></button>
      <button class="tbtn small boostbtn" data-a="boost" aria-label="Boost">⚡<span>বুস্ট</span></button>
    </div>
    <div class="touch-right">
      <button class="tbtn brakebtn" data-a="brake" aria-label="Brake">ব্রেক<span>BRAKE</span></button>
      <button class="tbtn gas" data-a="accel" aria-label="Accelerate">গ্যাস<span>GAS</span></button>
    </div>
  </div>
</div>`;

export class HUD {
  constructor(root, input) {
    this.root = root;
    this.input = input;
    root.innerHTML = TEMPLATE;
    this.el = {};
    root.querySelectorAll('[data-k]').forEach((n) => { this.el[n.dataset.k] = n; });
    this.cache = {};
    this.onPause = null;
    this.subTimer = 0;
    this.bannerTimer = 0;
    this.vigTimer = 0;
    root.querySelectorAll('[data-a]').forEach((b) => input.bindButton(b, b.dataset.a));
    this.el.pause.addEventListener('click', () => this.onPause && this.onPause());
    const forceTouch = /[?&]touch=1/.test(location.search);
    this.setTouch(forceTouch || isTouchDevice());
    this.show(false);
  }

  show(on) { this.root.classList.toggle('hidden', !on); }
  setTouch(on) { this.root.classList.toggle('has-touch', !!on); }

  _set(key, value, prop = 'textContent') {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    this.el[key][prop] = value;
  }
  _width(key, f) {
    const v = Math.round(Math.max(0, Math.min(1, f)) * 1000) / 10;
    if (this.cache['w' + key] === v) return;
    this.cache['w' + key] = v;
    this.el[key].style.width = v + '%';
  }
  _cls(key, name, on) {
    const k = key + ':' + name;
    if (this.cache[k] === on) return;
    this.cache[k] = on;
    this.el[key].classList.toggle(name, on);
  }

  /** s: see Game.hudState() */
  update(s) {
    this._set('score', fmtScore(s.score));
    this._set('best', fmtScore(s.best));
    this._set('speed', String(Math.round(s.speedKmh)));
    this._width('boostBar', s.boost01);
    this._cls('boostRow', 'active', s.boosting);
    this._cls('boostRow', 'low', s.boost01 < 0.22 && !s.boosting);
    this._width('hullBar', s.integrity01);
    this._cls('hullRow', 'low', s.integrity01 < 0.3);

    // combo
    const showCombo = s.combo >= 2 || s.multiplier > 1;
    this._cls('combo', 'hidden', !showCombo);
    if (showCombo) {
      this._set('mult', 'x' + s.multiplier.toFixed(1).replace('.0', ''));
      this._set('comboN', String(s.combo));
      this._width('comboBar', s.comboTimer01);
    }

    // zone
    if (s.zone) {
      this._set('zoneName', s.zone.name);
      this._set('zoneEn', s.zone.en);
      this._width('zoneBar', s.zoneProgress01);
    }

    // mission
    this._width('routeBar', s.routeProgress01);
    this._set('pax', String(s.passengers));
    const nx = s.next;
    this._cls('next', 'hidden', !nx || nx.dist > 220);
    if (nx && nx.dist <= 220) {
      this._set('nextText', nx.dist > 12 ? `বাস স্টপ ${Math.round(nx.dist)} মি` : 'থামুন! যাত্রী উঠছে');
      this._width('dwellBar', nx.dwell01);
      this._cls('next', 'near', nx.dist < 60);
    }
    this._cls('jam', 'hidden', !s.jam);

    // police
    const p = s.police;
    const showPolice = p.state !== 'none';
    this._cls('police', 'hidden', !showPolice);
    if (showPolice) {
      const chase = p.state === 'chase';
      this._cls('police', 'chase', chase);
      this._set('policeTitle', chase ? 'পুলিশ ধাওয়া করছে!' : 'পুলিশ সন্দেহ করছে…');
      this._set('stars', chase ? '★'.repeat(p.level) + '☆'.repeat(Math.max(0, p.maxLevel - p.level)) : '');
      this._cls('heatRow', 'hidden', chase);
      this._cls('bustRow', 'hidden', !chase);
      this._cls('escRow', 'hidden', !chase);
      this._width('heatBar', p.heat01);
      this._width('bustBar', p.bust01);
      this._width('escBar', p.escape01);
    }
  }

  // ---- transient things -----------------------------------------------------------------------------
  /** Score pop-up. kind: good | bad | info */
  popup(text, sub = '', kind = 'good') {
    const box = this.el.popups;
    while (box.childElementCount >= 4) box.firstElementChild.remove();
    const d = document.createElement('div');
    d.className = 'pop ' + kind;
    d.innerHTML = `<b></b><span></span>`;
    d.firstChild.textContent = text;
    d.lastChild.textContent = sub;
    box.appendChild(d);
    setTimeout(() => d.remove(), 1500);
  }

  subtitle(line, seconds = 2.5) {
    this._cls('sub', 'hidden', false);
    this.el.subWho.textContent = WHO[line.who] || '';
    this.el.subWho.dataset.who = line.who;
    this.el.subText.textContent = line.t;
    this.subTimer = seconds;
  }
  hideSubtitle() { this.subTimer = 0; this._cls('sub', 'hidden', true); }

  banner(kicker, name, en, seconds = 3) {
    this.el.bannerKicker.textContent = kicker;
    this.el.bannerName.textContent = name;
    this.el.bannerEn.textContent = en;
    this._cls('banner', 'hidden', false);
    this.el.banner.classList.remove('play');
    void this.el.banner.offsetWidth;
    this.el.banner.classList.add('play');
    this.bannerTimer = seconds;
  }

  /** kind: hit | boost | police | good */
  flash(kind) {
    const v = this.el.vig;
    v.className = 'vignette';
    void v.offsetWidth;
    v.classList.add('flash', kind);
    this.vigTimer = 0.6;
  }

  tick(dt, subtitlesOn = true) {
    if (this.subTimer > 0) {
      this.subTimer -= dt;
      if (this.subTimer <= 0) this.hideSubtitle();
    }
    if (!subtitlesOn && this.subTimer > 0) this.hideSubtitle();
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this._cls('banner', 'hidden', true);
    }
  }

  reset() {
    this.cache = {};
    this.el.popups.innerHTML = '';
    this.hideSubtitle();
    this._cls('banner', 'hidden', true);
  }
}
