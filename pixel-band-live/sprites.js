// 픽셀 멤버 그리기. 좌표 단위 = 픽셀 1칸.
// back number 3인 전용 스프라이트(iyori / bass / drums) + 범용 멤버(generic).
globalThis.PixelSprites = (() => {
  const DARK = "#14121c";

  // 문자열 맵을 그리는 도우미. '.' 은 투명.
  function drawMap(g, map, pal, x, y) {
    for (let r = 0; r < map.length; r++) {
      const row = map[r];
      for (let c = 0; c < row.length; c++) {
        const col = pal[row[c]];
        if (col) { g.fillStyle = col; g.fillRect(x + c, y + r, 1, 1); }
      }
    }
  }
  const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const mod = (a, n) => ((a % n) + n) % n;

  // 입 모양. 숫자(0~3)는 소리 크기 기반, 문자는 립싱크 데이터의 모음
  //   a: 크게 벌림(윗니) / e: 옆으로 벌림 / i: 이를 보이며 옆으로 / o: 동그랗게 / u: 작게 오므림 / n·-·0: 다묾
  function drawMouth(g, x, y, m, closed, dark) {
    const T = "#efe6de";
    switch (m) {
      case "a": case 3: rect(g, x - 1, y, 4, 2, dark); rect(g, x, y, 2, 1, T); break;
      case "e": rect(g, x - 1, y, 4, 1, dark); break;
      case "i": rect(g, x - 1, y, 4, 1, T); rect(g, x - 1, y, 1, 1, dark); rect(g, x + 2, y, 1, 1, dark); break;
      case "o": case 2: rect(g, x, y, 2, 2, dark); break;
      case "u": case 1: rect(g, x, y, 2, 1, dark); break;
      case "n": rect(g, x, y, 2, 1, "#8a5848"); break;
      default: rect(g, x, y, 2, 1, closed);
    }
  }

  // ---------- 의상 팔레트 ----------
  // stage: 첫 번째 사진(대기실) / black: 두 번째 사진(올블랙)
  const OUTFITS = {
    stage: {
      iyori: { V: "#7a1424", v: "#b0303f", d: "#4a0a16", W: "#f2efe8", J: "#4a6b96", j: "#33507a", O: "#1e1e24" },
      bass:  { J: "#1c1c22", j: "#3a3a44", P: "#3c3866", N: "#d0d0da", X: "#1a1a1f", x: "#c8682e", y: "#3f6fb8", O: "#1e1e24" },
      drums: { G: "#5d6a36", g: "#808f4e", T: "#2a2a30", Z: "#c8c8d0" },
    },
    black: {
      iyori: { V: "#1d1d22", v: "#3a3a44", d: "#101014", W: "#f2efe8", J: "#1a1a20", j: "#2a2a32", O: "#101014" },
      bass:  { J: "#18181d", j: "#34343e", P: "#22222a", N: "#18181d", X: "#18181d", x: "#18181d", y: "#18181d", O: "#101014" },
      drums: { G: "#1c1c22", g: "#3a3a44", T: "#141418", Z: "#d8d8e0" },
    },
  };

  // ================= 보컬: 시미즈 이요리 =================
  // 볼륨 있는 검은 곱슬머리, 앞머리가 눈썹을 덮음, 버건디 벨벳 셔츠 + 흰 티, 청바지, 기타
  const IYORI_HEAD = [
    "...K.kK.K.K...",
    "..KKKKKkKKKK..",
    ".KkKKKKKKKKkK.",
    "KKKKkKKKKkKKKK",
    "KkKKKKKKKKKKkK",
    "KKKSKKSSKKSKKK",
    ".KKSSSSSSSSKK.",
    "KKKS......SKKK",   // 눈 줄 (따로 그림)
    ".KKSSSSSSSSKK.",
    "..KSSSSSSSSK..",
    "...KSSSSSSK...",
    ".....SSSS.....",
  ];
  const IYORI_BODY = [
    "..dVvWWvVd..",
    ".dVVVWWVVVd.",
    "dVVvVWWVvVVd",
    "dVvVVWWVVvVd",
    "dVVVVWWVVVVd",
    ".VVvVWWVvVV.",
    ".dVVVWWVVVd.",
    ".dVVVWWVVVd.",
  ];
  const IYORI_LEGS = [
    "..JJJ..JJJ..",
    "..JjJ..JjJ..",
    "..JJJ..JJJ..",
    "..JJJ..JJJ..",
    ".OOOO..OOOO.",
  ];
  const GUITAR = [
    // b 테두리, B 바디, o 사운드홀, n 넥, h 헤드
    "...........hh",
    "..........nh.",
    ".........n...",
    ".bbbb..nn....",
    "bBBBBbn......",
    "bBBoBBb......",
    "bBBBBBb......",
    ".bbbbb.......",
  ];
  const GUITAR_PAL = { b: "#5a240e", B: "#d8843a", o: "#2a140a", n: "#d2a870", h: "#e8e0d0" };
  const STRAY_CURLS = [[2, -1], [5, -2], [8, -1], [11, -1], [-1, 3], [14, 4], [0, 6], [13, 7]];

  function drawIyori(g, cx, ground, s, pal) {
    const P = Object.assign({ K: "#1c161e", k: "#54424e", S: "#f1c6a2" }, pal);
    const ox = cx - 6;
    const loud = s.level > 0.62;
    const quiet = s.level < 0.28;
    const bob = s.pulse > 0.5 ? -1 : 0;
    // 조용한 구간: 천천히 좌우로 흔들림 / 큰 구간: 마이크 쪽으로 몸을 기울임
    const sway = quiet ? Math.round(Math.sin(s.t / 700)) : (loud && s.pulse > 0.3 ? 1 : 0);

    const legY = ground - 5 + bob; // 박자마다 한 칸 점프
    const bodyY = legY - 8;
    const headY = bodyY - 12 + (loud && s.pulse > 0.5 ? -1 : 0);
    const hx = ox - 1 + sway;

    drawMap(g, IYORI_LEGS, P, ox, legY);
    drawMap(g, IYORI_BODY, P, ox, bodyY);

    // 팔 (벨벳 소매 + 손)
    rect(g, ox - 1, bodyY + 1, 1, 4, P.d);
    rect(g, ox + 12, bodyY + 1, 1, 3, P.d);

    // 머리
    drawMap(g, IYORI_HEAD, P, hx, headY);
    // 박자마다 곱슬머리가 튐
    if (s.pulse > 0.5) {
      STRAY_CURLS.forEach(([x, y], i) => {
        if ((s.beatCount + i) % 2 === 0) rect(g, hx + x, headY + y, 1, 1, i % 2 ? P.k : P.K);
      });
    }
    // 눈: 조용하면 감고(감정 몰입), 아니면 웃는 눈
    const ey = headY + 7;
    if (quiet) {
      rect(g, hx + 4, ey, 2, 1, "#3a2420"); rect(g, hx + 8, ey, 2, 1, "#3a2420");
    } else {
      rect(g, hx + 4, ey, 1, 1, P.S); rect(g, hx + 5, ey, 1, 1, DARK);
      rect(g, hx + 8, ey, 1, 1, DARK); rect(g, hx + 9, ey, 1, 1, P.S);
      rect(g, hx + 6, ey, 2, 1, P.S);
    }
    if (quiet) rect(g, hx + 6, ey, 2, 1, P.S);
    // 입: 소리 크기에 따라
    const my = headY + 10;
    drawMouth(g, hx + 6, my, s.mouth, "#c98a72", "#5a1a1a");

    // 기타 (몸 앞)
    drawMap(g, GUITAR, GUITAR_PAL, ox + 1, bodyY + 2);
    // 코드 잡는 손(넥 위) / 스트로크 손
    rect(g, ox + 10, bodyY + 3, 1, 1, P.S);
    rect(g, ox + 3, bodyY + (s.pulse > 0.5 ? 4 : 7), 1, 1, P.S);

    // 마이크 스탠드: 바닥에 고정 (점프해도 움직이지 않음)
    const micX = ox + 6;
    const myF = ground - 5 - 8 - 12 + 10; // 점프 안 했을 때 입 높이
    rect(g, micX - 1, myF + 1, 2, 2, "#2a2a30");
    rect(g, micX - 1, myF + 1, 1, 1, "#6b6f78");
    rect(g, micX, myF + 3, 1, ground - (myF + 3), "#55585f");
    rect(g, micX - 2, ground - 1, 5, 1, "#55585f");
  }

  // ================= 보컬 라이브 룩 (사용자가 준 라이브 일러스트 기준) =================
  // 갈색 곱슬머리(옆으로 내려옴) + 수염 약간, 오버사이즈 검은 맨투맨, 크림색 스트랩,
  // 버터스카치 텔레캐스터(검은 픽가드), 왼쪽에서 뻗어 나온 붐 마이크 스탠드
  const LIVE_HEAD = [
    "...K.kK.K.K...",
    "..KKkKKkKKKK..",
    ".KkKKKKKKKKkK.",
    "KKKKkKKKKkKKKK",
    "KkKKKKKKKKKKkK",
    "KKKSkKSSKKSKKK",
    "KKKSSSSSSSSKKK",
    "KKKS......SKKK",   // 눈 줄
    "KkKSSSSSSSSKkK",
    ".KKSSSSSSSSKK.",
    "..KKsSSSSsKK..",   // 입 줄 + 수염
    ".....ssss.....",
  ];
  const LIVE_BODY = [
    "....dVVVVd....",
    "..dVVVVVVCVd..",
    ".dVVVvVVVCVVd.",
    "dVVVVVVVVCVVVd",
    "dVvVVVVVVCVVVd",
    "dVVVVVVVVVVvVd",
    ".VVVVVVVVVVVV.",
    ".dVVVVVVVVVVd.",
    "..dVVVVVVVVd..",
  ];
  const LIVE_LEGS = [
    "...JJJ..JJJ...",
    "...JjJ..JjJ...",
    "...JJJ..JJJ...",
    "...JJJ..JJJ...",
    "..OOOO..OOOO..",
  ];
  const TELE = [
    ".............hhh",
    "............nh..",
    "...........n....",
    "..........n.....",
    ".........n......",
    "..bbbb..n.......",
    ".bBBBBbn........",
    "bBBppcBb........",
    "bBBpppBb........",
    "bBBBBcBBb.......",
    ".bBBBBBb........",
    "..bbbbb.........",
  ];
  const TELE_PAL = { b: "#9a6a1c", B: "#ebbb4e", p: "#1b1b1d", c: "#d4d5da", n: "#e2bb74", h: "#e2bb74" };
  const LIVE_PAL = {
    K: "#2e1d14", k: "#7a4e2e", S: "#ecc09a", s: "#b48e72",
    V: "#2a2426", v: "#433a3c", d: "#6a4632", C: "#d8c08a",
    J: "#2a2626", j: "#1c1919", O: "#111111",
  };
  const LIVE_CURLS = [[2, -1], [5, -2], [8, -1], [11, -1], [-1, 3], [14, 4], [-1, 8], [14, 9]];

  function line(g, x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      rect(g, x0, y0, 1, 1, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function drawIyoriLive(g, cx, ground, s) {
    const P = LIVE_PAL;
    const ox = cx - 7; // 14칸 폭
    const loud = s.level > 0.62;
    const quiet = s.level < 0.28;
    const bob = s.pulse > 0.5 ? -1 : 0;
    const sway = quiet ? Math.round(Math.sin(s.t / 900)) : (loud && s.pulse > 0.3 ? -1 : 0); // 큰 소리엔 마이크(왼쪽) 쪽으로
    const legY = ground - 5 + bob; // 박자마다 한 칸 점프
    const bodyY = legY - 9;
    const headY = bodyY - 11 + (loud && s.pulse > 0.5 ? -1 : 0);
    const hx = ox + sway;

    drawMap(g, LIVE_LEGS, P, ox, legY);
    drawMap(g, LIVE_BODY, P, ox, bodyY);
    // 오버사이즈 소매
    rect(g, ox - 1, bodyY + 3, 2, 5, P.V); rect(g, ox - 1, bodyY + 3, 1, 5, P.d); rect(g, ox + 13, bodyY + 3, 2, 3, P.V); rect(g, ox + 14, bodyY + 3, 1, 3, P.d);

    drawMap(g, LIVE_HEAD, P, hx, headY);
    if (s.pulse > 0.5) {
      LIVE_CURLS.forEach(([x, y], i) => {
        if ((s.beatCount + i) % 2 === 0) rect(g, hx + x, headY + y, 1, 1, i % 2 ? P.k : P.K);
      });
    }
    // 눈: 기본은 노래하는 반쯤 감은 눈, 조용하면 완전히 감음
    const ey = headY + 7;
    rect(g, hx + 4, ey, 6, 1, P.S);
    if (quiet) {
      rect(g, hx + 4, ey, 2, 1, "#4a2c20"); rect(g, hx + 8, ey, 2, 1, "#4a2c20");
    } else {
      rect(g, hx + 4, ey - 1, 2, 1, "#4a2c20"); rect(g, hx + 8, ey - 1, 2, 1, "#4a2c20"); // 처진 눈꺼풀
      rect(g, hx + 5, ey, 1, 1, DARK); rect(g, hx + 8, ey, 1, 1, DARK);
    }
    // 입
    const my = headY + 10;
    drawMouth(g, hx + 6, my, s.mouth, "#b07a62", "#4a1414");

    // 텔레캐스터 + 손
    drawMap(g, TELE, TELE_PAL, ox + 1, bodyY + 2);
    rect(g, ox + 12, bodyY + 4 + (s.step % 4 < 2 ? 0 : 1), 1, 2, P.S); // 넥 잡는 손 (코드 바꾸듯 움직임)
    // 스트로크 팔: 계속 위아래로 크게 흔듦
    if (s.f) { line(g, ox, bodyY + 6, ox + 4, bodyY + 6, P.V); rect(g, ox + 4, bodyY + 5, 2, 2, P.S); }
    else { line(g, ox, bodyY + 6, ox + 4, bodyY + 10, P.V); rect(g, ox + 4, bodyY + 11, 2, 1, P.S); }

    // 붐 마이크 스탠드: 바닥에 고정 (점프해도 움직이지 않음)
    const restBodyY = ground - 5 - 9;
    const myF = restBodyY - 11 + 10;          // 점프 안 했을 때 입 높이
    const baseX = ox - 4, jointY = restBodyY + 4, micX = ox + 4;
    rect(g, baseX - 2, ground - 1, 5, 1, "#55585f");
    rect(g, baseX, jointY, 1, ground - jointY, "#6b6f78");
    line(g, baseX, jointY, micX - 1, myF + 1, "#7d818a");
    rect(g, micX, myF, 2, 1, "#9aa0a8");      // 마이크 그릴
    rect(g, micX, myF + 1, 1, 1, "#2a2a30");
  }

  // ================= 베이스 =================
  // 갈색 머리(앞머리 내림, 옆머리 김), 검은 재킷 + 보라 티 + 목걸이, 무늬 바지
  const BASS_HEAD = [
    "..HHHHHH..",
    ".HHhHHHHH.",
    "HHHHHhHHHH",
    "HHhHHHHhHH",
    "HHHHHHHHHH",
    "HHSSSSSSHH",
    "HHS....SHH",   // 눈 줄
    "HSSSSSSSSH",
    "H.SSSSSS.H",
    "...SSSS...",
  ];
  const BASS_BODY = [
    "jJJPPPPJJj",
    "JJJNPPNJJJ",
    "JJJPNNPJJJ",
    "JJjPPPPjJJ",
    "JJJPPPPJJJ",
    "JJJPPPPJJJ",
    "JJjPPPPjJJ",
    "JJJJJJJJJJ",
  ];
  const BASS_LEGS = [
    ".XxX..XXX.",
    ".XXX..XyX.",
    ".xXX..XXx.",
    ".XXy..XXX.",
    ".XXX..xXX.",
    "OOOO..OOOO",
  ];
  const BASS_GTR = [
    "............hh",
    "...........nh.",
    ".........nn...",
    ".bbb...nn.....",
    "bBBBb.n.......",
    "bBwBBn........",
    "bBBBBb........",
    ".bbbb.........",
  ];
  const BASS_GTR_PAL = { b: "#2a1418", B: "#7a2a30", w: "#e8e4dc", n: "#d2a870", h: "#e8e0d0" };

  function drawBass(g, cx, ground, s, pal) {
    const P = Object.assign({ H: "#6b4428", h: "#8f5f3a", S: "#efc8a6", O: "#1e1e24" }, pal);
    const ox = cx - 5;
    const bob = s.pulse > 0.5 ? -1 : 0;
    const legY = ground - 6 + bob; // 박자마다 한 칸 점프
    const bodyY = legY - 8;
    const headY = bodyY - 10;
    drawMap(g, BASS_LEGS, P, ox, legY);
    drawMap(g, BASS_BODY, P, ox, bodyY);
    rect(g, ox - 1, bodyY + 1, 1, 4, P.J);
    rect(g, ox + 10, bodyY + 1, 1, 3, P.J);
    drawMap(g, BASS_HEAD, P, ox, headY);
    // 눈 (앞머리 아래로 살짝)
    rect(g, ox + 3, headY + 6, 1, 1, DARK); rect(g, ox + 6, headY + 6, 1, 1, DARK);
    rect(g, ox + 4, headY + 6, 2, 1, P.S);
    rect(g, ox + 4, headY + 8, 2, 1, "#c98a72");
    drawMap(g, BASS_GTR, BASS_GTR_PAL, ox, bodyY + 2);
    rect(g, ox + 10, bodyY + 3, 1, 1, P.S); // 넥 잡는 손
    rect(g, ox + 2, bodyY + (s.pulse > 0.5 ? 5 : 7), 1, 1, P.S); // 핑거링 손
  }

  // ================= 드럼 =================
  // 짧은 검은 머리, 환한 웃음, 카키 가죽 라이더 재킷 + 검은 티
  const DRUM_HEAD = [
    ".K.KK.KK..",
    "KKKKKKKKK.",
    "KKKKKKKKKK",
    "KKSSSSSSKK",
    "KS......SK",   // 눈 줄
    "KSSSSSSSSK",
    ".SSWWWWSS.",   // 활짝 웃는 입
    "..SSSSSS..",
  ];
  const DRUM_BODY = [
    "GgGTTTTGgG",
    "GGgTZTTgGG",
    "GGGgTTgGGG",
    "GGGgTTgGGG",
    "GGGTTTTGGG",
  ];
  function drawDrums(g, cx, ground, s, pal) {
    const P = Object.assign({ K: "#141016", S: "#eec29c", W: "#ffffff" }, pal);
    const ox = cx - 5;
    // 스틱은 반 프레임 단위(4단계)로 계속 움직임: 높이 → 중간 → 타격 → 중간
    // 한 박을 4등분: 왼손은 박자 순간에, 오른손은 반 박 뒤에 내려침
    const q = mod(Math.floor(s.bp * 4), 4);
    const pL = [2, 1, 0, 1][q], pR = [0, 1, 2, 1][q];
    const crash = mod(Math.floor(s.bp), 4) === 0 && q === 0; // 4박마다 첫 박에 크래시
    const bob = s.f ? -1 : 0;
    const bodyY = ground - 14;
    const headY = bodyY - 8 + bob;
    // 의자
    rect(g, ox + 3, ground - 4, 4, 1, "#333");
    drawMap(g, DRUM_BODY, P, ox, bodyY + bob);
    drawMap(g, DRUM_HEAD, P, ox, headY);
    rect(g, ox + 2, headY + 4, 1, 1, DARK); rect(g, ox + 7, headY + 4, 1, 1, DARK);
    rect(g, ox + 3, headY + 4, 4, 1, P.S);
    // 크래시 심벌(왼쪽) / 하이햇(오른쪽, 프레임마다 열리고 닫힘)
    const cymY = bodyY - 1 + (crash ? 1 : 0);
    rect(g, ox - 6, cymY, 5, 1, crash ? "#fff6c0" : "#c9a83a"); rect(g, ox - 4, bodyY, 1, 14, "#555");
    rect(g, ox + 11, bodyY + (s.f ? 2 : 1), 4, 1, "#c9a83a"); rect(g, ox + 11, bodyY + 3, 4, 1, "#c9a83a"); rect(g, ox + 13, bodyY + 4, 1, 10, "#555");
    // 탐탐 (맞는 순간 흰색으로 번쩍)
    rect(g, ox, bodyY + 5, 4, 2, "#8e1f2c"); rect(g, ox + 6, bodyY + 5, 4, 2, "#8e1f2c");
    rect(g, ox, bodyY + 4, 4, 1, pL === 2 ? "#ffffff" : "#d8d0c4");
    rect(g, ox + 6, bodyY + 4, 4, 1, pR === 2 ? "#ffffff" : "#d8d0c4");

    const STICK = "#ecdcaa";
    function arm(x, dir, p, crashHit) {
      if (crashHit) { // 심벌/하이햇 강타
        rect(g, x, bodyY, 1, 3, P.G); rect(g, x, bodyY - 1, 1, 1, P.S);
        line(g, x, bodyY - 1, x - dir * 3, bodyY - 1, STICK);
        return;
      }
      if (p === 0) {        // 높이 들어 올림
        rect(g, x, bodyY - 1, 1, 3, P.G); rect(g, x, bodyY - 2, 1, 1, P.S);
        line(g, x, bodyY - 2, x - dir * 2, bodyY - 6, STICK);
      } else if (p === 1) { // 중간 (내려오는 중)
        rect(g, x, bodyY, 1, 3, P.G); rect(g, x, bodyY, 1, 1, P.S);
        line(g, x, bodyY, x + dir * 3, bodyY - 2, STICK);
      } else {              // 타격
        rect(g, x, bodyY + 1, 1, 2, P.G); rect(g, x, bodyY + 3, 1, 1, P.S);
        line(g, x, bodyY + 3, x + dir * 3, bodyY + 4, STICK);
        rect(g, x + dir * 2 - (dir < 0 ? 1 : 0), bodyY + 2, 2, 1, "#ffffff"); // 타격 반짝
      }
    }
    arm(ox - 1, 1, pL, crash);
    arm(ox + 10, -1, pR, crash);
    // 베이스 드럼 (프레임마다 울림)
    rect(g, ox - 1, ground - 8, 12, 8, "#8e1f2c");
    rect(g, ox, ground - 7, 10, 6, s.f ? "#fffaf0" : "#f0e6d8");
    rect(g, ox + 1, ground - 4 - (s.f ? 1 : 0), 8, 1, "#8e1f2c");
  }

  // ================= 범용 멤버 (config에서 role만 지정한 경우) =================
  function drawGeneric(g, m, cx, ground, s) {
    const bob = s.pulse > 0.5 ? -1 : 0;
    const ox = cx - 4, oy = ground - 14 + bob;
    const p = (x, y, w, h, c) => rect(g, ox + x, oy + y, w, h, c);
    const alt = s.beatCount % 2 === 0;
    if (m.role !== "drums") { p(2, 11, 1, 3, m.pants); p(5, 11, 1, 3, m.pants); p(1, 13, 2, 1, DARK); p(5, 13, 2, 1, DARK); }
    p(1, 6, 6, 5, m.shirt); p(1, 2, 6, 4, m.skin); p(1, 0, 6, 2, m.hair);
    p(1, 2, 1, 1, m.hair); p(6, 2, 1, 1, m.hair); p(2, 3, 1, 1, DARK); p(5, 3, 1, 1, DARK);
    if (m.role === "vocal") {
      p(8, 5, 1, 9, "#6b6f78"); p(7, 13, 3, 1, "#6b6f78"); p(8, 4, 1, 1, "#9aa0a8"); p(7, 6, 1, 1, m.skin);
      if (s.pulse > 0.5 && alt) p(0, 3, 1, 4, m.skin); else p(0, 6, 1, 4, m.skin);
      p(3, 5, 2, 1, s.level > 0.35 ? DARK : "#c98a72");
    } else if (m.role === "keys") {
      p(-1, 9, 10, 2, "#222"); p(0, 9, 8, 1, "#eee"); p(alt ? 2 : 5, 8, 1, 1, m.skin);
    } else if (m.role === "drums") {
      p(-1, 9, 10, 5, m.instrument); p(0, 10, 8, 3, "#f0e6d8");
      p(0, s.pulse > 0.5 && alt ? 4 : 6, 1, 3, m.skin); p(7, s.pulse > 0.5 && !alt ? 4 : 6, 1, 3, m.skin);
    } else {
      p(0, 8, 4, 3, m.instrument); p(4, 8, m.role === "bass" ? 6 : 5, 1, "#8a5a32");
      p(7, 8, 1, 1, m.skin); p(2, s.pulse > 0.5 ? 8 : 10, 1, 1, m.skin);
    }
  }

  // 모든 멤버는 박자 감지와 상관없이 2프레임을 계속 번갈아 움직임 (라이브 느낌)
  // s.period: 한 프레임 길이(ms, 곡 템포에서 추정). s.pulse/s.beatCount 는 2프레임 값으로 바꿔서 전달하고,
  // s.bp: 박자 위치 (1 = 한 박), s.mouth: 보컬 입 모양 (0~3)
  function drawMember(g, m, cx, ground, s0, outfit, vocalLook, idx) {
    const period = s0.period || 250;
    // 박자 위치(bp): 1 증가 = 한 박. 정보가 없으면 시간으로 대신함
    const bp = s0.beatPos !== undefined ? s0.beatPos : s0.t / (period * 2);
    const step = Math.floor(bp * 2) + (m.sprite === "bass" ? 1 : 0); // 반 박마다 프레임 전환, 베이스는 보컬과 엇박
    const f = mod(step, 2); // 0 = 착지(박자 순간), 1 = 공중
    const s = Object.assign({}, s0, { pulse: f ? 1 : 0, beatCount: step, f, step, period, bp, mouth: s0.mouth || 0 });
    const o = OUTFITS[outfit] || OUTFITS.stage;
    if (m.sprite === "iyori") {
      const look = vocalLook || "live";
      if (look === "live") return drawIyoriLive(g, cx, ground, s);
      return drawIyori(g, cx, ground, s, (OUTFITS[look] || o).iyori);
    }
    if (m.sprite === "bass") return drawBass(g, cx, ground, s, o.bass);
    if (m.sprite === "drums") return drawDrums(g, cx, ground, s, o.drums);
    return drawGeneric(g, m, cx, ground, s);
  }

  function drawNote(g, x, y, c) {
    rect(g, x, y + 2, 2, 1, c); rect(g, x + 1, y, 1, 2, c); rect(g, x + 2, y, 1, 1, c);
  }

  return { drawMember, drawNote, _maps: { LIVE_HEAD, LIVE_BODY, LIVE_LEGS, TELE, IYORI_HEAD, IYORI_BODY, IYORI_LEGS, BASS_HEAD, BASS_BODY, BASS_LEGS, DRUM_HEAD, DRUM_BODY } };
})();
