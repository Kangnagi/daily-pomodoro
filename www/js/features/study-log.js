// 공부한 시간 화면 (지난 날짜): 그날 공부 타이머로 기록된 시간만 보여준다 (직접 입력 불가)
(() => {
  "use strict";
  const { $, fmtLong, fmtMin, fmtClock, escapeHtml } = DT.utils;

  class StudyLogScreen {
    constructor(store, sessionDialog) {
      this.name = "studylog";
      this.store = store;
      this.sessions = sessionDialog;
      this.el = $("studyLogScreen");
      this.key = null;
      store.onChange(() => { if (this.key) this.render(); });
    }

    setActive(active, param) {
      this.key = active ? param : null;
      if (active) {
        this.render();
        this.el.querySelector(".screen-body").scrollTop = 0;
      }
      this.el.classList.toggle("open", active);
    }

    render() {
      const k = this.key;
      const r = this.store.get(k);
      const list = ((r && r.sessions) || []).slice().sort((a, b) => a.start - b.start);
      const total = list.reduce((s, x) => s + x.minutes, 0);
      $("studyLogDate").textContent = fmtLong(k);

      if (!list.length) {
        $("studyLogSummary").innerHTML = "";
        $("studyLogList").innerHTML = `<div class="empty-msg">이 날은 공부 타이머로 기록된 공부가 없어요</div>`;
        return;
      }

      // 과목별 공부 시간 (설정의 과목 순서대로)
      const byPart = {};
      list.forEach((s) => s.parts.forEach((p) => { byPart[p] = (byPart[p] || 0) + s.minutes; }));
      const partText = this.store.sortSubjects(Object.keys(byPart)).map((p) => `<span class="badge">${escapeHtml(p)} ${fmtMin(byPart[p])}</span>`).join("");

      $("studyLogSummary").innerHTML =
        `<div class="totals">` +
        `<div>공부한 시간<b>${fmtMin(total)}</b></div>` +
        `<div>뽀모도로<b>🍅 ${list.length}개</b></div>` +
        `<div>공부 시간대<b>${fmtClock(list[0].start)}–${fmtClock(list[list.length - 1].end)}</b></div>` +
        `</div>` +
        (partText ? `<div class="log-parts">${partText}</div>` : "");
      this.sessions.renderList($("studyLogList"), k, list, false);
    }
  }

  DT.StudyLogScreen = StudyLogScreen;
})();
