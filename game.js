// Dune Drift — a tiny precision platformer at desert dusk.
// Controls: arrows to move, C to jump, X to dash, R to restart, N for next.

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const TILE = 16;
  const COLS = 40;
  const ROWS = 22;
  const W = COLS * TILE;
  const H = ROWS * TILE;

  // Canvas sizing handled by CSS (fills viewport at 16:9, letterboxes
  // off-aspect). Browser nearest-neighbor scaling keeps the pixel-art crisp.

  // ----- Palette -----
  const P = {
    sky0: "#1a0a28", sky1: "#3a1450", sky2: "#6a2058", sky3: "#b03058",
    sky4: "#e8703a", sky5: "#f4a850", sky6: "#ffd070",
    sunHot: "#fff0a0", sunMid: "#ffd060", sunRim: "#ff8038",
    pyrDark: "#2a0e22", pyrLit: "#5a2030",
    sand0: "#c87838", sand1: "#7a3a18",
    stoneA: "#a86028", stoneB: "#7a3e18", stoneC: "#5a2a10",
    stoneTop: "#f0c878", stoneTopLo: "#e89858",
    bone: "#f0e0b8", boneLo: "#c0a070",
    cactiA: "#3a8050", cactiB: "#54a070", cactiC: "#1a4828", cactiSpine: "#f0e0a0",
    crystal: "#ff6a8a", crystalLo: "#a82a52", crystalHi: "#ffd0dc",
    ink: "#1a0a14",
    goalDark: "#3a1a26", goalGold: "#ffd070", goalGlow: "#fff0a0",
  };

  // ----- Vampire sprite palette + frames (12 wide x 16 tall) -----
  const SP = {
    ".": null,
    "k": "#0a0a12",   // hair / black outline
    "w": "#ecd6c0",   // skin
    "s": "#b8927a",   // skin shadow
    "r": "#c41a26",   // red eyes / sash
    "c": "#1a0a14",   // dark coat
    "d": "#3a1822",   // coat highlight
    "b": "#050208",   // boots
  };
  const SPRITES = {
    idle: [
      "....kkkk....",
      "...kkkkkk...",
      "..kkwwwwkk..",
      "..kwwwwwwk..",
      "..kwrrwrrk..",
      "..kwwwwwwk..",
      "..kkwsswkk..",
      "..kkccccdk..",
      ".kcrrrrrck.",
      ".kcrrrrrck.",
      ".kcccccccd.",
      "..ccccccc...",
      "..cc...cc...",
      "..cc...cc...",
      "..bb...bb...",
      "..bb...bb...",
    ],
    walkA: [
      "....kkkk....",
      "...kkkkkk...",
      "..kkwwwwkk..",
      "..kwwwwwwk..",
      "..kwrrwrrk..",
      "..kwwwwwwk..",
      "..kkwsswkk..",
      "..kkccccdk..",
      ".kcrrrrrck.",
      ".kcrrrrrck.",
      ".kcccccccd.",
      "..ccccccc...",
      "...cc.cc....",   // step (legs in)
      "...cc.cc....",
      "...bb.bb....",
      "...bb.bb....",
    ],
    walkB: [
      "....kkkk....",
      "...kkkkkk...",
      "..kkwwwwkk..",
      "..kwwwwwwk..",
      "..kwrrwrrk..",
      "..kwwwwwwk..",
      "..kkwsswkk..",
      "..kkccccdk..",
      ".kcrrrrrck.",
      ".kcrrrrrck.",
      ".kcccccccd.",
      "..ccccccc...",
      ".cc.....cc..",   // stride (legs out)
      ".cc.....cc..",
      ".bb.....bb..",
      ".bb.....bb..",
    ],
    jump: [
      "....kkkk....",
      "...kkkkkk...",
      "..kkwwwwkk..",
      "..kwwwwwwk..",
      "..kwrrwrrk..",
      "..kwwwwwwk..",
      "..kkwccwkk..",   // open mouth
      "..kkccccdk..",
      ".kcrrrrrck.",
      ".kcrrrrrck.",
      ".kcccccccd.",
      "..ccccccc...",
      "..cccccccc..",   // legs together raised
      "..cccccccc..",
      "...bbbbbb...",
      "....bbbb....",
    ],
    fall: [
      "....kkkk....",
      "...kkkkkk...",
      "..kkwwwwkk..",
      "..kwwwwwwk..",
      "..kwrrwrrk..",
      "..kwwwwwwk..",
      "..kkwsswkk..",
      "..kkccccdk..",
      ".kcrrrrrck.",
      ".kcrrrrrck.",
      ".kcccccccd.",
      "..ccccccc...",
      ".cc.....cc..",   // legs spread for landing
      ".cc.....cc..",
      ".bb.....bb..",
      ".bb.....bb..",
    ],
    dash: [
      "...kkkkkkk..",   // hair streaming
      "..kkkkkkkk..",
      ".kkkwwwwwk..",
      ".kwwwwwwwk..",
      "kkwrrwrrkk..",
      "kwwwwwwwk...",
      "kkwsswwkk...",
      ".kkccccdk...",
      "kcrrrrrck...",
      "kcrrrrrck...",
      "kccccccdk...",
      ".cccccccd...",
      "..ccccccc...",   // body forward, legs trailing
      "..ccccc.....",
      "..bbbb......",
      "..bb........",
    ],
  };

  // ----- Level catalogue -----
  // Geometry is verified: every climbing gap is 3 rows up and 6 cols across,
  // reachable from a platform's right edge with one jump + diagonal dash.
  // Landing refills the dash, so no mid-air crystal is required for the main
  // path on any level. Cacti sit above the right edge of each platform so
  // players must launch from the left/middle.
  const LEVELS_RAW = [
    // 1. The Foothills — clean staircase, no hazards on the path
    [
      "........................................",
      "........................................",
      "........................................",
      ".......................................*",
      "......................................##",
      "....................................####",
      "........................................",
      "..........................######........",
      "..........................######........",
      "........................................",
      "..................######................",
      "..................######................",
      "........................................",
      "..........######........................",
      "..........######........................",
      "........................................",
      "..######................................",
      "..######................................",
      "........................................",
      "p.......................................",
      "########################################",
      "########################################",
    ],
    // 2. The Cactus Patch — same staircase + cactus over each platform's right
    [
      "........................................",
      "........................................",
      "........................................",
      ".......................................*",
      "......................................##",
      "....................................####",
      "...............................c........",
      "..........................######........",
      "..........................######........",
      ".......................c................",
      "..................######................",
      "..................######................",
      "...............c........................",
      "..........######........................",
      "..........######........................",
      ".......c................................",
      "..######................................",
      "..######................................",
      "........................................",
      "p.......................................",
      "########################################",
      "########################################",
    ],
    // 3. The Bone Field — staircase + cacti + long spike pit on the floor
    [
      "........................................",
      "........................................",
      "........................................",
      ".......................................*",
      "......................................##",
      "....................................####",
      "...............................c........",
      "..........................######........",
      "..........................######........",
      ".......................c................",
      "..................######................",
      "..................######................",
      "...............c........................",
      "..........######........................",
      "..........######........................",
      ".......c................................",
      "..######................................",
      "..######................................",
      "........................................",
      "p........^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
      "########################################",
      "########################################",
    ],
    // 4. The Pillars — each platform is a tall block rising from the floor.
    // Player tops & gaps are identical to L1, so the climb is reachable.
    [
      "........................................",
      "........................................",
      "........................................",
      ".......................................*",
      "......................................##",
      "....................................####",
      "........................................",
      "..........................######........",
      "..........................######........",
      "..........................######........",
      "..................######..######........",
      "..................######..######........",
      "..................######..######........",
      "..........######..######..######........",
      "..........######..######..######........",
      "..........######..######..######........",
      "..######..######..######..######........",
      "..######..######..######..######........",
      "..######..######..######..######........",
      "p.######..######..######..######........",
      "########################################",
      "########################################",
    ],
    // 5. The Apex — pillars + cacti + spike pits in the floor channels
    [
      "........................................",
      "........................................",
      "........................................",
      ".......................................*",
      "......................................##",
      "....................................####",
      "...............................c........",
      "..........................######........",
      "..........................######........",
      ".......................c..######........",
      "..................######..######........",
      "..................######..######........",
      "...............c..######..######........",
      "..........######..######..######........",
      "..........######..######..######........",
      ".......c..######..######..######........",
      "..######..######..######..######........",
      "..######..######..######..######........",
      "..######..######..######..######........",
      "p.######^^######^^######^^######^^^^^^^^",
      "########################################",
      "########################################",
    ],
  ];

  // ----- Tile helpers -----
  const SOLID = "#";
  const HAZARDS = {
    "^": { hx: 0,  hy: 10, hw: 16, hh: 6  },
    "v": { hx: 0,  hy: 0,  hw: 16, hh: 6  },
    "<": { hx: 10, hy: 0,  hw: 6,  hh: 16 },
    ">": { hx: 0,  hy: 0,  hw: 6,  hh: 16 },
    "c": { hx: 2,  hy: 1,  hw: 12, hh: 15 },
  };
  const SPIKE_RENDER = { "^": "up", "v": "down", "<": "right", ">": "left" };

  // Current loaded level state
  let levelIdx = 0;
  let LEVEL = [];
  let spawn = { x: 0, y: 0 };
  let goal = null;
  let crystals = [];

  const tileAt = (cx, cy) => {
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return SOLID;
    return LEVEL[cy][cx];
  };
  const isSolid = (cx, cy) => tileAt(cx, cy) === SOLID;

  const findChar = (ch) => {
    for (let y = 0; y < ROWS; y++) {
      const r = LEVEL[y];
      for (let x = 0; x < r.length; x++) if (r[x] === ch) return { cx: x, cy: y };
    }
    return null;
  };

  const loadLevel = (idx) => {
    levelIdx = idx;
    const raw = LEVELS_RAW[idx];
    LEVEL = raw.map((r) => (r + ".".repeat(COLS)).slice(0, COLS));
    const sp = findChar("p");
    spawn = { x: sp.cx * TILE, y: sp.cy * TILE };
    goal = findChar("*");
    crystals = [];
    LEVEL.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "o")
          crystals.push({ cx: x, cy: y, taken: false, respawn: 0, t: Math.random() * Math.PI * 2 });
      }
    });
    reset();
  };

  // ----- Input -----
  const keys = {};
  const pressed = {};
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k))
      e.preventDefault();
  });
  addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // ----- Particles -----
  const particles = [];
  const addParticle = (x, y, vx, vy, life, color, size = 2) =>
    particles.push({ x, y, vx, vy, life, max: life, color, size });

  // ----- Background (pre-baked once) -----
  const SUN = { x: Math.floor(W * 0.5), y: Math.floor(H * 0.5), r: 44 };
  const HORIZON = Math.floor(H * 0.62);
  const pyramids = [
    { cx: Math.floor(W * 0.30), base: HORIZON, w: 70,  h: 44 },
    { cx: Math.floor(W * 0.50), base: HORIZON, w: 110, h: 70 },
    { cx: Math.floor(W * 0.72), base: HORIZON, w: 60,  h: 38 },
  ];
  const bgCacti = [];
  for (let i = 0; i < 12; i++)
    bgCacti.push({ x: 24 + i * 50 + ((i * 17) % 18), h: 5 + (i % 3) * 2 });
  const stars = [];
  for (let i = 0; i < 14; i++)
    stars.push({ x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * 60) });

  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = W; bgCanvas.height = H;
  const bx = bgCanvas.getContext("2d");
  bx.imageSmoothingEnabled = false;

  const BAYER = [
    [0,  8,  2, 10],
    [12, 4, 14,  6],
    [3, 11,  1,  9],
    [15, 7, 13,  5],
  ];
  const ditherRow = (g, y, hi, lo, threshold) => {
    for (let x = 0; x < W; x++) {
      const t = BAYER[y & 3][x & 3];
      g.fillStyle = t < threshold ? hi : lo;
      g.fillRect(x, y, 1, 1);
    }
  };

  const drawBandedSky = (g) => {
    const bands = [
      { y: 0,   c: P.sky0 }, { y: 30,  c: P.sky1 }, { y: 70,  c: P.sky2 },
      { y: 110, c: P.sky3 }, { y: 160, c: P.sky4 }, { y: 200, c: P.sky5 },
      { y: 230, c: P.sky6 },
    ];
    for (let i = 0; i < bands.length; i++) {
      const top = bands[i].y;
      const bot = i + 1 < bands.length ? bands[i + 1].y : HORIZON;
      g.fillStyle = bands[i].c;
      g.fillRect(0, top, W, bot - top);
    }
    for (let i = 0; i + 1 < bands.length; i++) {
      const seam = bands[i + 1].y;
      ditherRow(g, seam - 2, bands[i].c, bands[i + 1].c, 6);
      ditherRow(g, seam - 1, bands[i].c, bands[i + 1].c, 10);
      ditherRow(g, seam,     bands[i + 1].c, bands[i].c, 6);
    }
  };

  const drawSun = (g) => {
    const r = SUN.r;
    for (let dy = -r; dy <= r; dy++) {
      const span = Math.floor(Math.sqrt(r * r - dy * dy));
      const y = SUN.y + dy;
      if (y >= HORIZON) continue;
      const innerR = r * 0.55;
      const inner = Math.abs(dy) < innerR ? Math.floor(Math.sqrt(innerR * innerR - dy * dy)) : 0;
      g.fillStyle = P.sunMid;
      g.fillRect(SUN.x - span, y, span * 2, 1);
      if (inner) {
        g.fillStyle = P.sunHot;
        g.fillRect(SUN.x - inner, y, inner * 2, 1);
      }
    }
    for (let a = Math.PI; a <= Math.PI * 2; a += 0.06) {
      const px = Math.floor(SUN.x + Math.cos(a) * r);
      const py = Math.floor(SUN.y + Math.sin(a) * r);
      if (py >= HORIZON) continue;
      g.fillStyle = P.sunRim;
      g.fillRect(px, py, 1, 1);
    }
    g.fillStyle = "#ffb060";
    g.fillRect(SUN.x - r - 6, HORIZON, (r + 6) * 2, 1);
    g.fillStyle = "#ffd070";
    g.fillRect(SUN.x - r, HORIZON + 1, r * 2, 1);
  };

  const drawPyramid = (g, py) => {
    const half = Math.floor(py.w / 2);
    for (let i = 0; i < py.h; i++) {
      const w = Math.floor((half * (i + 1)) / py.h);
      const y = py.base - py.h + i;
      g.fillStyle = P.pyrDark;
      g.fillRect(py.cx - w, y, w * 2, 1);
    }
    const sunSide = py.cx < SUN.x ? +1 : -1;
    for (let i = 0; i < py.h; i++) {
      const w = Math.floor((half * (i + 1)) / py.h);
      const y = py.base - py.h + i;
      g.fillStyle = P.pyrLit;
      if (sunSide > 0) g.fillRect(py.cx + w - 2, y, 2, 1);
      else g.fillRect(py.cx - w, y, 2, 1);
    }
    g.fillStyle = P.pyrLit;
    g.fillRect(py.cx - 1, py.base - py.h, 2, 2);
  };

  const drawBackgroundToCache = () => {
    drawBandedSky(bx);
    bx.fillStyle = "#ffffff";
    stars.forEach((s) => bx.fillRect(s.x, s.y, 1, 1));
    drawSun(bx);
    pyramids.forEach((p) => drawPyramid(bx, p));
    bx.fillStyle = "#2a0e1a";
    bgCacti.forEach((c) => {
      const baseY = HORIZON - 1;
      bx.fillRect(c.x, baseY - c.h, 2, c.h);
      if (c.h > 6) {
        bx.fillRect(c.x - 2, baseY - c.h + 2, 2, 1);
        bx.fillRect(c.x - 2, baseY - c.h + 2, 1, 2);
        bx.fillRect(c.x + 2, baseY - c.h + 3, 2, 1);
        bx.fillRect(c.x + 3, baseY - c.h + 1, 1, 3);
      }
    });
    bx.fillStyle = P.sand0;
    bx.fillRect(0, HORIZON, W, H - HORIZON);
    bx.fillStyle = P.sand1;
    bx.fillRect(0, HORIZON + 22, W, H - HORIZON - 22);
    for (let x = 0; x < W; x++) {
      if (((x + 1) & 3) === 0) {
        bx.fillStyle = P.sand1;
        bx.fillRect(x, HORIZON + 19, 1, 1);
        bx.fillRect(x, HORIZON + 21, 1, 1);
      }
      if ((x & 3) === 0) {
        bx.fillStyle = P.sand0;
        bx.fillRect(x, HORIZON + 22, 1, 1);
        bx.fillRect(x, HORIZON + 24, 1, 1);
      }
    }
  };
  drawBackgroundToCache();

  // ----- Player -----
  const player = {
    x: 0, y: 0,
    w: 10, h: 12,
    vx: 0, vy: 0,
    facing: 1,
    onGround: false,
    coyote: 0, jumpBuffer: 0,
    dashCharges: 1,
    dashBuffer: 0, dashBufferAge: 0,
    dashTime: 0, dashCooldown: 0,
    dashDX: 0, dashDY: 0,
    dead: false, deadTimer: 0,
    won: false, winTimer: 0,
    walkTime: 0, walkFrame: 0,
  };

  const GRAV = 600;
  const MAX_FALL = 320;
  const MOVE_ACC = 1200;
  const MOVE_MAX = 110;
  const FRICTION_GROUND = 900;
  const FRICTION_AIR = 350;
  const JUMP_V = -210;
  const JUMP_CUT = 0.45;
  const COYOTE = 0.09;
  const BUFFER = 0.12;
  const DASH_SPEED = 260;
  const DASH_TIME = 0.16;
  const DASH_COOLDOWN = 0.08;
  const DASH_END_SPEED = 130;
  const DASH_BUF_MAX = 0.12;
  const DASH_BUF_WAIT = 0.035;

  const moveX = (dx) => {
    player.x += dx;
    const left = Math.floor(player.x / TILE);
    const right = Math.floor((player.x + player.w - 0.001) / TILE);
    const top = Math.floor(player.y / TILE);
    const bot = Math.floor((player.y + player.h - 0.001) / TILE);
    for (let cy = top; cy <= bot; cy++) {
      for (let cx = left; cx <= right; cx++) {
        if (isSolid(cx, cy)) {
          if (dx > 0) player.x = cx * TILE - player.w;
          else if (dx < 0) player.x = (cx + 1) * TILE;
          player.vx = 0;
          if (player.dashTime > 0) player.dashTime = 0;
        }
      }
    }
  };
  const moveY = (dy) => {
    player.y += dy;
    const left = Math.floor(player.x / TILE);
    const right = Math.floor((player.x + player.w - 0.001) / TILE);
    const top = Math.floor(player.y / TILE);
    const bot = Math.floor((player.y + player.h - 0.001) / TILE);
    for (let cy = top; cy <= bot; cy++) {
      for (let cx = left; cx <= right; cx++) {
        if (isSolid(cx, cy)) {
          if (dy > 0) {
            player.y = cy * TILE - player.h;
            player.onGround = true;
          } else if (dy < 0) {
            player.y = (cy + 1) * TILE;
          }
          player.vy = 0;
          if (player.dashTime > 0) player.dashTime = 0;
        }
      }
    }
  };

  const hazardHit = () => {
    const left = Math.floor(player.x / TILE);
    const right = Math.floor((player.x + player.w - 0.001) / TILE);
    const top = Math.floor(player.y / TILE);
    const bot = Math.floor((player.y + player.h - 0.001) / TILE);
    for (let cy = top; cy <= bot; cy++) {
      for (let cx = left; cx <= right; cx++) {
        const t = tileAt(cx, cy);
        const h = HAZARDS[t];
        if (!h) continue;
        const sx = cx * TILE, sy = cy * TILE;
        if (
          player.x < sx + h.hx + h.hw &&
          player.x + player.w > sx + h.hx &&
          player.y < sy + h.hy + h.hh &&
          player.y + player.h > sy + h.hy
        ) return true;
      }
    }
    return false;
  };

  function reset() {
    player.x = spawn.x; player.y = spawn.y;
    player.vx = 0; player.vy = 0;
    player.facing = 1;
    player.dashCharges = 1;
    player.dashTime = 0; player.dashCooldown = 0;
    player.dashBuffer = 0; player.dashBufferAge = 0;
    player.dead = false; player.deadTimer = 0;
    player.won = false; player.winTimer = 0;
    player.walkTime = 0; player.walkFrame = 0;
    crystals.forEach((c) => { c.taken = false; c.respawn = 0; });
  }

  const kill = () => {
    if (player.dead) return;
    player.dead = true;
    player.deadTimer = 0.5;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      addParticle(
        player.x + player.w / 2,
        player.y + player.h / 2,
        Math.cos(a) * (60 + Math.random() * 40),
        Math.sin(a) * (60 + Math.random() * 40),
        0.5 + Math.random() * 0.3,
        Math.random() < 0.5 ? P.sunMid : "#c41a26",
        2,
      );
    }
  };

  // ----- Update loop -----
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;

    if (player.won) {
      player.winTimer += dt;
      if (Math.random() < 0.4)
        addParticle(
          player.x + player.w / 2 + (Math.random() - 0.5) * 6,
          player.y + player.h / 2 + (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 30,
          -20 - Math.random() * 30,
          0.7,
          P.goalGlow,
          2,
        );
      // Menu: R = retry, N = next level
      if (pressed["r"]) {
        reset();
      } else if (pressed["n"]) {
        if (levelIdx + 1 < LEVELS_RAW.length) loadLevel(levelIdx + 1);
        else loadLevel(0);
      }
    } else if (pressed["r"]) {
      reset();
    } else if (player.dead) {
      player.deadTimer -= dt;
      if (player.deadTimer <= 0) reset();
    } else {
      // Jump levels with 1..5 hotkeys for quick navigation while testing
      for (let i = 1; i <= LEVELS_RAW.length; i++) {
        if (pressed[String(i)]) { loadLevel(i - 1); return requestAnimationFrame(tick); }
      }

      const ix = (keys["arrowright"] ? 1 : 0) - (keys["arrowleft"] ? 1 : 0);
      const iy = (keys["arrowdown"] ? 1 : 0) - (keys["arrowup"] ? 1 : 0);
      if (ix !== 0) player.facing = ix;

      player.dashCooldown = Math.max(0, player.dashCooldown - dt);

      if (player.dashTime > 0) {
        player.dashTime -= dt;
        player.vx = player.dashDX * DASH_SPEED;
        player.vy = player.dashDY * DASH_SPEED;
        if (Math.random() < 0.6)
          addParticle(
            player.x + player.w / 2,
            player.y + player.h / 2,
            -player.dashDX * 40 + (Math.random() - 0.5) * 20,
            -player.dashDY * 40 + (Math.random() - 0.5) * 20,
            0.3 + Math.random() * 0.2,
            P.sunHot,
            2,
          );
        if (player.dashTime <= 0) {
          player.vx = Math.sign(player.dashDX) * Math.min(Math.abs(player.vx), DASH_END_SPEED);
          if (player.dashDY < 0) player.vy = Math.max(player.vy, -60);
          else if (player.dashDY > 0) player.vy = Math.min(player.vy, DASH_END_SPEED);
          else player.vy = 0;
        }
      } else {
        if (pressed["x"]) {
          player.dashBuffer = DASH_BUF_MAX;
          player.dashBufferAge = 0;
        }
        if (player.dashBuffer > 0) {
          player.dashBuffer -= dt;
          player.dashBufferAge += dt;
        }
        const canDash = player.dashCharges > 0 && player.dashCooldown <= 0;
        if (player.dashBuffer > 0 && canDash) {
          const dirCount = Math.abs(ix) + Math.abs(iy);
          const expiring = player.dashBuffer <= dt;
          const ready =
            dirCount >= 2 ||
            (dirCount === 1 && player.dashBufferAge >= DASH_BUF_WAIT) ||
            expiring;
          if (ready) {
            let dx = ix, dy = iy;
            if (dx === 0 && dy === 0) { dx = player.facing; dy = 0; }
            const len = Math.hypot(dx, dy);
            dx /= len; dy /= len;
            player.dashDX = dx; player.dashDY = dy;
            player.dashTime = DASH_TIME;
            player.dashCooldown = DASH_COOLDOWN;
            player.dashCharges--;
            player.dashBuffer = 0;
            for (let i = 0; i < 14; i++) {
              const a = Math.atan2(dy, dx) + Math.PI + (Math.random() - 0.5) * 1.2;
              const sp = 30 + Math.random() * 60;
              addParticle(
                player.x + player.w / 2,
                player.y + player.h / 2,
                Math.cos(a) * sp, Math.sin(a) * sp,
                0.3 + Math.random() * 0.25, "#ffffff", 2,
              );
            }
          }
        }

        if (ix !== 0) {
          player.vx += ix * MOVE_ACC * dt;
          player.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, player.vx));
        } else {
          const fr = player.onGround ? FRICTION_GROUND : FRICTION_AIR;
          if (player.vx > 0) player.vx = Math.max(0, player.vx - fr * dt);
          else if (player.vx < 0) player.vx = Math.min(0, player.vx + fr * dt);
        }

        player.vy += GRAV * dt;
        if (player.vy > MAX_FALL) player.vy = MAX_FALL;
      }

      player.coyote = player.onGround ? COYOTE : Math.max(0, player.coyote - dt);
      player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
      if (pressed["c"]) player.jumpBuffer = BUFFER;
      if (player.jumpBuffer > 0 && player.coyote > 0 && player.dashTime <= 0) {
        player.vy = JUMP_V;
        player.coyote = 0;
        player.jumpBuffer = 0;
        player.onGround = false;
        for (let i = 0; i < 6; i++)
          addParticle(
            player.x + player.w / 2 + (Math.random() - 0.5) * player.w,
            player.y + player.h,
            (Math.random() - 0.5) * 40, -20 - Math.random() * 20,
            0.35, P.stoneTop, 1,
          );
      }
      if (!keys["c"] && player.vy < 0 && player.dashTime <= 0) {
        player.vy *= 1 - (1 - JUMP_CUT) * Math.min(1, dt * 30);
      }

      const wasGround = player.onGround;
      player.onGround = false;
      moveX(player.vx * dt);
      moveY(player.vy * dt);
      if (!wasGround && player.onGround) {
        for (let i = 0; i < 4; i++)
          addParticle(
            player.x + player.w / 2 + (Math.random() - 0.5) * player.w,
            player.y + player.h,
            (Math.random() - 0.5) * 50, -10 - Math.random() * 15,
            0.3, P.sand1, 1,
          );
      }
      if (player.onGround) player.dashCharges = 1;

      // Walking animation timer (steps every 0.12s while moving on ground)
      if (player.onGround && Math.abs(player.vx) > 10) {
        player.walkTime += dt;
        if (player.walkTime > 0.12) {
          player.walkTime = 0;
          player.walkFrame = (player.walkFrame + 1) % 2;
        }
      } else {
        player.walkTime = 0;
        player.walkFrame = 0;
      }

      crystals.forEach((c) => {
        if (c.taken) {
          c.respawn -= dt;
          if (c.respawn <= 0) c.taken = false;
          return;
        }
        c.t += dt * 4;
        const cx = c.cx * TILE + TILE / 2;
        const cy = c.cy * TILE + TILE / 2;
        if (
          Math.abs(cx - (player.x + player.w / 2)) < 8 &&
          Math.abs(cy - (player.y + player.h / 2)) < 9
        ) {
          c.taken = true;
          c.respawn = 1.6;
          player.dashCharges = Math.max(player.dashCharges, 1);
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            addParticle(cx, cy, Math.cos(a) * 60, Math.sin(a) * 60, 0.4, P.crystal, 2);
          }
        }
      });

      if (goal) {
        const gx = goal.cx * TILE, gy = goal.cy * TILE;
        if (
          player.x < gx + TILE && player.x + player.w > gx &&
          player.y < gy + TILE && player.y + player.h > gy &&
          !player.won
        ) {
          player.won = true;
          player.winTimer = 0;
        }
      }

      if (hazardHit() || player.y > H + 40) kill();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 1.5;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (const k in pressed) delete pressed[k];

    draw();
    requestAnimationFrame(tick);
  };

  // ----- Drawing -----
  const drawTile = (cx, cy) => {
    const t = LEVEL[cy][cx];
    const x = cx * TILE, y = cy * TILE;
    if (t === SOLID) {
      ctx.fillStyle = P.stoneA;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = P.stoneC;
      ctx.fillRect(x + TILE - 2, y, 2, TILE);
      ctx.fillRect(x, y + TILE - 2, TILE, 2);
      ctx.fillStyle = P.stoneB;
      ctx.fillRect(x + 2, y + 8, TILE - 4, 2);
      const above = tileAt(cx, cy - 1);
      const leftN = tileAt(cx - 1, cy);
      if (above !== SOLID) {
        ctx.fillStyle = P.stoneTop;
        ctx.fillRect(x, y, TILE, 2);
        ctx.fillStyle = P.stoneTopLo;
        ctx.fillRect(x, y + 2, TILE, 1);
        ctx.fillStyle = P.stoneTop;
        ctx.fillRect(x + 3, y + 3, 1, 1);
        ctx.fillRect(x + 10, y + 4, 1, 1);
      }
      if (leftN !== SOLID) {
        ctx.fillStyle = P.stoneTop;
        ctx.fillRect(x, y, 2, TILE);
      }
    } else if (SPIKE_RENDER[t]) {
      const dir = SPIKE_RENDER[t];
      ctx.fillStyle = P.bone;
      const tri = (px, py, dx1, dy1, dx2, dy2, dx3, dy3) => {
        ctx.beginPath();
        ctx.moveTo(px + dx1, py + dy1);
        ctx.lineTo(px + dx2, py + dy2);
        ctx.lineTo(px + dx3, py + dy3);
        ctx.closePath();
        ctx.fill();
      };
      for (let i = 0; i < 3; i++) {
        if (dir === "up") tri(x + i * 5, y, 0, TILE, 2.5, 6, 5, TILE);
        else if (dir === "down") tri(x + i * 5, y, 0, 0, 2.5, 10, 5, 0);
        else if (dir === "right") tri(x, y + i * 5, TILE, 0, 6, 2.5, TILE, 5);
        else if (dir === "left") tri(x, y + i * 5, 0, 0, 10, 2.5, 0, 5);
      }
      ctx.fillStyle = P.boneLo;
      if (dir === "up") ctx.fillRect(x, y + TILE - 2, TILE, 2);
      else if (dir === "down") ctx.fillRect(x, y, TILE, 2);
      else if (dir === "right") ctx.fillRect(x + TILE - 2, y, 2, TILE);
      else if (dir === "left") ctx.fillRect(x, y, 2, TILE);
    } else if (t === "c") {
      drawCactus(x, y);
    }
  };

  const drawCactus = (x, y) => {
    ctx.fillStyle = P.cactiA; ctx.fillRect(x + 7, y + 1, 2, 15);
    ctx.fillStyle = P.cactiB; ctx.fillRect(x + 7, y + 1, 1, 15);
    ctx.fillStyle = P.cactiC; ctx.fillRect(x + 8, y + 1, 1, 15);
    ctx.fillStyle = P.cactiA; ctx.fillRect(x + 3, y + 4, 2, 4); ctx.fillRect(x + 4, y + 6, 4, 2);
    ctx.fillStyle = P.cactiB; ctx.fillRect(x + 3, y + 4, 1, 4); ctx.fillRect(x + 4, y + 6, 4, 1);
    ctx.fillStyle = P.cactiC; ctx.fillRect(x + 4, y + 4, 1, 2);
    ctx.fillStyle = P.cactiA; ctx.fillRect(x + 11, y + 3, 2, 5); ctx.fillRect(x + 9, y + 6, 3, 2);
    ctx.fillStyle = P.cactiB; ctx.fillRect(x + 11, y + 3, 1, 5); ctx.fillRect(x + 9, y + 6, 3, 1);
    ctx.fillStyle = P.cactiC; ctx.fillRect(x + 12, y + 3, 1, 5);
    ctx.fillStyle = P.cactiSpine;
    ctx.fillRect(x + 7, y + 3, 1, 1); ctx.fillRect(x + 8, y + 7, 1, 1);
    ctx.fillRect(x + 7, y + 11, 1, 1); ctx.fillRect(x + 8, y + 14, 1, 1);
    ctx.fillRect(x + 3, y + 5, 1, 1); ctx.fillRect(x + 12, y + 4, 1, 1);
    ctx.fillStyle = P.stoneC; ctx.fillRect(x + 6, y + 15, 5, 1);
  };

  // Render a 12x16 sprite at (x,y). If flipped, mirror horizontally.
  const drawSprite = (frame, x, y, flipX) => {
    for (let py = 0; py < frame.length; py++) {
      const row = frame[py];
      for (let px = 0; px < row.length; px++) {
        const ch = row[px];
        const col = SP[ch];
        if (!col) continue;
        const dx = flipX ? row.length - 1 - px : px;
        ctx.fillStyle = col;
        ctx.fillRect(x + dx, y + py, 1, 1);
      }
    }
  };

  const drawPlayer = () => {
    const px = Math.round(player.x);
    const py = Math.round(player.y);

    // Dash trail (chunky pixel ghosts)
    if (player.dashTime > 0) {
      const tint = "rgba(255,240,160,0.45)";
      ctx.fillStyle = tint;
      ctx.fillRect(Math.round(px - player.dashDX * 4) - 1, Math.round(py - player.dashDY * 4) - 4, 12, 16);
      ctx.fillStyle = "rgba(255,240,160,0.22)";
      ctx.fillRect(Math.round(px - player.dashDX * 8) - 1, Math.round(py - player.dashDY * 8) - 4, 12, 16);
    }

    // Pick frame
    let frame;
    if (player.dashTime > 0) frame = SPRITES.dash;
    else if (!player.onGround && player.vy < -20) frame = SPRITES.jump;
    else if (!player.onGround) frame = SPRITES.fall;
    else if (Math.abs(player.vx) > 10) frame = player.walkFrame === 0 ? SPRITES.walkA : SPRITES.walkB;
    else frame = SPRITES.idle;

    // Sprite is 12 wide, hitbox 10 — center horizontally (offset -1).
    // Sprite is 16 tall, hitbox 12 — anchor to bottom (offset -4).
    drawSprite(frame, px - 1, py - 4, player.facing < 0);

    // Dash-available halo: a faint red rim pixel ring when dash ready
    if (player.dashCharges > 0 && player.dashTime <= 0) {
      ctx.fillStyle = "rgba(255,80,110,0.5)";
      ctx.fillRect(px + 4, py - 5, 4, 1);
      ctx.fillRect(px + 4, py + player.h + 1, 4, 1);
    }
  };

  const draw = () => {
    ctx.drawImage(bgCanvas, 0, 0);

    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < LEVEL[y].length; x++)
        drawTile(x, y);

    crystals.forEach((c) => {
      if (c.taken) return;
      const cx = c.cx * TILE + TILE / 2;
      const cy = c.cy * TILE + TILE / 2 + Math.sin(c.t) * 1.5;
      ctx.fillStyle = P.crystal;
      ctx.fillRect(cx - 1, cy - 5, 2, 1);
      ctx.fillRect(cx - 1, cy + 4, 2, 1);
      ctx.fillRect(cx - 5, cy - 1, 1, 2);
      ctx.fillRect(cx + 4, cy - 1, 1, 2);
      const drawDiamond = (r, color) => {
        ctx.fillStyle = color;
        for (let dy = -r; dy <= r; dy++) {
          const w = r - Math.abs(dy);
          ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
        }
      };
      drawDiamond(3, P.crystal);
      drawDiamond(2, P.crystalLo);
      ctx.fillStyle = P.crystalHi;
      ctx.fillRect(cx - 1, cy - 2, 1, 1);
      ctx.fillRect(cx - 2, cy - 1, 1, 1);
    });

    if (goal) {
      const gx = goal.cx * TILE, gy = goal.cy * TILE;
      const t = performance.now() / 280;
      const pulse = Math.sin(t) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255,224,128,${0.25 + pulse * 0.35})`;
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(gx - 4 - i * 3, gy + 6, 2, 2);
        ctx.fillRect(gx + 14 + i * 3, gy + 6, 2, 2);
      }
      ctx.fillStyle = P.goalDark;
      ctx.fillRect(gx + 5, gy + 2, 6, TILE - 2);
      ctx.fillStyle = P.pyrLit;
      ctx.fillRect(gx + 5, gy + 2, 3, TILE - 2);
      ctx.fillStyle = `rgba(255,224,128,${0.7 + pulse * 0.3})`;
      ctx.fillRect(gx + 7, gy + 6, 2, 2);
      ctx.fillRect(gx + 7, gy + 11, 2, 2);
      ctx.fillStyle = P.goalGold;
      ctx.fillRect(gx + 4, gy, 8, 2);
      ctx.fillRect(gx + 6, gy - 1, 4, 1);
    }

    if (!player.dead) drawPlayer();

    particles.forEach((p) => {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // Level number in top-left corner (small text, drop shadow)
    ctx.fillStyle = "#000";
    ctx.font = "10px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`LEVEL ${levelIdx + 1} / ${LEVELS_RAW.length}`, 7, 13);
    ctx.fillStyle = P.goalGold;
    ctx.fillText(`LEVEL ${levelIdx + 1} / ${LEVELS_RAW.length}`, 6, 12);

    if (player.won) {
      ctx.fillStyle = `rgba(10,5,12,${Math.min(0.75, player.winTimer * 0.6)})`;
      ctx.fillRect(0, 0, W, H);
      if (player.winTimer > 0.3) {
        ctx.textAlign = "center";
        const lastLevel = levelIdx + 1 >= LEVELS_RAW.length;
        ctx.fillStyle = P.goalGold;
        ctx.font = "22px 'Courier New', monospace";
        ctx.fillText(lastLevel ? "ALL LEVELS CLEAR" : `LEVEL ${levelIdx + 1} COMPLETE`, W / 2, H / 2 - 28);
        ctx.fillStyle = P.sand0;
        ctx.font = "11px 'Courier New', monospace";
        ctx.fillText("THE OBELISK SINGS", W / 2, H / 2 - 8);

        // Button-like labels
        if (player.winTimer > 0.6) {
          ctx.font = "13px 'Courier New', monospace";
          if (lastLevel) {
            ctx.fillStyle = "#ffb86a";
            ctx.fillText("[R] PLAY AGAIN FROM LEVEL 1", W / 2, H / 2 + 24);
          } else {
            ctx.fillStyle = "#ffb86a";
            ctx.fillText("[R] REPLAY     [N] NEXT LEVEL", W / 2, H / 2 + 24);
          }
        }
      }
    }
  };

  // ----- Boot -----
  loadLevel(0);
  requestAnimationFrame((t) => { last = t; tick(t); });
})();
