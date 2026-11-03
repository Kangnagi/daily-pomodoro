// 기록 화면: 선택한 날짜의 학습 시간, 공부한 과목, 단어, 점수 기록, 컨디션, 메모
//   시험 일정·결과는 날짜 시트의 "시험" 줄에서 (ExamDialog)
(() => {
  "use strict";
  const { $, fmtLong, fmtMin, escapeHtml } = DT.utils;
  const { Store } = DT;

  const MAX_SCORE = 100000;

  class RecordScreen {
    constructor(store, sessionDialog, toast, router) {
      this.name = "record";
      this.store = store;
      this.sessions = sessionDialog;
      this.toast = toast;
      this.router = router;
      this.el = $("recordScreen");
      this.key = null;
      this.knownParts = null; // 화면을 연 뒤 세션 기록으로 추가된 과목을 입력칸에 반영하기 위한 기준값
      this.parts = new DT.SubjectPicker(store, $("partChecks"));

      $("btnAddScore").addEventListener("click", () => this.addScoreRow({ name: "", score: null }, true));
      $("scoreRows").addEventListener("click", (e) => {
        const del = e.target.closest("[data-del-score]");
        if (del) del.closest(".score-entry").remove();
      });
      $("recordForm").addEventListener("submit", (e) => { e.preventDefault(); this.save(); });
      $("btnDelete").addEventListener("click", () => this.remove());
      store.onChange(() => this.syncFromStore());
    }

    setActive(active, param) {
      if (active && param && param !== this.key) this.load(param);
      this.el.classList.toggle("open", active);
      if (!active) this.key = null;
    }

    load(k) {
      this.key = k;
      const r = this.store.get(k) || Store.emptyRecord();
      $("recordTitle").textContent = fmtLong(k);
      this.renderMinutes(r);
      $("fVocab").value = r.vocab || "";
      $("fMemo").value = r.memo || "";
      this.parts.render(r.parts || []);
      $("nameList").innerHTML = this.store.knownNames().map((n) => `<option value="${escapeHtml(n)}">`).join("");
      $("scoreRows").innerHTML = "";
      Store.scores(r).forEach((x) => this.addScoreRow(x, false));
      document.querySelectorAll("#moods input").forEach((c) => (c.checked = Number(c.value) === r.mood));
      $("btnDelete").classList.toggle("hidden", !this.store.get(k));
      this.knownParts = (r.parts || []).slice();
      this.renderSessions();
      this.el.querySelector(".screen-body").scrollTop = 0;
    }

    // 점수 한 줄: [이름][점수][×]. detail(예전 LC/RC 등)은 숨은 값으로 그대로 보존
    addScoreRow(x, focus) {
      const row = document.createElement("div");
      row.className = "score-entry";
      row.innerHTML =
        `<input type="text" class="se-name" list="nameList" maxlength="20" placeholder="이름 (예: 토익, 수학 모의고사)" value="${escapeHtml(x.name || "")}">` +
        `<input type="number" class="se-score" inputmode="decimal" step="any" min="0" placeholder="점수" value="${x.score != null ? x.score : ""}">` +
        `<button type="button" class="se-del" data-del-score aria-label="이 점수 지우기">×</button>`;
      row.dataset.detail = x.detail || "";
      $("scoreRows").appendChild(row);
      if (focus) row.querySelector(".se-name").focus();
    }

    readScores() {
      return [...$("scoreRows").querySelectorAll(".score-entry")].map((row) => {
        const name = row.querySelector(".se-name").value.trim();
        const raw = row.querySelector(".se-score").value;
        const score = raw === "" ? null : Math.max(0, Math.min(MAX_SCORE, Number(raw)));
        const x = { name, score };
        if (row.dataset.detail) x.detail = row.dataset.detail;
        return x;
      }).filter((x) => x.name && x.score != null && !isNaN(x.score));
    }

    renderSessions() {
      const r = this.store.get(this.key);
      const list = (r && r.sessions) || [];
      $("daySessionsBox").classList.toggle("hidden", !list.length);
      this.sessions.renderList($("daySessions"), this.key, list, false);
    }

    // 학습 시간은 공부 타이머로 기록된 시간 (직접 입력 불가)
    renderMinutes(r) {
      const n = Store.tomatoes(r);
      $("fMinutes").textContent = r.minutes ? fmtMin(r.minutes) : "0분";
      $("fMinutesSub").textContent = n ? `🍅 ${n}개` : "공부 타이머로 공부하면 자동으로 기록돼요";
    }

    // 세션 편집/삭제로 저장된 값이 바뀌면 학습 시간과 목록을 다시 그리고, 새로 추가된 과목은 체크
    syncFromStore() {
      if (!this.key || !this.knownParts) return;
      const r = this.store.get(this.key) || Store.emptyRecord();
      this.renderMinutes(r);
      const added = (r.parts || []).filter((p) => !this.knownParts.includes(p));
      if (added.length) this.parts.render([...new Set([...this.parts.values, ...added])]);
      this.knownParts = (r.parts || []).slice();
      this.renderSessions();
    }

    save() {
      const k = this.key;
      const mood = document.querySelector("#moods input:checked");
      const prev = this.store.get(k);
      const typed = $("scoreRows").querySelectorAll(".score-entry").length;
      const scores = this.readScores();
      const r = {
        minutes: (prev && prev.minutes) || 0,
        parts: this.store.sortSubjects(this.parts.values),
        vocab: Math.max(0, Number($("fVocab").value) || 0),
        scores,
        mood: mood ? Number(mood.value) : null,
        memo: $("fMemo").value.trim(),
        sessions: (prev && prev.sessions) || [],
      };
      this.key = null; // 저장으로 인한 syncFromStore 무시
      this.store.saveRecord(k, r);
      this.toast.show(scores.length < typed ? "이름과 점수가 모두 있는 줄만 저장했어요" : "저장했습니다");
      this.router.back();
    }

    async remove() {
      const k = this.key;
      if (!(await DT.ask.confirm(`${fmtLong(k)} 기록을 삭제할까요?`, { ok: "삭제", danger: true }))) return;
      this.key = null;
      this.store.deleteRecord(k);
      this.toast.show("삭제했습니다");
      this.router.back();
    }
  }

  DT.RecordScreen = RecordScreen;
})();
