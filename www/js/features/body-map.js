// 운동 통계의 부위별 운동: 인체 픽토그램(앞모습 + 뒷모습)에 운동한 부위를 칠함. 횟수가 많을수록 진하게
//   부위: 가슴·복근(앞), 등(뒤), 어깨·팔·하체(앞뒤 모두). "전신"은 모든 부위에 1회씩 더하고, "유산소"는 그림 아래 따로 표시
//   부위를 누르면 아래에 "가슴 3회"처럼 보여줌
(() => {
  "use strict";

  const MUSCLES = ["가슴", "등", "어깨", "팔", "복근", "하체"];

  // 둥근 사각형 한 칸: [x, y, 너비, 높이, 모서리]
  const R = (x, y, w, h, r) => ({ x, y, w, h, r });
  // 몸 한쪽(앞 또는 뒤)의 부위별 도형. cx = 몸 가운데 x
  function figure(cx, back) {
    const m = (x, w) => cx * 2 - x - w; // 왼쪽 도형을 오른쪽으로 뒤집은 x
    const L = (x, y, w, h, r) => [R(cx - (cx - x), y, w, h, r), R(m(x, w), y, w, h, r)]; // 좌우 한 쌍
    const shapes = {
      어깨: L(cx - 33, 44, 15, 15, 7),
      팔: [...L(cx - 41, 60, 12, 38, 6), ...L(cx - 44, 101, 11, 36, 5)],
      하체: back
        ? [R(cx - 18, 110, 36, 22, 9), ...L(cx - 17, 134, 15, 48, 7), ...L(cx - 16, 185, 13, 44, 6)]
        : [...L(cx - 17, 116, 15, 66, 7), ...L(cx - 16, 185, 13, 44, 6)],
    };
    if (back) {
      shapes["등"] = [R(cx - 17, 44, 34, 40, 9), R(cx - 14, 86, 28, 22, 7)];
    } else {
      shapes["가슴"] = L(cx - 17, 44, 16, 26, 8);
      shapes["복근"] = [R(cx - 14, 72, 28, 40, 8)];
    }
    // 색을 칠하지 않는 부분 (머리·목·골반)
    const neutral = [R(cx - 12, 4, 24, 26, 12), R(cx - 5, 30, 10, 12, 3)];
    if (!back) neutral.push(R(cx - 18, 110, 36, 8, 4));
    return { shapes, neutral };
  }

  const rect = (s, cls, part) =>
    `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" class="${cls}"${part ? ` data-part="${part}"` : ""}/>`;

  class BodyMap {
    constructor(container) {
      this.el = container;
      this.counts = {};
      this.el.addEventListener("click", (e) => {
        const p = e.target.closest("[data-part]");
        this.show(p ? p.dataset.part : null);
      });
    }

    // counts: { 가슴: 2, 등: 0, ..., 전신: 1, 유산소: 3 }  (부위를 고른 운동 날 수)
    render(counts) {
      const all = counts["전신"] || 0;
      this.counts = Object.fromEntries(MUSCLES.map((p) => [p, (counts[p] || 0) + all]));
      this.cardio = counts["유산소"] || 0;
      this.all = all;
      const max = Math.max(1, ...Object.values(this.counts));
      // 진하기 0~4 단계 (캘린더 색과 같은 --lv0~4)
      const lv = (n) => (!n ? 0 : Math.min(4, Math.max(1, Math.ceil((n / max) * 4))));

      let g = "";
      [[75, false, "앞"], [225, true, "뒤"]].forEach(([cx, back, label]) => {
        const f = figure(cx, back);
        f.neutral.forEach((s) => (g += rect(s, "bm-neutral")));
        Object.entries(f.shapes).forEach(([part, list]) =>
          list.forEach((s) => (g += rect(s, `bm-part lv${lv(this.counts[part])}`, part))));
        g += `<text x="${cx}" y="248" text-anchor="middle" class="bm-label">${label}</text>`;
      });
      this.el.innerHTML =
        `<svg viewBox="0 0 300 256" class="bm-svg" role="img" aria-label="부위별 운동">${g}</svg>` +
        `<div class="bm-info">` +
        `<span class="bm-cardio"><i class="lv${lv(this.cardio) || 0}"></i>유산소 ${this.cardio}회</span>` +
        (all ? `<span class="bm-all">전신 ${all}회 (모든 부위에 포함)</span>` : "") +
        `<span class="bm-scale">적음 <i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i> 많음</span>` +
        `</div><p class="bm-pick" aria-live="polite"></p>`;
      this.show(null);
    }

    // 누른 부위의 횟수 (같은 부위는 앞뒤 모두 강조)
    show(part) {
      this.el.querySelectorAll(".bm-part").forEach((s) => s.classList.toggle("on", s.dataset.part === part));
      const pick = this.el.querySelector(".bm-pick");
      if (!pick) return;
      pick.textContent = part
        ? `${part} ${this.counts[part]}회`
        : Object.values(this.counts).some(Boolean) ? "부위를 누르면 운동한 횟수가 보여요" : "운동 일지에서 운동 부위를 고르면 그림에 표시돼요";
    }
  }

  BodyMap.MUSCLES = MUSCLES;
  DT.BodyMap = BodyMap;
})();
