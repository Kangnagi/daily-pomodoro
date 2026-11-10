// 내 프로필 화면 (#profile, 위쪽 바의 사람 버튼): 닉네임·칭호, 레벨·경험치 바, 지갑(뽀모도로 화폐), 다음 조각까지, 업적 목록, 칭호 고르기
//   1단계의 간단한 프로필. 캐릭터·미니룸·상점·뽑기는 2~3단계에서 이 화면에 붙임
(() => {
  "use strict";
  const { $, fmtShort, fmtMin, escapeHtml } = DT.utils;
  const I = DT.ArcadeIcons;

  const CATS = ["처음", "공부 누적", "운동 누적", "연속", "하루", "시간대", "목표", "시험", "운동", "숨은 업적"];

  class ProfileScreen {
    constructor(arcade, store) {
      this.name = "profile";
      this.arcade = arcade;
      this.el = $("profileScreen");
      this.active = false;
      $("btnProfile").innerHTML = I.PROFILE;
      $("btnProfile").addEventListener("click", () => this.onOpen && this.onOpen());
      $("pfNickname").addEventListener("click", () => this.editNickname());
      $("pfTitles").addEventListener("click", (e) => {
        const b = e.target.closest("[data-title]");
        if (b) this.arcade.setTitle(b.dataset.title || null);
      });
      store.onChange(() => { if (this.active) this.render(); });
    }

    setActive(active) {
      this.active = active;
      this.el.classList.toggle("open", active);
      if (active) { this.render(); this.el.querySelector(".screen-body").scrollTop = 0; }
    }

    async editNickname() {
      const name = await DT.ask.prompt("닉네임", { placeholder: "12자까지", value: this.arcade.data.nickname, maxLength: 12, ok: "저장" });
      if (name != null) this.arcade.setNickname(name);
    }

    render() {
      const a = this.arcade;
      const s = a.summary();
      const lv = s.level;

      // 닉네임 · 칭호 · 레벨
      $("pfNickname").textContent = s.nickname || "나";
      $("pfTitle").textContent = s.title ? `「${s.title}」` : "칭호 없음";
      $("pfTitle").classList.toggle("empty", !s.title);
      $("pfLevel").textContent = `Lv.${lv.level}`;
      $("pfXpBar").style.width = `${(lv.into / lv.need) * 100}%`;
      $("pfXpText").textContent = `경험치 ${lv.into} / ${lv.need}`;

      // 지갑 + 다음 조각까지
      const w = s.wallet;
      $("pfWallet").innerHTML = I.wallet(w, 22);
      $("pfPieceBar").style.width = `${((60 - w.nextPieceMin) / 60) * 100}%`;
      $("pfPieceText").textContent = `다음 조각까지 ${w.nextPieceMin}분`;
      $("pfStats").textContent = `공부 ${fmtMin(s.minutes.study)} · 운동 ${fmtMin(s.minutes.workout)} · 뽑기권 ${s.tickets}장`;

      // 칭호 고르기
      const titles = a.titles();
      $("pfTitles").innerHTML = titles.length
        ? `<button type="button" class="title-chip${!s.title ? " on" : ""}" data-title="">없음</button>` +
          titles.map((t) => `<button type="button" class="title-chip${t.title === s.title ? " on" : ""}" data-title="${escapeHtml(t.title)}" title="${escapeHtml(t.from)}">${escapeHtml(t.title)}</button>`).join("")
        : `<p class="hint">업적을 달성하거나 레벨 5가 되면 칭호를 받아요</p>`;

      // 업적 목록 (분류별, 달성한 것 먼저)
      const list = a.achievements();
      const done = list.filter((x) => x.done).length;
      $("pfAchCount").textContent = `${done} / ${list.length}`;
      $("pfAchievements").innerHTML = CATS.map((cat) => {
        const items = list.filter((x) => x.cat === cat).sort((p, q) => (q.done ? 1 : 0) - (p.done ? 1 : 0));
        if (!items.length) return "";
        return `<h4 class="ach-cat">${cat}</h4>` + items.map((x) => {
          const secret = x.hidden && !x.done;
          const pct = Math.min(100, (x.value / x.goal) * 100);
          return `<div class="ach${x.done ? " done" : ""}">
            <div class="ach-top"><b>${secret ? "???" : escapeHtml(x.name)}</b><span>${x.done ? fmtShort(x.done) : secret ? "숨은 업적" : `${x.value} / ${x.goal}${x.unit}`}</span></div>
            <div class="ach-sub">칭호 「${secret ? "???" : escapeHtml(x.title)}」 · 경험치 +${x.xp}</div>
            ${x.done || secret ? "" : `<div class="ach-bar"><i style="width:${pct}%"></i></div>`}
          </div>`;
        }).join("");
      }).join("");
    }
  }

  DT.ProfileScreen = ProfileScreen;
})();
