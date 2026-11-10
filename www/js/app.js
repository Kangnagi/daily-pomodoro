// 앱 시작: 각 기능 객체를 만들고 서로 연결한다
(() => {
  "use strict";
  const { $ } = DT.utils;
  const APP_VERSION = "2.3 (2026-11-10)"; // 설치된 버전 확인용 (android/app/build.gradle 의 versionName과 맞춤)

  class App {
    constructor() {
      this.toast = new DT.Toast($("toast"));
      DT.ask = new DT.Ask(); // 앱 안 확인·입력 창 (confirm/prompt 대신, 모든 화면에서 사용)
      this.store = new DT.Store((msg) => this.toast.show(msg));
      this.router = new DT.Router();

      this.workouts = new DT.WorkoutStore(this.store); // 운동모드 기록
      this.arcade = new DT.ArcadeStore(this.store, this.workouts); // 아케이드: 화폐·경험치·레벨·업적·칭호
      this.modes = new DT.ModeManager($("btnMode"), this.toast); // 위쪽 💪/📖 버튼: 공부모드 ↔ 운동모드
      this.theme = new DT.ThemeManager($("themePick"), this.toast); // 테마는 설정 창 안에서
      this.settings = new DT.SettingsDialog(this.store, this.toast);

      // 계정 로그인 + 클라우드 동기화 (cloud-config.js 의 enabled가 false면 아무 동작 안 함)
      this.account = new DT.AccountService(DT.CLOUD_CONFIG);
      this.sync = new DT.CloudSync(this.store, this.account);
      this.accountPanel = new DT.AccountPanel(this.account, this.sync);
      this.account.init();
      this.sessionDialog = new DT.SessionDialog(this.store, this.toast);
      this.examDialog = new DT.ExamDialog(this.store, this.toast);

      this.calendar = new DT.CalendarView(this.store, (k) => this.router.go("day", k), this.workouts, this.modes);
      this.tips = new DT.TipBanner(this.store, this.modes, this.workouts);
      this.sheet = new DT.DaySheet(this.store, {
        study: () => this.router.go("timer"),
        studyLog: (k) => this.router.go("studylog", k),
        stats: (k, scope) => this.router.go("stats", scope ? `${k}~${scope}` : k),
        record: (k) => this.router.go("record", k),
        exam: (k, id) => this.examDialog.open(k, id),
        workout: () => this.router.go("wtimer"),
        workoutStats: (k, scope) => this.router.go("wstats", `${k}~${scope}`),
        workoutLog: (k) => this.router.go("wlog", k),
        close: () => this.router.back(),
        toast: (msg) => this.toast.show(msg),
      }, this.modes, this.workouts);
      this.timer = new DT.TimerScreen(this.store, this.sessionDialog, this.toast, this.router);
      this.stats = new DT.StatsScreen(this.store, (k) => this.router.go("record", k), this.sessionDialog);
      this.record = new DT.RecordScreen(this.store, this.sessionDialog, this.toast, this.router);
      this.studyLog = new DT.StudyLogScreen(this.store, this.sessionDialog);
      // 운동모드 화면: 운동 타이머(스톱워치+휴식), 운동 일지, 운동 통계
      this.workoutScreen = new DT.WorkoutScreen(this.workouts, this.timer.timer.alarm.notifier, this.toast, this.router);
      this.workoutLog = new DT.WorkoutLogScreen(this.workouts, this.toast, this.router);
      this.workoutStats = new DT.WorkoutStatsScreen(this.workouts, (k) => this.router.go("wlog", k));
      // 모드를 바꾸면 메인 화면으로
      this.modes.onChange(() => this.router.home());
      // 아케이드: 프로필 화면(위쪽 바 사람 버튼), 지난 기록 정산 + 업적·레벨업 알림
      this.profile = new DT.ProfileScreen(this.arcade, this.store);
      this.profile.onOpen = () => this.router.go("profile");
      this.arcadeNotify = new DT.ArcadeNotifier(this.arcade, this.store, () => this.router.go("profile"));

      // 각 화면을 라우터에 등록 (홈 캘린더는 항상 아래에 깔려 있음)
      [this.sheet, this.timer, this.stats, this.record, this.studyLog, this.workoutScreen, this.workoutLog, this.workoutStats, this.profile]
        .forEach((v) => this.router.register(v));
      // 선택된 날짜 표시는 시트/기록/통계 화면이 열려 있는 동안 유지
      this.router.register({ name: "__selection", setActive: () => {
        const { name, param } = this.router.current;
        const k = param && param.split("~")[0];
        this.calendar.setSelected(["day", "stats", "record", "studylog", "wstats", "wlog"].includes(name) ? k : null);
      } });

      // 화면 왼쪽 위 ‹ 버튼
      document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => this.goBack()));

      // 설정 창 맨 아래: 버전 + 태엽 소리 상태 (휴대폰에서 소리가 안 날 때 원인 확인용)
      const showVersion = () => { $("appVersion").textContent = `Daily Study 버전 ${APP_VERSION} · 태엽 소리: ${this.timer.sound.status}`; };
      showVersion();
      $("btnSettings").addEventListener("click", showVersion);
      this.calendar.render();
      this.router.start();
      this.arcadeNotify.start(); // 처음이면 지난 기록 정산 창, 아니면 새 업적·레벨업 확인
      this.registerServiceWorker();
    }

    // 휴대폰 뒤로가기 (안드로이드 앱: MainActivity가 호출). "handled"를 돌려주면 앱이 계속, "exit"면 종료
    //   1) 종료 확인 창이 떠 있으면 → 종료 (뒤로가기 두 번 = 종료)
    //   2) 다른 확인·입력 창, 기록·시험·설정 창이 열려 있으면 → 그 창만 닫기
    //   3) 공부·운동 타이머 화면 → 바로 메인 / 통계·기록 화면이나 날짜 시트 → 이전 화면
    //   4) 메인 화면 → "앱을 종료할까요?" 창 [취소] [종료]
    onBackButton() {
      if (this.exitAsking) return "exit";
      if (DT.ask.dialog.open) { $("askCancel").click(); return "handled"; }
      const openDialog = [...document.querySelectorAll("dialog[open]")].pop();
      if (openDialog) { openDialog.close(); return "handled"; }
      if (this.router.current.name) { this.goBack(); return "handled"; }
      this.askExit();
      return "handled";
    }

    // 이전 화면으로. 공부 타이머는 날짜 시트를 거치지 않고 바로 메인(캘린더)으로
    goBack() {
      if (["timer", "wtimer"].includes(this.router.current.name) || history.length <= 1) this.router.home();
      else this.router.back();
    }

    async askExit() {
      this.exitAsking = true;
      const t = this.timer.timer, w = this.workoutScreen.timer;
      const running = t.running || t.onBreak;
      const working = w.started || w.resting;
      const msg = "앱을 종료할까요?\n" +
        (running ? "타이머는 알림창에서 계속 돌아가요. " : "") +
        (working ? "운동 시간은 이어서 재고, 휴식이 끝나면 알림이 울려요. " : "") +
        "뒤로가기를 한 번 더 누르면 종료돼요.";
      const ok = await DT.ask.confirm(msg, { ok: "종료" });
      this.exitAsking = false;
      if (ok) this.exitApp();
    }

    exitApp() {
      const p = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppControl;
      if (p) p.exitApp();
    }

    registerServiceWorker() {
      // 안드로이드 앱(Capacitor) 안에서는 파일이 앱에 들어 있으므로 오프라인 캐시가 필요 없음
      const native = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
      if (native) return;
      if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        navigator.serviceWorker.register("service-worker.js").catch(() => {});
      }
    }
  }

  DT.app = new App();
})();
