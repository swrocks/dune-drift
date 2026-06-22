// Dune Drift — a tiny precision platformer set at desert dusk.
// Controls: arrows to move, C to jump, X to dash, R to restart room.

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const TILE = 16;
  const COLS = 40;
  const ROWS = 22;
  const W = COLS * TILE; // 640
  const H = ROWS * TILE; // 352

  // Legend:
  // . empty  # solid  ^ spike-up  v spike-down  < spike-right  > spike-left
  // o crystal (refills dash)  * goal  p player spawn
  const RAW_LEVEL = [
    "........................................",
    "........................................",
    ".......................................*",
    "......................................##",
    "....................................####",
    ".................................o......",
    "..............................o.........",
    "............................###.........",
    ".........................o..............",
    "........................................",
    "......................o.................",
    "....................###.................",
    "................o.......................",
    "..............###.......................",
    "............vvv.........................",
    "..........o.............................",
    "........###.............................",
    "........................................",
    "....o.......................o...........",
    "p..........^^^^^^..........###..........",
    "########################################",
    "########################################",
  ];
  const LEVEL = RAW_LEVEL.map((r) => (r + ".".repeat(COLS)).slice(0, COLS));

  // ----- Tile helpers -----
  const SOLID = "#";
  const SPIKES = { "^": "up", v: "down", "<": "right", ">": "left" };

  const tileAt = (cx, cy) => {
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return SOLID;
    return LEVEL[cy][cx];
  };
  const isSolid = (cx, cy) => tileAt(cx, cy) === SOLID;

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

  // ----- Background props (pre-baked) -----
  // Sun
  const SUN = { x: W * 0.72, y: H * 0.42, r: 38 };
  // Distant mesas (far)
  const farMesas = [];
  for (let i = 0; i < 7; i++) {
    farMesas.push({
      x: i * 110 + (i % 2) * 30 - 40,
      w: 80 + (i % 3) * 30,
      h: 30 + ((i * 7) % 18),
    });
  }
  // Mid plateaus
  const midPlateaus = [];
  for (let i = 0; i < 6; i++) {
    midPlateaus.push({
      x: i * 130 - 30 + (i % 2) * 40,
      w: 90 + (i % 3) * 40,
      h: 22 + ((i * 11) % 14),
    });
  }
  // Pyramid silhouette (single landmark, behind the sun on the right)
  const pyramid = { cx: W * 0.78, base: H * 0.65, w: 130, h: 70 };
  // Cacti silhouettes scattered on far horizon
  const cacti = [];
  for (let i = 0; i < 9; i++) {
    cacti.push({ x: 30 + i * 70 + ((i * 13) % 20), h: 8 + (i % 3) * 4 });
  }
  // Stars (faint, near top of sky)
  const stars = [];
  for (let i = 0; i < 24; i++)
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.4,
      b: Math.random() * 0.5 + 0.3,
    });
  // Drifting sand/dust particles
  const dust = [];
  for (let i = 0; i < 70; i++)
    dust.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: -10 - Math.random() * 30,
      vy: -3 + Math.random() * 6,
      r: Math.random() < 0.5 ? 1 : 2,
      c: Math.random() < 0.5 ? "#f7d9a1" : "#e0a86c",
      a: 0.25 + Math.random() * 0.5,
    });

  // ----- Crystals (dash refills) -----
  const crystals = [];
  LEVEL.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "o")
        crystals.push({ cx: x, cy: y, taken: false, respawn: 0, t: Math.random() * Math.PI * 2 });
    }
  });

  // ----- Player -----
  const findChar = (ch) => {
    for (let y = 0; y < ROWS; y++) {
      const r = LEVEL[y];
      for (let x = 0; x < r.length; x++) if (r[x] === ch) return { cx: x, cy: y };
    }
    return null;
  };
  const spawnCell = findChar("p");
  const spawn = { x: spawnCell.cx * TILE, y: spawnCell.cy * TILE };
  const goal = findChar("*");

  const player = {
    x: spawn.x,
    y: spawn.y,
    w: 10,
    h: 12,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: false,
    coyote: 0,
    jumpBuffer: 0,
    dashCharges: 1,
    dashBuffer: 0,
    dashBufferAge: 0,
    dashTime: 0,
    dashCooldown: 0,
    dashDX: 0,
    dashDY: 0,
    dead: false,
    deadTimer: 0,
    won: false,
    winTimer: 0,
  };

  // ----- Constants -----
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
  // Dash input window: when X is pressed we wait a couple frames so multi-key
  // diagonal inputs (X + Up + Right pressed near-simultaneously) all land
  // before the dash direction is committed.
  const DASH_BUF_MAX = 0.12;
  const DASH_BUF_WAIT = 0.035; // ~2 frames at 60Hz

  // ----- Collision: AABB vs tilemap, one axis at a time -----
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

  const spikeHit = () => {
    const left = Math.floor(player.x / TILE);
    const right = Math.floor((player.x + player.w - 0.001) / TILE);
    const top = Math.floor(player.y / TILE);
    const bot = Math.floor((player.y + player.h - 0.001) / TILE);
    for (let cy = top; cy <= bot; cy++) {
      for (let cx = left; cx <= right; cx++) {
        const t = tileAt(cx, cy);
        const dir = SPIKES[t];
        if (!dir) continue;
        const sx = cx * TILE, sy = cy * TILE;
        let hx = sx, hy = sy, hw = TILE, hh = TILE;
        if (dir === "up") { hy = sy + 10; hh = 6; }
        else if (dir === "down") { hh = 6; }
        else if (dir === "right") { hx = sx + 10; hw = 6; }
        else if (dir === "left") { hw = 6; }
        if (
          player.x < hx + hw &&
          player.x + player.w > hx &&
          player.y < hy + hh &&
          player.y + player.h > hy
        )
          return true;
      }
    }
    return false;
  };

  const reset = () => {
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0; player.vy = 0;
    player.facing = 1;
    player.dashCharges = 1;
    player.dashTime = 0; player.dashCooldown = 0;
    player.dashBuffer = 0; player.dashBufferAge = 0;
    player.dead = false; player.deadTimer = 0;
    player.won = false; player.winTimer = 0;
    crystals.forEach((c) => { c.taken = false; c.respawn = 0; });
  };

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
        Math.random() < 0.5 ? "#ffb56a" : "#e85a3a",
        2,
      );
    }
  };

  // ----- Update -----
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;

    if (pressed["r"]) reset();

    if (player.dead) {
      player.deadTimer -= dt;
      if (player.deadTimer <= 0) reset();
    } else if (player.won) {
      player.winTimer += dt;
      if (Math.random() < 0.4)
        addParticle(
          player.x + player.w / 2 + (Math.random() - 0.5) * 6,
          player.y + player.h / 2 + (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 30,
          -20 - Math.random() * 30,
          0.7,
          "#fff2a8",
          2,
        );
    } else {
      const left = keys["arrowleft"] ? 1 : 0;
      const right = keys["arrowright"] ? 1 : 0;
      const ix = right - left;
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
            "#fff2a8",
            2,
          );
        if (player.dashTime <= 0) {
          player.vx = Math.sign(player.dashDX) * Math.min(Math.abs(player.vx), DASH_END_SPEED);
          if (player.dashDY < 0) player.vy = Math.max(player.vy, -60);
          else if (player.dashDY > 0) player.vy = Math.min(player.vy, DASH_END_SPEED);
          else player.vy = 0;
        }
      } else {
        // Dash input buffering. On X press we open a window. If a diagonal
        // is already held we fire immediately. If only one axis is held we
        // wait ~2 frames in case the second key was pressed just after X.
        // If nothing is held we wait the full buffer, then dash with facing.
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
                Math.cos(a) * sp,
                Math.sin(a) * sp,
                0.3 + Math.random() * 0.25,
                "#ffffff",
                2,
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
            (Math.random() - 0.5) * 40,
            -20 - Math.random() * 20,
            0.35,
            "#f0c884",
            1,
          );
      }
      if (!keys["c"] && player.vy < 0 && player.dashTime <= 0) {
        player.vy *= 1 - (1 - JUMP_CUT) * Math.min(1, dt * 30);
      }

      const wasGround = player.onGround;
      player.onGround = false;
      moveX(player.vx * dt);
      moveY(player.vy * dt);
      // Landing puff
      if (!wasGround && player.onGround) {
        for (let i = 0; i < 4; i++)
          addParticle(
            player.x + player.w / 2 + (Math.random() - 0.5) * player.w,
            player.y + player.h,
            (Math.random() - 0.5) * 50,
            -10 - Math.random() * 15,
            0.3,
            "#e0a86c",
            1,
          );
      }
      if (player.onGround) player.dashCharges = 1;

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
            addParticle(cx, cy, Math.cos(a) * 60, Math.sin(a) * 60, 0.4, "#ff6a8a", 2);
          }
        }
      });

      if (goal) {
        const gx = goal.cx * TILE, gy = goal.cy * TILE;
        if (
          player.x < gx + TILE &&
          player.x + player.w > gx &&
          player.y < gy + TILE &&
          player.y + player.h > gy &&
          !player.won
        ) {
          player.won = true;
          player.winTimer = 0;
        }
      }

      if (spikeHit() || player.y > H + 40) kill();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 1.5;
      p.vy *= 1 - dt * 1.5;
      if (p.life <= 0) particles.splice(i, 1);
    }
    dust.forEach((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < -4) { s.x = W + 4; s.y = Math.random() * H; }
      if (s.y < -4) s.y = H + 4;
      if (s.y > H + 4) s.y = -4;
    });

    for (const k in pressed) delete pressed[k];

    draw();
    requestAnimationFrame(tick);
  };

  // ----- Drawing -----
  const drawTile = (cx, cy) => {
    const t = LEVEL[cy][cx];
    const x = cx * TILE, y = cy * TILE;
    if (t === SOLID) {
      // Sandstone base
      ctx.fillStyle = "#8c5a2b";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#b8763a";
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      // Sediment bands
      ctx.fillStyle = "#a06530";
      ctx.fillRect(x + 1, y + 5, TILE - 2, 1);
      ctx.fillRect(x + 1, y + 10, TILE - 2, 1);
      // Speckle
      ctx.fillStyle = "#6e4220";
      ctx.fillRect(x + 3, y + 3, 1, 1);
      ctx.fillRect(x + 8, y + 7, 1, 1);
      ctx.fillRect(x + 12, y + 12, 1, 1);
      ctx.fillRect(x + 5, y + 13, 1, 1);
      ctx.fillStyle = "#dca06a";
      ctx.fillRect(x + 6, y + 4, 1, 1);
      ctx.fillRect(x + 11, y + 8, 1, 1);
      // Sandy crust top (where there's no block above)
      const above = tileAt(cx, cy - 1);
      if (above !== SOLID) {
        ctx.fillStyle = "#e7b46a";
        ctx.fillRect(x, y, TILE, 2);
        ctx.fillStyle = "#f7d39a";
        ctx.fillRect(x + 2, y, 3, 1);
        ctx.fillRect(x + 8, y, 4, 1);
        ctx.fillStyle = "#c98a48";
        ctx.fillRect(x, y + 2, TILE, 1);
        // sand grains spilling
        ctx.fillStyle = "#e7b46a";
        ctx.fillRect(x + 4, y + 3, 1, 1);
        ctx.fillRect(x + 11, y + 3, 1, 1);
      }
      // Edge highlights
      if (tileAt(cx - 1, cy) !== SOLID) {
        ctx.fillStyle = "#d49860";
        ctx.fillRect(x, y, 1, TILE);
      }
      if (tileAt(cx + 1, cy) !== SOLID) {
        ctx.fillStyle = "#5e3a18";
        ctx.fillRect(x + TILE - 1, y, 1, TILE);
      }
      if (tileAt(cx, cy + 1) !== SOLID) {
        ctx.fillStyle = "#5e3a18";
        ctx.fillRect(x, y + TILE - 1, TILE, 1);
      }
    } else if (SPIKES[t]) {
      const dir = SPIKES[t];
      // Sun-bleached bone spikes
      ctx.fillStyle = "#f0e2c0";
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
      // shaded base
      ctx.fillStyle = "#b89060";
      if (dir === "up") ctx.fillRect(x, y + TILE - 2, TILE, 2);
      else if (dir === "down") ctx.fillRect(x, y, TILE, 2);
      else if (dir === "right") ctx.fillRect(x + TILE - 2, y, 2, TILE);
      else if (dir === "left") ctx.fillRect(x, y, 2, TILE);
      // tiny shadow line on each spike for pixel-art read
      ctx.fillStyle = "#cdbb90";
      for (let i = 0; i < 3; i++) {
        if (dir === "up") ctx.fillRect(x + i * 5 + 2, y + 8, 1, TILE - 8);
        else if (dir === "down") ctx.fillRect(x + i * 5 + 2, y + 1, 1, 6);
      }
    }
  };

  const drawBackground = () => {
    // Dusk gradient sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#2c1340");
    sky.addColorStop(0.35, "#7a2a55");
    sky.addColorStop(0.6, "#e0633a");
    sky.addColorStop(0.85, "#f4a25a");
    sky.addColorStop(1, "#f7c884");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars at top
    stars.forEach((s) => {
      ctx.fillStyle = `rgba(255,235,200,${s.b})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    });

    // Sun (pixel-stepped circle)
    const r = SUN.r;
    for (let dy = -r; dy <= r; dy++) {
      const span = Math.floor(Math.sqrt(r * r - dy * dy));
      const yy = SUN.y + dy;
      // gradient: hot center to deep edge
      const f = 1 - Math.abs(dy) / r;
      const col = f > 0.7 ? "#fff2a0" : f > 0.4 ? "#ffb86a" : "#ee7a3a";
      ctx.fillStyle = col;
      ctx.fillRect(SUN.x - span, yy, span * 2, 1);
    }
    // Sun reflection band on horizon
    ctx.fillStyle = "rgba(255,220,150,0.18)";
    ctx.fillRect(0, SUN.y + r - 1, W, 3);

    // Pyramid silhouette (drawn before mesas so mesas can overlap)
    ctx.fillStyle = "#5a2a30";
    const py = pyramid;
    for (let i = 0; i < py.h; i++) {
      const w = ((py.w / 2) * (i + 1)) / py.h;
      ctx.fillRect(py.cx - w, py.base - py.h + i, w * 2, 1);
    }
    // Pyramid sun-lit edge
    ctx.fillStyle = "#7a3a3a";
    for (let i = 0; i < py.h; i++) {
      const w = ((py.w / 2) * (i + 1)) / py.h;
      ctx.fillRect(py.cx, py.base - py.h + i, w, 1);
    }

    // Far mesas
    ctx.fillStyle = "#4a1f2e";
    farMesas.forEach((m) => {
      const top = H * 0.6 - m.h;
      ctx.fillRect(m.x, top, m.w, m.h);
      // Stepped top edge for plateau look
      ctx.fillRect(m.x - 4, top + 2, m.w + 8, 1);
    });

    // Mid plateaus (closer / lower)
    ctx.fillStyle = "#3a1825";
    midPlateaus.forEach((m) => {
      const top = H * 0.68 - m.h;
      ctx.fillRect(m.x, top, m.w, m.h);
      ctx.fillRect(m.x - 6, top + 3, m.w + 12, 2);
    });

    // Cacti (along horizon, dark silhouettes)
    ctx.fillStyle = "#2a0f1a";
    cacti.forEach((c) => {
      const baseY = H * 0.72;
      // trunk
      ctx.fillRect(c.x, baseY - c.h, 2, c.h);
      // arms
      if (c.h > 9) {
        ctx.fillRect(c.x - 3, baseY - c.h + 3, 3, 1);
        ctx.fillRect(c.x - 3, baseY - c.h + 3, 1, 3);
        ctx.fillRect(c.x + 2, baseY - c.h + 5, 3, 1);
        ctx.fillRect(c.x + 4, baseY - c.h + 2, 1, 4);
      }
    });

    // Foreground dunes (3 layers)
    const dune = (yBase, col, amp, period, phase) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) {
        const y = yBase + Math.sin((x / period) * Math.PI * 2 + phase) * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    };
    dune(H * 0.75, "#7a2a2a", 8, 200, 0.2);
    dune(H * 0.82, "#5a1a22", 10, 170, 1.6);
    dune(H * 0.9, "#2a0c18", 6, 130, 3.4);

    // Drifting dust
    dust.forEach((s) => {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    });
    ctx.globalAlpha = 1;
  };

  const draw = () => {
    drawBackground();

    // Tiles
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < LEVEL[y].length; x++)
        drawTile(x, y);

    // Crystals (warm pink in this palette)
    crystals.forEach((c) => {
      if (c.taken) return;
      const cx = c.cx * TILE + TILE / 2;
      const cy = c.cy * TILE + TILE / 2 + Math.sin(c.t) * 1.5;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
      glow.addColorStop(0, "rgba(255,140,170,0.55)");
      glow.addColorStop(1, "rgba(255,140,170,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 16, cy - 16, 32, 32);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#ff6a8a";
      ctx.fillRect(-3, -3, 6, 6);
      ctx.fillStyle = "#ffd0dc";
      ctx.fillRect(-3, -3, 2, 2);
      ctx.fillStyle = "#a82a52";
      ctx.fillRect(1, 1, 2, 2);
      ctx.restore();
    });

    // Goal — a small relic obelisk
    if (goal) {
      const gx = goal.cx * TILE, gy = goal.cy * TILE;
      const t = performance.now() / 300;
      const glow = ctx.createRadialGradient(gx + 8, gy + 8, 0, gx + 8, gy + 8, 30);
      glow.addColorStop(0, "rgba(255,242,168,0.45)");
      glow.addColorStop(1, "rgba(255,242,168,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(gx - 22, gy - 22, 60, 60);
      // obelisk body
      ctx.fillStyle = "#3a1e2a";
      ctx.fillRect(gx + 5, gy + 2, 6, TILE - 2);
      ctx.fillStyle = "#5a2e3a";
      ctx.fillRect(gx + 5, gy + 2, 3, TILE - 2);
      // glowing rune
      const pulse = 0.5 + 0.5 * Math.sin(t);
      ctx.fillStyle = `rgba(255,220,120,${0.6 + pulse * 0.4})`;
      ctx.fillRect(gx + 7, gy + 6, 2, 2);
      ctx.fillRect(gx + 7, gy + 10, 2, 2);
      // cap
      ctx.fillStyle = "#ffd76b";
      ctx.fillRect(gx + 4, gy, 8, 2);
      ctx.fillRect(gx + 6, gy - 1, 4, 1);
    }

    // Player
    if (!player.dead) {
      const px = Math.round(player.x);
      const py = Math.round(player.y);
      if (player.dashTime > 0) {
        ctx.fillStyle = "rgba(255,242,168,0.35)";
        ctx.fillRect(px - player.dashDX * 4, py - player.dashDY * 4, player.w, player.h);
        ctx.fillStyle = "rgba(255,242,168,0.2)";
        ctx.fillRect(px - player.dashDX * 8, py - player.dashDY * 8, player.w, player.h);
      }
      const bodyColor = player.dashCharges > 0 ? "#e84a6a" : "#3a78c8";
      const inner = player.dashCharges > 0 ? "#ffc6d3" : "#a6c8ff";
      ctx.fillStyle = "#1a0a14";
      ctx.fillRect(px - 1, py - 1, player.w + 2, player.h + 2);
      ctx.fillStyle = bodyColor;
      ctx.fillRect(px, py, player.w, player.h);
      ctx.fillStyle = inner;
      ctx.fillRect(px + 1, py + 1, player.w - 2, 3);
      ctx.fillStyle = "#1a0a14";
      const ex = player.facing > 0 ? px + player.w - 4 : px + 2;
      ctx.fillRect(ex, py + 5, 2, 2);
    }

    particles.forEach((p) => {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    });
    ctx.globalAlpha = 1;

    if (player.won) {
      ctx.fillStyle = `rgba(20,8,16,${Math.min(0.7, player.winTimer * 0.6)})`;
      ctx.fillRect(0, 0, W, H);
      if (player.winTimer > 0.4) {
        ctx.fillStyle = "#fff2a8";
        ctx.font = "20px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("THE OBELISK SINGS", W / 2, H / 2 - 6);
        ctx.fillStyle = "#f7d39a";
        ctx.font = "11px 'Courier New', monospace";
        ctx.fillText("press R to drift again", W / 2, H / 2 + 14);
      }
    }
  };

  requestAnimationFrame((t) => { last = t; tick(t); });
})();
