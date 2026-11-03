// 1년 학습량 보기: 12개월을 작은 달력으로 한 화면에 보여주고, 날짜 칸을 학습량 색으로 칠한다
// 달을 누르면 onPickMonth(월)을 호출해 그 달 보기로 돌아간다
(() => {
  "use strict";
  const { pad, todayKey, fmtMin, fmtMinShort } = DT.utils;

  const TITLE_H = 18; // 작은 달력 제목 줄 높이(px)
  const GAP = 2;      // 날짜 칸 사이 간격(px)

  class YearView {
    constructor(store, container, grid, onPickMonth) {
      this.store = store;
      this.container = container;
      this.grid = grid;
      this.onPickMonth = onPickMonth;
      this.year = new Date().getFullYear();
      window.addEventListener("resize", () => { if (!container.classList.contains("hidden")) this.layout(); });
    }

    yearMinutes(y) {
      const prefix = `${y}-`;
      return Object.keys(this.store.records).filter((k) => k.startsWith(prefix)).reduce((s, k) => s + this.minOf(this.store.records[k]), 0);
    }

    // 하루 시간(분): 운동 기록이면 유산소 시간까지 (WorkoutStore.minutesOf)
    minOf(r) {
      return this.store instanceof DT.WorkoutStore ? DT.WorkoutStore.minutesOf(r) : (r && r.minutes) || 0;
    }

    render(year) {
      this.year = year;
      const tk = todayKey();
      let html = "";
      for (let m = 0; m < 12; m++) {
        const first = new Date(year, m, 1).getDay();
        const days = new Date(year, m + 1, 0).getDate();
        const mins = this.store.minutesInMonth(year, m);
        let cells = "";
        for (let i = 0; i < first; i++) cells += `<i class="md empty"></i>`;
        for (let d = 1; d <= days; d++) {
          const k = `${year}-${pad(m + 1)}-${pad(d)}`;
          const r = this.store.get(k);
          const min = this.minOf(r);
          const cls = ["md", `lv${this.store.level(min)}`];
          if (k === tk) cls.push("today");
          if (k > tk) cls.push("future");
          if (this.store.isExam(k)) cls.push("exam");
          cells += `<i class="${cls.join(" ")}" title="${m + 1}/${d}${min ? ` ${fmtMin(min)}` : ""}"></i>`;
        }
        const isNow = year === new Date().getFullYear() && m === new Date().getMonth();
        html += `<button type="button" class="mini-month${isNow ? " now" : ""}" data-m="${m}" aria-label="${m + 1}월 ${fmtMin(mins)}">
          <span class="mm-title">${m + 1}월${mins ? `<small>${fmtMinShort(mins)}</small>` : ""}</span>
          <span class="mini-days">${cells}</span>
        </button>`;
      }
      this.grid.innerHTML = html;
      this.grid.querySelectorAll(".mini-month").forEach((b) => b.addEventListener("click", () => this.onPickMonth(Number(b.dataset.m))));
      this.layout();
    }

    // 화면 크기에 맞춰 2/3/4/6열 중 날짜 칸이 가장 크게 보이는 배치를 고른다
    layout() {
      const W = this.container.clientWidth, H = this.container.clientHeight;
      if (!W || !H) return;
      const colGap = 10, rowGap = 8;
      let best = { cols: 3, sq: 0 };
      [2, 3, 4, 6].forEach((cols) => {
        const rows = 12 / cols;
        const monthW = (W - (cols - 1) * colGap) / cols;
        const byW = (monthW - 6 * GAP) / 7;
        const byH = ((H - (rows - 1) * rowGap) / rows - TITLE_H - 5 * GAP) / 6;
        const sq = Math.floor(Math.min(byW, byH));
        if (sq > best.sq) best = { cols, sq };
      });
      this.grid.style.setProperty("--sq", `${Math.max(4, best.sq)}px`);
      this.grid.style.setProperty("--md-gap", `${GAP}px`);
      this.grid.style.gridTemplateColumns = `repeat(${best.cols}, max-content)`;
      this.grid.style.columnGap = `${colGap}px`;
      this.grid.style.rowGap = `${rowGap}px`;
    }

    // 화면 좌표에 있는 달 (두 손가락으로 벌린 위치의 달로 들어가기)
    monthAt(x, y) {
      const el = document.elementFromPoint(x, y);
      const mm = el && el.closest(".mini-month");
      return mm ? Number(mm.dataset.m) : null;
    }
  }

  DT.YearView = YearView;
})();
