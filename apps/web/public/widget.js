/**
 * Ziyarn widget — Shadow DOM web component (<zy-widget>).
 *
 * GENERATED FILE. Do not edit public/widget.js directly.
 * Edit the sources in apps/web/widget/ and run: pnpm --filter web build:widget
 *
 * Usage:
 *   <script defer src="https://app.ziyarn.com/widget.js"></script>
 *   <zy-widget data-slug="acme" data-secret="..." data-title="Chat with us"></zy-widget>
 *
 * Attributes:
 *   data-slug     (required) domain slug
 *   data-secret   (required) domain embed secret
 *   data-title    header title            (default "Chat with us")
 *   data-subtitle header subtitle         (default "We usually reply in minutes")
 *   data-color    launcher/accent color   (default "#10b981")
 *   data-position "bottom-right" | "bottom-left" (default "bottom-right")
 *   data-api      API base URL override   (default: origin of this script)
 *   data-variant  widget style            (default "classic" — see VARIANTS)
 *
 * Classic and Glow render inside the shadow root, so host page CSS cannot leak
 * in or out. Modern Sleek's script mounts the same launcher and loads its chat
 * surface from /embed/<slug> in a full-screen iframe.
 *
 * Architecture:
 *   1. Registers <zy-widget> via customElements.define()
 *   2. connectedCallback() reads data-* attributes and builds the shadow root
 *      from the resolved variant's CSS + markup
 *   3. Classic/Glow wire the panel in that shadow root; Modern Sleek shows its
 *      iframe overlay and listens for the chat's `ziyarn:close` message
 *   4. Visitor messages are POSTed to /api/chat as SSE streams, rendered
 *      token by token via renderMd()
 *   5. After the AI responds, a delta loop long-polls for owner (human) replies
 *      via GET /api/chat?since=X&stream=1
 *
 * Layout of the generated file:
 *   preamble.js      this header + IIFE open + API base detection
 *   helpers.js       DOM helpers, markdown renderer, variant registry
 *   base.css         launcher / panel / header / messages styles
 *   variants/*.js    one CSS + markup pair per widget style
 *   engine.js        the ZyWidget class — all network and state
 *   epilogue.js      element registration + public API
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // API base URL detection
  // ---------------------------------------------------------------------------
  // document.currentScript.src gives us the URL this script was loaded from.
  // We use that to derive the API base (e.g. "https://ziyarn.vercel.app").
  // Falls back to location.origin if the script is injected dynamically
  // (e.g. via next/script afterInteractive, where currentScript may be null).
  // The data-api attribute on <zy-widget> overrides this entirely.
  var SCRIPT_SRC = document.currentScript && document.currentScript.src;

/* core — @repo/widget-core, bundled (transport, stream, session, store) */
"use strict";var ZiyarnCore=(()=>{var E=Object.defineProperty;var P=Object.getOwnPropertyDescriptor;var H=Object.getOwnPropertyNames;var C=Object.prototype.hasOwnProperty;var N=(i,o)=>{for(var s in o)E(i,s,{get:o[s],enumerable:!0})},x=(i,o,s,d)=>{if(o&&typeof o=="object"||typeof o=="function")for(let n of H(o))!C.call(i,n)&&n!==s&&E(i,n,{get:()=>o[n],enumerable:!(d=P(o,n))||d.enumerable});return i};var B=i=>x(E({},"__esModule",{value:!0}),i);var M={};N(M,{StaleConversationError:()=>h,createSession:()=>_,createStore:()=>w,createTransport:()=>I,newVisitorId:()=>v});var A="/api/chat";function w(i){let o=s=>`zy:${s}:${i}`;return{load(s){try{return localStorage.getItem(o(s))}catch{return null}},save(s,d){try{localStorage.setItem(o(s),d)}catch{}}}}function v(){return typeof crypto<"u"&&typeof crypto.randomUUID=="function"?crypto.randomUUID():`v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`}function I({apiBase:i,secret:o}){let s=r=>`${i}${r}`,d=()=>({"x-embed-secret":o});async function n(r,g={}){let c=await fetch(s(r),{...g,headers:{...d(),...g.headers}});if(!c.ok){let m=(await c.json().catch(()=>({})))?.error?.message??`Request failed (${c.status})`;throw new Error(m)}return await c.json()}let y=async r=>{if(!r.ok||!r.body){let c=(await r.json().catch(()=>({})))?.error,S=new Error(c?.message??`Request failed (${r.status})`);throw c?.code==="NOT_FOUND"&&(S.name="StaleConversation"),S}return r.body};function b(r,g,c){return fetch(s(r),{method:"POST",headers:{...d(),"content-type":"application/json"},body:JSON.stringify(g),signal:c}).then(y)}function u(r){return fetch(s(r),{method:"GET",headers:d()}).then(y)}async function f(r,g){let c=r.getReader(),S=new TextDecoder,m="",T=()=>c.read().then(({done:O,value:R})=>{if(O)return;m+=S.decode(R,{stream:!0});let e=m.split(`

`);m=e.pop()??"";for(let t of e){let l=t.split(`
`)[0]??"";if(l.startsWith("data:"))try{g(JSON.parse(l.slice(5).trim()))}catch{}}return T()});return T()}return{json:n,stream:b,streamGet:u,readEvents:f}}var h=class extends Error{},U=9e4,k=2500,$=200;function _(i){let o=I({apiBase:i.apiBase,secret:i.secret}),s=w(i.slug),d=s.load("visitor")??v();s.save("visitor",d);let n=s.load("conversation"),y=null,b=!1,u=null,f=!1,r=null,g=null,c=e=>{if(!e)return;let t=Date.parse(e);Number.isNaN(t)||(y=new Date(t))},S=e=>{for(let t=e.length-1;t>=0;t-=1){let l=e[t]?.createdAt;if(l){c(l);return}}};function m(e){r&&clearTimeout(r),r=setTimeout(()=>{r=null,g&&T(g)},e)}function T(e){if(f||!n||!y)return;f=!0,g=e;let t=`${A}?conversationId=${encodeURIComponent(n)}&since=${encodeURIComponent(y.toISOString())}&stream=1`;o.streamGet(t).then(l=>o.readEvents(l,p=>{if(p.type==="message"&&p.message){e.onMessage(p.message),c(p.message.createdAt);return}f=!1,p.type==="done"&&c(p.serverTime),m(p.type==="error"?k:$)})).catch(()=>{f=!1,m(k)})}async function O(e,t){try{return await o.stream(A,{message:e,visitorId:d,conversationId:n??void 0},t)}catch(l){throw l instanceof Error&&l.name==="StaleConversation"?new h(l.message):l}}async function R(e,t,l){let p=await O(e,u.signal);await o.readEvents(p,a=>{if(l(),t.onTick?.(),a.type==="text"){t.onDelta(a.delta);return}if(a.type==="tool"){t.onTool(a.name,a.args);return}if(a.type==="escalate"){t.onEscalate();return}if(a.type==="error"){t.onError(a.message??"Something went wrong");return}a.conversationId&&(n=a.conversationId,s.save("conversation",a.conversationId)),c(a.serverTime??new Date().toISOString()),t.onDone(a.conversationId??n)})}return{get visitorId(){return d},get conversationId(){return n},get streaming(){return b},async loadConfig(){return o.json(A)},async loadHistory(){if(!n)return null;let e=await o.json(`${A}?conversationId=${encodeURIComponent(n)}`);return S(e.messages??[]),e},listenForOwnerReplies(e){T(e)},stopListening(){f=!1,g=null,r&&(clearTimeout(r),r=null)},async send(e,t){if(b)return;b=!0,u=new AbortController;let l=t.inactivityTimeoutMs??U,p=null,a=()=>{p&&clearTimeout(p),p=setTimeout(()=>{u?.abort(),t.onError("Response timed out. Please try again.")},l)};a();try{await R(e,t,a)}catch(D){D instanceof h?(n=null,y=null,s.save("conversation",""),a(),await R(e,t,a)):u?.signal.aborted||t.onError(D instanceof Error?D.message:"Something went wrong")}finally{p&&clearTimeout(p),b=!1,u=null}},stop(){u?.abort()}}}return B(M);})();

