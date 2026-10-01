// shihaabalam.com - shared behaviour for the homepage and post pages:
// the glass nav, the smoke backgrounds, and mouse stirring.

// Visitor counts via GoatCounter (no cookies, no personal data). The dashboard is at
// https://shihaabalam.goatcounter.com once the account exists. Set to '' to turn it off.
const GOATCOUNTER = 'shihaabalam';
if (GOATCOUNTER) {
  const gc = document.createElement('script');
  gc.async = true;
  gc.src = 'https://gc.zgo.at/count.js';
  gc.dataset.goatcounter = 'https://' + GOATCOUNTER + '.goatcounter.com/count';
  document.head.appendChild(gc);
}

// Email links: the address sits in the page as data-mail="name|domain" so spam bots
// scanning the source don't find it; it's put together here, in the browser.
document.querySelectorAll('[data-mail]').forEach(a => {
  const [name, domain] = a.dataset.mail.split('|');
  a.href = 'mailto:' + name + '@' + domain;
  if (a.hasAttribute('data-mail-text')) a.textContent = name + '@' + domain;
});

// Sections with the dark smoke background (homepage hero, Writing band, post header).
const SMOKE = '.hero, .band, .post-hero';

// Nav: glass the whole way down. Dark ink over the white sections, white ink elsewhere.
const nav = document.getElementById('nav');
const darkBits = [...document.querySelectorAll(SMOKE + ', footer')];
const onScroll = () => {
  const y = nav.getBoundingClientRect().top + nav.offsetHeight / 2;
  const overDark = darkBits.some(el => { const r = el.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
  nav.classList.toggle('light', !overDark);
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Refraction for the glass (Chromium only; other browsers keep the plain blur).
// Builds a displacement map for the nav's rounded shape: flat in the middle,
// bending the backdrop more and more towards the rim, like the edge of a lens.
if (window.chrome && CSS.supports('backdrop-filter', 'url(#glass)')) {
  const img = document.getElementById('glass-map');
  const build = () => {
    const w = Math.round(nav.offsetWidth), h = Math.round(nav.offsetHeight);
    const rad = parseFloat(getComputedStyle(nav).borderTopLeftRadius) || 0;
    const edge = Math.min(26, h / 2);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const px = ctx.createImageData(w, h);
    const hw = w / 2, hh = h / 2;
    // signed distance to the rounded rectangle (negative inside)
    const sdf = (x, y) => {
      const qx = Math.abs(x - hw) - (hw - rad), qy = Math.abs(y - hh) - (hh - rad);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = -sdf(x + .5, y + .5);
        let dx = 0, dy = 0;
        if (d > 0 && d < edge) {
          const nx = sdf(x + 1.5, y + .5) - sdf(x - .5, y + .5);
          const ny = sdf(x + .5, y + 1.5) - sdf(x + .5, y - .5);
          const len = Math.hypot(nx, ny) || 1;
          const k = Math.pow(1 - d / edge, 2);
          dx = -nx / len * k; dy = -ny / len * k;
        }
        const i = (y * w + x) * 4;
        px.data[i] = 128 + dx * 127;
        px.data[i + 1] = 128 + dy * 127;
        px.data[i + 2] = 128;
        px.data[i + 3] = 255;
      }
    }
    ctx.putImageData(px, 0, 0);
    img.setAttribute('width', w);
    img.setAttribute('height', h);
    img.setAttribute('href', c.toDataURL());
    nav.classList.add('refract');
  };
  build();
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 150); });
}

