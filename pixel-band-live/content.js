(() => {
  const CFG = globalThis.PIXEL_LIVE_CONFIG || { scale: 3, members: [], titleKeywords: [] };
  const { drawMember, drawNote } = globalThis.PixelSprites;
  const TEST = !!globalThis.PIXEL_LIVE_TEST; // 로컬 테스트 페이지용

  // stageMode: "taskbar" = 배경 없이 화면 맨 아래(작업표시줄 바로 위)에 멤버만 서 있음
//            "stage"   = 무대·조명·관객이 있는 박스
const TASKBAR = (CFG.stageMode || "taskbar") === "taskbar";
  const W = 120, H = TASKBAR ? 40 : 68, GROUND = TASKBAR ? 40 : 55, FLOOR = 60;
  const S = CFG.scale || 3;

  // ---------- 오버레이 ----------
  const wrap = document.createElement("div");
  wrap.id = "pixel-band-live";
  Object.assign(wrap.style, {
    position: "fixed", right: "16px", bottom: TASKBAR ? "0px" : "16px",
    width: W * S + "px", height: H * S + "px",
    zIndex: "2147483647", pointerEvents: "none",
    opacity: "0", transition: "opacity .4s",
  });
  if (TASKBAR) {
    // 배경 없음. 어두운 화면에서도 검은 옷이 보이도록 얇은 빛 테두리
    wrap.style.filter = "drop-shadow(0 0 1px rgba(255,255,255,.7)) drop-shadow(0 0 3px rgba(255,255,255,.25))";
  } else {
    Object.assign(wrap.style, { borderRadius: "8px", overflow: "hidden", boxShadow: "0 4px 18px rgba(0,0,0,.45)" });
  }
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  Object.assign(cv.style, { width: "100%", height: "100%", imageRendering: "pixelated", display: "block" });
  wrap.appendChild(cv);
  const g = cv.getContext("2d");

  function mount() {
    const host = document.fullscreenElement || document.body;
    if (host && wrap.parentNode !== host) host.appendChild(wrap);
  }
  document.addEventListener("fullscreenchange", mount);

  let enabled = true; // Alt+P 로 켜고 끄기
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "p" || e.key === "P" || e.code === "KeyP")) enabled = !enabled;
  }, true);

  // ---------- 영상 / 오디오 ----------
  let video = null;
  let actx = null, analyser = null, freq = null;
  const hooked = new WeakSet();
  let lowFrom = 1, lowTo = 4, vocFrom = 7, vocTo = 70, hiFrom = 93, fluxTo = 232;

  function findVideo() {
    return document.querySelector("#movie_player video.html5-main-video") || document.querySelector("video");
  }

  async function hookAudio() {
    if (!video || hooked.has(video)) return;
    try {
      actx = actx || new AudioContext();
      if (actx.state !== "running") await actx.resume().catch(() => {});
      // 컨텍스트가 멈춘 상태에서 연결하면 소리가 끊기므로, 실행 중일 때만 연결
      if (actx.state !== "running") return;
      if (!analyser) {
        analyser = actx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.55;
        analyser.connect(actx.destination);
        freq = new Uint8Array(analyser.frequencyBinCount);
        const binHz = actx.sampleRate / analyser.fftSize;
        lowFrom = Math.max(1, Math.floor(40 / binHz));
        lowTo = Math.max(lowFrom + 1, Math.ceil(160 / binHz));
        vocFrom = Math.floor(300 / binHz); vocTo = Math.ceil(3000 / binHz);
        hiFrom = Math.floor(4000 / binHz); fluxTo = Math.min(freq.length - 1, Math.ceil(10000 / binHz));
      }
      const src = actx.createMediaElementSource(video);
      src.connect(analyser);
      hooked.add(video);
    } catch (e) {
      hooked.add(video); // 실패하면 다시 시도하지 않고 가짜 박자로 동작
      console.warn("[Pixel Band Live] 오디오 연결 실패, 기본 박자로 동작합니다:", e);
    }
  }

  setInterval(() => {
    const v = findVideo();
    if (v && v !== video) {
      video = v;
      video.addEventListener("play", hookAudio);
      video.addEventListener("seeked", resetTracker);
      video.addEventListener("loadeddata", resetTracker);
      if (!video.paused) hookAudio();
    }
    mount();
  }, 1000);
  // 사용자 클릭/키 입력 시에도 연결 시도 (오디오 정책상 사용자 동작이 필요)
  ["click", "keydown"].forEach((t) => window.addEventListener(t, () => hookAudio(), true));

  // ---------- 표시 조건 ----------
  function titleMatches() {
    const kws = (CFG.titleKeywords || []).filter(Boolean);
    if (!kws.length) return true;
    const title = (document.title || "").toLowerCase();
    return kws.some((k) => title.includes(String(k).toLowerCase()));
  }
  function shouldShow() {
    if (!enabled || !video || video.paused || video.ended) return false;
    if (TEST) return true;
    if (!location.pathname.startsWith("/watch")) return false;
    const player = document.getElementById("movie_player");
    if (player && player.classList.contains("ad-showing")) return false;
    return titleMatches();
  }

  // ---------- 박자 추적 ----------
  // 1) 매 프레임 스펙트럼이 갑자기 커진 정도(onset)를 20ms 칸에 기록
  //    (킥 드럼 저음 위주 + 스네어·하이햇 고음 약간. 목소리 대역은 박자를 헷갈리게 해서 제외)
  // 2) 1초마다 최근 6초를 자기상관 분석해서 템포(BPM) 추정 (2배·절반 오류를 줄이려고 120BPM 근처를 약간 선호)
  // 3) 그 템포 간격으로 onset을 빗질(comb)해서 박자 위치를 찾고, 예측 위치를 30%씩 보정
  const mod = (a, n) => ((a % n) + n) % n;
  const BIN = 20, ENV_LEN = 300;
  const env = new Float32Array(ENV_LEN);
  let envIdx = 0, envTime = 0, envFilled = 0, prevSpec = null;
  let beatMs = 500, beatOrigin = 0, candMs = 0, lastTrack = 0, locked = false;
  let level = 0, silentSince = 0;
  let lastBeatIdx = null, beatCount = 0, lastBeat = 0;

  function resetTracker() {
    env.fill(0); envFilled = 0; envTime = 0; prevSpec = null; candMs = 0; beatOrigin = 0; lastBeatIdx = null; locked = false;
  }

  function pushOnset(now, v) {
    if (!envTime || now - envTime > ENV_LEN * BIN) { env.fill(0); envFilled = 0; envTime = now; }
    while (now - envTime >= BIN) { envTime += BIN; envIdx = (envIdx + 1) % ENV_LEN; env[envIdx] = 0; envFilled++; }
    env[envIdx] = Math.max(env[envIdx], v);
  }

  function trackTempo() {
    if (envFilled < 150) return; // 3초 이상 모인 뒤부터
    const N = Math.min(envFilled, ENV_LEN);
    const x = new Float32Array(N); // x[k] = k칸 전
    let mean = 0;
    for (let k = 0; k < N; k++) { x[k] = env[mod(envIdx - k, ENV_LEN)]; mean += x[k]; }
    mean /= N;
    for (let k = 0; k < N; k++) x[k] = Math.max(0, x[k] - mean);
    // 뾰족한 onset을 살짝 퍼뜨림: 박자 간격이 20ms 칸 사이에 걸쳐도 놓치지 않게
    const y = new Float32Array(N);
    const KER = [0.25, 0.6, 1, 0.6, 0.25];
    for (let k = 0; k < N; k++) for (let j = -2; j <= 2; j++) { const t = k + j; if (t >= 0 && t < N) y[k] += x[t] * KER[j + 2]; }
    x.set(y);

    const minLag = Math.round(60000 / 190 / BIN), maxLag = Math.round(60000 / 65 / BIN);
    const sc = [];
    let best = 0, bestLag = 0;
    for (let L = minLag; L <= maxLag; L++) {
      let s = 0;
      for (let k = 0; k + L < N; k++) s += x[k] * x[k + L];
      s /= N - L;
      if (2 * L < N) { let s2 = 0; for (let k = 0; k + 2 * L < N; k++) s2 += x[k] * x[k + 2 * L]; s += 0.5 * s2 / (N - 2 * L); } // 두 박 뒤도 맞으면 가산
      const bpm = 60000 / (L * BIN);
      sc[L] = s * Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.7, 2));
      if (sc[L] > best) { best = sc[L]; bestLag = L; }
    }
    if (!bestLag || best <= 0) return;
    let lag = bestLag;
    const a = sc[bestLag - 1], c = sc[bestLag + 1];
    if (a !== undefined && c !== undefined) { const d = a - 2 * best + c; if (d < 0) lag += (0.5 * (a - c)) / d; }
    const ms = lag * BIN;
    let newMs = beatMs;
    if (!locked) { newMs = ms; locked = true; }                                        // 첫 추정은 바로 적용
    else if (Math.abs(ms - beatMs) / beatMs < 0.08) newMs = beatMs * 0.5 + ms * 0.5;  // 비슷하면 부드럽게
    else if (candMs && Math.abs(ms - candMs) / candMs < 0.08) { newMs = ms; candMs = 0; } // 다르면 두 번 연속일 때 교체
    else candMs = ms;

    // 박자 위치
    const P = newMs / BIN;
    let bestPh = 0, bestS = -1;
    for (let ph = 0; ph < Math.ceil(P); ph++) {
      let s = 0, w = 1;
      for (let k = ph; k < N; k += P, w *= 0.9) s += (x[Math.round(k)] || 0) * w; // 최근 박자일수록 가중치 큼
      if (s > bestS) { bestS = s; bestPh = ph; }
    }
    const measured = envTime - bestPh * BIN; // 가장 최근 박자 시각(측정)
    if (!beatOrigin) { beatOrigin = measured; beatMs = newMs; return; }
    // 기존 예측에서 측정 시각과 가장 가까운 박자를 찾고, 그 차이의 절반만 보정
    const predicted = beatOrigin + Math.round((measured - beatOrigin) / beatMs) * beatMs;
    beatOrigin = predicted + (measured - predicted) * 0.5; // 기준점을 최근 박자로 옮겨서 템포가 바뀌어도 위치가 튀지 않게
    beatMs = newMs;
  }

  // ---------- 보컬 입 모양 ----------
  // 목소리 대역(300~3000Hz) 세기와 음절 시작 순간을 보고, 열린 정도에 맞는 모음 모양을 골라 보여줌
  //   크게: a / o / e,  중간: e / o / i,  작게: u / i,  조용: 다묾(-)
  // 한 모양은 최소 mouthHoldMs 동안 유지해서 천천히 바뀌게 함
  const HOLD = CFG.mouthHoldMs ?? 200;
  const SHAPES = { 3: ["a", "o", "a", "e"], 2: ["e", "o", "i", "a"], 1: ["u", "i", "u", "e"] };
  let vAvg = 0.1, vPeak = 0.3, vPrev = 0, syl = 0, mouth = "-", mouthAt = 0, quietSince = 0, pick = 0;

  function chooseMouth(now, size, newSyllable) {
    if (now - mouthAt < HOLD) return;           // 아직 유지 시간
    if (size === 0) {                             // 조용하면 잠깐 지난 뒤 다묾
      if (!quietSince) quietSince = now;
      if (now - quietSince > 120 && mouth !== "-") { mouth = "-"; mouthAt = now; }
      return;
    }
    quietSince = 0;
    if (!newSyllable && mouth !== "-") return;  // 새 음절이 아니면 지금 모양 유지
    const list = SHAPES[size];
    let next = list[pick++ % list.length];
    if (next === mouth) next = list[pick++ % list.length];
    mouth = next; mouthAt = now;
  }

  function updateMouth(now, v) {
    vAvg = vAvg * 0.995 + v * 0.005;
    vPeak = Math.max(v, vPeak * 0.998);
    const floor = vAvg * 0.8;
    const norm = Math.min(1, Math.max(0, (v - floor) / Math.max(0.02, vPeak - floor)));
    const onset = v - vPrev > 0.01;
    vPrev = v;
    if (onset) syl = 1;
    syl *= 0.9;
    const open = Math.max(norm * 0.8, syl * 0.9);
    chooseMouth(now, open > 0.7 ? 3 : open > 0.4 ? 2 : open > 0.18 ? 1 : 0, onset);
  }

  let fakeAt = 0;
  function fakeMouth(now) { // 소리를 못 읽을 때: 노래하듯 천천히 여닫음
    if (now < fakeAt) return;
    fakeAt = now + HOLD + (now % 150);
    const size = [3, 2, 0, 2, 3, 1, 2, 0][Math.floor(now / 211) % 8];
    mouthAt = 0; chooseMouth(now, size, true);
  }

  if (TEST) globalThis.__pbl = () => ({ beatMs, beatOrigin, mouth, now: performance.now() });

  function analyse(now) {
    let real = false;
    if (analyser && video && hooked.has(video)) {
      analyser.getByteFrequencyData(freq);
      let all = 0;
      for (let i = 0; i < freq.length; i++) all += freq[i];
      if (all > 0) { silentSince = 0; real = true; }
      else if (!silentSince) silentSince = now;
      if (real) {
        level = level * 0.7 + Math.min(1, (all / (freq.length * 255)) * 3) * 0.3;
        let flux = 0;
        if (prevSpec) for (let i = 1; i <= fluxTo; i++) { if (i > lowTo && i < hiFrom) continue; const d = freq[i] - prevSpec[i]; if (d > 0) flux += i <= lowTo ? d * 2 : d * 0.5; }
        if (!prevSpec) prevSpec = new Uint8Array(freq.length);
        prevSpec.set(freq);
        pushOnset(now, flux / 255);
        let v = 0;
        for (let i = vocFrom; i <= vocTo; i++) v += freq[i];
        updateMouth(now, v / ((vocTo - vocFrom + 1) * 255));
      } else if (now - silentSince < 3000) real = true; // 잠깐 조용한 건 무시
    }
    if (!real) { level = 0.45; beatMs = 500; fakeMouth(now); }
    else if (now - lastTrack > 1000) { lastTrack = now; trackTempo(); }
    wrap.dataset.mode = real ? "audio" : "fallback";
    wrap.dataset.bpm = (60000 / beatMs).toFixed(1); // 디버그용: 추정 BPM

    if (!beatOrigin) beatOrigin = now;
    const beatPos = (now - beatOrigin) / beatMs;
    const idx = Math.floor(beatPos);
    let beat = false;
    if (lastBeatIdx === null) lastBeatIdx = idx;
    else if (idx > lastBeatIdx) { beat = true; beatCount++; lastBeat = now; lastBeatIdx = idx; }
    else if (idx < lastBeatIdx - 1) lastBeatIdx = idx; // 보정으로 크게 뒤로 간 경우
    level = Math.min(1, level);
    return { beat, beatPos };
  }

  // ---------- 그리기 ----------
  const notes = [];      // 음표
  const confetti = [];   // 꽃가루
  const COLORS = ["#ff4d6d", "#4dd2ff", "#ffd84d", "#9b6bff", "#4dff9a"];
  const members = (CFG.members || []).slice(0, 6);
  let frameFlip = 0;

  function beam(top, bottom, half, color, alpha) {
    g.globalAlpha = alpha; g.fillStyle = color;
    g.beginPath(); g.moveTo(top - 1, 0); g.lineTo(top + 1, 0);
    g.lineTo(bottom + half, GROUND); g.lineTo(bottom - half, GROUND); g.closePath(); g.fill();
  }

  function drawStage(now, pulse) {
    g.globalAlpha = 1;
    g.fillStyle = "#0d0b18"; g.fillRect(0, 0, W, H);
    // 측면 조명: 박자마다 색이 바뀜 + 교차 스윕 조명
    const c1 = COLORS[beatCount % COLORS.length], c2 = COLORS[(beatCount + 2) % COLORS.length];
    beam(16, 30, 12, c1, 0.12 + pulse * 0.3);
    beam(104, 92, 12, c2, 0.12 + pulse * 0.3);
    const sw = Math.sin(now / 350) * 20;
    beam(40, 60 + sw, 6, COLORS[(beatCount + 1) % COLORS.length], 0.1 + pulse * 0.1);
    beam(80, 60 - sw, 6, COLORS[(beatCount + 3) % COLORS.length], 0.1 + pulse * 0.1);
    // 보컬 핀 조명
    g.globalAlpha = 0.16 + pulse * 0.14 + level * 0.12;
    g.fillStyle = "#fff1cf";
    g.beginPath(); g.moveTo(58, 0); g.lineTo(62, 0); g.lineTo(73, GROUND); g.lineTo(47, GROUND); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(60, GROUND, 13, 2, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    // 조명 기구
    g.fillStyle = "#333"; g.fillRect(0, 0, W, 2);
    [[15, c1], [39, COLORS[1]], [59, "#fff1cf"], [79, COLORS[3]], [103, c2]].forEach(([x, col]) => {
      g.fillStyle = "#555"; g.fillRect(x, 1, 3, 2); g.fillStyle = col; g.fillRect(x + 1, 3, 1, 1);
    });
    // 무대 바닥 (박자에 테두리가 번쩍)
    g.fillStyle = "#4a3426"; g.fillRect(0, GROUND, W, FLOOR - GROUND);
    g.fillStyle = pulse > 0.5 ? c1 : "#6b4c37"; g.fillRect(0, GROUND, W, 1);
    g.fillStyle = "#3a281d";
    for (let x = 6; x < W; x += 12) g.fillRect(x, GROUND + 1, 1, FLOOR - GROUND - 1);
  }

  function drawCrowd(pulse) {
    g.fillStyle = "#06050b"; g.fillRect(0, FLOOR, W, H - FLOOR);
    for (let i = 0; i < 15; i++) {
      const x = 4 + i * 8 + (i % 2) * 2;
      const seed = (i * 7919) % 13;
      const headY = FLOOR + 3 + (seed % 2);
      g.fillStyle = "#14121c";
      g.fillRect(x - 1, headY, 3, 2); g.fillRect(x - 2, headY + 2, 5, H - headY - 2);
      if (seed % 3 === 0) continue; // 응원봉 없는 관객
      const sx = x + 2;
      const sy = headY - 4 - ((i + frameFlip) % 2 === 0 ? 2 : 0);
      const color = COLORS[(i + beatCount) % COLORS.length];
      g.globalAlpha = 0.25; g.fillStyle = color; g.fillRect(sx - 1, sy - 1, 3, 5);
      g.globalAlpha = 1; g.fillRect(sx, sy, 1, 3);
      g.fillStyle = "#14121c"; g.fillRect(sx, sy + 3, 1, 2);
    }
  }

  function drawConfetti(now, beat) {
    if (beat) for (let k = 0; k < 4; k++) {
      confetti.push({ x: Math.random() * W, y: -2, vy: 0.35 + Math.random() * 0.35, vx: (Math.random() - 0.5) * 0.3, c: COLORS[(k + beatCount) % COLORS.length] });
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.x += c.vx + Math.sin((now + i * 100) / 200) * 0.15; c.y += c.vy;
      if (c.y > FLOOR) { confetti.splice(i, 1); continue; }
      g.fillStyle = c.c; g.fillRect(Math.round(c.x), Math.round(c.y), (Math.floor(c.y) % 4 < 2) ? 2 : 1, 1);
    }
    if (confetti.length > 200) confetti.splice(0, confetti.length - 200);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const show = shouldShow();
    wrap.style.opacity = show ? "1" : "0";
    if (!show) return;

    const { beat, beatPos } = analyse(now);
    const frac = beatPos - Math.floor(beatPos);
    const pulse = Math.max(0, 1 - (frac * beatMs) / 180); // 박자 순간에 1
    const period = beatMs / 2;
    frameFlip = mod(Math.floor(beatPos * 2), 2);
    if (TASKBAR) g.clearRect(0, 0, W, H);
    else { drawStage(now, pulse); drawConfetti(now, beat); }

    const n = members.length;
    const xs = n === 3 ? [24, 60, 96] : members.map((_, i) => Math.round((W / (n + 1)) * (i + 1)));
    members.forEach((m, i) => {
      const cx = xs[i];
      drawMember(g, m, cx, GROUND, { pulse, beatCount: beatCount + i, level, t: now, period, beatPos, mouth }, CFG.outfit, CFG.vocalLook, i);
      if (beat && Math.random() < 0.3) notes.push({ x: cx + 3, y: GROUND - 30, life: 1, c: COLORS[(i + beatCount) % COLORS.length] });
    });

    for (let i = notes.length - 1; i >= 0; i--) {
      const nt = notes[i];
      nt.y -= 0.15; nt.life -= 0.012;
      if (nt.life <= 0) { notes.splice(i, 1); continue; }
      g.globalAlpha = nt.life;
      drawNote(g, Math.round(nt.x + Math.sin(nt.y / 3)), Math.round(nt.y), nt.c);
      g.globalAlpha = 1;
    }
    if (!TASKBAR) drawCrowd(pulse);
  }
  requestAnimationFrame(frame);
})();