/* helpers — dom utilities, markdown, variant registry */
  var DEFAULT_API_BASE = (function () {
    try {
      return new URL(SCRIPT_SRC, location.href).origin;
    } catch (_) {
      return location.origin;
    }
  })();

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---------------------------------------------------------------------------
  // Helper: escape HTML special characters (XSS prevention)
  // ---------------------------------------------------------------------------
  // Used by renderMd() to sanitize AI output before injecting HTML.
  // Must be called BEFORE any markdown-to-HTML conversion so that raw HTML
  // in AI responses (e.g. <script>) is neutralized.
  function esc(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------------------------------------------------------------------------
  // Lightweight markdown → HTML renderer
  // ---------------------------------------------------------------------------
  // Converts a small subset of markdown into HTML for agent messages.
  // Order matters: esc() first (prevents XSS), then apply formatting tags.
  //
  // Supported syntax:
  //   **bold**    → <strong>bold</strong>
  //   *italic*    → <em>italic</em>
  //   `code`      → <code>code</code>
  //   \n          → <br>
  //   em-dash (—) → " — " (spaced, for readability)
  //   en-dash (–) → " - " (spaced, for readability)
  //
  // NOT supported (intentionally): tables, links, images, headers, lists.
  // This keeps the renderer fast and safe for untrusted AI output.
  function renderMd(text) {
    if (!text) return "";
    var s = esc(text);
    s = s.replace(/\u2014/g, " \u2014 "); // em-dash → spaced
    s = s.replace(/\u2013/g, " - ");       // en-dash → hyphen
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\n/g, "<br>");
    return s;
  }

  // ---------------------------------------------------------------------------
  // ZyWidget — custom element class
  // ---------------------------------------------------------------------------
  // Lifecycle: constructor() → connectedCallback() → (user interacts) → disconnectedCallback()
  // The widget manages its own state (open/closed, streaming, conversation ID)

  var VARIANTS = {};
  var DEFAULT_VARIANT_ID = "classic";

  /**
   * @param {string} id
   * @param {{
   *   css: string,
   *   markup: function(object): string,
   *   iframe?: boolean,
   *   onThinking?: function(HTMLElement, object): {
   *     done: function(): Promise<void>|void,
   *     destroy?: function(): void
   *   }
   * }} variant
   *
   * `iframe: true` marks a variant whose chat surface is a separate page
   * (Modern Sleek). The engine mounts its launcher/frame and skips the panel
   * wiring, so the variant's markup must not rely on the panel classes.
   *
   * `onThinking` is optional. Without it the engine renders the bouncing typing
   * dots. With it, the variant owns the placeholder bubble from the moment a
   * request goes out until it calls `done()` (answer incoming — may be async,
   * the engine waits for the node) or `destroy()` (error, escalation, teardown).
   * A controller that never settles would strand an empty bubble, so both paths
   * must be reachable.
   */
  function registerWidget(id, variant) {
    VARIANTS[id] = variant;
  }

  /**
   * Resolves data-variant to a registered variant, FAILING OPEN.
   *
   * Every widget already embedded on a customer site predates this attribute,
   * so a missing value must mean classic. A typo must never leave a paying
   * customer's website with a blank chat widget — warn and fall back.
   */
  function resolveVariant(name) {
    var fallback = VARIANTS[DEFAULT_VARIANT_ID];
    if (typeof name === "string") {
      var key = name.trim();
      if (key) {
        if (VARIANTS[key]) return VARIANTS[key];
        console.warn(
          '[zy-widget] unknown data-variant "' +
            key +
            '" — falling back to ' +
            DEFAULT_VARIANT_ID
        );
      }
    }
    return fallback;
  }

/* thinking orb — canvas renderer + timeline engine (Glow) */
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


