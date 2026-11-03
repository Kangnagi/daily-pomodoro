// 통계 화면: 선택한 날짜가 속한 달(또는 주)의 요약, 이름별 점수 추이 + 시험 결과, 최근 30일 학습 시간, 과목별 공부 시간, 전체 기록 목록
//   param이 "날짜~week" 이면 그 주(일~토) 요약 + 요일별 그래프, "날짜~day" 면 그날 요약 + 24시간 원형 시계(DayClock)
(() => {
  "use strict";
  const { $, pad, keyOf, parseKey, todayKey, fmtLong, fmtShort, fmtMin, fmtMinShort, fmtClock, escapeHtml, MOOD_ICON, WEEK } = DT.utils;
  const { Store } = DT;
  const UNSORTED = "미분류";

  const svg = (w, h, inner) => `<svg viewBox="0 0 ${w} ${h}" role="img">${inner}</svg>`;

  class StatsScreen {
    // onOpenRecord(k): 목록에서 기록을 누르면 호출 / sessionDialog: 시계에서 고른 공부 기록 수정
    constructor(store, onOpenRecord, sessionDialog) {
      this.name = "stats";
      this.store = store;
      this.onOpenRecord = onOpenRecord;
      this.clock = new DT.DayClock($("dayClock"), $("dayClockDetail"), (k, id) => sessionDialog.open(k, id, false));
      this.el = $("statsScreen");
      this.key = todayKey();
      this.active = false;
      store.onChange(() => { if (this.active) this.render(); });
    }

    setActive(active, param) {
      this.active = active;
      if (active) {
        const [k, scope] = (param || todayKey()).split("~");
        this.key = k;
        this.scope = scope === "week" || scope === "day" ? scope : "month";
        this.render();
        this.el.querySelector(".screen-body").scrollTop = 0;
      }
      this.el.classList.toggle("open", active);
    }

    get records() { return this.store.records; }

    render() {
      $("weekChart").classList.toggle("hidden", this.scope !== "week");
      $("dayClockBox").classList.toggle("hidden", this.scope !== "day");
      if (this.scope === "week") this.renderWeek();
      else if (this.scope === "day") this.renderDay();
      else this.renderMonth();
      this.renderScoreChart();
      this.renderTimeChart();
      this.renderParts();
      this.renderList();
    }

    // 선택한 날짜가 속한 달 요약
    renderMonth() {
      const d = parseKey(this.key);
      const y = d.getFullYear(), m = d.getMonth();
      const prefix = `${y}-${pad(m + 1)}`;
      const keys = this.store.activeKeys().filter((k) => k.startsWith(prefix));
      const minutes = keys.reduce((s, k) => s + (this.records[k].minutes || 0), 0);
      const tomatoes = keys.reduce((s, k) => s + Store.tomatoes(this.records[k]), 0);
      const goalDays = keys.filter((k) => this.store.settings.daily && this.records[k].minutes >= this.store.settings.daily).length;
      this.scopeKeys = keys;
      $("statsMonthTitle").textContent = `${y}년 ${m + 1}월 요약`;
      $("monthTotals").innerHTML =
        `<div>공부한 날<b>${keys.length}일</b></div>` +
        `<div>총 학습 시간<b>${fmtMin(minutes)}</b></div>` +
        `<div>하루 평균<b>${keys.length ? fmtMin(Math.round(minutes / keys.length)) : "-"}</b></div>` +
        `<div>뽀모도로<b>🍅 ${tomatoes}개</b></div>` +
        `<div>목표 달성<b>${goalDays}일</b></div>` +
        `<div>많이 한 과목<b>${this.topSubject(keys)}</b></div>`;
    }
    // 하루 요약 (토요일·마지막 날이 아닌 날): 숫자 요약 + 24시간 원형 시계
    renderDay() {
      const k = this.key, r = this.store.get(k);
      const list = ((r && r.sessions) || []).slice().sort((a, b) => a.start - b.start);
      const minutes = (r && r.minutes) || 0;
      const rest = list.reduce((s, x) => s + (x.rest || 0), 0);
      const daily = this.store.settings.daily;
      const isToday = k === todayKey();
      this.scopeKeys = r && Store.hasActivity(r) ? [k] : [];
      $("statsMonthTitle").textContent = `${isToday ? "오늘" : "하루"} 요약 · ${fmtShort(k)}`;
      $("monthTotals").innerHTML =
        `<div>공부한 시간<b>${fmtMin(minutes)}</b></div>` +
        `<div>뽀모도로<b>🍅 ${list.length}개</b></div>` +
        `<div>쉰 시간<b>${rest ? fmtMin(rest) : "-"}</b></div>` +
        `<div>목표<b>${!daily ? "-" : minutes >= daily ? "달성 ✓" : `${fmtMin(daily - minutes)} 남음`}</b></div>` +
        `<div>공부 시간대<b>${list.length ? `${fmtClock(list[0].start)}–${fmtClock(list[list.length - 1].end)}` : "-"}</b></div>` +
        `<div>많이 한 과목<b>${this.topSubject(this.scopeKeys)}</b></div>`;
      this.clock.render(k, list, isToday);
    }

    // 선택한 날짜가 속한 주(일요일~토요일) 요약
    weekKeys() {
      const d = parseKey(this.key);
      d.setDate(d.getDate() - d.getDay());
      const keys = [];
      for (let i = 0; i < 7; i++) { keys.push(keyOf(d)); d.setDate(d.getDate() + 1); }
      return keys;
    }
    renderWeek() {
      const days = this.weekKeys();
      const a = parseKey(days[0]), b = parseKey(days[6]);
      const keys = days.filter((k) => this.store.get(k) && Store.hasActivity(this.store.get(k)));
      const minutes = keys.reduce((s, k) => s + (this.records[k].minutes || 0), 0);
      const tomatoes = keys.reduce((s, k) => s + Store.tomatoes(this.records[k]), 0);
      const daily = this.store.settings.daily;
      const goalDays = keys.filter((k) => daily && this.records[k].minutes >= daily).length;
      this.scopeKeys = keys;
      $("statsMonthTitle").textContent = `이 주 요약 · ${a.getMonth() + 1}월 ${a.getDate()}일 ~ ${b.getMonth() + 1}월 ${b.getDate()}일`;
      $("monthTotals").innerHTML =
        `<div>공부한 날<b>${keys.length}일 / 7일</b></div>` +
        `<div>총 학습 시간<b>${fmtMin(minutes)}</b></div>` +
        `<div>하루 평균<b>${keys.length ? fmtMin(Math.round(minutes / keys.length)) : "-"}</b></div>` +
        `<div>뽀모도로<b>🍅 ${tomatoes}개</b></div>` +
        `<div>목표 달성<b>${goalDays}일</b></div>` +
        `<div>많이 한 과목<b>${this.topSubject(keys)}</b></div>`;

      // 요일별 학습 시간 막대
      const W = 640, H = 170, L = 10, R = 10, T = 22, B = 26;
      const mins = days.map((k) => (this.records[k] && this.records[k].minutes) || 0);
      const max = Math.max(daily || 0, ...mins, 30);
      const bw = (W - L - R) / 7;
      const tk = todayKey();
      let g = "";
      if (daily) {
        const yy = T + (H - T - B) * (1 - daily / max);
        g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="var(--danger)" stroke-dasharray="5 4"/>`;
      }
      days.forEach((k, i) => {
        const h = ((H - T - B) * mins[i]) / max;
        const x = L + i * bw + bw * 0.18, w = bw * 0.64;
        g += `<rect x="${x}" y="${H - B - h}" width="${w}" height="${h}" rx="5" fill="var(--lv${this.store.level(mins[i])})"><title>${k}  ${fmtMin(mins[i])}</title></rect>`;
        if (mins[i]) g += `<text x="${x + w / 2}" y="${H - B - h - 6}" font-size="12" text-anchor="middle" fill="var(--text)">${fmtMinShort(mins[i])}</text>`;
        const color = i === 0 ? "var(--sun)" : i === 6 ? "var(--sat)" : "var(--muted)";
        g += `<text x="${x + w / 2}" y="${H - 8}" font-size="13" font-weight="${k === tk ? 800 : 500}" text-anchor="middle" fill="${color}">${WEEK[i]}</text>`;
      });
      $("weekChart").innerHTML = svg(W, H, g);
    }

    // 기간 안에서 가장 오래 공부한 과목 (타이머 기록 기준)
    topSubject(keys) {
      const by = this.subjectMinutes(keys);
      const top = Object.entries(by).filter(([n]) => n !== UNSORTED).sort((a, b) => b[1] - a[1])[0];
      return top ? escapeHtml(top[0]) : "-";
    }
    // 과목별 공부 시간(분): 뽀모도로 기록의 과목 기준, 과목을 안 고른 기록은 "미분류"
    subjectMinutes(keys) {
      const by = {};
      keys.forEach((k) => ((this.records[k] && this.records[k].sessions) || []).forEach((s) => {
        const parts = s.parts && s.parts.length ? s.parts : [UNSORTED];
        parts.forEach((p) => { by[p] = (by[p] || 0) + s.minutes; });
      }));
      return by;
    }

    // 점수 추이: 이름(토익, 수학 모의고사 등)을 골라서 그 이름의 점수만 선으로. 시험 결과는 속이 찬 점
    renderScoreChart() {
      const el = $("scoreChart");
      const names = this.store.scoredNames();
      if (!names.includes(this.scoreName)) this.scoreName = names[0];
      $("scoreNames").innerHTML = names.length > 1
        ? names.map((n) => `<button type="button" class="name-chip${n === this.scoreName ? " on" : ""}" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join("")
        : "";
      $("scoreNames").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { this.scoreName = b.dataset.name; this.renderScoreChart(); }));
      this.renderExamResults();
      if (!names.length) { el.innerHTML = `<div class="empty-msg">기록에서 점수를 적거나 시험 결과를 입력하면 추이가 표시돼요</div>`; return; }
      const pts = this.store.scoreSeries(this.scoreName);

      const W = 640, H = 220, L = 52, R = 20, T = 18, B = 28;
      const vals = pts.map((p) => p.v);
      // 눈금 간격: 점수 범위에 맞춰 1·2·5 단위
      const span = Math.max(10, Math.max(...vals) - Math.min(...vals));
      const raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const step = [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= raw);
      const lo = Math.max(0, Math.floor((Math.min(...vals) - step) / step) * step);
      const hi = Math.ceil((Math.max(...vals) + step) / step) * step;
      const x = (i) => (pts.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (pts.length - 1));
      const yv = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
      const num = (v) => +v.toFixed(2);

      let g = "";
      for (let v = lo; v <= hi + 1e-9; v += step) {
        g += `<line x1="${L}" x2="${W - R}" y1="${yv(v)}" y2="${yv(v)}" stroke="var(--line)"/>`;
        g += `<text x="${L - 6}" y="${yv(v) + 4}" font-size="11" text-anchor="end" fill="var(--muted)">${num(v)}</text>`;
      }
      g += `<path d="${pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${yv(p.v)}`).join(" ")}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round"/>`;
      const labelEvery = Math.ceil(pts.length / 8);
      pts.forEach((p, i) => {
        const tip = `${p.k}  ${p.v}점${p.exam ? " (시험)" : ""}${p.detail ? ` · ${escapeHtml(p.detail)}` : ""}`;
        g += `<circle cx="${x(i)}" cy="${yv(p.v)}" r="${p.exam ? 5 : 4}" fill="${p.exam ? "var(--primary)" : "var(--card)"}" stroke="var(--primary)" stroke-width="2"><title>${tip}</title></circle>`;
        g += `<text x="${x(i)}" y="${yv(p.v) - 9}" font-size="11" text-anchor="middle" fill="var(--text)">${p.v}</text>`;
        if (i % labelEvery === 0 || i === pts.length - 1) {
          const d = parseKey(p.k);
          g += `<text x="${x(i)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="var(--muted)">${d.getMonth() + 1}/${d.getDate()}</text>`;
        }
      });
      el.innerHTML = svg(W, H, g);
    }

    // 선택한 날짜까지 30일
    renderTimeChart() {
      const W = 640, H = 150, L = 8, R = 8, T = 10, B = 22;
      const daily = this.store.settings.daily;
      const days = [];
      const d = parseKey(this.key);
      d.setDate(d.getDate() - 29);
      for (let i = 0; i < 30; i++) { days.push(keyOf(d)); d.setDate(d.getDate() + 1); }
      const mins = days.map((k) => (this.records[k] && this.records[k].minutes) || 0);
      const max = Math.max(daily || 0, ...mins, 30);
      const bw = (W - L - R) / 30;
      let g = "";
      if (daily) {
        const yy = T + (H - T - B) * (1 - daily / max);
        g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="var(--danger)" stroke-dasharray="5 4"/>`;
      }
      days.forEach((k, i) => {
        const h = ((H - T - B) * mins[i]) / max;
        g += `<rect x="${L + i * bw + 2}" y="${H - B - h}" width="${bw - 4}" height="${h}" rx="3" fill="var(--lv${this.store.level(mins[i])})"><title>${k}  ${fmtMin(mins[i])}</title></rect>`;
        if (i % 5 === 0 || i === 29) {
          const dd = parseKey(k);
          g += `<text x="${L + i * bw + bw / 2}" y="${H - 6}" font-size="10" text-anchor="middle" fill="var(--muted)">${dd.getMonth() + 1}/${dd.getDate()}</text>`;
        }
      });
      $("timeChart").innerHTML = svg(W, H, g);
    }

    // 시험 결과 목록 (점수나 합격 여부가 적힌 시험)
    renderExamResults() {
      const done = this.store.settings.exams.filter((e) => e.score != null || e.pass != null).slice().reverse();
      $("examResults").innerHTML = done.map((e) => {
        const res = [e.score != null ? `${e.score}점` : "", e.pass == null ? "" : e.pass ? "합격" : "불합격"].filter(Boolean).join(" · ");
        return `<div class="exam-result${e.pass === true ? " pass" : ""}"><span>${escapeHtml(e.name)}</span><span class="er-date">${fmtShort(e.date)}</span><b>${res}</b></div>`;
      }).join("");
    }

    // 과목별 공부 시간 (요약과 같은 기간: 이 달 또는 이 주)
    renderParts() {
      const by = this.subjectMinutes(this.scopeKeys || []);
      const names = this.store.sortSubjects(Object.keys(by).filter((n) => n !== UNSORTED));
      if (by[UNSORTED]) names.push(UNSORTED);
      $("partTitle").textContent = `과목별 공부 시간 (${{ week: "이 주", day: "이 날", month: "이 달" }[this.scope]})`;
      if (!names.length) {
        $("partChart").innerHTML = `<div class="empty-msg">뽀모도로 기록에서 과목을 고르면 과목별 공부 시간이 보여요</div>`;
        return;
      }
      const max = Math.max(1, ...Object.values(by));
      $("partChart").innerHTML = names.map((p) =>
        `<div class="part-bar"><span title="${escapeHtml(p)}">${escapeHtml(p)}</span><div class="track"><div class="fill${p === UNSORTED ? " unsorted" : ""}" style="width:${(by[p] / max) * 100}%"></div></div><span class="cnt">${fmtMinShort(by[p])}</span></div>`
      ).join("");
    }

    renderList() {
      const el = $("recordList");
      const keys = this.store.activeKeys().reverse();
      if (!keys.length) { el.innerHTML = `<div class="empty-msg">아직 기록이 없습니다</div>`; return; }
      el.innerHTML = keys.map((k) => {
        const r = this.records[k];
        const badges = (r.parts || []).map((p) => `<span class="badge">${escapeHtml(p)}</span>`).join("") +
          Store.scores(r).map((x) => `<span class="badge score">${escapeHtml(x.name)} ${x.score}점</span>`).join("") +
          (Store.tomatoes(r) ? `<span class="badge">🍅 ${Store.tomatoes(r)}</span>` : "");
        const meta = [r.minutes ? fmtMin(r.minutes) : "", r.vocab ? `단어 ${r.vocab}개` : "", r.mood ? MOOD_ICON[r.mood] : ""].filter(Boolean).join(" · ");
        return `<div class="rec" data-k="${k}">
          <div class="rec-top"><span class="rec-date">${fmtLong(k)}</span><span class="rec-meta">${meta}</span></div>
          <div>${badges}</div>
          ${r.memo ? `<div class="rec-memo">${escapeHtml(r.memo)}</div>` : ""}
        </div>`;
      }).join("");
      el.querySelectorAll(".rec").forEach((n) => n.addEventListener("click", () => this.onOpenRecord(n.dataset.k)));
    }
  }

  DT.StatsScreen = StatsScreen;
})();
