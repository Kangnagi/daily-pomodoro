// 운동 통계 화면 (#wstats/날짜~범위): 공부 통계와 같은 규칙 — 토요일 = 이 주, 매달 마지막 날 = 이 달, 나머지 = 하루
//   요약 숫자, (하루면) 그날 운동 내용, 몸무게 변화, 최근 30일 운동 시간, 부위별 운동(인체 그림 BodyMap), 종목별 최고 무게, 전체 기록
(() => {
  "use strict";
  const { $, pad, keyOf, parseKey, todayKey, fmtLong, fmtShort, fmtMin, escapeHtml, MOOD_ICON } = DT.utils;
  const { WorkoutStore } = DT;

  const svg = (w, h, inner) => `<svg viewBox="0 0 ${w} ${h}" role="img">${inner}</svg>`;
  const kg = (v) => `${+Number(v).toFixed(1)}kg`;
  const bigKg = (v) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}t` : `${Math.round(v)}kg`);

  class WorkoutStatsScreen {
    constructor(workouts, onOpenLog) {
      this.name = "wstats";
      this.w = workouts;
      this.onOpenLog = onOpenLog;
      this.bodyMap = new DT.BodyMap($("wsParts"));
      this.el = $("wstatsScreen");
      this.active = false;
      workouts.store.onChange(() => { if (this.active) this.render(); });
    }

    setActive(active, param) {
      this.active = active;
      if (active) {
        const [k, scope] = (param || todayKey()).split("~");
        this.key = k;
        this.scope = ["week", "month", "day"].includes(scope) ? scope : "day";
        this.render();
        this.el.querySelector(".screen-body").scrollTop = 0;
      }
      this.el.classList.toggle("open", active);
    }

    get records() { return this.w.records; }

    // 범위에 들어가는 날짜들
    scopeDays() {
      const d = parseKey(this.key);
      if (this.scope === "day") return [this.key];
      if (this.scope === "week") {
        d.setDate(d.getDate() - d.getDay());
        return Array.from({ length: 7 }, () => { const k = keyOf(d); d.setDate(d.getDate() + 1); return k; });
      }
      const prefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      return Object.keys(this.records).filter((k) => k.startsWith(prefix)).sort();
    }

    render() {
      const days = this.scopeDays();
      const keys = days.filter((k) => WorkoutStore.hasActivity(this.records[k]));
      const recs = keys.map((k) => this.records[k]);
      const d = parseKey(this.key);
      const titles = {
        day: () => `${this.key === todayKey() ? "오늘" : "하루"} 운동 · ${fmtShort(this.key)}`,
        week: () => { const a = parseKey(days[0]), b = parseKey(days[6]); return `이 주 운동 · ${a.getMonth() + 1}월 ${a.getDate()}일 ~ ${b.getMonth() + 1}월 ${b.getDate()}일`; },
        month: () => `${d.getFullYear()}년 ${d.getMonth() + 1}월 운동`,
      };
      $("wsTitle").textContent = titles[this.scope]();

      const minutes = recs.reduce((s, r) => s + WorkoutStore.minutesOf(r), 0);
      const sets = recs.reduce((s, r) => s + WorkoutStore.setCount(r), 0);
      const volume = recs.reduce((s, r) => s + WorkoutStore.volume(r), 0);
      const dist = recs.reduce((s, r) => s + WorkoutStore.distance(r), 0);
      const ws = keys.filter((k) => this.records[k].weight != null).map((k) => Number(this.records[k].weight));
      const weightText = !ws.length ? "-" : ws.length === 1 || this.scope === "day" ? kg(ws[ws.length - 1])
        : `${kg(ws[ws.length - 1])} (${ws[ws.length - 1] - ws[0] >= 0 ? "+" : ""}${+(ws[ws.length - 1] - ws[0]).toFixed(1)})`;
      $("wsTotals").innerHTML =
        (this.scope === "day" ? "" : `<div>운동한 날<b>${keys.length}일${this.scope === "week" ? " / 7일" : ""}</b></div>`) +
        `<div>운동 시간<b>${fmtMin(minutes)}</b></div>` +
        `<div>근력 세트<b>${sets}세트</b></div>` +
        `<div>총 볼륨<b>${volume ? bigKg(volume) : "-"}</b></div>` +
        `<div>유산소 거리<b>${dist ? `${+dist.toFixed(2)}km` : "-"}</b></div>` +
        `<div>몸무게<b>${weightText}</b></div>` +
        (this.scope === "day" ? `<div>컨디션<b>${recs[0] && recs[0].mood ? MOOD_ICON[recs[0].mood] : "-"}</b></div>` : "");

      this.renderDayDetail();
      this.renderWeight();
      this.renderTime();
      this.renderParts(recs);
      this.renderBests();
      this.renderList();
    }

    // 하루 범위: 그날 한 운동을 그대로
    renderDayDetail() {
      const box = $("wsDay");
      box.classList.toggle("hidden", this.scope !== "day");
      if (this.scope !== "day") return;
      const r = this.records[this.key];
      if (!r || !WorkoutStore.hasActivity(r)) { box.innerHTML = `<div class="empty-msg">이 날은 운동 기록이 없어요</div>`; return; }
      let html = "";
      (r.strength || []).forEach((e) => {
        html += `<div class="ws-ex"><b>${escapeHtml(e.name)}</b><span>${e.sets.map((s) => `${s.kg != null ? `${s.kg}kg` : "맨몸"}×${s.reps != null ? s.reps : "-"}`).join(" · ")}</span></div>`;
      });
      (r.cardio || []).forEach((c) => {
        html += `<div class="ws-ex"><b>${escapeHtml(c.name)}</b><span>${[c.min != null ? `${c.min}분` : "", c.km != null ? `${c.km}km` : ""].filter(Boolean).join(" · ")}</span></div>`;
      });
      if ((r.parts || []).length) html += `<div class="ws-ex"><b>부위</b><span>${r.parts.map((p) => `<span class="badge">${p}</span>`).join("")}</span></div>`;
      if (r.memo) html += `<div class="rec-memo">${escapeHtml(r.memo)}</div>`;
      box.innerHTML = html || `<div class="empty-msg">운동 시간만 기록됐어요. 운동 일지에 종목을 적어 보세요</div>`;
    }

    // 몸무게 변화 (전체 기록, 최근 40번)
    renderWeight() {
      const el = $("wsWeight");
      const pts = this.w.weights().slice(-40);
      if (!pts.length) { el.innerHTML = `<div class="empty-msg">운동 일지에 몸무게를 적으면 변화가 보여요</div>`; return; }
      const W = 640, H = 200, L = 46, R = 18, T = 18, B = 26;
      const vals = pts.map((p) => p.v);
      let lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
      if (hi - lo < 4) { const m = (hi + lo) / 2; lo = Math.floor(m - 2); hi = Math.ceil(m + 2); }
      const x = (i) => (pts.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (pts.length - 1));
      const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
      const step = Math.max(1, Math.round((hi - lo) / 4));
      let g = "";
      for (let v = lo; v <= hi; v += step) {
        g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="var(--muted)">${v}</text>`;
      }
      g += `<path d="${pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ")}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round"/>`;
      const every = Math.ceil(pts.length / 7);
      pts.forEach((p, i) => {
        g += `<circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" fill="var(--card)" stroke="var(--primary)" stroke-width="2"><title>${p.k} ${p.v}kg</title></circle>`;
        if (i % every === 0 || i === pts.length - 1) {
          const dd = parseKey(p.k);
          g += `<text x="${x(i)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="var(--muted)">${dd.getMonth() + 1}/${dd.getDate()}</text>`;
          g += `<text x="${x(i)}" y="${y(p.v) - 9}" font-size="11" text-anchor="middle" fill="var(--text)">${p.v}</text>`;
        }
      });
      el.innerHTML = svg(W, H, g);
    }

    // 선택한 날짜까지 30일 운동 시간
    renderTime() {
      const W = 640, H = 150, L = 8, R = 8, T = 10, B = 22;
      const daily = this.w.prefs.daily;
      const d = parseKey(this.key);
      d.setDate(d.getDate() - 29);
      const days = Array.from({ length: 30 }, () => { const k = keyOf(d); d.setDate(d.getDate() + 1); return k; });
      const mins = days.map((k) => WorkoutStore.minutesOf(this.records[k]));
      const max = Math.max(daily || 0, ...mins, 30);
      const bw = (W - L - R) / 30;
      let g = "";
      if (daily) { const yy = T + (H - T - B) * (1 - daily / max); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="var(--danger)" stroke-dasharray="5 4"/>`; }
      days.forEach((k, i) => {
        const h = ((H - T - B) * mins[i]) / max;
        g += `<rect x="${L + i * bw + 2}" y="${H - B - h}" width="${bw - 4}" height="${h}" rx="3" fill="var(--lv${this.w.level(mins[i])})"><title>${k} ${fmtMin(mins[i])}</title></rect>`;
        if (i % 5 === 0 || i === 29) { const dd = parseKey(k); g += `<text x="${L + i * bw + bw / 2}" y="${H - 6}" font-size="10" text-anchor="middle" fill="var(--muted)">${dd.getMonth() + 1}/${dd.getDate()}</text>`; }
      });
      $("wsTime").innerHTML = svg(W, H, g);
    }

    // 부위별 운동한 날 수 (범위 안)
    renderParts(recs) {
      const cnt = Object.fromEntries(WorkoutStore.PARTS.map((p) => [p, 0]));
      recs.forEach((r) => (r.parts || []).forEach((p) => { if (p in cnt) cnt[p]++; }));
      $("wsPartTitle").textContent = `부위별 운동 (${{ day: "이 날", week: "이 주", month: "이 달" }[this.scope]})`;
      this.bodyMap.render(cnt); // 인체 픽토그램: 횟수가 많을수록 진하게
    }

    // 종목별 최고 무게 (전체 기록)
    renderBests() {
      const list = this.w.bests();
      $("wsBests").innerHTML = list.length
        ? list.map((b) => `<div class="exam-result"><span>${escapeHtml(b.name)}</span><span class="er-date">${fmtShort(b.k)}</span><b>${b.kg}kg × ${b.reps}</b></div>`).join("")
        : `<div class="empty-msg">근력 운동 무게를 적으면 종목별 최고 기록이 보여요</div>`;
    }

    renderList() {
      const el = $("wsList");
      const keys = this.w.activeKeys().reverse();
      if (!keys.length) { el.innerHTML = `<div class="empty-msg">아직 운동 기록이 없습니다</div>`; return; }
      el.innerHTML = keys.map((k) => {
        const r = this.records[k];
        const min = WorkoutStore.minutesOf(r);
        const badges = (r.parts || []).map((p) => `<span class="badge">${p}</span>`).join("") +
          (r.strength || []).map((e) => `<span class="badge">${escapeHtml(e.name)}</span>`).join("") +
          (r.cardio || []).map((c) => `<span class="badge">${escapeHtml(c.name)}${c.km ? ` ${c.km}km` : ""}</span>`).join("");
        const meta = [min ? fmtMin(min) : "", r.weight != null ? `${r.weight}kg` : "", r.mood ? MOOD_ICON[r.mood] : ""].filter(Boolean).join(" · ");
        return `<div class="rec" data-k="${k}"><div class="rec-top"><span class="rec-date">${fmtLong(k)}</span><span class="rec-meta">${meta}</span></div>
          <div>${badges}</div>${r.memo ? `<div class="rec-memo">${escapeHtml(r.memo)}</div>` : ""}</div>`;
      }).join("");
      el.querySelectorAll(".rec").forEach((n) => n.addEventListener("click", () => this.onOpenLog(n.dataset.k)));
    }
  }

  DT.WorkoutStatsScreen = WorkoutStatsScreen;
})();
