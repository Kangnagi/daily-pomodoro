// 밝은/어두운 테마 (설정 창의 "테마"에서 고름: 시스템 설정 / 밝게 / 어둡게)
//   위쪽 테마 버튼 자리는 운동모드 버튼이 쓰고, 테마는 설정 안으로 옮김
(() => {
  "use strict";

  const THEME_KEY = "dailyToeic.theme";
  const THEMES = [
    { id: "system", name: "시스템 설정" },
    { id: "light", name: "밝은 테마" },
    { id: "dark", name: "어두운 테마" },
  ];

  class ThemeManager {
    // group: 설정 창의 테마 라디오 묶음 (input[name=theme] value=system|light|dark)
    constructor(group, toast) {
      this.group = group;
      this.toast = toast;
      this.theme = "system";
      try { this.theme = localStorage.getItem(THEME_KEY) || "system"; } catch (e) {}
      if (!THEMES.some((t) => t.id === this.theme)) this.theme = "system";
      group.addEventListener("change", (e) => { if (e.target.name === "theme") this.set(e.target.value); });
      this.apply();
    }

    get current() { return THEMES.find((t) => t.id === this.theme) || THEMES[0]; }

    apply() {
      const t = this.current;
      if (t.id === "system") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", t.id);
      this.group.querySelectorAll("input[name=theme]").forEach((i) => (i.checked = i.value === t.id));
    }

    set(id) {
      this.theme = id;
      try { localStorage.setItem(THEME_KEY, id); } catch (e) {}
      this.apply();
      this.toast.show(`${this.current.name}로 변경했습니다`);
    }
  }

  DT.ThemeManager = ThemeManager;
})();
