// 아케이드 그림: 뽀모도로 화폐 아이콘(빨강·노랑·초록 토마토, 토마토 조각)과 프로필 버튼 아이콘
//   이모지 대신 도트(픽셀) 느낌의 작은 SVG. 8×8 칸에 칠할 칸을 문자열로 그림
(() => {
  "use strict";

  // 칸 문자: 몸통 b, 밝은 점 h, 잎 l, 꼭지 s, 단면(속) i
  const TOMATO = [
    "...ss...",
    "..llll..",
    ".bbllbb.",
    "bhbbbbbb",
    "bhbbbbbb",
    "bbbbbbbb",
    ".bbbbbb.",
    "..bbbb..",
  ];
  const SLICE = [
    "........",
    "........",
    "bbbbbbbb",
    "biiiiiib",
    ".biiiib.",
    "..biib..",
    "...bb...",
    "........",
  ];
  const COLORS = {
    red: { b: "#e5533d", h: "#ffb3a3" },
    yellow: { b: "#f2b705", h: "#ffe58a" },
    green: { b: "#2fa84f", h: "#9fe0b0" },
    piece: { b: "#e5533d", i: "#ffd0c4" },
  };
  const LEAF = { l: "#3c8d2f", s: "#2a5f20" };

  function pixels(rows, palette) {
    let out = "";
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      const fill = palette[c];
      if (fill) out += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
    }));
    return out;
  }

  // kind: red | yellow | green | piece
  function currency(kind, size = 18) {
    const rows = kind === "piece" ? SLICE : TOMATO;
    const pal = Object.assign({}, LEAF, COLORS[kind]);
    return `<svg class="cur-ico" width="${size}" height="${size}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${pixels(rows, pal)}</svg>`;
  }

  const NAMES = { red: "빨강 뽀모도로", yellow: "노랑 뽀모도로", green: "초록 뽀모도로", piece: "토마토 조각" };

  // 지갑 한 줄: [빨강 1] [노랑 0] [초록 3] [조각 7]
  function wallet(w, size = 18) {
    return ["red", "yellow", "green", "piece"].map((k) =>
      `<span class="cur" title="${NAMES[k]}">${currency(k, size)}<b>${w[k]}</b></span>`).join("");
  }

  // 위쪽 바 프로필 버튼: 사람 모양 선 아이콘
  const PROFILE = '<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  DT.ArcadeIcons = { currency, wallet, NAMES, PROFILE };
})();
