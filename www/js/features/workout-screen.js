// 운동 타이머 화면 (#wtimer): 위 = 운동 시간 스톱워치, 가운데 = 세트 사이 휴식 타이머(원 링이 줄어듦), 아래 = 오늘 운동 요약
(() => {
  "use strict";
  const { $, pad, todayKey, fmtMin } = DT.utils;
  const { WorkoutStore, WorkoutTimer } = DT;

  const RING_R = 82, RING_LEN = 2 * Math.PI * RING_R;
  const hms = (ms) => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };
  const ms2 = (ms) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

  class WorkoutScreen {
    constructor(workouts, notifier, toast, router) {
      this.name = "wtimer";
      this.workouts = workouts;
      this.toast = toast;
      this.router = router;
      this.el = $("wtimerScreen");
      this.active = false;
      this.timer = new WorkoutTimer(workouts, notifier, {
        onUpdate: () => this.render(),
        onRestDone: () => this.toast.show("휴식 끝! 다음 세트 시작"),
      });

      $("wRestPresets").innerHTML = WorkoutTimer.REST_PRESETS.map((s) =>
        `<button type="button" data-sec="${s}" aria-label="휴식 ${s}초">${ms2(s * 1000)}</button>`).join(""); // 0:30 1:00 1:30 2:00 3:00
      $("wRestPresets").addEventListener("click", (e) => {
        const b = e.target.closest("[data-sec]");
        if (b) { this.workouts.updatePrefs({ rest: Number(b.dataset.sec) }); this.render(); }
      });
      $("wStart").addEventListener("click", () => this.timer.toggle());
      $("wFinish").addEventListener("click", () => this.finish());
      $("wSetDone").addEventListener("click", () => this.timer.startRest(this.workouts.prefs.rest));
      $("wRestPlus").addEventListener("click", () => this.timer.addRest(15));
      $("wRestSkip").addEventListener("click", () => this.timer.skipRest());
      $("wOpenLog").addEventListener("click", () => this.router.go("wlog", todayKey()));
      $("wtimerChip").addEventListener("click", () => this.router.go("wtimer"));
      workouts.store.onChange(() => this.render());
      this.render();
    }

    setActive(active) {
      this.active = active;
      this.el.classList.toggle("open", active);
      if (active) this.render();
    }

    async finish() {
      const t = this.timer;
      if (!t.started) return;
      const min = Math.round(t.total() / 60000);
      const msg = min >= 1 ? `운동 ${fmtMin(min)}을 기록하고 끝낼까요?` : "1분이 안 돼서 기록되지 않아요. 끝낼까요?";
      if (!(await DT.ask.confirm(msg, { ok: "운동 끝" }))) return;
      const saved = t.finish();
      if (saved) {
        this.toast.show(`운동 ${fmtMin(saved)} 기록! 무슨 운동을 했는지 적어 보세요`);
        this.router.go("wlog", todayKey());
      }
    }

    render() {
      const t = this.timer;
      // 홈 위쪽 칩: 운동 중이거나 휴식 중이면 보임
      const chip = $("wtimerChip");
      chip.classList.toggle("hidden", !t.started && !t.resting);
      chip.textContent = t.resting ? `휴식 ${ms2(t.restLeft())}` : `운동 ${hms(t.total()).replace(/^00:/, "")}${t.running ? "" : " · 멈춤"}`;
      if (!this.active) return;

      // 스톱워치
      $("wWatch").textContent = hms(t.total());
      $("wWatch").classList.toggle("paused", t.started && !t.running);
      $("wStart").textContent = !t.started ? "운동 시작" : t.running ? "일시정지" : "계속";
      $("wFinish").classList.toggle("hidden", !t.started);

      // 휴식 타이머 링: 휴식 중이면 남은 비율만큼, 아니면 가득
      const rest = this.workouts.prefs.rest;
      const left = t.restLeft(), total = t.state.restTotal || rest * 1000;
      const frac = t.resting ? left / total : 1;
      $("wRestArc").style.strokeDasharray = `${RING_LEN}`;
      $("wRestArc").style.strokeDashoffset = `${RING_LEN * (1 - frac)}`;
      $("wRestTime").textContent = ms2(t.resting ? left : rest * 1000);
      $("wRestLabel").textContent = t.resting ? "휴식 중" : "휴식 시간";
      $("wRestBox").classList.toggle("resting", t.resting);
      $("wRestPresets").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.sec) === rest)));
      $("wSetDone").classList.toggle("hidden", t.resting);
      $("wRestPlus").classList.toggle("hidden", !t.resting);
      $("wRestSkip").classList.toggle("hidden", !t.resting);

      // 오늘 운동 요약
      const r = this.workouts.get(todayKey());
      $("wSetCount").textContent = `오늘 세트 ${(r && r.sets) || 0}`;
      const parts = [];
      if (r) {
        const min = WorkoutStore.minutesOf(r);
        if (min) parts.push(`운동 ${fmtMin(min)}`);
        if ((r.strength || []).length) parts.push(`근력 ${r.strength.length}종목 · ${WorkoutStore.setCount(r)}세트`);
        if ((r.cardio || []).length) parts.push(`유산소 ${r.cardio.map((c) => c.name).join(", ")}`);
        if (r.weight != null) parts.push(`몸무게 ${r.weight}kg`);
      }
      $("wToday").textContent = parts.length ? parts.join(" · ") : "아직 오늘 운동 기록이 없어요";
    }
  }

  WorkoutScreen.RING_LEN = RING_LEN;
  DT.WorkoutScreen = WorkoutScreen;
})();
