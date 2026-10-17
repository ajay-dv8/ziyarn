  // ---------------------------------------------------------------------------
  // Thinking orb — ported from the "AI Thinking Orb" component (anark17r/ai-thinking-orb-and-input)
  // ---------------------------------------------------------------------------
  // WHAT IS PORTED vs DROPPED, and why
  //
  // Ported verbatim: the seeded point cloud, the 3D projection and painter's
  // algorithm, the colour ramp, cubic-bezier solver and easing set, the
  // track/timeline engine, and the assemble → resolve → condense motion.
  // The maths is the component's; only the plumbing around it changed.
  //
  // Dropped: launch (pill collapses to a ball), unfold (orb morphs into an answer
  // card), the input form, and the fixed status label. That choreography assumes
  // the orb owns the entire viewport and that a question produces exactly one
  // answer. The widget does neither — it is a chat panel with history, streaming
  // and follow-up turns. So the orb becomes the THINKING STATE: it appears where
  // the typing dots would be, thinks while the request is in flight, sweeps as
  // the answer arrives, and dissolves to make room for the real reply.
  //
  // The original drives geometry through CSS custom properties (--w, --h, --r)
  // set on a single .mo-actor, because the pill and the orb are the same element
  // at different times. Here the pill is always the composer, so there is no
  // morph to drive and the orb reads its own state from P.* directly. The colour
  // ramp is unchanged: rgb(235,235,235) → rgb(52,211,153), which already matches
  // the Ziyarn accent.

  // ─────────────────────────── maths + easing ───────────────────────────
  var MO_TAU = Math.PI * 2;

  function moClamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  function moLerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  // 4 decimals is plenty for sub-pixel values and keeps the CSS strings short.
  function moFmt(value) {
    return String(Math.round(value * 1e4) / 1e4);
  }

  // Deterministic PRNG so the dot cloud is identical on every load. A random
  // cloud would make the orb "reshuffle" between mounts, which reads as a bug.
  function moMulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Newton-Raphson with a bisection fallback: the derivative vanishes at the
  // endpoints, where Newton stalls, so fall back rather than returning garbage.
  function moCubicBezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    function sampleX(t) {
      return ((ax * t + bx) * t + cx) * t;
    }
    function sampleY(t) {
      return ((ay * t + by) * t + cy) * t;
    }
    function slopeX(t) {
      return (3 * ax * t + 2 * bx) * t + cx;
    }
    function solve(x) {
      var t = x, i, err, deriv;
      for (i = 0; i < 8; i++) {
        err = sampleX(t) - x;
        if (Math.abs(err) < 1e-6) return t;
        deriv = slopeX(t);
        if (Math.abs(deriv) < 1e-6) break;
        t -= err / deriv;
      }
      var lo = 0, hi = 1;
      t = x;
      for (i = 0; i < 40; i++) {
        err = sampleX(t);
        if (Math.abs(err - x) < 1e-6) break;
        if (x > err) lo = t;
        else hi = t;
        t = (hi - lo) / 2 + lo;
      }
      return t;
    }
    return function (x) {
      return x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x));
    };
  }

  var MO_E = {
    out: moCubicBezier(0.22, 1, 0.36, 1),
    io: moCubicBezier(0.65, 0, 0.35, 1),
    in: moCubicBezier(0.4, 0, 1, 1),
    grow: moCubicBezier(0.3, 0, 0.2, 1),
    vortex: moCubicBezier(0.6, 0, 0.2, 1),
    spring: moCubicBezier(0.34, 1.4, 0.64, 1),
  };

  // ─────────────────────────── geometry constants ───────────────────────────
  // Scaled down from the original (ORB_R 66 → 52, CANVAS 220 → 176) so the orb
  // sits comfortably inside a message bubble in a ~380px chat panel.
  var MO_CANVAS = 176;
  var MO_R = 52;

  // ─────────────────────────── the dot cloud ───────────────────────────
  // Fibonacci-ish sphere: 16 rings, ring k at height y, with enough points on
  // it to keep the spacing even as the ring shrinks toward the poles.
  var MO_RINGS = 16;
  var MO_DOTS = (function () {
    var random = moMulberry32(7);
    var dots = [];
    for (var ring = 0; ring < MO_RINGS; ring++) {
      var y = 1 - ((ring + 0.5) / MO_RINGS) * 2;
      var r = Math.sqrt(1 - y * y);
      var count = Math.max(4, Math.round(30 * r));
      for (var j = 0; j < count; j++) {
        var angle = (j / count) * MO_TAU + ring * 0.35;
        dots.push({
          x: Math.cos(angle) * r,
          y: y,
          z: Math.sin(angle) * r,
          u: (1 - y) / 2,
          seed: random() * MO_TAU,
        });
      }
    }
    return dots;
  })();

  var MO_N = MO_DOTS.length;
  var MO_DX = new Float32Array(MO_N);
  var MO_DY = new Float32Array(MO_N);
  var MO_DZ = new Float32Array(MO_N);
  var MO_DU = new Float32Array(MO_N);
  var MO_DS = new Float32Array(MO_N);
  (function () {
    for (var index = 0; index < MO_N; index++) {
      MO_DX[index] = MO_DOTS[index].x;
      MO_DY[index] = MO_DOTS[index].y;
      MO_DZ[index] = MO_DOTS[index].z;
      MO_DU[index] = MO_DOTS[index].u;
      MO_DS[index] = MO_DOTS[index].seed;
    }
  })();

  // ─────────────────────────── colour ramp ───────────────────────────
  // Pre-baked into a lookup table: 25 green steps × 49 alpha steps. Interpolating
  // rgba() strings per dot per frame would allocate ~1200 strings a frame.
  var MO_G_STEPS = 24;
  var MO_A_STEPS = 48;
  var MO_COLORS = (function () {
    var table = [];
    for (var gi = 0; gi <= MO_G_STEPS; gi++) {
      var g = gi / MO_G_STEPS;
      var red = Math.round(moLerp(235, 52, g));
      var green = Math.round(moLerp(235, 211, g));
      var blue = Math.round(moLerp(235, 153, g));
      for (var ai = 0; ai <= MO_A_STEPS; ai++) {
        table.push(
          "rgba(" + red + "," + green + "," + blue + "," + (ai / MO_A_STEPS).toFixed(3) + ")",
        );
      }
    }
    return table;
  })();

  // ─────────────────────────── the renderer ───────────────────────────
  // Per-dot state, preallocated once and reused every frame. Scratch buffers are
  // written in the update pass and read in the draw pass, which is why the draw
  // is split into two passes: everything behind the equator, then everything in
  // front. A single pass would let a front dot be painted before a back dot and
  // the orb would flicker.
  function moCreateOrb(canvas, getSpeed, isReduced) {
    var P = {
      k: 0, alpha: 0, spin: 0, rot: 0, sweep: 0, pop: 1,
      vortex: 0, gain: 1, floor: 0, rad: 0, prog: 0,
    };
    var ctx = canvas.getContext ? canvas.getContext("2d") : null;
    var lit = new Float32Array(MO_N);
    var screenX = new Float32Array(MO_N);
    var screenY = new Float32Array(MO_N);
    var radius = new Float32Array(MO_N);
    var depth = new Float32Array(MO_N);
    var colorIndex = new Int16Array(MO_N);
    // pw[] holds the strength of each of the four light programs, eased toward
    // their target one at a time so switching programs cross-fades.
    var pw = [1, 0, 0, 0];

    var time = 0, raf = 0, last = 0, dead = false;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(MO_CANVAS * dpr);
    canvas.height = Math.round(MO_CANVAS * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fixed 0.35 rad tilt: reads as a deliberate three-quarter view rather than
    // an equator-on sphere where the depth cue disappears.
    var S = 0.6, COS_TILT = Math.cos(0.35), SIN_TILT = Math.sin(0.35);
    var centre = MO_CANVAS / 2;

    function draw(dt) {
      if (!ctx) return;
      ctx.clearRect(0, 0, MO_CANVAS, MO_CANVAS);
      time += dt;
      P.rot += P.spin * dt;

      var yaw = P.rot + P.vortex;
      var cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
      var stepWeight = dt / 0.35;
      for (var q = 0; q < 4; q++) {
        var delta = (q === P.prog ? 1 : 0) - pw[q];
        pw[q] += Math.abs(delta) <= stepWeight ? delta : delta > 0 ? stepWeight : -stepWeight;
      }

      var decay = Math.exp(-dt / 0.5);
      var headA = (time * 300) % MO_N;
      var headB = (time * 480) % MO_N;
      // Two orbiting point lights, so the orb is lit from two directions.
      var angA = time * 0.8, bA = Math.sin(time * 0.5) * 0.9;
      var f1x = Math.cos(bA) * Math.cos(angA), f1y = Math.sin(bA), f1z = Math.cos(bA) * Math.sin(angA);
      var angB = time * 0.55 + 2.1, bB = Math.cos(time * 0.42) * 0.9;
      var f2x = Math.cos(bB) * Math.cos(angB), f2y = Math.sin(bB), f2z = Math.cos(bB) * Math.sin(angB);
      var equator = Math.sin(time * 2.2);
      var swirl = P.vortex * 1.5;

      for (var n = 0; n < MO_N; n++) {
        var dx = MO_DX[n], dy = MO_DY[n], dz = MO_DZ[n], u = MO_DU[n];
        var pulse = 0;

        // Program 0 — a band of dots sweeping around the index space.
        if (pw[0] > 0.001) {
          var d0 = Math.abs(n - headA);
          if (d0 > MO_N - d0) d0 = MO_N - d0;
          var v0 = Math.max(0, 1 - d0 / 16);
          pulse = Math.max(pulse, v0 * v0 * pw[0]);
        }
        // Program 1 — two moving specular hot-spots.
        if (pw[1] > 0.001) {
          var v1 = Math.max(0, (dx * f1x + dy * f1y + dz * f1z - 0.72) / 0.28);
          var v2 = Math.max(0, (dx * f2x + dy * f2y + dz * f2z - 0.72) / 0.28);
          var vHot = Math.max(v1, v2);
          pulse = Math.max(pulse, vHot * vHot * pw[1]);
        }
        // Program 2 — a latitude band rising and falling.
        if (pw[2] > 0.001) {
          var band = dy - equator;
          var vBand = Math.max(0, 1 - (band * band) / 0.02);
          pulse = Math.max(pulse, vBand * vBand * pw[2]);
        }
        // Program 3 — a wider, slower sweep, for contrast with program 0.
        if (pw[3] > 0.001) {
          var d3 = Math.abs(n - headB);
          if (d3 > MO_N - d3) d3 = MO_N - d3;
          var v3 = Math.max(0, 1 - d3 / 22);
          pulse = Math.max(pulse, v3 * v3 * pw[3]);
        }

        var level = Math.max(lit[n] * decay, pulse * P.gain);
        lit[n] = level;

        // Dots enter from the top and are the last to leave, so the orb grows
        // upward — the direction the eye expects.
        var keyed = moClamp01(P.k * (1 + S) - S * u);
        if (keyed <= 0.001) {
          colorIndex[n] = -1;
          continue;
        }
        var eased = MO_E.out(keyed);
        var size = eased * P.pop;

        // Yaw, then pitch, then divide-by-z for perspective.
        var x1 = dx * cosYaw + dz * sinYaw;
        var z1 = -dx * sinYaw + dz * cosYaw;
        var y2 = dy * COS_TILT - z1 * SIN_TILT;
        var z2 = dy * SIN_TILT + z1 * COS_TILT;
        var focal = 2.8 / (2.8 - z2);
        var zDepth = (z2 + 1) / 2;

        var ox = x1 * MO_R * size * focal;
        var oy = -y2 * MO_R * size * focal;
        if (swirl > 0.001) {
          // Un-keyed dots get an extra rotation, so the collapse looks like the
          // sphere being wound shut rather than just scaled down.
          var wind = (1 - keyed) * swirl;
          var cosWind = Math.cos(wind), sinWind = Math.sin(wind);
          var tx = ox * cosWind - oy * sinWind;
          oy = ox * sinWind + oy * cosWind;
          ox = tx;
        }

        // The sweep is a green wipe travelling pole to pole during resolve.
        var g = moClamp01((P.sweep * 1.4 - u) / 0.4);
        // Base alpha and the depth term are raised above the component's 0.1 /
        // 0.32. Those were tuned for a 132px orb; this one is 104px, and at the
        // original values the dot cloud washed out to near-invisible against a
        // white message bubble. Same curve, more gain.
        var alpha =
          0.14 +
          0.035 * Math.sin(MO_DS[n] + time * 1.6) * (1 - g) +
          0.4 * zDepth * zDepth +
          0.75 * level * (1 - g) +
          g * (0.55 + 0.4 * zDepth) +
          2 * g * (1 - g); // boost at the wipe's leading edge
        if (alpha < P.floor * (0.7 + 0.3 * zDepth)) alpha = P.floor * (0.7 + 0.3 * zDepth);
        if (alpha > 1) alpha = 1;
        alpha *= eased * P.alpha;

        screenX[n] = centre + ox;
        screenY[n] = centre + oy;
        depth[n] = zDepth;
        // 1.3 rather than the component's 1.15, for the same reason as the alpha
        // above: fewer, slightly larger dots survive the downscale.
        radius[n] =
          (1.3 * (0.45 + 0.75 * zDepth) * focal + 0.9 * level + g * 0.25) *
          (1 + P.rad) *
          (0.4 + 0.6 * eased);
        var ai = Math.round(alpha * MO_A_STEPS);
        var gi = Math.round(g * MO_G_STEPS);
        colorIndex[n] = ai <= 0 ? -1 : gi * (MO_A_STEPS + 1) + ai;
      }

      for (var pass = 0; pass < 2; pass++) {
        for (var i = 0; i < MO_N; i++) {
          var ci = colorIndex[i];
          if (ci < 0) continue;
          if (depth[i] >= 0.5 !== (pass === 1)) continue;
          ctx.fillStyle = MO_COLORS[ci];
          ctx.beginPath();
          ctx.arc(screenX[i], screenY[i], radius[i], 0, MO_TAU);
          ctx.fill();
        }
      }
    }

    function frame(now) {
      raf = 0;
      if (dead) return;
      // Clamp dt: a backgrounded tab returns one enormous delta, which would
      // teleport the light programs and skip the whole animation.
      var dt = isReduced()
        ? 0
        : Math.max(0, Math.min(0.05, (now - last) / 1000)) * getSpeed();
      last = now;
      draw(dt);
      if (P.alpha > 0.002) raf = requestAnimationFrame(frame);
      else if (ctx) ctx.clearRect(0, 0, MO_CANVAS, MO_CANVAS);
    }

    return {
      params: P,
      // Only run the loop while there is something to see. An orb that keeps a
      // rAF alive at alpha 0 would burn battery on every customer site forever.
      wake: function () {
        if (raf || dead || P.alpha <= 0.002) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
      reset: function () {
        P.k = 0; P.alpha = 0; P.spin = 0; P.rot = 0; P.sweep = 0;
        P.pop = 1; P.vortex = 0; P.gain = 1; P.floor = 0; P.rad = 0; P.prog = 0;
        lit.fill(0);
        pw[0] = 1; pw[1] = 0; pw[2] = 0; pw[3] = 0;
        time = isReduced() ? 1.2 : 0;
      },
      destroy: function () {
        dead = true;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      },
    };
  }

  // ─────────────────────────── timeline engine ───────────────────────────
  // A "track" animates one named channel between two values over a time window
  // with an easing curve. Playing a list of tracks in parallel is how the
  // original sequences its phases; only the CSS application differs here.
  function moTrack(channel, from, to, start, end, ease) {
    return { channel: channel, from: from, to: to, t0: start, t1: end, ease: ease || MO_E.io };
  }

  // Assemble: the cloud keys in from the top, spins up, and pops once as it
  // lands — the pop lands before the key-in finishes, which is what makes it
  // read as impact rather than a fade.
  var MO_ASSEMBLE = [
    moTrack("k", 0, 1, 0, 800, MO_E.out),
    moTrack("alpha", 0, 1, 0, 800, MO_E.out),
    moTrack("spin", 0, 0.9, 0, 800, MO_E.out),
    moTrack("pop", 1, 1.05, 0, 420, MO_E.out),
    moTrack("pop", 1.05, 1, 420, 800, MO_E.io),
  ];

  // Resolve: a green wipe sweeps pole to pole while the spin bleeds off.
  var MO_RESOLVE = [
    moTrack("sweep", 0, 1, 0, 700, MO_E.io),
    moTrack("spin", 0.9, 0.3, 0, 700, MO_E.out),
    moTrack("gain", 1, 0, 0, 700, MO_E.out),
  ];

  // Dissolve: the orb winds shut, collapses and fades, so the reply bubble can
  // take its place. Driven to zero alpha, which stops the rAF loop on its own.
  var MO_DISSOLVE = [
    moTrack("pop", 1, 1.06, 0, 120, MO_E.out),
    moTrack("k", 1, 0, 120, 640, MO_E.vortex),
    moTrack("vortex", 0, 1.6, 120, 640, MO_E.vortex),
    moTrack("alpha", 1, 0, 500, 800, MO_E.out),
  ];

  // Reduced-motion equivalents: cross-fades only, no rotation, no collapse.
  var MO_R_IN = [
    moTrack("alpha", 0, 1, 0, 200, MO_E.out),
    moTrack("k", 0, 1, 0, 200, MO_E.out),
    moTrack("spin", 0, 0, 0, 200, MO_E.out),
  ];
  var MO_R_RESOLVE = [
    moTrack("sweep", 0, 1, 0, 250, MO_E.io),
    moTrack("spin", 0, 0, 0, 250, MO_E.out),
  ];
  var MO_R_OUT = [
    moTrack("alpha", 1, 0, 0, 220, MO_E.out),
    moTrack("sweep", 0, 0, 0, 220, MO_E.out),
  ];

  /**
   * Plays a list of tracks in parallel, one rAF loop, applying each channel
   * through `apply(channel, value)`. Resolves when the last track finishes or
   * the signal aborts. All DOM writes for a frame are batched into one flush,
   * never one per track.
   */
  function moPlay(tracks, speed, isReduced, apply, signal) {
    return new Promise(function (resolve) {
      if (signal && signal.aborted) return resolve();
      var end = tracks.reduce(function (max, track) {
        return Math.max(max, track.t1);
      }, 0);
      var finished = [];
      var raf = 0;
      var elapsed = 0;
      var last = performance.now();

      function onAbort() {
        cancelAnimationFrame(raf);
        signal.removeEventListener("abort", onAbort);
        resolve();
      }
      function complete() {
        signal && signal.removeEventListener("abort", onAbort);
        resolve();
      }
      function step(now) {
        var dt = Math.max(0, Math.min(100, now - last));
        last = now;
        elapsed += dt * speed;
        for (var i = 0; i < tracks.length; i++) {
          var track = tracks[i];
          if (finished[i] || elapsed < track.t0) continue;
          var progress = Math.min(1, (elapsed - track.t0) / Math.max(1, track.t1 - track.t0));
          apply(track.channel, track.from + (track.to - track.from) * track.ease(progress));
          if (progress === 1) finished[i] = true;
        }
        if (elapsed >= end) complete();
        else raf = requestAnimationFrame(step);
      }
      if (signal) signal.addEventListener("abort", onAbort, { once: true });
      raf = requestAnimationFrame(step);
    });
  }

  // ─────────────────────────── the thinking state ───────────────────────────
  var MO_LABELS = ["Thinking", "Searching", "Analyzing", "Composing"];

  /**
   * Mounts a thinking orb inside `node` and returns a controller.
   *
   * `node` is the agent's message bubble. The engine calls `done()` the moment
   * the first token lands, so the orb always yields to the real reply — it is a
   * placeholder, never a second source of truth for the answer.
   */
  function moCreateThinking(node, options) {
    var opts = options || {};
    var speed = typeof opts.speed === "number" ? opts.speed : 1;
    var reducedQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    var reduced = reducedQuery ? reducedQuery.matches : false;

    node.innerHTML =
      '<div class="zy-glow-orb" aria-hidden="true">' +
      '<div class="zy-glow-orb-glow"></div>' +
      '<canvas class="zy-glow-orb-canvas"></canvas>' +
      '<div class="zy-glow-orb-pulse"></div>' +
      "</div>" +
      '<div class="zy-glow-orb-status" role="status" aria-live="polite">' +
      '<span class="zy-glow-orb-label"></span>' +
      '<span class="zy-glow-orb-dots"><i></i><i></i><i></i></span>' +
      "</div>";

    var host = node.querySelector(".zy-glow-orb");
    var canvas = node.querySelector(".zy-glow-orb-canvas");
    var status = node.querySelector(".zy-glow-orb-status");
    var label = node.querySelector(".zy-glow-orb-label");
    if (!host || !canvas || !status || !label) {
      return { done: function () {}, destroy: function () {} };
    }

    var orb = moCreateOrb(canvas, function () { return speed; }, function () { return reduced; });
    var ctl = new AbortController();
    var settled = false;
    var labelTimer = null;

    function setLabel(name) {
      if (label.textContent !== name) label.textContent = name;
    }

    function apply(channel, value) {
      var P = orb.params;
      if (channel === "k") P.k = value;
      else if (channel === "alpha") {
        P.alpha = value;
        host.style.setProperty("--oAlpha", moFmt(value));
        orb.wake();
      } else if (channel === "spin") P.spin = value;
      else if (channel === "sweep") {
        P.sweep = value;
        // Drives the green wash that accompanies the resolve wipe.
        host.style.setProperty("--oGreen", moFmt(value));
      } else if (channel === "pop") P.pop = value;
      else if (channel === "vortex") P.vortex = value;
      else if (channel === "gain") P.gain = value;
      else if (channel === "floor") P.floor = value;
      else if (channel === "rad") P.rad = value;
    }

    // Cycle the status label and the orb's light program together, so the words
    // and the visual stay in step. Reduced motion does not need the loop: the
    // canvas is static there and a rotating label would just be noise.
    if (!reduced) {
      var programIndex = 0;
      labelTimer = setInterval(function () {
        if (settled || ctl.signal.aborted) return;
        programIndex = (programIndex + 1) % 4;
        orb.params.prog = programIndex;
        setLabel(MO_LABELS[programIndex] || MO_LABELS[0]);
      }, 1150 / speed);
    }
    setLabel(MO_LABELS[0]);

    host.style.setProperty("--oAlpha", "0");
    orb.reset();
    moPlay(reduced ? MO_R_IN : MO_ASSEMBLE, speed, reduced, apply, ctl.signal);

    function teardown() {
      if (labelTimer) clearInterval(labelTimer);
      labelTimer = null;
      ctl.abort();
      orb.destroy();
    }

    return {
      /**
       * Called when the answer starts arriving. Sweeps, then dissolves, and only
       * then empties the node — the caller then writes the reply into it.
       */
      done: function () {
        if (settled) return Promise.resolve();
        settled = true;
        if (labelTimer) clearInterval(labelTimer);
        status.setAttribute("aria-live", "off");
        return moPlay(reduced ? MO_R_RESOLVE : MO_RESOLVE, speed, reduced, apply, ctl.signal)
          .then(function () {
            return moPlay(reduced ? MO_R_OUT : MO_DISSOLVE, speed, reduced, apply, ctl.signal);
          })
          .then(function () {
            teardown();
            node.innerHTML = "";
          });
      },
      /** Immediate teardown — error, escalation, or the widget being closed. */
      destroy: function () {
        if (settled) return;
        settled = true;
        teardown();
        node.innerHTML = "";
      },
    };
  }
