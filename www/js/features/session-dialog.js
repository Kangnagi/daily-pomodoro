// 뽀모도로 세션 기록 창: 집중이 끝나면 "어떤 공부를 했나요?"를 묻고, 지난 세션도 편집/삭제
(() => {
  "use strict";
  const { $, fmtLong, fmtClock, escapeHtml } = DT.utils;

  class SessionDialog {
    constructor(store, toast) {
      this.store = store;
      this.toast = toast;
      this.dialog = $("sessionDialog");
      this.parts = new DT.SubjectPicker(store, $("sessionParts")); // 공부한 과목
      this.ref = null;

      $("sessionForm").addEventListener("submit", () => this.save());
      $("sessionLater").addEventListener("click", () => this.dialog.close());
      $("sessionDelete").addEventListener("click", () => this.remove());
    }

    // justFinished: 방금 끝난 세션이면 축하 문구 + 직전 세션 과목을 기본 선택
    open(k, id, justFinished) {
      const s = this.store.findSession(k, id);
      if (!s) return;
      this.ref = { k, id };
      $("sDoneEmoji").classList.toggle("hidden", !justFinished);
      $("sessionTitle").textContent = justFinished ? "집중 완료!" : "뽀모도로 기록";
      $("sessionSub").textContent = `${fmtLong(k)} ${SessionDialog.timeText(s).replace(/<[^>]+>/g, "")}`;
      const parts = justFinished && !s.parts.length ? this.store.lastSessionParts(k, id) : s.parts;
      this.parts.render(parts);
      $("sessionNote").value = s.note || "";
      $("sessionDelete").classList.toggle("hidden", justFinished);
      $("sessionLater").textContent = justFinished ? "나중에" : "취소";
      if (!this.dialog.open) this.dialog.showModal();
    }

    save() {
      if (!this.ref) return;
      this.store.updateSession(this.ref.k, this.ref.id, this.parts.values, $("sessionNote").value.trim());
      this.toast.show("공부 내용을 기록했습니다");
    }

    async remove() {
      if (!this.ref || !(await DT.ask.confirm("이 공부 기록을 삭제할까요? 학습 시간에서도 빠집니다.", { ok: "삭제", danger: true }))) return;
      this.store.deleteSession(this.ref.k, this.ref.id);
      this.dialog.close();
      this.toast.show("삭제했습니다");
    }

    static timeText(s) {
      const p = SessionDialog.pausedMin(s);
      return `${fmtClock(s.start)}–${fmtClock(s.end)} · ${s.minutes}분` +
        (p ? ` <span class="paused">일시정지 ${p}분</span>` : "") +
        (s.rest != null ? ` <span class="rest">휴식 ${s.rest}분</span>` : "");
    }
    // 집중 중 일시정지한 시간(분) — 공부 시간에는 포함되지 않음
    static pausedMin(s) {
      return Math.round((s.pauses || []).reduce((t, [a, b]) => t + Math.max(0, b - a), 0) / 60000);
    }

    // 세션 목록 HTML (기록 화면, 타이머 화면에서 공용)
    static rowHtml(k, s) {
      const tags = s.parts.map((p) => `<span class="badge">${escapeHtml(p)}</span>`).join("");
      const note = s.note ? escapeHtml(s.note) : `<span class="empty-note">공부 내용을 기록해 보세요</span>`;
      return `<div class="session" role="button" tabindex="0" data-edit="${k}|${s.id}" aria-label="기록 편집">
        <span class="tomato">🍅</span>
        <div><div class="s-time">${SessionDialog.timeText(s)} ${tags}</div><div class="s-note">${note}</div></div>
      </div>`;
    }
    renderList(container, k, sessions, newestFirst) {
      const list = newestFirst ? sessions.slice().reverse() : sessions;
      container.innerHTML = list.map((s) => SessionDialog.rowHtml(k, s)).join("");
      // 기록 칸 전체를 누르면 편집 (키보드는 Enter/Space)
      container.querySelectorAll("[data-edit]").forEach((row) => {
        const open = () => { const [key, id] = row.dataset.edit.split("|"); this.open(key, id, false); };
        row.addEventListener("click", open);
        row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      });
    }
  }

  DT.SessionDialog = SessionDialog;
})();
