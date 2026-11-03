// 앱 안에서 띄우는 확인·입력 창 (브라우저 confirm/prompt 대신)
//   일부 브라우저·앱 화면에서는 confirm()/prompt()가 막혀 바로 "취소"로 끝나서 삭제 등이 안 되던 문제를 막는다
//   사용: if (await DT.ask.confirm("지울까요?", { ok: "삭제", danger: true })) ...
//         const name = await DT.ask.prompt("과목 이름", { placeholder: "예: 영어" });  // 취소면 null
(() => {
  "use strict";
  const { $ } = DT.utils;

  class Ask {
    constructor() {
      this.dialog = $("askDialog");
      this.resolve = null;
      $("askForm").addEventListener("submit", (e) => {
        e.preventDefault();
        this.finish(this.mode === "prompt" ? $("askInput").value.trim() : true);
      });
      $("askCancel").addEventListener("click", () => this.finish(this.mode === "prompt" ? null : false));
      this.dialog.addEventListener("cancel", (e) => { e.preventDefault(); this.finish(this.mode === "prompt" ? null : false); }); // 뒤로/ESC
    }

    open(mode, message, opts) {
      this.finish(mode === "prompt" ? null : false); // 이미 열려 있던 창은 취소로 정리
      this.mode = mode;
      $("askMessage").textContent = message;
      $("askOk").textContent = opts.ok || (mode === "prompt" ? "추가" : "확인");
      $("askOk").classList.toggle("danger-fill", !!opts.danger);
      $("askInput").classList.toggle("hidden", mode !== "prompt");
      $("askInput").value = opts.value || "";
      $("askInput").placeholder = opts.placeholder || "";
      $("askInput").maxLength = opts.maxLength || 30;
      this.dialog.showModal();
      if (mode === "prompt") $("askInput").focus();
      return new Promise((res) => { this.resolve = res; });
    }

    confirm(message, opts = {}) { return this.open("confirm", message, opts); }
    prompt(message, opts = {}) { return this.open("prompt", message, opts); }

    finish(value) {
      if (!this.resolve) return;
      const res = this.resolve;
      this.resolve = null;
      if (this.dialog.open) this.dialog.close();
      res(value);
    }
  }

  // index.html의 askDialog가 만들어진 뒤에 생성 (app.js에서)
  DT.Ask = Ask;
})();
