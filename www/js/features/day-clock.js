// 하루 요약의 24시간 원형 시계: 공부한 시각에 공부한 만큼 색을 칠하고(집중), 이어서 쉰 시간도 다른 색으로
//   0시가 맨 위, 시계 방향으로 하루(24시간)가 한 바퀴. 색칠된 부분을 누르면 그때 무슨 공부를 했는지 보여줌
(() => {
  "use strict";
  const { parseKey, fmtClock, fmtMin, escapeHtml } = DT.utils;

  const S = 300, C = 150, R = 112, W = 26; // 크기, 중심, 고리 반지름, 고리 두께
  const DAY_MIN = 1440;

  // 시계 각도(0=맨 위, 시계 방향) → 좌표
  const pt = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  // 고리 위의 호 (a1 → a2, 시계 방향)
  const arc = (a1, a2, r) => {
    if (a2 - a1 >= 359.99) return `M${C},${C - r} A${r},${r} 0 1,1 ${C - 0.01},${C - r}`;
    const [x1, y1] = pt(a1, r), [x2, y2] = pt(a2, r);
    return `M${x1},${y1} A${r},${r} 0 ${a2 - a1 > 180 ? 1 : 0},1 ${x2},${y2}`;
  };

  class DayClock {
    // onEdit(k, sessionId): 상세 카드의 "기록 수정"을 누르면
    constructor(container, detail, onEdit) {
      this.el = container;
      this.detail = detail;
      this.onEdit = onEdit;
      this.el.addEventListener("click", (e) => {
        const seg = e.target.closest("[data-i]");
        this.select(seg ? Number(seg.dataset.i) : null, seg ? seg.dataset.kind : null);
      });
      this.detail.addEventListener("click", (e) => {
        if (e.target.closest("[data-edit]") && this.sel != null) this.onEdit(this.key, this.sessions[this.sel].id);
      });
    }

    // k: 날짜, sessions: 그날 뽀모도로 기록, isToday: 지금 시각 바늘 표시
    render(k, sessions, isToday) {
      this.key = k;
      this.sessions = sessions.slice().sort((a, b) => a.start - b.start);
      const day0 = parseKey(k).getTime();
      const deg = (ts) => Math.max(0, Math.min(DAY_MIN * 1.5, (ts - day0) / 60000)) / DAY_MIN * 360;

      let g = `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="var(--lv0)" stroke-width="${W}"/>`;
      // 시간 눈금: 1시간마다 작은 눈금, 3시간마다 숫자
      for (let h = 0; h < 24; h++) {
        const big = h % 6 === 0;
        const [x1, y1] = pt(h * 15, R - W / 2 - 3), [x2, y2] = pt(h * 15, R - W / 2 - (big ? 11 : 7));
        g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--muted)" stroke-width="${big ? 2 : 1}" stroke-linecap="round"/>`;
        if (h % 3 === 0) {
          const [tx, ty] = pt(h * 15, R - W / 2 - 24);
          g += `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" font-size="${big ? 13 : 11}" font-weight="${big ? 700 : 500}" fill="var(--muted)">${h}</text>`;
        }
      }
      // 휴식(쉰 시간)을 먼저, 그 위에 공부를 칠함
      this.sessions.forEach((s, i) => {
        if (!s.rest) return;
        const a1 = deg(s.end), a2 = deg(s.end + s.rest * 60000);
        if (a2 > a1) g += `<path class="clock-seg rest" data-i="${i}" data-kind="rest" d="${arc(a1, a2, R)}" stroke-width="${W - 10}"/>`;
      });
      // 공부: 시작~끝에서 일시정지 구간을 빼고 칠함. 일시정지 구간은 가는 회색 선 (누르면 같은 공부 기록)
      this.sessions.forEach((s, i) => {
        const pauses = (s.pauses || []).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
        let from = s.start;
        const parts = [];
        pauses.forEach(([a, b]) => {
          if (a > from) parts.push([from, a]);
          g += `<path class="clock-seg pause" data-i="${i}" data-kind="study" d="${arc(deg(a), Math.max(deg(b), deg(a) + 0.5), R)}" stroke-width="6"/>`;
          from = Math.max(from, b);
        });
        if (s.end > from || !parts.length) parts.push([from, Math.max(s.end, from)]);
        parts.forEach(([a, b]) => {
          const a1 = deg(a), a2 = Math.max(deg(b), a1 + 1.2); // 아주 짧아도 누를 수 있게 최소 길이
          g += `<path class="clock-seg study" data-i="${i}" data-kind="study" d="${arc(a1, a2, R)}" stroke-width="${W}"/>`;
        });
      });
      // 오늘이면 지금 시각 바늘
      if (isToday) {
        const [x, y] = pt(deg(Date.now()), R + W / 2 + 4), [x0, y0] = pt(deg(Date.now()), R - W / 2 - 2);
        g += `<line x1="${x0}" y1="${y0}" x2="${x}" y2="${y}" class="clock-now" stroke-width="2.5" stroke-linecap="round"/>`;
      }
      // 가운데: 총 공부 시간
      const total = this.sessions.reduce((s, x) => s + x.minutes, 0);
      g += `<text x="${C}" y="${C - 8}" text-anchor="middle" font-size="22" font-weight="800" fill="var(--text)">${total ? fmtMin(total) : "기록 없음"}</text>`;
      g += `<text x="${C}" y="${C + 16}" text-anchor="middle" font-size="12" fill="var(--muted)">${this.sessions.length ? `🍅 ${this.sessions.length}개` : "공부 타이머로 기록돼요"}</text>`;
      this.el.innerHTML = `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="하루 공부 시계">${g}</svg>`;
      this.select(null);
    }

    // 색칠된 부분을 누르면 그 공부 기록 카드
    select(i, kind) {
      this.sel = i;
      this.el.querySelectorAll(".clock-seg").forEach((p) =>
        p.classList.toggle("on", i != null && Number(p.dataset.i) === i && p.dataset.kind === kind));
      this.el.querySelector("svg") && this.el.querySelector("svg").classList.toggle("has-sel", i != null);
      if (i == null) {
        this.detail.innerHTML = this.sessions.length
          ? `<p class="clock-hint">시계의 색칠된 부분을 누르면 그때 무슨 공부를 했는지 볼 수 있어요</p>`
          : "";
        return;
      }
      const s = this.sessions[i];
      const tags = (s.parts || []).map((p) => `<span class="badge">${escapeHtml(p)}</span>`).join("");
      const note = s.note ? escapeHtml(s.note) : `<span class="empty-note">공부 내용이 적혀 있지 않아요</span>`;
      const paused = DT.SessionDialog.pausedMin(s);
      const restLine = (paused ? `<div class="cd-rest">일시정지 ${paused}분 (공부 시간에서 빠짐)</div>` : "") +
        (s.rest != null ? `<div class="cd-rest">휴식 ${fmtClock(s.end)}–${fmtClock(s.end + s.rest * 60000)} · ${s.rest}분</div>` : "");
      this.detail.innerHTML =
        `<div class="clock-card${kind === "rest" ? " rest" : ""}">` +
        `<div class="cd-head"><b>${kind === "rest" ? "휴식 전 공부" : "🍅 공부"}</b> ${fmtClock(s.start)}–${fmtClock(s.end)} · ${s.minutes}분</div>` +
        (tags ? `<div class="cd-tags">${tags}</div>` : "") +
        `<div class="cd-note">${note}</div>` + restLine +
        `<button type="button" class="cd-edit" data-edit>기록 수정</button></div>`;
    }
  }

  DT.DayClock = DayClock;
})();
