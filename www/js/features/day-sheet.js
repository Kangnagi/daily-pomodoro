// 날짜를 누르면 아래에서 올라오는 시트: 공부 시작(지난 날은 공부한 시간) / 통계 / 기록 + 아래 시험 영역
//   지난 날: 시험이 있었으면 시험 결과 박스 / 오늘: 시험 결과 입력 버튼 + 시험 추가 / 미래: "아직 오픈 전" 하나 + 시험 칩·추가
//   토요일: 통계가 "이 주 요약"(파란 계열 버튼), 매달 마지막 날: "이 달 요약"(빨간 계열 버튼), 나머지: "오늘/하루 요약"
(() => {
  "use strict";
  const { $, todayKey, parseKey, fmtLong, fmtMin, escapeHtml } = DT.utils;
  const { Store } = DT;

  class DaySheet {
    // actions: { study(), studyLog(k), stats(k, scope), record(k), exam(k, id|null), close(), toast(msg),
    //           workout(), workoutStats(k, scope), workoutLog(k) }   ← 운동모드
    constructor(store, actions, modes, workouts) {
      this.name = "day";
      this.store = store;
      this.actions = actions;
      this.modes = modes;
      this.workouts = workouts;
      this.el = $("daySheet");
      this.key = null;

      $("sheetBackdrop").addEventListener("click", () => actions.close());
      $("sheetStudy").addEventListener("click", () => this.primaryAction());
      $("sheetStats").addEventListener("click", () =>
        (this.modes.workout ? actions.workoutStats : actions.stats)(this.key, this.statsScope));
      // 시험 줄: 시험 칩을 누르면 수정/결과 입력, "＋ 시험 추가"는 새 시험
      $("sheetExams").addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) actions.exam(this.key, b.dataset.id || null);
      });
      $("sheetRecord").addEventListener("click", () => (this.modes.workout ? actions.workoutLog : actions.record)(this.key));
      this.bindSwipeDown();
      store.onChange(() => { if (this.key) this.render(); });
    }

    // 시트를 아래로 끌어내리면 닫기
    bindSwipeDown() {
      let sy = null;
      const panel = this.el.querySelector(".sheet-panel");
      panel.addEventListener("touchstart", (e) => { sy = e.touches[0].clientY; }, { passive: true });
      panel.addEventListener("touchend", (e) => {
        if (sy != null && e.changedTouches[0].clientY - sy > 60) this.actions.close();
        sy = null;
      });
    }

    // 라우터가 호출: #day/날짜 일 때 열림
    setActive(active, param) {
      if (active && param) {
        this.key = param;
        this.render();
      }
      this.el.classList.toggle("open", active);
      this.el.setAttribute("aria-hidden", String(!active));
    }

    render() {
      const k = this.key;
      const r = this.store.get(k);
      const tk = todayKey();
      $("sheetDate").textContent = fmtLong(k);
      $("sheetRecord").querySelector(".lbl").textContent = this.modes.workout ? "운동 일지" : "기록";
      $("sheetRecord").querySelector(".sub").textContent = this.modes.workout ? "근력·유산소" : "이 날 기록";
            if (this.modes.workout) { this.renderWorkout(k, tk); return; }

      const exams = this.store.examsOn(k);
      const tags = [];
      if (k === tk) tags.push(`<span class="sheet-tag today">오늘</span>`);
      if (exams.length && k >= tk) tags.push(`<span class="sheet-tag exam">시험 ${Store.ddayText(k)}</span>`);
      $("sheetTags").innerHTML = tags.join("");

      const info = [];
      if (r && r.minutes) info.push(`공부 ${fmtMin(r.minutes)}`);
      if (Store.tomatoes(r)) info.push(`🍅 ${Store.tomatoes(r)}개`);
      Store.scores(r).forEach((x) => info.push(`${x.name} ${x.score}점`));
      if (r && r.vocab) info.push(`단어 ${r.vocab}개`);
      $("sheetInfo").textContent = info.length ? info.join(" · ") : k > tk ? "아직 오지 않은 날이에요" : "아직 기록이 없어요";

      const when = k === tk ? "today" : k < tk ? "past" : "future";
      this.renderPrimary(when, r);
      this.renderStats(k);

      // 미래 날짜는 "아직 오픈 전" 하나만
      const future = when === "future";
      $("sheetStudy").classList.remove("hidden");
      $("sheetStats").classList.toggle("hidden", future);
      $("sheetRecord").classList.toggle("hidden", future);
      this.el.querySelector(".sheet-actions").classList.toggle("single", future);
      this.el.querySelector(".sheet-actions").classList.remove("double");
      this.renderExams(exams, when);
    }

    // 운동모드: 오늘 = 운동 시작 · 통계 · 운동 일지 / 지난 날 = 통계 · 운동 일지 / 미래 = 아직 오픈 전
    renderWorkout(k, tk) {
      const W = DT.WorkoutStore;
      const r = this.workouts.get(k);
      $("sheetTags").innerHTML = k === tk ? `<span class="sheet-tag today">오늘</span>` : "";
      const info = [];
      if (r) {
        const min = W.minutesOf(r);
        if (min) info.push(`운동 ${fmtMin(min)}`);
        if ((r.strength || []).length) info.push(`근력 ${r.strength.map((e) => e.name).join(", ")}`);
        if ((r.cardio || []).length) info.push(`유산소 ${r.cardio.map((c) => c.name + (c.km ? ` ${c.km}km` : "")).join(", ")}`);
        if (r.weight != null) info.push(`몸무게 ${r.weight}kg`);
      }
      $("sheetInfo").textContent = info.length ? info.join(" · ") : k > tk ? "아직 오지 않은 날이에요" : "아직 운동 기록이 없어요";

      const when = k === tk ? "today" : k < tk ? "past" : "future";
      this.when = when;
      this.renderStats(k);
      const btn = $("sheetStudy");
      btn.classList.toggle("hidden", when === "past");
      btn.classList.remove("log");
      btn.classList.toggle("closed", when === "future");
      if (when === "today") {
        btn.querySelector(".ico").textContent = "";
        btn.querySelector(".lbl").textContent = "운동 시작";
        $("sheetStudySub").textContent = "타이머";
      } else if (when === "future") {
        btn.querySelector(".ico").textContent = "";
        btn.querySelector(".lbl").textContent = "아직 오픈 전";
        $("sheetStudySub").textContent = "Coming soon…";
      }
      $("sheetStats").classList.toggle("hidden", when === "future");
      $("sheetRecord").classList.toggle("hidden", when === "future");
      const actions = this.el.querySelector(".sheet-actions");
      actions.classList.toggle("single", when === "future");
      actions.classList.toggle("double", when === "past");
      $("sheetExams").innerHTML = "";
      $("sheetExams").classList.add("hidden");
    }

    // 메뉴 아래 시험 영역
    //   지난 날: 시험이 있었으면 "시험 결과" 박스만 (없으면 아무것도 없음, 시험 추가 없음)
    //   오늘: 시험이 있으면 "시험 결과 입력" 버튼(입력했으면 결과 박스) + ＋ 시험 추가
    //   미래: 시험 칩(수정) + ＋ 시험 추가
    renderExams(exams, when) {
      const hasResult = (e) => e.score != null || e.pass != null;
      const resultText = (e) => [e.score != null ? `${e.score}점` : "", e.pass == null ? "" : e.pass ? "합격" : "불합격"].filter(Boolean).join(" · ");
      const row = (e) =>
        `<button type="button" class="exam-row${e.pass === true ? " pass" : e.pass === false ? " fail" : ""}" data-id="${e.id}">` +
        `<span class="er-name">${escapeHtml(e.name)}</span>` +
        `<b class="er-res">${hasResult(e) ? resultText(e) : "결과 미입력"}</b></button>`;
      const box = (list) => `<div class="exam-box"><div class="eb-title">시험 결과</div>${list.map(row).join("")}</div>`;
      const add = `<button type="button" class="exam-chip add">＋ 시험 추가</button>`;
      let html = "";
      if (when === "past") {
        html = exams.length ? box(exams) : "";
      } else if (when === "today") {
        const done = exams.filter(hasResult);
        html = exams.filter((e) => !hasResult(e))
          .map((e) => `<button type="button" class="exam-input" data-id="${e.id}"><b>${escapeHtml(e.name)}</b> 시험 결과 입력</button>`).join("");
        if (done.length) html += box(done);
        html += add;
      } else {
        html = exams.map((e) => `<button type="button" class="exam-chip" data-id="${e.id}">${escapeHtml(e.name)} <small>수정</small></button>`).join("") + add;
      }
      $("sheetExams").innerHTML = html;
      $("sheetExams").classList.toggle("hidden", !html);
    }

    // 통계 버튼: 매달 마지막 날은 "이 달 요약"(빨강), 토요일은 "이 주 요약"(파랑), 그 외는 "오늘/하루 요약"(원형 시계)
    static statsScopeOf(k) {
      const d = parseKey(k);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      if (d.getDate() === lastDay) return "month";
      if (d.getDay() === 6) return "week";
      return "day";
    }
    renderStats(k) {
      this.statsScope = DaySheet.statsScopeOf(k);
      const btn = $("sheetStats");
      btn.querySelector(".sub").textContent =
        { week: "이 주 요약", month: "이 달 요약", day: k === todayKey() ? "오늘 요약" : "하루 요약" }[this.statsScope];
      btn.classList.toggle("review-week", this.statsScope === "week");
      btn.classList.toggle("review-month", this.statsScope === "month");
    }

    // 첫 번째 버튼: 오늘은 타이머로 공부 시작, 지난 날은 타이머로 기록된 공부 시간 보기, 미래는 "아직 오픈 전"
    renderPrimary(when, r) {
      const btn = $("sheetStudy");
      const n = Store.tomatoes(r);
      const look = {
        today:  { ico: "", lbl: "공부 시작", sub: "타이머" },
        past:   { ico: "", lbl: "공부한 시간", sub: n ? `🍅 ${n}개 기록` : "타이머 기록 없음" },
        future: { ico: "", lbl: "아직 오픈 전", sub: "Coming soon…" },
      }[when];
      this.when = when;
      btn.querySelector(".ico").textContent = look.ico;
      btn.querySelector(".lbl").textContent = look.lbl;
      $("sheetStudySub").textContent = look.sub;
      btn.classList.toggle("log", when === "past");
      btn.classList.toggle("closed", when === "future");
    }

    primaryAction() {
      if (this.when === "today") (this.modes.workout ? this.actions.workout : this.actions.study)();
      else if (this.when === "past") this.actions.studyLog(this.key);
      else this.joke();
    }

    // 미래 날짜 공부 시작을 누르면 농담 한마디 + 살짝 흔들기
    joke() {
      const lines = [
        "아직 오픈 전이에요! 오늘 공부부터 해볼까요?",
        "미래의 나는 아직 출근 전입니다",
        "그날이 오면 문을 열어드릴게요",
        "미리 공부는 안 받아요. 오늘 꺼 먼저!",
        "그날의 나는 아직 자는 중이에요",
      ];
      this.actions.toast(lines[Math.floor(Math.random() * lines.length)]);
      const btn = $("sheetStudy");
      btn.classList.remove("shake");
      void btn.offsetWidth; // 애니메이션 다시 시작
      btn.classList.add("shake");
    }
  }

  DT.DaySheet = DaySheet;
})();
