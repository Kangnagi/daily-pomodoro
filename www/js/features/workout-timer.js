// 운동 타이머 로직 (화면과 분리): 운동 시간 스톱워치 + 세트 사이 휴식 타이머
//   스톱워치: 운동 시작 → (일시정지/계속) → 운동 끝 = 일시정지를 뺀 시간을 그날 운동 시간으로 기록
//   휴식 타이머: "세트 완료" → 정한 초만큼 줄어듦 → 끝나면 "삐삐삐" + 진동 (앱을 닫아도 시스템 알림으로 울림)
//   상태를 저장해 두므로 앱을 닫았다 열어도 이어진다
(() => {
  "use strict";
  const { todayKey } = DT.utils;

  const STATE_KEY = "dailyToeic.wtimer";
  const REST_NOTIFY_ID = 7003; // 집중 종료(7001)·진행 중 알림(7002)과 다른 번호
  const LATE_MS = 3000;        // 끝난 지 이만큼 지나서 알게 되면(앱을 나중에 연 경우) 소리 없이 정리만

  class WorkoutTimer {
    // events: { onUpdate(), onRestDone() }
    constructor(workouts, notifier, events) {
      this.workouts = workouts;
      this.notifier = notifier;
      this.events = events;
      this.fx = new DT.SoundFx();
      this.haptics = new DT.DialHaptics(() => true);
      this.restScheduled = 0; // 시스템 알림으로 예약한 휴식 끝 시각
      this.state = Object.assign(
        { running: false, startAt: 0, segStart: 0, elapsed: 0, restEndAt: 0, restTotal: 0 },
        DT.Store.read(STATE_KEY, {})
      );
      this.tickId = setInterval(() => this.tick(), 250);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) this.tick(); });
      // 앱을 닫은 사이 휴식이 끝났으면 조용히 정리
      if (this.state.restEndAt && Date.now() - this.state.restEndAt > LATE_MS) this.endRest(false);
    }

    persist() { this.workouts.store.write(STATE_KEY, this.state); }
    update() { this.persist(); this.events.onUpdate(); }

    // ---------- 스톱워치 ----------
    get started() { return this.state.startAt > 0; }
    get running() { return this.state.running; }
    total() { return this.state.elapsed + (this.state.running ? Date.now() - this.state.segStart : 0); }

    start() {
      const st = this.state, now = Date.now();
      this.fx.unlock();
      if (!st.startAt) { st.startAt = now; st.elapsed = 0; this.fx.startBeep(); }
      st.segStart = now;
      st.running = true;
      this.update();
    }
    pause() {
      const st = this.state;
      if (!st.running) return;
      st.elapsed += Date.now() - st.segStart;
      st.running = false;
      this.update();
    }
    toggle() { this.state.running ? this.pause() : this.start(); }

    // 운동 끝: 1분 이상이면 기록하고 처음으로. 기록한 분(없으면 0)을 돌려줌
    finish() {
      const ms = this.total(), end = Date.now();
      const minutes = Math.round(ms / 60000);
      if (minutes >= 1) this.workouts.addSession(this.state.startAt, end, minutes);
      Object.assign(this.state, { running: false, startAt: 0, segStart: 0, elapsed: 0 });
      this.cancelRestAlarm();
      this.state.restEndAt = 0;
      this.update();
      return minutes;
    }

    // ---------- 휴식 타이머 ----------
    get resting() { return this.state.restEndAt > 0; }
    restLeft() { return this.resting ? Math.max(0, this.state.restEndAt - Date.now()) : 0; }

    // 세트 완료 → 휴식 시작 (스톱워치가 멈춰 있으면 같이 시작)
    startRest(sec) {
      this.fx.unlock();
      if (!this.state.running) this.start();
      this.workouts.addSet(todayKey());
      this.state.restTotal = sec * 1000;
      this.state.restEndAt = Date.now() + sec * 1000;
      this.scheduleRestAlarm();
      this.update();
    }
    addRest(sec) {
      if (!this.resting) return;
      this.state.restEndAt += sec * 1000;
      this.state.restTotal += sec * 1000;
      this.scheduleRestAlarm();
      this.update();
    }
    skipRest() {
      if (!this.resting) return;
      this.cancelRestAlarm();
      this.endRest(false);
    }

    scheduleRestAlarm() {
      const at = this.state.restEndAt;
      this.restScheduled = 0;
      this.notifier.scheduleAt(REST_NOTIFY_ID, at, "휴식 끝!", "다음 세트를 시작하세요").then((ok) => { if (ok) this.restScheduled = at; });
    }
    cancelRestAlarm() {
      this.restScheduled = 0;
      this.notifier.clear(REST_NOTIFY_ID);
    }

    // 휴식이 끝남. ring=true면 "삐삐삐" + 진동 (시스템 알림이 이미 울리면 앱 안 소리는 생략)
    endRest(ring) {
      const endAt = this.state.restEndAt;
      this.state.restEndAt = 0;
      this.state.restTotal = 0;
      if (ring) {
        const covered = this.notifier.native && this.restScheduled && Math.abs(this.restScheduled - endAt) < 2000;
        if (!covered) this.fx.endBeep(() => this.haptics.pattern(DT.SoundFx.END_VIBRATION));
        if (this.notifier.native) setTimeout(() => this.notifier.clear(REST_NOTIFY_ID), 4000);
        this.events.onRestDone();
      }
      this.restScheduled = 0;
      this.update();
    }

    tick() {
      if (this.resting && Date.now() >= this.state.restEndAt) this.endRest(Date.now() - this.state.restEndAt <= LATE_MS);
      else if (this.started || this.resting) this.events.onUpdate();
    }
  }

  WorkoutTimer.REST_PRESETS = [30, 60, 90, 120, 180];
  DT.WorkoutTimer = WorkoutTimer;
})();
