// 원판을 돌릴 때 톱니마다 손끝에 오는 아주 약한 "톡" 진동 (세기 1~10 중 LEVEL)
//   안드로이드 앱: 직접 만든 DialHaptics 플러그인 (10ms, 세기 LEVEL/10)
//   웹(안드로이드 크롬): navigator.vibrate로 아주 짧게 (세기는 조절 불가, 길이로 약하게)
(() => {
  "use strict";

  const LEVEL = 3;          // 진동 세기 (1~10)
  const MIN_GAP_MS = 35;    // 너무 촘촘하면 "윙~"이 되므로 이 간격보다 자주 울리지 않음
  const WEB_MS = 5;         // 웹에서 한 번 진동 길이

  class DialHaptics {
    // isEnabled(): 설정에서 진동을 켰는지
    constructor(isEnabled) {
      this.isEnabled = isEnabled;
      this.last = 0;
      const cap = window.Capacitor;
      this.native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
      this.plugin = this.native ? ((cap.Plugins && cap.Plugins.DialHaptics) || cap.registerPlugin("DialHaptics")) : null;
      this.web = !this.native && typeof navigator.vibrate === "function";
    }

    get supported() { return this.native || this.web; }

    // 톱니 n개를 넘었을 때 호출: 간격 제한 안에서 한 번 "톡"
    tick() {
      if (!this.isEnabled() || !this.supported) return;
      const now = performance.now();
      if (now - this.last < MIN_GAP_MS) return;
      this.last = now;
      if (this.native) this.plugin.tick({ level: LEVEL }).catch(() => {});
      else navigator.vibrate(WEB_MS);
    }
  }

  // 알람용 박자 진동: timings = [울림, 쉼, 울림, ...](ms). 앱은 휴대폰 기본 세기, 웹은 navigator.vibrate
  DialHaptics.prototype.pattern = function (timings) {
    if (!this.supported) return;
    if (this.native) this.plugin.pattern({ timings }).catch(() => {});
    else navigator.vibrate(timings);
  };

  DialHaptics.LEVEL = LEVEL;
  DT.DialHaptics = DialHaptics;
})();
