// 설정 창의 "계정" 칸: 로그인 상태, 로그인/로그아웃 버튼, 마지막 동기화 시각
// 지금은 cloud-config.js 의 enabled가 false라서 "준비 중"으로만 보인다
(() => {
  "use strict";
  const { $, escapeHtml, fmtClock } = DT.utils;

  class AccountPanel {
    constructor(account, sync) {
      this.account = account;
      this.sync = sync;
      this.el = $("accountBox");
      account.onChange(() => this.render());
      sync.onChange(() => this.render());
      this.el.addEventListener("click", async (e) => {
        const act = e.target.closest("[data-account]");
        if (!act) return;
        if (act.dataset.account === "signin") this.account.signIn();
        if (act.dataset.account === "signout" && (await DT.ask.confirm("로그아웃할까요? 이 기기의 기록은 그대로 남아요.", { ok: "로그아웃" }))) this.account.signOut();
      });
      this.render();
    }

    render() {
      const a = this.account;
      let html;
      switch (a.status) {
        case "disabled":
          html = `<p class="account-status">계정 연동은 준비 중이에요</p>
            <button type="button" class="account-btn" disabled>Google 계정으로 로그인</button>
            <p class="hint">로그인하면 기록이 계정에 저장되어 휴대폰을 바꿔도 이어서 볼 수 있게 될 예정이에요.</p>`;
          break;
        case "loading":
          html = `<p class="account-status">계정 정보를 불러오는 중…</p>`;
          break;
        case "signedOut":
          html = `<p class="account-status">로그인하면 기록이 계정에 저장돼요</p>
            <button type="button" class="account-btn" data-account="signin">Google 계정으로 로그인</button>`;
          break;
        case "signedIn": {
          const u = a.user;
          const when = this.sync.busy ? "동기화 중…" : this.sync.lastSyncedAt ? `마지막 동기화 ${fmtClock(this.sync.lastSyncedAt)}` : "동기화 대기 중";
          html = `<p class="account-status">${escapeHtml(u.name || u.email || "로그인됨")}<br><small>${escapeHtml(u.email || "")}</small></p>
            <p class="hint">${when}</p>
            <button type="button" class="account-btn ghost" data-account="signout">로그아웃</button>`;
          break;
        }
        default:
          html = `<p class="account-status">계정 연결에 문제가 있어요</p><p class="hint">${escapeHtml(a.error || "")}</p>`;
      }
      this.el.innerHTML = html;
    }
  }

  DT.AccountPanel = AccountPanel;
})();
