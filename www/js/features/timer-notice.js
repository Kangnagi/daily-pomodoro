// 타이머가 도는 동안 휴대폰 알림창에 떠 있는 게이지 타이머 알림 (안드로이드 앱에서만)
//   알약 모양 게이지 바 + "집중 중 · N분" + 큰 시간(휴식은 쉰 시간)
//   집중: 고른 색 게이지가 가득 찼다가 서서히 줄어듦 → 끝나면 휴식(초록 게이지가 늘어남, 60분에 가득)
//   일시정지: 멈춘 게이지 / 처음 상태: 알림 없음
//   갱신은 네이티브 TimerNoticeService(포그라운드 서비스)가 해서 앱을 닫아도 움직임. 웹에서는 아무 일도 하지 않음
(() => {
  "use strict";

  class TimerNotice {
    // notifier: NativeNotifier (알림 허용을 먼저 받아야 알림이 보임)
    constructor(notifier) {
      this.notifier = notifier;
      const cap = window.Capacitor;
      this.native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
      this.plugin = this.native ? (cap.Plugins && cap.Plugins.TimerNotice) || null : null;
      if (!this.plugin) this.native = false; // 플러그인이 없는 예전 앱이면 조용히 끔
      this.lastKey = ""; // 같은 내용이면 다시 보내지 않음
      this.queue = Promise.resolve(); // 보이기/지우기를 순서대로 (허용 확인을 기다리는 사이 순서가 뒤바뀌지 않게)
    }

    // 타이머 상태(PomodoroTimer.state)를 보고 알림을 맞춤
    //   opts: { fresh, focusMin, durationMs, color(설정의 집중 색 키) }
    sync(state, opts) {
      if (!this.native) return;
      const C = DT.TimeTimerDial.COLORS;
      const focusKey = opts.color in C ? opts.color : "red";
      const breakKey = focusKey === "green" ? "teal" : "green"; // 앱 원판과 같은 규칙
      const pick = (k) => ({ main: C[k].main });
      const base = { focusMin: opts.focusMin, durationMs: opts.durationMs, color: pick(focusKey), breakColor: pick(breakKey) };
      let args = null;
      if (state.mode === "break") {
        args = Object.assign(base, { mode: "break", startAt: state.breakStart });
      } else if (state.running && state.endAt > Date.now()) {
        args = Object.assign(base, { mode: "focus", endAt: state.endAt });
      } else if (!state.running && !opts.fresh) {
        args = Object.assign(base, { mode: "paused", remainingMs: state.remaining || 0 });
      }
      const key = JSON.stringify(args);
      if (key === this.lastKey) return;
      this.lastKey = key;
      this.queue = this.queue
        .then(async () => {
          if (!args) return this.plugin.hide();
          if (await this.notifier.ensurePermission()) return this.plugin.show(args);
          this.lastKey = ""; // 허용 전이면 다음 변화 때 다시 시도
        })
        .catch((e) => { this.lastKey = ""; console.warn("[notice] 알림 표시 실패", e); });
    }
  }

  DT.TimerNotice = TimerNotice;
})();
