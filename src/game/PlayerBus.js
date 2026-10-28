// The player's bus: body mesh + animated wheels + painted name boards + brake lights + the door helper.
// Add new buses by adding an entry to PLAYER_BUSES in config/gameConfig.js.
import * as THREE from 'three';
import { VEHICLE_TYPES, HANDLING } from '../config/vehicles.js';
import { buildBusGeometry, buildBusWheel } from './models/index.js';
import { Vehicle, vehicleMaterial } from './Vehicle.js';
import { Helper } from './Helper.js';
import { damp, clamp } from './utils.js';

const FONT = '"Noto Sans Bengali","Hind Siliguri","Nirmala UI","Kohinoor Bangla","Siyam Rupali",Vrinda,"Noto Sans",Arial,sans-serif';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

function bannerTexture(w, h, bg, fg, title, sub, border) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = Math.max(4, h * 0.06); ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let titleSize = sub ? h * 0.52 : h * 0.62;
  ctx.font = `800 ${titleSize}px ${FONT}`;
  while (ctx.measureText(title).width > w * 0.9 && titleSize > 14) {
    titleSize -= 2;
    ctx.font = `800 ${titleSize}px ${FONT}`;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(title, w / 2 + 2, h * (sub ? 0.36 : 0.52) + 2);
  ctx.fillStyle = fg; ctx.fillText(title, w / 2, h * (sub ? 0.36 : 0.52));
  if (sub) {
    ctx.font = `700 ${h * 0.24}px ${FONT}`;
    ctx.fillStyle = fg; ctx.globalAlpha = 0.9; ctx.fillText(sub, w / 2, h * 0.78); ctx.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class PlayerBus {
  constructor(cfg, seed = 1) {
    this.cfg = cfg;
    this.group = new THREE.Group();
    const W = 2.5, L = 9.6, hw = W / 2, zf = -L / 2, zr = L / 2;
    const built = buildBusGeometry(W, L, { color: cfg.color, accent: cfg.accent, trim: cfg.trim, roof: cfg.roof }, { seed: 12 + seed, bakeWheels: false });
    this.dims = built.dims;
    this.body = new THREE.Mesh(built.geometry, vehicleMaterial());
    this.group.add(this.body);

    // wheels (front steer + spin, rear dual)
    this.wheelGeos = [buildBusWheel(false), buildBusWheel(true)];
    this.wheels = [];
    const addWheel = (x, z, dual, steer) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.55, z);
      const m = new THREE.Mesh(this.wheelGeos[dual ? 1 : 0], vehicleMaterial());
      pivot.add(m);
      this.group.add(pivot);
      this.wheels.push({ pivot, mesh: m, steer });
    };
    for (const sx of [-1, 1]) {
      addWheel(sx * (hw - 0.12), zf + 1.95, false, true);
      addWheel(sx * (hw - 0.29), zr - 1.9, true, false);
    }

    // painted name boards (textures are generated once per bus)
    this.textures = [];
    const mk = (tex) => { this.textures.push(tex); return new THREE.MeshLambertMaterial({ map: tex }); };
    const rearMat = mk(bannerTexture(512, 170, hex(cfg.trim), hex(cfg.accent), cfg.banner, cfg.sub, hex(cfg.accent)));
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 0.74), rearMat);
    rear.position.set(0, 1.4, zr + 0.02);
    const sideMat = mk(bannerTexture(1024, 100, hex(cfg.trim), hex(cfg.accent), `${cfg.banner}  •  ${cfg.sub}`, null, null));
    const sideR = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.42), sideMat);
    sideR.position.set(hw + 0.022, 0.99 + 0.02, 0.9); sideR.rotation.y = Math.PI / 2;
    const sideL = new THREE.Mesh(sideR.geometry, sideMat);
    sideL.position.set(-hw - 0.022, 1.01, 1.1); sideL.rotation.y = -Math.PI / 2;
    const frontMat = mk(bannerTexture(512, 56, hex(cfg.accent), hex(cfg.trim), cfg.sub, null, null));
    const front = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 0.26), frontMat);
    front.position.set(0, 2.86, zf - 0.012); front.rotation.y = Math.PI;
    this.signs = [rear, sideR, sideL, front];
    this.group.add(rear, sideR, sideL, front);

    // brake / tail lights (emissive, toggled)
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0x8a1212 });
    this.tailGeo = new THREE.BoxGeometry(0.38, 0.22, 0.05);
    this.tails = [-1, 1].map((sx) => {
      const m = new THREE.Mesh(this.tailGeo, this.tailMat);
      m.position.set(sx * (hw - 0.25), 1.05, zr + 0.075);
      this.group.add(m);
      return m;
    });
    this.reverseMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
    this.reverseLamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.04), this.reverseMat);
    this.reverseLamp.position.set(0.0, 1.25, zr + 0.06);
    this.group.add(this.reverseLamp);

    // helper at the front-left door
    this.helper = new Helper(built.dims, seed);
    this.group.add(this.helper.group);

    // physics body
    const def = { ...VEHICLE_TYPES.bus, mass: cfg.mass };
    this.vehicle = new Vehicle('bus', this.group, def);
    this.vehicle.kind = 'player';
    this.vehicle.h = { ...HANDLING.bus, steer: cfg.steer, steerRef: 18, grip: cfg.grip, stunGrip: cfg.grip, spinDamp: 2.2, tip: 0 };
    this.vehicle.maxSpeed = cfg.maxSpeed;
    this.vehicle.accel = cfg.accel;
    this.vehicle.brakeDecel = cfg.brake;
    this.vehicle.reverseMax = 6;
    this.time = 0;
    this.steerVis = 0;
    this.exhaust = new THREE.Vector3(hw - 0.5, 0.5, zr + 0.4);
  }

  /** Per-frame visuals. fx = Effects instance (optional). */
  animate(dt, { braking, boosting, fx, throttle }) {
    const v = this.vehicle;
    this.time += dt;
    const sp = clamp(Math.abs(v.vf) / 30, 0, 1.4);
    // wheel spin + steering
    const spin = (v.vf * dt) / 0.55;
    this.steerVis += ((-v.steer * 0.4) - this.steerVis) * damp(10, dt);
    for (const w of this.wheels) {
      w.mesh.rotation.x -= spin;
      if (w.steer) w.pivot.rotation.y = this.steerVis;
    }
    // idle engine shudder + road vibration
    this.body.position.y = Math.sin(this.time * (boosting ? 55 : 30)) * (0.006 + sp * 0.012) + (throttle ? 0.004 : 0);
    // lights
    const on = braking && v.vf > 0.3;
    this.tailMat.color.setHex(on ? 0xff2a2a : 0x8a1212);
    const sc = on ? 1.18 : 1;
    this.tails[0].scale.set(sc, sc, 1); this.tails[1].scale.set(sc, sc, 1);
    this.reverseMat.color.setHex(v.vf < -0.4 ? 0xffffff : 0x555555);
    // helper
    this.helper.update(dt, { speed: Math.abs(v.vf), yawRate: v.yawRate, longAccel: v.longAccel, boosting });
    // exhaust smoke / boost flames
    if (fx) {
      const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
      const ex = this.exhaust.x, ez = this.exhaust.z;
      const wx = v.x + ex * cy + ez * sy, wz = v.z - ex * sy + ez * cy;
      this._puff = (this._puff || 0) - dt;
      if (this._puff <= 0) {
        this._puff = boosting ? 0.02 : throttle ? 0.07 : 0.16;
        if (boosting) { fx.flame(wx, 0.55, wz, v.vx * 0.5 + sy * 3, v.vz * 0.5 + cy * 3); fx.smoke(wx, 0.6, wz, v.vx * 0.6, v.vz * 0.6, 0x2a2826, 0.5); }
        else fx.smoke(wx, 0.55, wz, v.vx * 0.5, v.vz * 0.5, throttle ? 0x4a4642 : 0x6a6762, throttle ? 0.38 : 0.2);
      }
    }
  }

  dispose() {
    this.body.geometry.dispose();
    for (const g of this.wheelGeos) g.dispose();
    for (const t of this.textures) t.dispose();
    for (const s of this.signs) { s.material.dispose(); }
    this.signs[0].geometry.dispose(); this.signs[1].geometry.dispose(); this.signs[3].geometry.dispose();
    this.tailMat.dispose(); this.tailGeo.dispose(); this.reverseMat.dispose(); this.reverseLamp.geometry.dispose();
    this.helper.dispose();
  }
}
