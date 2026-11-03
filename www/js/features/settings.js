// 설정 창: 테마, 공부 과목, 하루 목표 시간(공부·운동), 백업 내보내기/가져오기
(() => {
  "use strict";
  const { $, todayKey, escapeHtml } = DT.utils;

  class SettingsDialog {
    constructor(store, toast) {
      this.store = store;
      this.toast = toast;
      this.dialog = $("settingsDialog");

      $("btnSettings").addEventListener("click", () => this.open());
      $("btnSettingsCancel").addEventListener("click", () => this.dialog.close());
      $("settingsForm").addEventListener("submit", () => this.save());
      $("btnExport").addEventListener("click", () => this.exportBackup());
      $("btnImport").addEventListener("click", () => $("importFile").click());
      $("importFile").addEventListener("change", (e) => this.importBackup(e));
      $("sSubjectAdd").addEventListener("click", () => this.addSubject());
      $("sSubjectNew").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); this.addSubject(); } });
      $("sSubjects").addEventListener("click", async (e) => {
        const b = e.target.closest("[data-del]");
        if (!b || !(await DT.ask.confirm(`'${b.dataset.del}' 과목을 목록에서 지울까요? 지난 기록은 그대로 남아요.`, { ok: "삭제", danger: true }))) return;
        this.store.removeSubject(b.dataset.del);
        this.renderSubjects();
      });
    }

    open() {
      $("sDaily").value = this.store.settings.daily || "";
      $("sWDaily").value = (this.store.settings.workout && this.store.settings.workout.daily) || "";
      $("sSubjectNew").value = "";
      this.renderSubjects();
      this.dialog.showModal();
    }

    // 과목 목록: 칩의 ×로 지우기 (지운 과목의 지난 기록은 그대로 남음)
    renderSubjects() {
      const list = this.store.subjects;
      $("sSubjects").innerHTML = list.length
        ? list.map((n) => `<span class="subject-chip">${escapeHtml(n)}<button type="button" data-del="${escapeHtml(n)}" aria-label="${escapeHtml(n)} 지우기">×</button></span>`).join("")
        : `<span class="hint">아직 과목이 없어요. 아래에서 추가해 보세요</span>`;
    }
    addSubject() {
      const name = $("sSubjectNew").value.trim();
      if (!name) return;
      if (!this.store.addSubject(name)) this.toast.show("이미 있는 과목이에요");
      $("sSubjectNew").value = "";
      this.renderSubjects();
    }

    save() {
      this.addSubject(); // 입력칸에 적어 두고 저장을 눌러도 추가
      const workout = Object.assign({}, this.store.settings.workout, { daily: Number($("sWDaily").value) || 0 });
      this.store.updateSettings({ daily: Number($("sDaily").value) || 0, workout });
      this.toast.show("설정을 저장했습니다");
    }

    exportBackup() {
      const blob = new Blob([this.store.exportJson()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `daily-study-backup-${todayKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    async importBackup(e) {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const n = Object.keys((data && data.records) || {}).length;
        if (!(await DT.ask.confirm(`${n}개의 기록을 가져옵니다. 같은 날짜의 기존 기록은 덮어씁니다. 계속할까요?`, { ok: "가져오기" }))) return;
        this.store.importData(data);
        this.dialog.close();
        this.toast.show(`${n}개 기록을 가져왔습니다`);
      } catch (err) {
        this.toast.show("백업 파일을 읽을 수 없습니다");
      }
    }
  }

  DT.SettingsDialog = SettingsDialog;
})();