/* base styles — panel, header, messages, composer, chips */
var BASE_CSS = `
/* ---- Reset & base ----
   The theme tokens are private aliases (--_zy-*) that read the public names
   (--zy-*). Declaring a custom property from itself — \`--zy-muted:
   var(--zy-muted, #64748b)\` — is a cycle: it resolves to nothing at all, and
   every colour that used it silently fell back to the inherited black. The
   alias breaks the cycle while still letting a page override the widget by
   setting --zy-* on the <zy-widget> element. */
:host {
  --_zy-color: var(--zy-color, #10b981);
  --_zy-text: var(--zy-text, #0f172a);
  --_zy-muted: var(--zy-muted, #64748b);
  --_zy-bg: var(--zy-bg, #ffffff);
  --_zy-border: var(--zy-border, #e2e8f0);
  --zy-radius: 14px;
  --zy-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
  all: initial;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }

/* ---- Fixed-position wrapper — anchors the panel and launcher to viewport ---- */
.zy-wrap {
  position: fixed;
  bottom: 20px;
  z-index: 2147483000; /* above everything, including site z-index stacks */
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  font-size: 15px;
  line-height: 1.45;
  color: var(--_zy-text);
}
.zy-wrap[data-position="bottom-left"] { left: 20px; right: auto; align-items: flex-start; }
.zy-wrap[data-position="bottom-right"] { right: 20px; left: auto; }

/* ---- Launcher — the floating chat bubble that toggles the panel open/closed ---- */
.zy-launcher {
  width: 58px;
  height: 58px;
  border: none;
  border-radius: 50%;
  background: var(--_zy-color);
  color: #fff;
  cursor: pointer;
  box-shadow: var(--zy-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.zy-launcher:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 16px 44px rgba(15, 23, 42, 0.24); }
.zy-launcher svg { width: 26px; height: 26px; }
/* Toggle between chat icon and close icon based on data-open */
.zy-launcher .zy-close { display: none; }
.zy-wrap[data-open="true"] .zy-launcher .zy-open { display: none; }
.zy-wrap[data-open="true"] .zy-launcher .zy-close { display: block; }

/* ---- Chat panel — the main chat window ---- */
/* Hidden by default (display: none). Shown when data-open="true" on .zy-wrap. */
.zy-panel {
  width: 382px;
  max-width: calc(100vw - 32px);
  height: 620px;
  max-height: min(80vh, 700px);
  background: var(--_zy-bg);
  border: 1px solid var(--_zy-border);
  border-radius: var(--zy-radius);
  box-shadow: var(--zy-shadow);
  display: none;
  flex-direction: column;
  overflow: hidden;
}
.zy-wrap[data-open="true"] .zy-panel { display: flex; }

/* ---- Header — agent name, description, online status, mobile close button ---- */
.zy-header {
  background: var(--_zy-color);
  color: #fff;
  padding: 14px 16px;
  flex-shrink: 0;
  position: relative; /* anchor for the absolute-positioned close button */
}
.zy-header-title { font-weight: 650; font-size: 16px; letter-spacing: -0.01em; padding-right: 36px; /* room for close btn */ }
.zy-header-sub { font-size: 12.5px; opacity: 0.92; margin-top: 2px; }
/* Close button inside the header — hidden on desktop, shown on mobile (≤480px) */
.zy-header-close {
  display: none;
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  line-height: 0;
  transition: background 0.15s ease;
}
.zy-header-close:hover { background: rgba(255,255,255,0.18); }
.zy-header-close svg { width: 20px; height: 20px; }
/* Online status indicator — pulsing dot shown during escalated conversations */
.zy-header-status { display: none; margin-top: 6px; font-size: 12px; opacity: 0.95; }
.zy-header-status[data-visible="true"] { display: flex; align-items: center; gap: 6px; }
.zy-header-status::before {
  content: "";
  width: 7px; height: 7px; border-radius: 50%;
  background: currentColor; flex-shrink: 0;
  animation: zy-pulse 1.4s ease-in-out infinite;
}

/* ---- Messages container — scrollable list of chat bubbles ---- */
/* overscroll-behavior: contain prevents the page from scrolling when
   the user scrolls to the top/bottom of the message list (important
   on mobile where the panel is fullscreen). */
.zy-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #f8fafc;
  overscroll-behavior: contain;
}
/* Individual message bubble styles */
.zy-msg {
  max-width: 84%;
  padding: 9px 13px;
  border-radius: 16px;
  font-size: 14.5px;
  white-space: pre-wrap;
  word-break: break-word;
  animation: zy-in 0.16s ease;
}
/* Agent (AI) messages — left-aligned, white background */
.zy-msg-agent { background: #fff; border: 1px solid var(--_zy-border); border-bottom-left-radius: 5px; align-self: flex-start; }
/* Owner (human support) messages — left-aligned, accent border, labeled */
.zy-msg-owner { background: #fff; border: 1px solid var(--_zy-color); border-bottom-left-radius: 5px; align-self: flex-start; }
.zy-msg-owner::before { content: "Owner"; display: block; font-size: 11px; font-weight: 600; color: var(--_zy-color); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
/* User (visitor) messages — right-aligned, accent background, white text */
.zy-msg-user { background: var(--_zy-color); color: #fff; border-bottom-right-radius: 5px; align-self: flex-end; }
/* Error messages — centered, red background */
.zy-msg-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; align-self: center; font-size: 13px; }
/* Typing indicator — bouncing dots while waiting for AI response */
.zy-msg-typing { padding: 9px 13px; }
.zy-typing-dots { display: inline-flex; align-items: center; gap: 12%; }
.zy-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--_zy-color);
  animation: zy-bounce 1.4s ease-in-out infinite;
}
.zy-dot:nth-child(2) { animation-delay: 0.2s; }
.zy-dot:nth-child(3) { animation-delay: 0.4s; }

/* ---- Composer ----
 * Shared shell, promoted out of variants/classic.css: every variant needs a
 * working input and send button, and the theming below is driven by --zy-color
 * and --zy-border, which are per-domain. A variant overrides what it wants to
 * change rather than re-declaring the structure.
 *
 * Expanding pill composer. Collapsed it is a single rounded row; on focus
 * (or once the visitor types) the capability row fades in below it.
 *
 * The expand/collapse uses grid-template-rows 0fr -> 1fr rather than an
 * animated height: it needs no magic numbers and stays correct when the
 * chip labels wrap on a narrow widget.
 *
 * Placeholder letters are animated with a CSS keyframe plus a per-index
 * animation-delay, so the blur-in stagger costs nothing at runtime and
 * needs no animation library inside the shadow root.
 */
.zy-composer {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--_zy-border);
  background: #fff;
  flex-shrink: 0;
}
.zy-composer-shell {
  border: 1px solid var(--_zy-border);
  border-radius: 26px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.zy-composer-shell:focus-within,
.zy-composer-shell[data-expanded="true"] {
  border-color: color-mix(in srgb, var(--_zy-color) 55%, var(--_zy-border));
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
}

/* Row 1 — input + send */
.zy-composer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 14px;
}
.zy-composer-field {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
.zy-composer input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  padding: 8px 0;
  font-size: 14.5px;
  font-family: inherit;
  color: var(--_zy-text);
  position: relative;
  z-index: 1;
}
/* Placeholder sits under the real input and is never focusable. It is drawn at
   half strength: it is a hint, not content, and the visitor's own text must
   always win the eye. */
.zy-composer-ph {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  overflow: hidden;
  transition: opacity 0.16s ease;
}
/* Once the visitor is in the field — focused, or typing — the hint goes, so
   their words never sit on top of it. */
.zy-composer[data-ph-hidden="true"] .zy-composer-ph {
  opacity: 0;
}
.zy-composer-ph span {
  display: inline-block;
  white-space: nowrap;
  color: color-mix(in srgb, var(--_zy-muted) 50%, transparent);
  font-size: 14.5px;
  font-family: inherit;
  animation: zy-ph-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--zy-ph-delay, 0ms);
}
@keyframes zy-ph-in {
  from { opacity: 0; filter: blur(7px); transform: translateY(6px); }
  to   { opacity: 1; filter: blur(0);   transform: none; }
}
@keyframes zy-ph-out {
  from { opacity: 1; filter: blur(0);   transform: none; }
  to   { opacity: 0; filter: blur(7px); transform: translateY(-6px); }
}
.zy-composer-ph[data-leaving="true"] span {
  animation: zy-ph-out 0.3s ease forwards;
  animation-delay: var(--zy-ph-delay, 0ms);
}

.zy-send {
  border: none;
  border-radius: 50%;
  background: var(--_zy-color);
  color: #fff;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.zy-send:hover:not(:disabled) { transform: translateY(-1px); }
.zy-send:disabled { opacity: 0.4; cursor: not-allowed; }
.zy-send svg { width: 17px; height: 17px; }

.zy-probe { color: red; }

/* ---- Footer note ---- */
.zy-note { padding: 0 16px 12px; font-size: 12px; color: var(--_zy-muted); text-align: center; flex-shrink: 0; background: #fff; border-top: 1px solid var(--_zy-border); }

/* ---- Animations ---- */
@keyframes zy-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes zy-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes zy-bounce { 0%, 100% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } }

/* ---- Mobile: fullscreen panel (≤480px) ---- */
@media (max-width: 480px) {
  .zy-panel {
    width: 100vw;
    max-width: none;
    height: 100dvh; /* dynamic viewport height — handles mobile browser chrome */
    max-height: none;
    border-radius: 0;
    border: none;
  }
  .zy-wrap, .zy-wrap[data-position] { left: 0; right: 0; bottom: 0; }
  /* Keep the launcher as a floating bubble at the bottom */
  .zy-launcher { position: fixed; right: 16px; bottom: 16px; }
  .zy-wrap[data-position="bottom-left"] .zy-launcher { left: 16px; right: auto; }
  /* When panel is open on mobile: hide the floating launcher (it would overlap
     the send button), show the header close button instead */
  .zy-wrap[data-open="true"] .zy-launcher { display: none; }
  .zy-header-close { display: flex; }
}
`;