// Liquid/smoke gradient: domain-warped noise in teal and orange, flowing slowly right.
// Drawn at a quarter of screen resolution (it's all soft edges anyway), paused when
// off screen, and frozen on one frame for people who ask for reduced motion.
const FRAG = `
  precision highp float;
  uniform vec2 res;
  uniform float t;
  uniform float dim;
  uniform sampler2D stirMap; // lasting mouse stirs (see STIR below), when supported
  uniform float useMap;
  uniform vec4 stir[12];     // fallback: short mouse trail, xy = where (0..1), zw = velocity
  uniform float stirAmt[12]; // how much of each trail point is left (fades out)
  uniform float ribs;        // ribbed glass strips across the section (0 = none)
  uniform vec2 ribMap;       // canvas x -> section x: scale, offset (the canvas overhangs)

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / res;
    vec2 here = uv;                          // unrefracted, for the mouse stir map

    // Ribbed glass, drawn here instead of with per-strip CSS blur: each strip
    // shows a magnified, softened slice of the smoke centred on itself, which
    // gives the same breaks at the strip edges for a fraction of the cost.
    if (ribs > 0.5) {
      float hx = uv.x * ribMap.x + ribMap.y;
      if (hx > 0.0 && hx < 1.0) {
        float c = (floor(hx * ribs) + 0.5) / ribs;
        hx = c + (hx - c) * 0.45;
        uv.x = (hx - ribMap.y) / ribMap.x;
      }
    }

    vec2 p = vec2(uv.x * res.x / res.y, uv.y) * 0.85;
    p.x -= t * 0.012;                         // the whole field drifts right, slowly

    // mouse stirring: read how far the smoke here has been pushed
    vec2 push = vec2(0.0);
    if (useMap > 0.5) {
      push = texture2D(stirMap, here).xy;
    } else {
      // fallback: each recent trail point pushes along the mouse's direction, with a
      // little curl, fading out over a second or two
      vec2 st = vec2(here.x * res.x / res.y, here.y);
      for (int i = 0; i < 12; i++) {
        float a = stirAmt[i];
        if (a <= 0.0) continue;
        vec4 s = stir[i];
        vec2 d = st - vec2(s.x * res.x / res.y, s.y);
        float fall = exp(-dot(d, d) / 0.03);
        push += (s.zw + vec2(-d.y, d.x) * length(s.zw) * 2.5) * fall * a * 0.16;
      }
    }
    p -= push;

    // domain warping: noise bent by noise, which is what makes it curl like smoke
    vec2 q = vec2(fbm(p + vec2(0.0, t * 0.012)),
                  fbm(p + vec2(5.2, 1.3) - vec2(0.0, t * 0.010)));
    vec2 r = vec2(fbm(p + 2.2 * q + vec2(1.7, 9.2) + t * 0.018),
                  fbm(p + 2.2 * q + vec2(8.3, 2.8) + t * 0.015));
    float f = fbm(p + 2.2 * r);

    vec3 deep   = vec3(0.020, 0.090, 0.120);
    vec3 teal   = vec3(0.050, 0.420, 0.530);
    vec3 peach  = vec3(0.950, 0.690, 0.550);
    vec3 orange = vec3(1.000, 0.360, 0.040);

    // teal on the left, orange on the right, with the smoke pushing the border around
    float warm = smoothstep(0.30, 0.72, uv.x + (f - 0.5) * 0.9 + (r.x - 0.5) * 0.5);
    vec3 cool = mix(deep, teal, smoothstep(0.20, 0.68, f + 0.40 * (1.0 - uv.x) - 0.05));
    vec3 hot  = mix(orange, peach, smoothstep(0.32, 0.85, uv.y + (r.y - 0.5) * 0.8));
    vec3 col  = mix(cool, hot, warm);

    // a dark plume drifting through, like the shadow in the middle of Delve's hero
    float plume = smoothstep(0.30, 0.62, f * 0.9 + q.x * 0.5 - 0.1);
    col *= mix(mix(0.50, 0.85, warm), 1.10, plume);
    col = pow(col, vec3(0.92));

    // deep, dark blue on the cool side in both places; the Writing band also
    // dims its orange a little so the text over it stays calm
    col = mix(col * mix(0.32, 1.0, warm), col * mix(0.30, 0.80, warm), dim);

    // the slight saturation boost the canvas used to get from CSS
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = max(mix(vec3(lum), col, 1.15), 0.0);

    gl_FragColor = vec4(col, 1.0);
  }`;

const SCALE = 4;
const VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';

// The stir map: a small image the smoke reads to see how far each spot has been pushed.
// Every frame it's redrawn from the previous frame: carried right with the drift, new
// mouse moves added in, and old stirs held for ~10s before easing back by ~25-30s.
// xy = push, z = seconds since that spot was last stirred (/60).
const STIR = `
  precision highp float;
  uniform sampler2D prev;
  uniform vec2 mapRes;
  uniform float aspect;     // canvas width / height
  uniform float shift;      // how far the smoke drifted right this frame (0..1 across)
  uniform float dt;
  uniform vec4 seg[16];     // mouse moves since last frame: xy = where (0..1), zw = movement
  uniform float segCount;

  void main() {
    vec2 uv = gl_FragCoord.xy / mapRes;
    vec2 from = uv - vec2(shift, 0.0);
    vec4 old = from.x < 0.0 ? vec4(0.0, 0.0, 1.0, 1.0) : texture2D(prev, from);
    vec2 push = old.xy;
    float age = old.z * 60.0;

    vec2 st = vec2(uv.x * aspect, uv.y);
    float touched = 0.0;
    for (int i = 0; i < 16; i++) {
      if (float(i) >= segCount) break;
      vec4 s = seg[i];
      vec2 d = st - vec2(s.x * aspect, s.y);
      float fall = exp(-dot(d, d) / 0.025);
      push += (s.zw + vec2(-d.y, d.x) * length(s.zw) * 6.0) * fall * 2.4;
      touched = max(touched, fall);
    }
    age = mix(age + dt, 0.0, smoothstep(0.15, 0.6, touched));

    push *= exp(-dt * 0.22 * smoothstep(8.0, 18.0, age));
    float len = length(push);
    if (len > 0.9) push *= 0.9 / len;

    gl_FragColor = vec4(push, min(age, 60.0) / 60.0, 1.0);
  }`;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

