// 계정 상태 관리. 실제 로그인은 provider(FirebaseProvider)가 하고, 화면은 이 객체의 상태만 본다
//   status: "disabled"(설정 꺼짐) | "loading" | "signedOut" | "signedIn" | "error"
(() => {
  "use strict";

  const PROVIDERS = { firebase: (cfg) => new DT.FirebaseProvider(cfg.firebase) };

  class AccountService {
    constructor(config) {
      this.config = config || { enabled: false };
      this.status = this.config.enabled ? "loading" : "disabled";
      this.user = null;
      this.error = null;
      this.provider = null;
      this.listeners = [];
    }

    get enabled() { return !!this.config.enabled; }
    get signedIn() { return this.status === "signedIn"; }

    onChange(fn) { this.listeners.push(fn); }
    emit() { this.listeners.forEach((fn) => fn(this)); }

    async init() {
      if (!this.enabled) return; // 꺼져 있으면 아무것도 불러오지 않음
      try {
        const make = PROVIDERS[this.config.provider];
        if (!make) throw new Error(`지원하지 않는 provider: ${this.config.provider}`);
        this.provider = make(this.config);
        await this.provider.load();
        this.provider.onAuthChange((user) => {
          this.user = user;
          this.status = user ? "signedIn" : "signedOut";
          this.emit();
        });
      } catch (e) {
        this.fail(e);
      }
    }

    fail(e) {
      this.status = "error";
      this.error = (e && e.message) || String(e);
      console.warn("[account]", e);
      this.emit();
    }

    async signIn() {
      if (!this.provider) return;
      try { await this.provider.signIn(); } catch (e) { this.fail(e); }
    }

    async signOut() {
      if (!this.provider) return;
      try { await this.provider.signOut(); } catch (e) { this.fail(e); }
    }
  }

  DT.AccountService = AccountService;
})();
