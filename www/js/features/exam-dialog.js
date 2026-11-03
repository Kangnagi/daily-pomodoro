// 시험 창: 날짜에 이름 있는 시험을 추가·수정·삭제하고, 시험 날이 지나면 결과(점수·합격 여부)를 기록
(() => {
  "use strict";
  const { $, fmtLong, todayKey } = DT.utils;

  class ExamDialog {
    constructor(store, toast) {
      this.store = store;
      this.toast = toast;
      this.dialog = $("examDialog");
      this.date = null;
      this.id = null; // 수정 중인 시험 (새 시험이면 null)

      $("examForm").addEventListener("submit", (e) => { e.preventDefault(); this.save(); });
      $("examCancel").addEventListener("click", () => this.dialog.close());
      $("examDelete").addEventListener("click", () => this.remove());
    }

    // id 없으면 새 시험 추가
    open(date, id) {
      const e = id ? this.store.findExam(id) : null;
      this.date = e ? e.date : date;
      this.id = e ? e.id : null;
      $("examTitle").textContent = e ? "시험" : "시험 추가";
      $("examDate").textContent = fmtLong(this.date);
      $("examName").value = e ? e.name : "";
      // 결과는 시험 날(오늘 포함)부터 입력
      const done = this.date <= todayKey();
      $("examResult").classList.toggle("hidden", !done);
      $("examScore").value = e && e.score != null ? e.score : "";
      const pass = e && e.pass != null ? String(e.pass) : "";
      document.querySelectorAll("#examPass input").forEach((c) => (c.checked = c.value === pass));
      $("examDelete").classList.toggle("hidden", !e);
      this.dialog.showModal();
      if (!e) $("examName").focus();
      else if (done && e.score == null && e.pass == null) $("examScore").focus(); // 결과 입력하러 온 경우
    }

    save() {
      const name = $("examName").value.trim();
      if (!name) { $("examName").focus(); this.toast.show("시험 이름을 적어 주세요"); return; }
      let id = this.id;
      if (!id) id = this.store.addExam(this.date, name).id;
      const patch = { name: name.slice(0, 20) };
      if (this.date <= todayKey()) {
        const raw = $("examScore").value;
        const pass = document.querySelector("#examPass input:checked");
        patch.score = raw === "" ? null : Math.max(0, Number(raw));
        patch.pass = !pass || pass.value === "" ? null : pass.value === "true";
      }
      this.store.updateExam(id, patch);
      this.dialog.close();
      this.toast.show(this.id ? "시험을 고쳤어요" : `${name} 시험을 추가했어요`);
    }

    async remove() {
      const e = this.store.findExam(this.id);
      if (!e || !(await DT.ask.confirm(`'${e.name}' 시험을 지울까요?`, { ok: "삭제", danger: true }))) return;
      this.store.deleteExam(e.id);
      this.dialog.close();
      this.toast.show("시험을 지웠어요");
    }
  }

  DT.ExamDialog = ExamDialog;
})();
