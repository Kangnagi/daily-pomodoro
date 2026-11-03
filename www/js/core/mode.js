// 공부모드 ↔ 운동모드 전환 (위쪽 버튼). 고른 모드는 기억해 두고 다음에 열 때도 그대로
//   <body data-mode="study|workout"> 로 색(운동모드는 초록 계열)과 제목을 바꾸고, onChange로 화면들에 알림
(() => {
  "use strict";
  const { $ } = DT.utils;

  const MODE_KEY = "dailyToeic.mode";
  const LOOK = {
    study: { title: "Daily Study", btn: "💪", btnTitle: "운동모드로 바꾸기", toast: "공부모드" },
    workout: { title: "Daily Workout", btn: "📖", btnTitle: "공부모드로 바꾸기", toast: "운동모드" },
  };

  class ModeManager {
    constructor(button, toast) {
      this.button = button;
      this.toast = toast;
      this.listeners = [];
      let m = "study";
      try { m = localStorage.getItem(MODE_KEY) || "study"; } catch (e) {}
      this.mode = m === "workout" ? "workout" : "study";
      this.button.addEventListener("click", () => this.set(this.mode === "study" ? "workout" : "study", true));
      this.apply();
    }

    get workout() { return this.mode === "workout"; }
    onChange(fn) { this.listeners.push(fn); }

    set(mode, announce) {
      if (mode === this.mode) return;
      this.mode = mode;
      try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
      this.apply();
      if (announce) this.toast.show(LOOK[mode].toast);
      this.listeners.forEach((fn) => fn(mode));
    }

    apply() {
      const look = LOOK[this.mode];
      document.body.dataset.mode = this.mode;
      $("appTitle").textContent = look.title;
      this.button.textContent = look.btn;
      this.button.title = look.btnTitle;
      this.button.setAttribute("aria-label", look.btnTitle);
    }
  }

  DT.ModeManager = ModeManager;
})();
