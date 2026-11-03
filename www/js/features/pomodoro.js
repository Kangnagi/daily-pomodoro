// 뽀모도로 타이머 로직 (화면과 분리)
//   집중: 정해 둔 시간에서 줄어드는 타이머. 시작하면 높은 "삐삐삐", 끝나면 "삐삐삐" + 공부 기록
//   휴식: 시간 설정 없이 쉰 만큼 올라가는 스톱워치. "다시 집중"을 누르면 휴식 시간을 기록하고 집중 시작
// 실행 중에는 종료/시작 시각을 저장하므로 앱을 닫았다 열어도 이어진다
(() => {
  "use strict";

  const TIMER_KEY = "dailyToeic.timer";
  const MODE_NAME = { focus: "집중", break: "휴식" };

  const LATE_MS = 3000; // 끝난 지 이만큼 지나서야 처리되면(앱을 나중에 연 경우) 소리 없이 기록만

  // 알람: 시작/끝 "삐삐삐"(SoundFx) + 끝날 때 "삐삐삐"와 같은 박자로 "징-징-징" 진동
  //   안드로이드 앱에서는 NativeNotifier가 끝나는 시각에 시스템 알림을 예약 → 앱을 닫아도 울림
  class Alarm {
    constructor() {
      this.fx = new DT.SoundFx();
      this.notifier = new DT.NativeNotifier();
      this.haptics = new DT.DialHaptics(() => true); // 알람 진동은 원판 진동 설정과 상관없이
    }

    // 브라우저 정책상 사용자가 버튼을 누를 때 오디오를 깨워 둬야 나중에 소리가 난다
    unlock() {
      this.fx.unlock();
      if (!this.notifier.native && "Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    }

    startSound() { this.fx.startBeep(); }

    scheduleEnd(at) { this.notifier.scheduleFocusEnd(at); }
    cancelEnd() { this.notifier.cancelFocusEnd(); }

    ring(title, body, endAt) {
      const late = Date.now() - endAt > LATE_MS;
      const covered = this.notifier.coveredBy(endAt); // 시스템 알림이 이미 소리·진동을 냄
      this.notifier.scheduledAt = 0;
      // 이미 울린 알림 정리 (나중에 연 경우 바로, 화면을 보고 있었으면 알림 소리가 끝난 뒤)
      if (this.notifier.native) setTimeout(() => this.notifier.dismissFocusEnd(), late ? 0 : 4000);
      if (late || covered) return;
      // 첫 "삐"가 울리는 순간 진동 시작 → 세 음과 세 번의 진동이 같은 박자
      this.fx.endBeep(() => this.haptics.pattern(DT.SoundFx.END_VIBRATION));
      try {
        if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(title, { body, icon: "icon.svg" });
      } catch (e) {}
    }
  }

  class PomodoroTimer {
    // events: { onUpdate(), onFocusDone({k, s}) }
    constructor(store, events) {
      this.store = store;
      this.events = events;
      this.alarm = new Alarm();
      this.notice = new DT.TimerNotice(this.alarm.notifier); // 알림창의 "집중 중 / 휴식 중"
      this.tickId = null;
      const saved = DT.Store.read(TIMER_KEY, {});
      // 예전 버전의 짧은/긴 휴식 상태는 새 집중으로 초기화
      if (saved.mode && saved.mode !== "focus" && saved.mode !== "break") Object.assign(saved, { mode: "focus", running: false, remaining: null });
      this.state = Object.assign(
        // pauses: 이번 집중 중 일시정지한 구간 [[멈춘 시각, 다시 시작한 시각(0=아직 멈춤)], ...] → 기록에서 공부 시간에서 뺌
        { mode: "focus", running: false, endAt: 0, remaining: null, focusStart: 0, breakStart: 0, last: null, pauses: [] },
        saved
      );
      if (this.state.remaining == null) this.state.remaining = this.duration();
      document.addEventListener("visibilitychange", () => { if (!document.hidden) this.tick(); });
    }

    // 저장된 상태로 재개 (앱을 닫아둔 사이에 집중이 끝났으면 바로 완료 처리)
    resume() {
      if (this.state.mode === "break") this.startTicking();
      else if (this.state.running) {
        if (Date.now() >= this.state.endAt) this.finish(this.state.endAt);
        else this.startTicking();
      }
      this.syncNotice();
    }

    get pomo() { return this.store.settings.pomo; }
    get mode() { return this.state.mode; }
    get running() { return this.state.running; }
    get onBreak() { return this.state.mode === "break"; }
    duration() { return this.pomo.focus * 60000; }
    remaining() { return this.state.running ? Math.max(0, this.state.endAt - Date.now()) : this.state.remaining; }
    breakElapsed() { return this.onBreak ? Math.max(0, Date.now() - this.state.breakStart) : 0; }
    isFresh() { return !this.onBreak && !this.state.running && this.state.remaining === this.duration(); }
    static modeName(mode) { return MODE_NAME[mode]; }

    persist() { this.store.write(TIMER_KEY, this.state); }
    update() { this.persist(); this.syncNotice(); this.events.onUpdate(); }
    syncNotice() {
      this.notice.sync(this.state, { fresh: this.isFresh(), focusMin: this.pomo.focus, durationMs: this.duration(), color: this.pomo.color });
    }

    startTicking() {
      clearInterval(this.tickId);
      this.tickId = setInterval(() => this.tick(), 250);
    }

    tick() {
      if (!this.onBreak && this.state.running && Date.now() >= this.state.endAt) this.finish(this.state.endAt);
      else this.events.onUpdate();
    }

    // ---------- 집중 ----------
    start() {
      if (this.onBreak) return;
      this.alarm.unlock();
      this.alarm.startSound();
      const st = this.state;
      const now = Date.now();
      st.running = true;
      st.endAt = now + st.remaining;
      if (!st.focusStart) { st.focusStart = now; st.pauses = []; }
      else this.closePause(now); // 일시정지했다가 이어서 시작
      this.alarm.scheduleEnd(st.endAt); // 앱을 닫아도 끝나는 시각에 알림
      this.startTicking();
      this.update();
    }

    pause() {
      if (this.onBreak) return;
      this.state.remaining = this.remaining();
      this.state.running = false;
      if (this.state.focusStart) (this.state.pauses = this.state.pauses || []).push([Date.now(), 0]);
      clearInterval(this.tickId);
      this.alarm.cancelEnd();
      this.update();
    }

    toggle() { this.state.running ? this.pause() : this.start(); }

    // 아직 열려 있는 일시정지 구간을 at에서 닫음
    closePause(at) {
      const last = (this.state.pauses || [])[this.state.pauses.length - 1];
      if (last && !last[1]) last[1] = at;
    }

    // 이번 집중을 기록: 시작~끝 시각은 실제 시각 그대로, 공부 시간(minutes)은 일시정지를 뺀 집중한 시간만
    recordFocus(end, focusedMs) {
      this.closePause(end);
      const pauses = (this.state.pauses || []).filter(([a, b]) => b > a && a < end);
      const start = this.state.focusStart || end - focusedMs;
      return this.store.addSession(start, end, { minutes: Math.max(1, Math.round(focusedMs / 60000)), pauses });
    }

    // 집중을 처음 상태(설정 시간 가득)로
    reset() {
      clearInterval(this.tickId);
      this.alarm.cancelEnd();
      Object.assign(this.state, { mode: "focus", running: false, remaining: this.duration(), focusStart: 0, pauses: [] });
      this.update();
    }

    // 다이얼 드래그로 집중 시간 변경 (멈춰 있을 때만)
    setMinutes(min, persistSettings) {
      if (this.state.running || this.onBreak) return;
      this.store.updatePomo({ focus: min }, !persistSettings);
      this.state.remaining = min * 60000;
      this.state.focusStart = 0;
      this.state.pauses = [];
      if (persistSettings) { this.persist(); this.syncNotice(); }
      this.events.onUpdate();
    }

    // 입력칸으로 집중 시간 변경: 아직 시작 전이면 바로 반영
    setDuration(min) {
      const fresh = this.isFresh();
      this.store.updatePomo({ focus: min });
      if (fresh) this.reset();
      else this.events.onUpdate();
    }

    // 집중 시간이 다 됨: 기록 → 알람 → 휴식(스톱워치) 시작
    finish(endAt) {
      clearInterval(this.tickId);
      const rec = this.recordFocus(endAt, this.duration()); // 집중 시간을 다 채움 (일시정지 시간은 빠짐)
      this.alarm.ring("집중 완료! 🍅", "휴식 중이에요. 다시 집중할 땐 '다시 집중'을 눌러 주세요.", endAt);
      this.enterBreak(endAt, rec);
      this.events.onFocusDone(rec);
    }

    enterBreak(at, rec) {
      Object.assign(this.state, {
        mode: "break", running: false, breakStart: at, focusStart: 0, pauses: [],
        last: rec ? { k: rec.k, id: rec.s.id } : null,
      });
      this.startTicking();
      this.update();
    }

    // 집중 중 그만두기: 1분 이상 했으면 그만큼 기록할지 묻고 휴식으로
    // confirmFn(메시지, 버튼 글자) → Promise<boolean> (앱 안 확인 창)
    async skip(confirmFn) {
      if (this.onBreak) return null;
      const doneMs = this.duration() - this.remaining();
      if (doneMs >= 60000) {
        if (!(await confirmFn(`지금까지 집중한 ${Math.floor(doneMs / 60000)}분을 기록하고 휴식할까요?`, "기록하고 휴식"))) return null;
        if (this.onBreak) return null; // 묻는 사이에 집중이 끝난 경우
        const done = this.duration() - this.remaining(); // 묻는 동안 흐른 시간까지
        clearInterval(this.tickId);
        this.alarm.cancelEnd();
        const end = Date.now();
        const rec = this.recordFocus(end, done);
        this.enterBreak(end, rec);
        return rec;
      }
      if (await confirmFn("1분이 안 돼서 기록되지 않아요. 집중을 처음부터 다시 할까요?", "처음부터")) this.reset();
      return null;
    }

    // ---------- 휴식 → 다시 집중 ----------
    refocus() {
      if (!this.onBreak) return;
      const restMin = Math.round(this.breakElapsed() / 60000);
      if (this.state.last) this.store.setSessionRest(this.state.last.k, this.state.last.id, restMin);
      Object.assign(this.state, { mode: "focus", running: false, remaining: this.duration(), focusStart: 0, breakStart: 0, last: null, pauses: [] });
      this.start();
    }
  }

  DT.PomodoroTimer = PomodoroTimer;
})();