/* variant stylesheets — keyed by id */
var VARIANT_CSS = {
  "classic": `
/* =========================================================================
   Classic — the default appearance
   =========================================================================
   Classic is the reference look, so it has almost nothing left to declare: the
   panel, header, messages, composer and chips all live in base.css, themed
   entirely through --zy-color and --zy-border. That is deliberate — it means a
   per-domain accent colour re-themes the whole widget with no variant involved,
   and a new variant starts from a working widget instead of a blank panel.

   What lives here is only what is genuinely Classic-specific:

     1. The composer focus treatment. Base gives a soft accent border; Classic
        makes that border a touch stronger, which suits its flat, quiet look.
     2. The launcher. Base draws a filled circle; Classic flattens its shadow.

   Everything else in a variant is a departure FROM this baseline. See
   variants/glow.css for a substantially different treatment.

   Adding a variant that wants a different composer does not need to redeclare
   the structure — override the specific properties.
   ------------------------------------------------------------------------- */

.zy-wrap[data-variant="classic"] .zy-composer-shell:focus-within,
.zy-wrap[data-variant="classic"] .zy-composer-shell[data-expanded="true"] {
  border-color: color-mix(in srgb, var(--_zy-color) 68%, var(--_zy-border));
}

.zy-wrap[data-variant="classic"] .zy-launcher {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}
`,
  "glow": `
/* =========================================================================
   Glow — the orb-led widget variant
   =========================================================================
   Reconstructed for the Ziyarn widget. The upstream component's stylesheet was
   unavailable, so these rules are written against the same contract the ported
   orb writes to: the orb sets --oAlpha and --oGreen on its host element, and
   everything visual follows from those two numbers.

   Provenance: the @keyframes below (mo-drift, mo-dot, mo-in, mo-out,
   mo-fade-in, mo-fade-out, mo-shake, mo-spin, mo-shimmer) are the upstream
   component's, unchanged. The selectors around them are Ziyarn's.

   The upstream component styled a full-viewport hero. Here the same visual
   language is compressed into a 382px chat panel, so the effects are scaled
   down and clipped rather than removed.
   ------------------------------------------------------------------------- */

@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes mo-spin { to { --angle: 360deg; } }
@keyframes mo-drift { from { transform: translateX(-14%); } to { transform: translateX(14%); } }
@keyframes mo-shimmer { from { background-position: 150% 0; } to { background-position: -100% 0; } }
@keyframes mo-dot {
  0%, 80%, 100% { opacity: 0.25; }
  40% { opacity: 1; }
}
@keyframes mo-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mo-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(-6px); } }
@keyframes mo-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes mo-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes mo-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
@keyframes mo-breathe {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.06); }
}

/* ---- Panel: an aurora bleeding down from the header ---- */
/* position:relative is load-bearing: without it .zy-aurora's absolute
   positioning resolves against .zy-wrap (the fixed viewport anchor) instead of
   the panel, and the wash lands in the wrong place entirely. */
.zy-wrap[data-variant="glow"] .zy-panel {
  position: relative;
  background: linear-gradient(180deg, #eafff5 0%, #ffffff 30%);
  border-color: rgba(16, 185, 129, 0.22);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 18px 44px -12px rgba(16, 185, 129, 0.3);
}
/* Three blurred blobs on a slow, offset drift. Kept behind the content with
   z-index 0 and clipped by the panel's own overflow:hidden, so it can never
   bleed over the composer or escape the panel's rounded corners. Sized for a
   382px panel rather than the component's full-width hero. */
.zy-aurora {
  position: absolute;
  inset: 0 0 auto 0;
  height: 190px;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  /* Fade the wash out as it descends, so it reads as light spilling from the
     header rather than a band with a hard bottom edge. */
  -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.45) 55%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.45) 55%, transparent 100%);
}
.zy-aurora i {
  position: absolute;
  display: block;
  border-radius: 50%;
  filter: blur(30px);
  opacity: 0.7;
}
.zy-aurora i:nth-child(1) {
  width: 150px; height: 150px; top: -84px; left: -38px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.62), transparent 68%);
  animation: mo-drift 9s ease-in-out infinite alternate;
}
.zy-aurora i:nth-child(2) {
  width: 132px; height: 132px; top: -64px; right: -44px;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.58), transparent 68%);
  animation: mo-drift 12s ease-in-out infinite alternate-reverse;
}
.zy-aurora i:nth-child(3) {
  width: 118px; height: 118px; top: -26px; left: 36%;
  background: radial-gradient(circle, rgba(253, 186, 116, 0.38), transparent 70%);
  animation: mo-drift 15s ease-in-out infinite alternate;
  animation-delay: -4s;
}

/* Content sits above the aurora. */
.zy-wrap[data-variant="glow"] .zy-header,
.zy-wrap[data-variant="glow"] .zy-messages,
.zy-wrap[data-variant="glow"] .zy-note,
.zy-wrap[data-variant="glow"] .zy-composer {
  position: relative;
  z-index: 1;
}

.zy-wrap[data-variant="glow"] .zy-header {
  background: linear-gradient(135deg, #059669 0%, #10b981 52%, #2dd4bf 100%);
  box-shadow: 0 6px 18px -8px rgba(5, 150, 105, 0.55);
}
.zy-wrap[data-variant="glow"] .zy-messages { background: transparent; }
.zy-wrap[data-variant="glow"] .zy-note { background: transparent; border-top-color: rgba(16, 185, 129, 0.16); }

/* ---- Messages: agent replies pick up a faint emerald tint ---- */
.zy-wrap[data-variant="glow"] .zy-msg-agent {
  background: rgba(236, 253, 245, 0.92);
  border-color: rgba(16, 185, 129, 0.2);
}
.zy-wrap[data-variant="glow"] .zy-msg-user {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  box-shadow: 0 4px 12px -4px rgba(5, 150, 105, 0.5);
}

/* ---- Composer: a rotating conic ring on focus ---- */
/* Uses the upstream mo-spin keyframe, which animates the registered --angle
   custom property — that registration is why @property is declared above. */
.zy-wrap[data-variant="glow"] .zy-composer-shell {
  border: 1px solid rgba(16, 185, 129, 0.24);
  background: #fff;
  transition: box-shadow 0.22s ease, border-color 0.22s ease;
}
.zy-wrap[data-variant="glow"] .zy-composer[data-expanded="true"] .zy-composer-shell,
.zy-wrap[data-variant="glow"] .zy-composer-shell:focus-within {
  border-color: transparent;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), #10b981, #2dd4bf, #fcd34d, #10b981) border-box;
  border: 1px solid transparent;
  animation: mo-spin 3.2s linear infinite;
  box-shadow: 0 6px 20px -8px rgba(16, 185, 129, 0.5);
}
.zy-wrap[data-variant="glow"] .zy-send {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
}
.zy-wrap[data-variant="glow"] .zy-send:disabled { background: #a7f3d0; color: #34d399; }
/* =========================================================================
   Thinking orb — the variant's stand-in for the typing dots
   =========================================================================
   Two custom properties drive everything, both written by the ported orb:
     --oAlpha  0 → 1 as the orb keys in, 1 → 0 as it dissolves
     --oGreen  0 → 1 during the resolve wipe
   ========================================================================= */
.zy-wrap[data-variant="glow"] .zy-msg-typing {
  align-self: center;
  background: transparent;
  border: none;
  padding: 10px 16px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.zy-glow-orb {
  --oAlpha: 0;
  --oGreen: 0;
  position: relative;
  width: 176px;
  height: 176px;
  display: grid;
  place-items: center;
  opacity: var(--oAlpha);
  transition: opacity 0.18s linear;
}
/* The bloom under the orb. Scales and saturates with the resolve wipe, so the
   green flash is the orb's own state rather than a separate animation. */
.zy-glow-orb-glow {
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(16, 185, 129, 0.62) 0%,
    rgba(45, 212, 191, 0.3) 44%,
    transparent 72%
  );
  filter: blur(14px);
  transform: scale(calc(0.8 + var(--oGreen) * 0.34));
  opacity: calc(0.5 + var(--oGreen) * 0.5);
  transition: transform 0.5s ease, opacity 0.5s ease;
}
.zy-glow-orb-canvas {
  position: relative;
  width: 176px;
  height: 176px;
  display: block;
}
/* A single expanding ring, fired once on resolve. */
.zy-glow-orb-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(16, 185, 129, 0.55);
  opacity: 0;
  transform: scale(0.7);
}
.zy-glow-orb-pulse[data-fire="true"] { animation: mo-ring 0.9s ease-out forwards; }
@keyframes mo-ring {
  0% { opacity: 0.9; transform: scale(0.7); }
  100% { opacity: 0; transform: scale(1.32); }
}

.zy-glow-orb-status {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: #047857;
  animation: mo-in 0.32s ease both;
}
.zy-glow-orb-dots { display: inline-flex; gap: 3px; }
.zy-glow-orb-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #10b981;
  animation: mo-dot 1.25s ease-in-out infinite;
}
.zy-glow-orb-dots i:nth-child(2) { animation-delay: 0.16s; }
.zy-glow-orb-dots i:nth-child(3) { animation-delay: 0.32s; }

/* ---- Reduced motion: hold the orb still, keep it legible ---- */
/* The ported engine already cross-fades instead of rotating. This strips the
   decorative ambient loops so nothing moves indefinitely. */
@media (prefers-reduced-motion: reduce) {
  .zy-aurora i { animation: none; opacity: 0.4; }
  .zy-wrap[data-variant="glow"] .zy-composer-shell:focus-within,
  .zy-wrap[data-variant="glow"] .zy-composer[data-expanded="true"] .zy-composer-shell {
    animation: none;
    background: linear-gradient(#fff, #fff) padding-box, #10b981 border-box;
  }
  .zy-glow-orb-dots i { animation: none; opacity: 0.7; }
  .zy-glow-orb-status { animation: mo-fade-in 0.2s ease both; }
}

/* ---- Mobile ---- */
@media (max-width: 480px) {
  .zy-glow-orb, .zy-glow-orb-canvas { width: 152px; height: 152px; }
  .zy-glow-orb-glow { inset: 10px; }
}
`,
  "sleek": `
/* Modern Sleek — the chat itself lives in /embed/<slug>; the script only owns
   the launcher and the full-screen frame. Scoped under data-variant so these
   rules cannot reach Classic or Glow. */
.zy-wrap[data-variant="sleek"] .zy-sleek-overlay {
  position: fixed;
  inset: 0;
  z-index: 2;
  background: #1b1a1f;
}

.zy-wrap[data-variant="sleek"] .zy-sleek-overlay[hidden] {
  display: none;
}

.zy-wrap[data-variant="sleek"] .zy-sleek-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #1b1a1f;
}

/* The frame covers the viewport, so the launcher would only sit on top of it. */
.zy-wrap[data-variant="sleek"][data-open="true"] .zy-launcher {
  display: none;
}
`,
};

