// 홈 화면: 요약 카드, 캘린더 (한 달 보기 ↔ 1년 보기). 위쪽 배너는 TipBanner가 담당
// 날짜를 누르면 onSelect(날짜키)를 호출한다
// 두 손가락으로 오므리면 1년 보기, 벌리면 한 달 보기 (CalendarZoom), 1년 보기는 YearView가 그린다
(() => {
  "use strict";
  const { $, pad, todayKey, fmtShort, fmtMin, fmtMinShort } = DT.utils;
  const { Store, YearView, CalendarZoom } = DT;

  // 시험 카운트다운 기준 시각: 시험 날 하루가 시작되는 00시
  const EXAM_TIME = { h: 0, m: 0 };

  class CalendarView {
    // workouts: 운동 기록(WorkoutStore), modes: ModeManager — 운동모드면 운동 기록으로 칠하고 요약 카드도 운동용
    constructor(store, onSelect, workouts, modes) {
      this.study = store;
      this.workouts = workouts;
      this.modes = modes;
      this.onSelect = onSelect;
      this.view = new Date();
      this.view.setDate(1);
      this.mode = "month"; // "month" | "year"
      this.selected = null;
      this.grid = $("calGrid");
      this.panel = document.querySelector(".panel.calendar");

      this.yearView = new YearView(store, $("yearView"), $("yearGrid"), (m) => this.showMonth(m));
      this.zoom = new CalendarZoom(this.panel, {
        onZoomOut: () => { if (this.mode === "month") this.showYear(); },
        onZoomIn: ({ x, y }) => {
          if (this.mode !== "year") return;
          const m = this.yearView.monthAt(x, y);
          this.showMonth(m != null ? m : this.view.getMonth());
        },
      });

      $("prevMonth").addEventListener("click", () => this.move(-1));
      $("nextMonth").addEventListener("click", () => this.move(1));
      $("todayBtn").addEventListener("click", () => this.goToday());
      $("zoomBtn").addEventListener("click", () => (this.mode === "month" ? this.showYear() : this.showMonth(this.view.getMonth())));
      // 시험 카운트다운은 1초마다 갱신 (화면이 보일 때만)
      setInterval(() => { if (!document.hidden) this.renderCountdown(); }, 1000);
      this.bindSwipe();
      store.onChange(() => this.render());
      modes.onChange(() => this.render());
    }

    // 지금 모드의 기록 (공부 Store 또는 WorkoutStore — 캘린더가 쓰는 함수 이름이 같음)
    get store() { return this.modes.workout ? this.workouts : this.study; }
    minOf(r) { return this.modes.workout ? DT.WorkoutStore.minutesOf(r) : (r && r.minutes) || 0; }

    // 한 달 보기에선 달 이동, 1년 보기에선 해 이동
    move(delta) {
      if (this.mode === "year") this.view.setFullYear(this.view.getFullYear() + delta);
      else this.view.setMonth(this.view.getMonth() + delta);
      this.render();
    }

    goToday() {
      this.view = new Date();
      this.view.setDate(1);
      this.render();
    }

    showYear() {
      this.mode = "year";
      this.render();
      this.animate($("yearView"), "zoom-from-big");
    }

    showMonth(m) {
      this.mode = "month";
      this.view.setMonth(m);
      this.render();
      this.animate($("calMonth"), "zoom-from-small");
    }

    animate(el, cls) {
      el.classList.remove("zoom-from-big", "zoom-from-small");
      void el.offsetWidth; // 애니메이션 다시 시작
      el.classList.add(cls);
    }

    // 좌우 스와이프로 달(1년 보기에선 해) 이동. 두 손가락 핀치 중에는 무시
    bindSwipe() {
      let sx = null, sy = null;
      this.panel.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1 && !this.zoom.pinching) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
        else sx = null;
      }, { passive: true });
      this.panel.addEventListener("touchend", (e) => {
        if (sx == null || this.zoom.pinching || e.touches.length) { sx = null; return; }
        const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        sx = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) this.move(dx < 0 ? 1 : -1);
      });
    }

    setSelected(k) {
      this.selected = k;
      this.grid.querySelectorAll(".day").forEach((b) => b.classList.toggle("selected", b.dataset.k === k));
    }

    render() {
      const year = this.mode === "year";
      $("calMonth").classList.toggle("hidden", year);
      $("yearView").classList.toggle("hidden", !year);
      $("zoomBtn").textContent = year ? "한 달" : "1년";
      $("zoomBtn").title = year ? "한 달 보기 (두 손가락으로 벌리기)" : "1년 보기 (두 손가락으로 오므리기)";
      this.yearView.store = this.store; // 1년 보기도 지금 모드의 기록으로 (요약의 "그 해 전체 시간"도 이걸 씀)
      this.renderSummary();
      if (year) {
        $("monthLabel").textContent = `${this.view.getFullYear()}년`;
        this.yearView.render(this.view.getFullYear());
      } else {
        this.renderGrid();
      }
    }

    // 시험까지 남은 시간: "11일 03시 12분 45초" 한 줄 (좁은 화면에선 글자를 줄여 맞춤)
    renderCountdown() {
      if (this.modes.workout) return; // 운동모드: 첫 카드는 몸무게
      const el = $("statDday");
      const exam = this.store.nextExam();
      // 카드 제목에 가장 가까운 시험 이름 (예: "정보처리기사")
      const label = exam ? exam.name : "시험";
      if ($("statExamLabel").textContent !== label) { $("statExamLabel").textContent = label; $("statExamLabel").title = label; }
      if (!exam) { el.textContent = "미설정"; return; }
      const [y, mo, d] = exam.date.split("-").map(Number);
      const left = new Date(y, mo - 1, d, EXAM_TIME.h, EXAM_TIME.m) - Date.now();
      if (left <= 0) { el.textContent = "오늘 시험!"; return; }
      const s = Math.floor(left / 1000);
      const days = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      const u = (n, unit) => `${pad(n)}<small>${unit}</small>`;
      const head = days ? `${days}<small>일</small> ` : "";
      el.innerHTML = `<span class="cd">${head}${u(h, "시")} ${u(m, "분")} ${u(sec, "초")}</span>`;
      this.fitCountdown(el);
    }

    // 카드 폭보다 길면 글자 크기를 줄여 한 줄에 맞춤
    fitCountdown(el) {
      const cd = el.firstElementChild;
      cd.style.fontSize = "";
      const avail = el.clientWidth - 2;
      // 단위 글자까지 함께 줄어들도록 em 기준. 두 번 맞춰서 오차 보정
      for (let i = 0, size = 0.86; i < 2 && avail > 0 && cd.scrollWidth > avail; i++) {
        size = Math.max(0.55, size * avail / cd.scrollWidth);
        cd.style.fontSize = `${size.toFixed(3)}rem`;
      }
    }

    renderSummary() {
      const workout = this.modes.workout;
      // 카드 제목: 공부모드 [시험][연속 학습][이번 달][오늘 공부] / 운동모드 [몸무게][연속 운동][이번 달][오늘 운동]
      $("statStreakLabel").textContent = workout ? "연속 운동" : "연속 학습";
      // 캘린더 아래 범례도 모드에 맞게 (운동모드: 운동량 · 점 = 몸무게, 시험일 없음)
      $("legendAmount").textContent = workout ? "운동량" : "학습량";
      $("legendDot").textContent = workout ? "몸무게" : "점수";
      $("legendExam").classList.toggle("hidden", workout);
      $("statTodayLabel").textContent = workout ? "오늘 운동" : "오늘 공부";
      if (workout) {
        const w = this.workouts.latestWeight();
        $("statExamLabel").textContent = "몸무게";
        $("statDday").textContent = w ? `${w.v}kg` : "-";
      } else {
        $("statExamLabel").textContent = "";
        this.renderCountdown();
      }
      $("statStreak").textContent = `${this.store.streak()}일`;
      const y = this.view.getFullYear();
      // 1년 보기에선 "이번 달" 대신 그 해 전체 학습 시간
      $("statMonthLabel").textContent = this.mode === "year" ? `${y}년` : "이번 달";
      $("statMonth").textContent = fmtMin(this.mode === "year" ? this.yearView.yearMinutes(y) : this.store.minutesInMonth(y, this.view.getMonth()));
      $("statToday").textContent = fmtMin(this.store.todayMinutes());
    }


    renderGrid() {
      const y = this.view.getFullYear(), m = this.view.getMonth();
      $("monthLabel").textContent = `${y}년 ${m + 1}월`;
      const first = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      const weeks = Math.ceil((first + days) / 7);
      const tk = todayKey();
      const workout = this.modes.workout;
      const daily = workout ? this.workouts.prefs.daily : this.store.settings.daily;

      // 주 수(4~6주)에 맞춰 칸 높이를 화면에 꽉 차게 나눈다
      this.grid.style.gridTemplateRows = `repeat(${weeks}, minmax(0, 1fr))`;
      let html = "";
      for (let i = 0; i < first; i++) html += `<div class="day empty"></div>`;
      for (let d = 1; d <= days; d++) {
        const k = `${y}-${pad(m + 1)}-${pad(d)}`;
        const r = this.store.get(k);
        const dow = (first + d - 1) % 7;
        const exams = this.store.examsOn(k);
        const exam = exams.length > 0;
        const min = this.minOf(r);
        const cls = ["day", `lv${this.store.level(min)}`];
        if (dow === 0) cls.push("sun");
        if (dow === 6) cls.push("sat");
        if (k === tk) cls.push("today");
        if (k > tk) cls.push("future");
        if (k === this.selected) cls.push("selected");
        if (exam) cls.push("exam", k < tk ? "past" : "upcoming");
        const label = `${m + 1}월 ${d}일${exam ? `, ${exams.map((e) => e.name).join("·")} 시험 ${Store.ddayText(k)}` : ""}${min ? `, ${fmtMin(min)}` : ""}`;

        let inner = `<span class="num">${d}</span>`;
        if (exam) inner += `<span class="exam-tag">${k < tk ? "시험" : Store.ddayText(k)}</span>`;
        // 점: 공부모드 = 점수 기록, 운동모드 = 몸무게 기록
        if (workout ? r && r.weight != null : Store.scores(r).length) inner += `<span class="dot"></span>`;
        if (r && daily && min >= daily) inner += `<span class="goal-check">✓</span>`;
        if (min) inner += `<span class="min">${!workout && Store.tomatoes(r) ? "🍅" : ""}${fmtMinShort(min)}</span>`;
        else if (workout && DT.WorkoutStore.hasActivity(r)) inner += `<span class="min">운동</span>`;
        html += `<button type="button" class="${cls.join(" ")}" data-k="${k}" aria-label="${label}">${inner}</button>`;
      }
      this.grid.innerHTML = html;
      this.grid.querySelectorAll("button.day").forEach((b) => b.addEventListener("click", () => this.onSelect(b.dataset.k)));
    }
  }

  DT.CalendarView = CalendarView;
})();
