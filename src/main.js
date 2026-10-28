// Entry point: WebGL check -> fonts -> loading screen -> Game.
import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/700.css';
import '@fontsource/noto-sans-bengali/800.css';
import './styles.css';
import { Game } from './game/Game.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

function showError(message) {
  const box = document.getElementById('webgl-error');
  if (message) box.querySelector('p').textContent = message;
  box.classList.remove('hidden');
}

async function boot() {
  if (!webglAvailable()) { showError(); return; }
  const menuRoot = document.getElementById('menu-root');
  menuRoot.innerHTML = '<div class="screen loading"><div class="card"><h2>লোড হচ্ছে… <small>Loading</small></h2><div class="loader"><i></i></div></div></div>';
  try {
    const game = new Game({
      canvas: document.getElementById('game-canvas'),
      hudRoot: document.getElementById('hud-root'),
      menuRoot,
    });
    await game.init();
  } catch (err) {
    console.error(err);
    menuRoot.innerHTML = '';
    showError('Something went wrong while starting the game: ' + (err && err.message ? err.message : err) + '. Try reloading, or switch to Low quality.');
  }
}

boot();