function program(gl, vsrc, fsrc) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = sh(gl.VERTEX_SHADER, vsrc), fs = sh(gl.FRAGMENT_SHADER, fsrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'a');
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

// Watches the mouse over the canvas's section. Calls onMove(x, y, dx, dy) in canvas terms:
// x, y from 0 to 1 (y up), dx, dy the movement in canvas heights.
function watchMouse(canvas, onMove) {
  const section = canvas.closest(SMOKE);
  let last = null;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const hr = section.getBoundingClientRect();
    if (e.clientY < hr.top || e.clientY > hr.bottom) { last = null; return; }
    const r = canvas.getBoundingClientRect();
    if (last) {
      const dx = (e.clientX - last.x) / r.height, dy = -(e.clientY - last.y) / r.height;
      if (Math.hypot(dx, dy) < 0.25) onMove((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, dx, dy);
    }
    last = { x: e.clientX, y: e.clientY };
  }, { passive: true });
}

// Lasting stirs, using the STIR shader and two half-float images that take turns being
// read and written. Returns null where the graphics card can't do that, and the page
// falls back to the short-lived trail below.
function stirMap(gl, canvas) {
  const hf = gl.getExtension('OES_texture_half_float');
  const hfl = gl.getExtension('OES_texture_half_float_linear');
  gl.getExtension('EXT_color_buffer_half_float');
  if (!hf || !hfl) return null;
  const prog = program(gl, VERT, STIR);
  if (!prog) return null;
  const u = {};
  ['prev', 'mapRes', 'aspect', 'shift', 'dt', 'seg', 'segCount'].forEach(n => u[n] = gl.getUniformLocation(prog, n));

  let tex = [], fbs = [], mw = 0, mh = 0, cur = 0;
  const make = (w, h) => {
    tex.forEach(t => gl.deleteTexture(t));
    fbs.forEach(f => gl.deleteFramebuffer(f));
    tex = []; fbs = [];
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, hf.HALF_FLOAT_OES, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      tex.push(t); fbs.push(f);
      if (!ok) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return false; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 1, 1);        // no push, "stirred ages ago"
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    mw = w; mh = h; cur = 0;
    return true;
  };
  if (!make(128, 80)) return null;

  // mouse moves collected between frames (the last slot soaks up any overflow)
  const segs = new Float32Array(16 * 4);
  let n = 0;
  watchMouse(canvas, (x, y, dx, dy) => {
    if (n < 16) { segs.set([x, y, dx, dy], n * 4); n++; return; }
    const i = 15 * 4;
    segs[i] = x; segs[i + 1] = y; segs[i + 2] += dx; segs[i + 3] += dy;
  });

  return {
    // advance one frame; returns the texture the smoke should read
    step(dt) {
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const h = Math.max(16, Math.round(128 / aspect));
      if (h !== mh && !make(128, h)) return null;
      gl.useProgram(prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbs[1 - cur]);
      gl.viewport(0, 0, mw, mh);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
      gl.uniform1i(u.prev, 0);
      gl.uniform2f(u.mapRes, mw, mh);
      gl.uniform1f(u.aspect, aspect);
      gl.uniform1f(u.shift, (0.012 / 0.85) * dt / aspect);   // same speed as the drift
      gl.uniform1f(u.dt, dt);
      gl.uniform4fv(u.seg, segs);
      gl.uniform1f(u.segCount, n);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      n = 0;
      segs.fill(0);
      cur = 1 - cur;
      return tex[cur];
    },
  };
}