/* variant: classic */
// Icons belong to the variant: a widget that looks nothing like Classic
// brings its own.
  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  };

  registerWidget("classic", {
    // Stylesheet shipped by build-widget.mjs as VARIANT_CSS.classic.
    css: VARIANT_CSS.classic,
    /**
     * @param {{title: string, subtitle: string, color: string, position: string}} config
     */
    markup: function (config) {
      return (
        '<div class="zy-wrap" data-position="' +
        config.position +
        '" data-variant="classic">' +
        '<div class="zy-panel">' +
        '<div class="zy-header">' +
        '<div class="zy-header-title"></div>' +
        '<div class="zy-header-sub"></div>' +
        '<div class="zy-header-status" data-visible="false"></div>' +
        '<button type="button" class="zy-header-close" aria-label="Close chat">' +
        ICONS.close +
        "</button>" +
        "</div>" +
        '<div class="zy-messages"></div>' +
        '<div class="zy-composer" data-expanded="false">' +
        '<div class="zy-composer-shell">' +
        '<div class="zy-composer-row">' +
        '<div class="zy-composer-field">' +
        '<input type="text" placeholder=" " aria-label="Type a message" autocomplete="off" />' +
        '<div class="zy-composer-ph" aria-hidden="true"></div>' +
        "</div>" +
        '<button type="button" class="zy-send" aria-label="Send message">' +
        ICONS.send +
        "</button>" +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="zy-note">Powered by Ziyarn</div>' +
        "</div>" +
        '<button type="button" class="zy-launcher" aria-label="Open chat">' +
        '<span class="zy-open">' +
        ICONS.chat +
        '</span><span class="zy-close">' +
        ICONS.close +
        "</span>" +
        "</button>" +
        "</div>"
      );
    },
  });


/* variant: glow */
  // Icons belong to the variant: a widget that looks nothing like Classic
  // brings its own. Glow's launcher is a small orbit rather than a speech bubble.
  var GLOW_ICONS = {
    chat:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(-28 12 12)"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5.5 11.5 12 5l6.5 6.5"/></svg>',
  };

  registerWidget("glow", {
    // Stylesheet shipped by build-widget.mjs as VARIANT_CSS.glow.
    css: VARIANT_CSS.glow,

    /**
     * @param {{title: string, subtitle: string, color: string, position: string}} config
     */
    markup: function (config) {
      return (
        '<div class="zy-wrap" data-position="' +
        config.position +
        '" data-variant="glow">' +
        '<div class="zy-panel">' +
        // Sits behind the content, clipped by the panel's overflow:hidden.
        '<div class="zy-aurora" aria-hidden="true"><i></i><i></i><i></i></div>' +
        '<div class="zy-header">' +
        '<div class="zy-header-title"></div>' +
        '<div class="zy-header-sub"></div>' +
        '<div class="zy-header-status" data-visible="false"></div>' +
        '<button type="button" class="zy-header-close" aria-label="Close chat">' +
        GLOW_ICONS.close +
        "</button>" +
        "</div>" +
        '<div class="zy-messages"></div>' +
        '<div class="zy-composer" data-expanded="false">' +
        '<div class="zy-composer-shell">' +
        '<div class="zy-composer-row">' +
        '<div class="zy-composer-field">' +
        '<input type="text" placeholder=" " aria-label="Type a message" autocomplete="off" />' +
        '<div class="zy-composer-ph" aria-hidden="true"></div>' +
        "</div>" +
        '<button type="button" class="zy-send" aria-label="Send message">' +
        GLOW_ICONS.send +
        "</button>" +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="zy-note">Powered by Ziyarn</div>' +
        "</div>" +
        '<button type="button" class="zy-launcher" aria-label="Open chat">' +
        '<span class="zy-open">' +
        GLOW_ICONS.chat +
        '</span><span class="zy-close">' +
        GLOW_ICONS.close +
        "</span>" +
        "</button>" +
        "</div>"
      );
    },

    /**
     * Replaces the bouncing typing dots with the thinking orb.
     *
     * The engine calls this when a request goes out and calls `.done()` on the
     * returned controller the moment the first token lands, so the orb always
     * hands the bubble back empty for the real reply. Both the orb and the
     * typing dots are strictly placeholders — neither ever holds the answer.
     */
    onThinking: function (node) {
      return moCreateThinking(node, { speed: 1 });
    },
  });


/* variant: sleek */
  // Modern Sleek is the React surface at /embed/<slug>. The script owns only
  // the launcher and the full-screen frame, so a customer embeds it with the
  // same <zy-widget> tag as Classic and Glow.
  var SLEEK_ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };

  registerWidget("sleek", {
    // Stylesheet shipped by build-widget.mjs as VARIANT_CSS.sleek.
    css: VARIANT_CSS.sleek,
    // Tells the engine to skip the panel wiring and mount the iframe instead.
    iframe: true,

    /**
     * @param {{title: string, subtitle: string, color: string, position: string}} config
     */
    markup: function (config) {
      return (
        '<div class="zy-wrap" data-position="' +
        config.position +
        '" data-variant="sleek" data-open="false">' +
        '<button type="button" class="zy-launcher" aria-label="Open chat" aria-expanded="false">' +
        '<span class="zy-open">' +
        SLEEK_ICONS.chat +
        '</span><span class="zy-close">' +
        SLEEK_ICONS.close +
        "</span>" +
        "</button>" +
        '<div class="zy-sleek-overlay" hidden>' +
        '<iframe class="zy-sleek-frame" title="Chat with us" allow="clipboard-write" referrerpolicy="no-referrer"></iframe>' +
        "</div>" +
        "</div>"
      );
    },
  });


