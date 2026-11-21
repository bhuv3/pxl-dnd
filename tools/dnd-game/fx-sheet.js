// A contact sheet of a spell effect, for reviewing an animation in one screenshot. Load it into a page that runs dev/fx-lab.html
// (the lab room with the five heroes and their foes), e.g. from the browser console / javascript tool:
//     eval(await (await fetch('/tools/dnd-game/fx-sheet.js')).text());
//     await fxSheet('fireball', { outcome: 'hit' });          // an overlay shows the frames; fxSheet.close() removes it
// Options: outcome ('hit' | 'miss' | 'crit' | 'dice'), times (seconds after the effect starts), crop ({ x0, y0, x1, y1 } in map pixels,
// default: the figures' bounding box plus a margin), cols, scale (shrink the frames), margin (map pixels around the default crop).
// It steps the stage by hand (Stage.setManual), so frame times are exact and the animation runs at the pace the game gives it.
(() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // The display canvas as an ImageData, top row first (the GL display is read with readPixels, a 2D display with getImageData).
  function grab(canvas) {
    const gl = canvas.getContext('webgl2');
    const W = canvas.width, H = canvas.height, img = new ImageData(W, H);
    if (gl) {
      const raw = new Uint8Array(W * H * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      for (let y = 0; y < H; y++) img.data.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      return img;
    }
    return canvas.getContext('2d').getImageData(0, 0, W, H);
  }

  async function fxSheet(name, o = {}) {
    const canvas = document.getElementById('stage') || document.querySelector('canvas');
    document.querySelector(`#outcome button[data-v="${o.outcome || 'hit'}"]`).click();
    Stage.setManual(true);
    Lab.reset();
    await wait(0);
    const times = o.times || [0.08, 0.2, 0.32, 0.45, 0.6, 0.8, 1.0, 1.3];
    const dt = 1 / 60;
    let guard = 0, started = false, t = 0, k = 0, done = false;
    const p = Lab.cast(name);
    if (!p) throw new Error('Lab.cast did not start ' + name);
    p.then(() => { done = true; }, () => { done = true; });
    // The crop follows the action: the caster and the target (Lab.cast has just set the selects) plus a margin.
    const caster = Figures.get(+document.getElementById('caster').value), target = Figures.get(+document.getElementById('target').value) || caster;
    const m = o.margin ?? 44;
    const crop = o.crop || (o.focus === 'target' ? {
      x0: target.x - m, x1: target.x + m, y0: target.y - m * 0.8 - 14, y1: target.y + m * 0.6,
    } : {
      x0: Math.min(caster.x, target.x) - m, x1: Math.max(caster.x, target.x) + m,
      y0: Math.min(caster.y, target.y) - m - 12, y1: Math.max(caster.y, target.y) + m * 0.7,
    });
    const dpr = window.devicePixelRatio || 1, z = Stage.cam.zoom * dpr, cam = Stage.cam;
    const sx = Math.max(0, Math.floor((cam.panX + crop.x0 * Stage.cam.zoom) * dpr)), sy = Math.max(0, Math.floor((cam.panY + crop.y0 * Stage.cam.zoom) * dpr));
    const sw = Math.min(canvas.width - sx, Math.ceil((crop.x1 - crop.x0) * z)), sh = Math.min(canvas.height - sy, Math.ceil((crop.y1 - crop.y0) * z));
    const cols = o.cols || 4, scale = o.scale ?? Math.min(0.5, 790 / (cols * sw)), fw = Math.round(sw * scale), fh = Math.round(sh * scale);
    const rows = Math.ceil(times.length / cols);
    const sheet = document.createElement('canvas');
    sheet.width = fw * cols; sheet.height = (fh + 16) * rows;
    const g = sheet.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, sheet.width, sheet.height);
    g.imageSmoothingEnabled = false; g.font = '12px monospace';
    const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height;
    const tg = tmp.getContext('2d');
    while (!done && k < times.length && guard++ < 6000) {
      Stage.step(dt);
      if (!started) { if (Fx.busy()) started = true; if (guard % 10 === 0) await wait(0); if (!started) continue; }
      t += dt;
      while (k < times.length && t >= times[k]) {
        tg.putImageData(grab(canvas), 0, 0);
        const col = k % cols, row = Math.floor(k / cols);
        g.drawImage(tmp, sx, sy, sw, sh, col * fw, row * (fh + 16) + 16, fw, fh);
        g.fillStyle = '#9cf'; g.fillText(`${name} ${times[k].toFixed(2)}s`, col * fw + 4, row * (fh + 16) + 12);
        k++;
      }
      if (guard % 10 === 0) await wait(0);
    }
    for (let i = 0; i < 600 && !done; i++) { Stage.step(dt); if (i % 10 === 0) await wait(0); }
    const overlay = document.createElement('div');
    overlay.id = 'fxSheetOverlay';
    overlay.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#111;padding:4px;max-width:100vw;max-height:100vh;overflow:auto';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    fxSheet.last = sheet.toDataURL();
    return { frames: k, size: [sheet.width, sheet.height] };
  }
  fxSheet.close = () => { const el = document.getElementById('fxSheetOverlay'); if (el) el.remove(); };
  window.fxSheet = fxSheet;
})();