// Fallback: remembers the last couple of seconds of mouse movement, then lets go.
function trail(canvas) {
  const N = 12, LIFE = 1.8;
  const pos = new Float32Array(N * 4), amt = new Float32Array(N), born = new Float64Array(N).fill(-1e9);
  let next = 0, lastDrop = 0, vx = 0, vy = 0, lastT = performance.now();
  watchMouse(canvas, (x, y, dx, dy) => {
    const now = performance.now();
    const dt = Math.max(8, now - lastT) / 1000;
    lastT = now;
    // velocity in canvas heights per second, smoothed and capped
    vx += (dx / dt - vx) * 0.35; vy += (dy / dt - vy) * 0.35;
    const sp = Math.hypot(vx, vy), cap = 2.5;
    if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
    if (now - lastDrop < 45 || Math.hypot(vx, vy) < 0.05) return;
    lastDrop = now;
    const i = next; next = (next + 1) % N;
    pos.set([x, y, vx, vy], i * 4);
    born[i] = now;
  });
  return {
    pos, amt,
    update(now) {
      for (let i = 0; i < N; i++) {
        const age = (now - born[i]) / 1000;
        amt[i] = age < LIFE ? Math.pow(1 - age / LIFE, 2) : 0;
      }
    },
  };
}

function flow(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) return;
  const prog = program(gl, VERT, FRAG);
  if (!prog) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('res'), uT = U('t'), uStir = U('stir'), uStirAmt = U('stirAmt'), uMap = U('stirMap'), uUseMap = U('useMap');
  gl.useProgram(prog);
  gl.uniform1f(U('dim'), +canvas.dataset.dim || 0);
  const uRibs = U('ribs'), uRibMap = U('ribMap');
  const flutes = canvas.parentElement.querySelector('.flutes');

  // Mouse stirring: hero and Writing band, real mouse only, never with reduced motion.
  const interactive = canvas.closest(SMOKE) && finePointer && !still;
  const map = interactive ? stirMap(gl, canvas) : null;
  const stirTrail = interactive && !map ? trail(canvas) : null;
  canvas.dataset.stir = map ? 'lasting' : stirTrail ? 'trail' : 'off';

  const t0 = 40 + Math.random() * 60;   // start mid-flow, not from a blank field
  let prevNow = null;
  const draw = now => {
    const dt = prevNow === null ? 0 : Math.min(0.25, (now - prevNow) / 1000);
    prevNow = now;
    const mapTex = map ? map.step(dt) : null;

    gl.useProgram(prog);
    // Drawn at a fraction of screen size and smoothly scaled up: the smoke is soft
    // anyway, so this replaces a full-screen CSS blur for free.
    const w = Math.max(1, Math.round(canvas.clientWidth / SCALE));
    const h = Math.max(1, Math.round(canvas.clientHeight / SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      // where the glass strips sit, in the canvas's own 0..1 across
      const c = canvas.getBoundingClientRect(), f = flutes ? flutes.getBoundingClientRect() : null;
      const n = flutes ? [...flutes.children].filter(el => el.offsetWidth > 0).length : 0;
      gl.uniform1f(uRibs, f && f.width ? n : 0);
      if (f && f.width) gl.uniform2f(uRibMap, c.width / f.width, (c.left - f.left) / f.width);
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uT, t0 + now / 1000);
    gl.uniform1f(uUseMap, mapTex ? 1 : 0);
    if (mapTex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mapTex);
      gl.uniform1i(uMap, 0);
    } else if (stirTrail) {
      stirTrail.update(performance.now());
      gl.uniform4fv(uStir, stirTrail.pos);
      gl.uniform1fv(uStirAmt, stirTrail.amt);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let visible = true, raf = 0;
  const loop = now => {
    draw(now);
    raf = visible ? requestAnimationFrame(loop) : 0;
    if (!raf) prevNow = null;       // don't count off-screen time as one huge frame
  };
  if (still) {
    draw(0);
    addEventListener('resize', () => draw(0));
  } else {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }).observe(canvas);
  }
  canvas.classList.add('on');
}

document.querySelectorAll('canvas.flow').forEach(flow);

// Project preview videos: play only while on screen, with a pause button.
// With reduced motion they wait on their poster frame until someone presses Play.
document.querySelectorAll('video.preview').forEach(v => {
  const btn = v.closest('figure') && v.closest('figure').querySelector('.vid-toggle');
  let held = still;
  const label = () => { if (btn) btn.textContent = v.paused ? 'Play' : 'Pause'; };
  v.addEventListener('play', label);
  v.addEventListener('pause', label);
  if (btn) btn.addEventListener('click', () => {
    held = !v.paused;
    if (held) v.pause(); else v.play().catch(() => {});
  });
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !held) v.play().catch(() => {});
    else if (!e.isIntersecting) v.pause();
  }, { threshold: 0.25 }).observe(v);
  label();
});
