// 아케이드 알림: (1) 처음 한 번 지난 기록 정산 + 결과 창 (2) 업적 달성·레벨업 배너
//   정산: 아케이드가 들어간 버전을 처음 켜면 지금까지의 타이머 기록으로 업적을 달성 처리(실제 조건을 채운 날짜)하고 결과를 보여줌
//   그 뒤로는 기록이 바뀔 때마다(store.onChange) 새 업적·레벨업을 확인해서 위에서 내려오는 배너로 알림
(() => {
  "use strict";
  const { $, todayKey, fmtMin, escapeHtml } = DT.utils;
  const I = DT.ArcadeIcons;

  const SHOW_MS = 3200; // 배너 하나 보여주는 시간

  class ArcadeNotifier {
    // onOpenProfile(): 배너나 정산 창의 "프로필 보기"를 누르면
    constructor(arcade, store, onOpenProfile) {
      this.arcade = arcade;
      this.onOpenProfile = onOpenProfile;
      this.queue = [];
      this.showing = false;
      this.banner = $("arcadeBanner");
      this.banner.addEventListener("click", () => { this.hideBanner(); this.onOpenProfile(); });
      $("settleClose").addEventListener("click", () => $("settleDialog").close());
      $("settleProfile").addEventListener("click", () => { $("settleDialog").close(); this.onOpenProfile(); });
      store.onChange(() => this.check());
    }

    // 앱 시작 때 한 번
    start() {
      if (!this.arcade.data.settledAt) this.settle();
      else this.check();
    }

    // ---------- 지난 기록 정산 ----------
    settle() {
      const a = this.arcade;
      const fresh = a.unlockReady();
      const lv = a.level();
      a.data.settledAt = todayKey();
      a.data.levelSeen = lv.level;
      a.persist();
      const m = a.minutes();
      if (!m.total && !fresh.length) return; // 기록이 없는 새 사용자는 조용히 시작
      const w = a.wallet();
      const list = fresh.slice(0, 6).map((x) => `<li><b>${escapeHtml(x.name)}</b><span>칭호 「${escapeHtml(x.title)}」</span></li>`).join("");
      $("settleBody").innerHTML =
        `<p class="settle-lead">지금까지의 공부·운동 기록으로 보상을 받았어요</p>` +
        `<div class="settle-grid">` +
        `<div><span>공부</span><b>${fmtMin(m.study)}</b></div>` +
        `<div><span>운동</span><b>${fmtMin(m.workout)}</b></div>` +
        `<div><span>레벨</span><b>Lv.${lv.level}</b></div>` +
        `<div><span>업적</span><b>${fresh.length}개</b></div>` +
        `</div>` +
        `<div class="settle-wallet">${I.wallet(w, 22)}</div>` +
        (a.tickets() ? `<p class="settle-ticket">뽑기권 ${a.tickets()}장도 받았어요</p>` : "") +
        (list ? `<ul class="settle-list">${list}</ul>${fresh.length > 6 ? `<p class="settle-more">외 ${fresh.length - 6}개</p>` : ""}` : "");
      $("settleDialog").showModal();
    }

    // ---------- 새 업적·레벨업 확인 ----------
    check() {
      const a = this.arcade;
      if (!a.data.settledAt) return;
      const fresh = a.unlockReady();
      fresh.forEach((x) => this.push({ kind: "ach", head: "업적 달성", main: x.name, sub: `칭호 「${x.title}」 · 경험치 +${x.xp}` }));
      const lv = a.level().level;
      const seen = a.data.levelSeen || 1;
      if (lv > seen) {
        const gained = lv - seen;
        const titles = Object.entries(DT.LEVEL_TITLES).filter(([n]) => Number(n) > seen && Number(n) <= lv).map(([, t]) => t);
        const tickets = Math.floor(lv / 5) - Math.floor(seen / 5);
        const rewards = [`조각 +${2 * gained}`];
        if (tickets) rewards.push(`뽑기권 +${tickets}`);
        if (titles.length) rewards.push(`칭호 「${titles.join("」「")}」`);
        this.push({ kind: "level", head: "레벨 업", main: `Lv.${lv}`, sub: rewards.join(" · ") });
        a.data.levelSeen = lv;
        a.persist();
      }
    }

    // ---------- 배너 ----------
    push(item) {
      this.queue.push(item);
      if (!this.showing) this.next();
    }
    next() {
      const item = this.queue.shift();
      if (!item) { this.showing = false; return; }
      this.showing = true;
      this.banner.className = `arcade-banner ${item.kind}`;
      this.banner.innerHTML =
        `<span class="ab-badge">${item.kind === "level" ? I.currency("red", 26) : I.currency("yellow", 26)}</span>` +
        `<span class="ab-text"><small>${item.head}</small><b>${escapeHtml(item.main)}</b><span>${escapeHtml(item.sub)}</span></span>`;
      void this.banner.offsetWidth; // 애니메이션 다시 시작
      this.banner.classList.add("show");
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.hideBanner(), SHOW_MS);
    }
    hideBanner() {
      clearTimeout(this.timer);
      this.banner.classList.remove("show");
      setTimeout(() => this.next(), 350);
    }
  }

  DT.ArcadeNotifier = ArcadeNotifier;
})();