/* engine — /api/chat, SSE streaming, delta long-poll, composer */
  class ZyWidget extends HTMLElement {
    constructor() {
      super();
      // ---- State ----
      this._open = false;            // whether the chat panel is visible
      this._streaming = false;       // true while an AI response is being streamed in
      this._thinking = null;          // active variant thinking controller, or null
      this._apiBase = null;          // API base URL (e.g. "https://ziyarn.vercel.app")
      this._conversationId = null;   // current conversation ID (persisted in localStorage)
      this._visitorId = null;        // unique visitor ID (persisted in localStorage)
      // ---- Config (from data-* attributes) ----
      this._slug = "";               // domain slug — identifies which business/agent to talk to
      this._secret = "";             // embed secret — authenticates widget requests
      this._title = "Chat with us";  // header title (overridden by agent name after _init)
      this._subtitle = "We usually reply in minutes"; // header subtitle
      this._color = "#10b981";       // accent color for launcher, header, user messages
      this._position = "bottom-right"; // "bottom-right" or "bottom-left"
    }

    // -------------------------------------------------------------------------
    // connectedCallback — called when <zy-widget> is inserted into the DOM
    // -------------------------------------------------------------------------
    // This is the main initialization entry point. It:
    //   1. Reads data-* attributes
    //   2. Creates the Shadow DOM (isolated styles + markup)
    //   3. Caches references to key DOM elements for fast access
    //   4. Restores visitor ID and conversation from localStorage
    //   5. Wires up event listeners
    //   6. Calls _init() to fetch agent config and load conversation history
    connectedCallback() {
      if (this._rendered) return; // prevent double-init (e.g. React re-renders)
      this._rendered = true;

      // ---- Read configuration from data-* attributes ----
      this._slug = this.getAttribute("data-slug") || "";
      this._secret = this.getAttribute("data-secret") || "";
      this._title = this.getAttribute("data-title") || this._title;
      this._subtitle = this.getAttribute("data-subtitle") || this._subtitle;
      this._color = this.getAttribute("data-color") || this._color;
      this._position = this.getAttribute("data-position") || this._position;
      this._apiBase =
        this.getAttribute("data-api") || DEFAULT_API_BASE;

      // ---- Resolve which look to render ----
      // Fail-open: unknown or missing values fall back to classic, because
      // every widget embedded before variants existed has no data-variant.
      this._variant = resolveVariant(this.getAttribute("data-variant"));
      var variant = this._variant;

      // ---- Validate required attributes ----
      if (!this._slug || !this._secret) {
        console.error(
          "[zy-widget] data-slug and data-secret attributes are required"
        );
        return;
      }

      // ---- Create Shadow DOM ----
      // The shadow root encapsulates all styles and markup. The host page
      // cannot access or style elements inside the shadow root.
      var root = this.attachShadow({ mode: "open" });

      // ---- Build the DOM tree from the resolved variant ----
      // Structure (class names are the engine contract — see VARIANTS above):
      //   <div class="zy-wrap">          — fixed-position wrapper
      //     <div class="zy-panel">       — chat window (hidden until open)
      //       <div class="zy-header">    — title bar with close button
      //       <div class="zy-messages">  — scrollable message list
      //       <div class="zy-composer">  — input + send button
      //       <div class="zy-note">      — "Powered by Ziyarn"
      //     <button class="zy-launcher"> — floating chat bubble
      root.innerHTML =
        "<style>" +
        BASE_CSS +
        (variant.css || "") +
        "</style>" +
        variant.markup({
          title: this._title,
          subtitle: this._subtitle,
          color: this._color,
          position: this._position,
        });

      // ---- Apply accent color via CSS custom property ----
      var wrap = root.querySelector(".zy-wrap");
      wrap.style.setProperty("--zy-color", this._color);

      // ---- Cache DOM references for fast access ----
      // Avoids repeated querySelector calls during streaming/interaction.
      this._root = root;
      this._wrap = wrap;

      // Modern Sleek's chat lives on a separate page. It needs only the
      // launcher and the frame, so hand off before wiring the panel.
      if (variant.iframe) {
        this._mountSleek();
        return;
      }

      this._panel = root.querySelector(".zy-panel");
      this._launcher = root.querySelector(".zy-launcher");
      this._messages = root.querySelector(".zy-messages");
      this._input = root.querySelector(".zy-composer input");
      // Select by explicit class, NOT ".zy-composer button" — a positional
      // selector would bind _sendBtn to whatever button comes first.
      this._sendBtn = root.querySelector(".zy-composer .zy-send");
      this._composer = root.querySelector(".zy-composer");
      this._placeholder = root.querySelector(".zy-composer-ph");
      // Whether the visitor is in the field right now. Tracked here because
      // the input is inside a shadow root (see _syncPlaceholder).
      this._inputEngaged = false;
      this._placeholders = [
        "How can I help you today?",
        "What are your opening hours?",
      ];
      this._placeholderIndex = 0;
      this._placeholderTimer = null;
      this._renderPlaceholder();
      this._titleEl = root.querySelector(".zy-header-title");
      this._subEl = root.querySelector(".zy-header-sub");
      this._statusEl = root.querySelector(".zy-header-status");
      this._headerCloseBtn = root.querySelector(".zy-header-close");
      this._titleEl.textContent = this._title;
      this._subEl.textContent = this._subtitle;
      this._sendBtn.disabled = false;

      // ---- Visitor and conversation ids live in the session ----
      // Both persist across reloads so a returning visitor resumes the same
      // conversation. _createSession() (below) reads and writes them.
      this._session = null;

      // ---- Wire up event listeners ----
      this._launcher.addEventListener("click", this._toggle.bind(this));
      this._headerCloseBtn.addEventListener("click", this._toggle.bind(this));
      this._input.addEventListener("keydown", this._onKey.bind(this));
      this._input.addEventListener("input", this._onInput.bind(this));
      this._input.addEventListener("focus", this._onFocus.bind(this));
      this._sendBtn.addEventListener("click", this._send.bind(this));
      this._input.addEventListener("blur", this._onBlur.bind(this));
      this._startPlaceholderCycle();

      // ---- Bootstrap: fetch agent info + load conversation history ----
      this._init();
    }

    // -------------------------------------------------------------------------
    // localStorage helpers — persist visitor ID and conversation ID
    // -------------------------------------------------------------------------
    // Keys are namespaced with the domain slug so multiple widgets on the
    // same page (different domains) don't collide.
    // -------------------------------------------------------------------------
    // The conversation itself lives in @repo/widget-core — transport, streaming,
    // storage and reconnect live there, so the React package and a future native
    // client share them. Everything below is rendering.
    // -------------------------------------------------------------------------
    _createSession() {
      var self = this;
      this._session = ZiyarnCore.createSession({
        apiBase: this._apiBase,
        secret: this._secret,
        slug: this._slug,
      });
      this._visitorId = this._session.visitorId;
      this._conversationId = this._session.conversationId;
      return this._session;
    }

    // -------------------------------------------------------------------------
    // _init — bootstrap the widget after DOM is ready
    // -------------------------------------------------------------------------
    //   1. Load the agent's config: name, description, placeholder prompts. This
    //      also validates the embed secret.
    //   2. If there is a saved conversation, replay it; otherwise greet.
    _init() {
      var self = this;
      this._createSession();
      this._session
        .loadConfig()
        .then(function (data) {
          if (data && data.agent) {
            if (data.agent.name) self._titleEl.textContent = data.agent.name;
            if (data.agent.description)
              self._subEl.textContent = data.agent.description;
          }
          if (data && data.placeholders) {
            self._setPlaceholders(data.placeholders);
          }
        })
        .catch(function () {
          /* keep attribute defaults — API might be unreachable */
        });

      this._loadHistory();
    }

    // -------------------------------------------------------------------------
    // _mountSleek — launcher + full-screen iframe for Modern Sleek
    // -------------------------------------------------------------------------
    // The chat surface is the React page at /embed/<slug>. Keeping it in an
    // iframe gives it a private document for layout and styles, while the
    // customer still uses the same <zy-widget> tag as the other variants.
    _mountSleek() {
      var self = this;
      this._sleekLauncher = this._root.querySelector(".zy-launcher");
      this._sleekOverlay = this._root.querySelector(".zy-sleek-overlay");
      this._sleekFrame = this._root.querySelector(".zy-sleek-frame");

      var embedUrl;
      try {
        // The iframe page is served beside this script, not by data-api:
        // data-api points at the chat API, while /embed is an app route.
        embedUrl = new URL(
          "/embed/" + encodeURIComponent(this._slug),
          DEFAULT_API_BASE
        );
      } catch (_) {
        console.error("[zy-widget] could not build the Modern Sleek URL");
        return;
      }
      embedUrl.searchParams.set("secret", this._secret);
      this._sleekFrame.src = embedUrl.toString();
      this._sleekFrame.title = this._title || "Chat with us";

      this._sleekLauncher.addEventListener("click", function () {
        self._setSleekOpen(true);
      });

      // The iframe asks the host to close itself. event.source is the frame's
      // own window proxy, so another frame on the page cannot trigger this.
      this._sleekMessageHandler = function (event) {
        if (
          event.source === self._sleekFrame.contentWindow &&
          event.data &&
          event.data.type === "ziyarn:close"
        ) {
          self._setSleekOpen(false);
        }
      };
      window.addEventListener("message", this._sleekMessageHandler);

      // Escape is handled inside the iframe too; this covers the case where
      // focus is still on the host page when the frame opens.
      this._sleekKeyHandler = function (event) {
        if (event.key === "Escape" && self._open) {
          self._setSleekOpen(false);
        }
      };
      document.addEventListener("keydown", this._sleekKeyHandler);
    }

    _setSleekOpen(open) {
      this._open = open;
      this._wrap.setAttribute("data-open", String(open));
      this._sleekOverlay.hidden = !open;
      this._sleekLauncher.setAttribute(
        "aria-label",
        open ? "Close chat" : "Open chat"
      );
      this._sleekLauncher.setAttribute("aria-expanded", String(open));
      if (open) {
        this._sleekFrame.focus();
      } else {
        this._sleekLauncher.focus();
      }
    }

    // -------------------------------------------------------------------------
    // _loadHistory — replay a saved conversation, then greet a new visitor
    // -------------------------------------------------------------------------
    _loadHistory() {
      var self = this;
      if (!this._session) return;
      var restored = this._session
        .loadHistory()
        .then(function (data) {
          if (data && Array.isArray(data.messages) && data.messages.length) {
            self._messages.textContent = ""; // clear greeting
            data.messages.forEach(function (message) {
              // Route each message to the correct visual style:
              //   "owner"   = human support agent
              //   role user = the visitor
              //   role assistant = the AI agent
              if (message.sender === "owner")
                self._appendMessage("owner", message.content || "");
              else if (message.role === "user")
                self._appendMessage("user", message.content || "");
              else if (message.role === "assistant")
                self._appendMessage("agent", message.content || "");
            });
            // A conversation that was escalated keeps getting human replies,
            // so start listening before the visitor says anything.
            if (data.conversation && data.conversation.status === "escalated") {
              self._listenForOwner();
            }
            return true;
          }
          return false;
        })
        .catch(function () {
          self._appendMessage("agent", "Hi there! How can we help you today?");
          return false;
        });

      void restored;
    }

    // -------------------------------------------------------------------------
    // _listenForOwner — keep the panel in step with the human teammate
    // -------------------------------------------------------------------------
    _listenForOwner() {
      var self = this;
      if (!this._session) return;
      this._session.listenForOwnerReplies({
        onMessage: function (message) {
          if (message.sender !== "owner" || !message.content) return;
          self._appendMessage("owner", message.content);
        },
      });
    }


    _toggle() {
      this._open = !this._open;
      this._wrap.setAttribute("data-open", String(this._open));
      this._launcher.setAttribute(
        "aria-label",
        this._open ? "Close chat" : "Open chat"
      );
      if (this._open) {
        // Scroll to the latest message and focus the input
        this._messages.scrollTop = this._messages.scrollHeight;
        this._input.focus();
      }
    }

    // -------------------------------------------------------------------------
    // _onKey — handle keyboard input in the text field
    // -------------------------------------------------------------------------
    // Enter sends the message (unless Shift is held for a newline).
    // Only sends when not currently streaming an AI response.
    _onKey(event) {
      if (event.key === "Enter" && !event.shiftKey && !this._streaming) {
        event.preventDefault();
        this._send();
      }
      this._syncExpanded();
    }

    // -------------------------------------------------------------------------
    // _syncExpanded — expand the composer while focused or non-empty.
    //
    // The composer grows once the visitor is engaged, and collapses again when
    // the field is blurred and emptied.
    // -------------------------------------------------------------------------
    _syncExpanded() {
      var expanded = this._streaming || Boolean(this._input.value);
      this._composer.setAttribute("data-expanded", String(expanded));
    }

    // -------------------------------------------------------------------------
    // _setPlaceholders — adopt the prompts the server chose for this business
    // type. Called from _init(); falls back to the generic list above.
    // -------------------------------------------------------------------------
    _setPlaceholders(list) {
      if (!Array.isArray(list) || !list.length) return;
      var cleaned = list
        .filter(function (item) { return typeof item === "string"; })
        .map(function (item) { return item.slice(0, 60); })
        .filter(function (item) { return item.length > 0; });
      if (!cleaned.length) return;
      this._placeholders = cleaned;
      this._placeholderIndex = 0;
      this._renderPlaceholder();
    }

    // -------------------------------------------------------------------------
    // _renderPlaceholder — draw the rotating hint under the input.
    //
    // Each character is its own span carrying a staggered animation-delay, so
    // the blur-in cascade is pure CSS. Rebuilt only when the text changes or the
    // visitor starts typing — never per keystroke.
    // -------------------------------------------------------------------------
    _renderPlaceholder() {
      if (!this._placeholder) return;
      var text = this._placeholders[this._placeholderIndex] || "";
      var html = "";
      for (var charIndex = 0; charIndex < text.length; charIndex += 1) {
        var character = text.charAt(charIndex);
        html +=
          '<span style="--zy-ph-delay:' +
          charIndex * 22 +
          'ms">' +
          (character === " " ? "&nbsp;" : this._escapeHtml(character)) +
          "</span>";
      }
      this._placeholder.innerHTML = html;
      this._placeholder.removeAttribute("data-leaving");
    }

    _escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    // -------------------------------------------------------------------------
    // _startPlaceholderCycle — rotate the hint every few seconds while idle.
    // Cleared the moment the visitor types, so their draft is never disturbed.
    // -------------------------------------------------------------------------
    _startPlaceholderCycle() {
      var self = this;
      this._stopPlaceholderCycle();
      if (this._placeholders.length < 2) return;
      this._placeholderTimer = setInterval(function () {
        if (self._input.value || self._streaming) return;
        // Fade the old phrase out before swapping, so the change reads as
        // intentional rather than a flicker.
        if (self._placeholder) {
          self._placeholder.setAttribute("data-leaving", "true");
        }
        setTimeout(function () {
          self._placeholderIndex =
            (self._placeholderIndex + 1) % self._placeholders.length;
          self._renderPlaceholder();
        }, 320);
      }, 4200);
    }

    _stopPlaceholderCycle() {
      if (this._placeholderTimer) {
        clearInterval(this._placeholderTimer);
        this._placeholderTimer = null;
      }
    }

    // -------------------------------------------------------------------------
    // _onFocus / _onInput — expand the composer and park the hint while typing
    // -------------------------------------------------------------------------
    _onFocus() {
      this._inputEngaged = true;
      this._syncExpanded();
      this._syncPlaceholder();
    }

    _onBlur() {
      this._inputEngaged = false;
      this._syncExpanded();
      this._syncPlaceholder();
    }

    _onInput() {
      this._syncExpanded();
      this._syncPlaceholder();
    }

    // -------------------------------------------------------------------------
    // _syncPlaceholder — hide the hint while the visitor is typing or focused.
    //
    // The hint is drawn under the input, so leaving it up while there is text
    // makes the two overlap and the field unreadable. Once the visitor focuses
    // the field they already know what it is for, so the hint goes away there
    // too, and comes back when they leave an empty field.
    //
    // Focus is tracked by the focus/blur handlers rather than compared against
    // document.activeElement: the field lives in a shadow root, so
    // document.activeElement is the host element, never the input itself.
    // -------------------------------------------------------------------------
    _syncPlaceholder() {
      var engaged = this._inputEngaged || Boolean(this._input.value);
      this._composer.setAttribute("data-ph-hidden", String(engaged));

      if (engaged) {
        this._stopPlaceholderCycle();
        return;
      }

      this._renderPlaceholder();
      this._startPlaceholderCycle();
    }

    // -------------------------------------------------------------------------
    // disconnectedCallback — called when <zy-widget> leaves the DOM
    // -------------------------------------------------------------------------
    // The variant's thinking state may own a requestAnimationFrame loop (Glow's
    // orb does). Without this, removing the element would leave that loop
    // running on a detached node — a permanent per-tab CPU cost on the
    // customer's site.
    disconnectedCallback() {
      if (this._sleekMessageHandler) {
        window.removeEventListener("message", this._sleekMessageHandler);
        this._sleekMessageHandler = null;
      }
      if (this._sleekKeyHandler) {
        document.removeEventListener("keydown", this._sleekKeyHandler);
        this._sleekKeyHandler = null;
      }
      this._abortThinking();
    }

    // -------------------------------------------------------------------------
    // _appendMessage — add a chat bubble to the message list
    // -------------------------------------------------------------------------
    // kind: "agent" | "user" | "owner" | "error"
    //   - "agent" messages are rendered through renderMd() (supports bold,
    //     italic, code, line breaks). This is safe because renderMd() escapes
    //     HTML first, then applies only controlled formatting tags.
    //   - "user" and "owner" messages use textContent (plain text only).
    //
    // Returns the created DOM node so callers can modify it later
    // (e.g. streaming updates to the typing indicator).
    _appendMessage(kind, text) {
      var node = document.createElement("div");
      node.className = "zy-msg zy-msg-" + kind;
      if (kind === "agent") {
        node.innerHTML = renderMd(text);
      } else {
        node.textContent = text;
      }
      this._messages.appendChild(node);
      this._scrollToBottom();
      return node;
    }

    _scrollToBottom() {
      this._messages.scrollTop = this._messages.scrollHeight;
    }

    // -------------------------------------------------------------------------
    // _resolveThinking — asks the variant's thinking controller to hand the
    // placeholder bubble back
    // -------------------------------------------------------------------------
    // Returns a promise ONLY when the controller animates out asynchronously, so
    // the caller knows it must defer writing the reply. Returns null when there
    // was nothing to resolve, which keeps the common path (typing dots, and
    // every token after the first) fully synchronous.
    //
    // The ordering matters: the controller clears the node as part of finishing
    // up, so writing the reply before awaiting it would have the reply wiped.
    _resolveThinking() {
      var thinking = this._thinking;
      if (!thinking) return null;
      this._thinking = null;
      var settled = thinking.done();
      return settled && typeof settled.then === "function" ? settled : null;
    }

    // -------------------------------------------------------------------------
    // _abortThinking — tears the placeholder down immediately
    // -------------------------------------------------------------------------
    // Used on the paths where there is no answer coming: errors, escalations,
    // timeouts, and teardown. No dissolve animation, because nothing is being
    // replaced — the caller is about to overwrite the node with text anyway.
    _abortThinking() {
      var thinking = this._thinking;
      if (!thinking) return;
      this._thinking = null;
      if (typeof thinking.destroy === "function") thinking.destroy();
    }

    // -------------------------------------------------------------------------
    // _setStatus — show/hide the status indicator in the header
    // -------------------------------------------------------------------------
    // Used during escalation to show "Connecting you with a human..."
    // with a pulsing green dot.
    _setStatus(text) {
      if (text) {
        this._statusEl.textContent = text;
        this._statusEl.setAttribute("data-visible", "true");
      } else {
        this._statusEl.textContent = "";
        this._statusEl.setAttribute("data-visible", "false");
      }
    }

    // -------------------------------------------------------------------------
    // _send — send a user message to the AI
    // -------------------------------------------------------------------------
    // Flow:
    //   1. Add the user's message to the chat UI
    //   2. Add a "typing" indicator placeholder
    //   3. POST /api/chat with the message, visitor ID, and conversation ID
    //   4. The response is an SSE stream — read it incrementally
    //   5. On error, show an error message in the typing bubble
    //   6. On completion, re-enable the input and focus it
    //
    // The server streams SSE events:
    //   data: {"type":"text","delta":"Hello"}      — incremental AI text
    //   data: {"type":"escalate"}                   — handoff to human
    //   data: {"type":"done","conversationId":"x"}  — response complete
    //   data: {"type":"error","message":"..."}      — error occurred
    _send() {
      var self = this;
      var text = this._input.value.trim();
      if (!text || this._streaming || !this._session) return;

      this._input.value = "";
      this._syncExpanded();
      this._syncPlaceholder();
      this._appendMessage("user", text);
      this._streaming = true;
      this._syncExpanded();
      this._sendBtn.disabled = true;

      // Placeholder bubble for the in-flight reply. A variant may offer something
      // richer than the typing dots (Glow shows a thinking orb); the controller
      // it returns owns the node until it hands the node back.
      var typing = this._appendMessage("agent", "");
      typing.classList.add("zy-msg-typing");
      this._thinking = this._variant.onThinking
        ? this._variant.onThinking(typing, this)
        : null;
      if (!this._thinking) {
        typing.innerHTML =
          '<span class="zy-typing-dots"><span class="zy-dot"></span><span class="zy-dot"></span><span class="zy-dot"></span></span>';
      }

      // The agent's typing indicator must be visible for a beat even when the
      // first token lands instantly, or a fast reply looks like a glitch.
      this._typingStartedAt = Date.now();
      this._typingMinimumMs = 600;
      this._reply = "";

      this._session
        .send(text, {
          onDelta: function (delta) {
            self._reply += delta;
            self._renderReply(typing);
          },
          onTool: function () {
            // The tool card arrives with the redesign; the event is already
            // flowing, so nothing to do here yet.
          },
          onEscalate: function () {
            self._abortThinking();
            self._setStatus("Connecting you with a human...");
            typing.classList.remove("zy-msg-typing");
            typing.textContent =
              "I've asked a human teammate to take over - they'll join this chat shortly.";
            self._scrollToBottom();
            self._listenForOwner();
          },
          onDone: function (conversationId) {
            self._conversationId = conversationId || self._conversationId;
            self._listenForOwner();
          },
          onError: function (message) {
            self._abortThinking();
            typing.classList.remove("zy-msg-typing");
            typing.classList.add("zy-msg-error");
            typing.textContent = message;
          },
        })
        .then(function () {
          // A turn that ended with nothing rendered (aborted, or an error the
          // shell handled) must not leave an empty bubble behind.
          if (!self._reply) {
            self._abortThinking();
            typing.classList.remove("zy-msg-typing");
          }
        })
        .finally(function () {
          self._streaming = false;
          self._sendBtn.disabled = false;
          self._syncExpanded();
          // Resume the idle hint once the reply has landed.
          self._startPlaceholderCycle();
          self._input.focus();
        });
    }

    // -------------------------------------------------------------------------
    // _renderReply — write the accumulated reply into the placeholder bubble
    // -------------------------------------------------------------------------
    // The first token hands control back from the thinking orb. Wait for it to
    // release the node before writing, or its cleanup would wipe the reply.
    // Later tokens find nothing to resolve and take the synchronous path, so
    // streaming stays token by token.
    _renderReply(typingNode) {
      var handover = this._resolveThinking();
      if (handover) {
        var node = typingNode;
        var self = this;
        // Read this._reply when the orb releases the node, not now: tokens
        // keep arriving while it animates out, and a snapshot taken here
        // would land on screen after the newer renders and undo them.
        handover.then(function () {
          node.innerHTML = renderMd(self._reply);
          self._scrollToBottom();
        });
        return;
      }
      typingNode.innerHTML = renderMd(this._reply);
      this._scrollToBottom();
    }

  }



// ---------------------------------------------------------------------------
  // Register the custom element
  // ---------------------------------------------------------------------------
  // Guard against browsers that don't support Web Components.
  // The try/catch handles the case where the script is loaded multiple times
  // (e.g. hot reload, dual script tags) — re-defining throws an error.
  if (!("customElements" in window)) {
    console.error("[zy-widget] customElements is not supported in this browser");
    return;
  }

  try {
    customElements.define("zy-widget", ZyWidget);
  } catch (_) {
    /* already defined */
  }

  // ---------------------------------------------------------------------------
  // Public registration API
  // ---------------------------------------------------------------------------
  // Lets a widget be registered without editing the build, and lets the contract
  // be exercised by tests. Not a capability grant: registering a variant only
  // supplies markup and styles, and <zy-widget> is already in the page's global
  // registry.
  window.ZyWidget = {
    register: registerWidget,
    list: function () {
      return Object.keys(VARIANTS);
    },
    resolve: resolveVariant,
  };
})();
