// 화면 전환: 주소의 #해시로 현재 화면을 관리한다
//   ""             → 캘린더(홈)
//   #day/날짜      → 홈 + 날짜 바텀시트
//   #timer         → 공부(타이머) 화면
//   #stats/날짜    → 통계 화면
//   #record/날짜   → 기록 화면
// 휴대폰 뒤로가기 버튼을 누르면 이전 화면으로 돌아간다
(() => {
  "use strict";

  class Router {
    constructor() {
      this.views = [];
      this.current = { name: "", param: null };
      window.addEventListener("popstate", () => this.sync());
    }

    // view: { name, setActive(active, param) }
    register(view) {
      this.views.push(view);
    }

    static parse(hash) {
      const [name, param] = hash.replace(/^#/, "").split("/");
      return { name: name || "", param: param || null };
    }

    go(name, param) {
      const hash = name ? `#${name}${param ? `/${param}` : ""}` : location.pathname + location.search;
      history.pushState(null, "", hash);
      this.sync();
    }

    back() {
      if (this.current.name) history.back();
    }

    // 홈으로 바로 돌아가기 (쌓인 화면 건너뜀)
    home() {
      history.replaceState(null, "", location.pathname + location.search);
      this.sync();
    }

    sync() {
      this.current = Router.parse(location.hash);
      this.views.forEach((v) => v.setActive(v.name === this.current.name, this.current.param));
    }

    // 새로고침 시 해시가 남아 있으면, 뒤로가기로 홈에 갈 수 있도록 홈을 기록에 깔아 둔다
    start() {
      const initial = location.hash;
      if (initial) {
        history.replaceState(null, "", location.pathname + location.search);
        history.pushState(null, "", initial);
      }
      this.sync();
    }
  }

  DT.Router = Router;
})();
