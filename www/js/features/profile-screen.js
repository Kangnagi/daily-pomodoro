// 내 프로필 화면 (#profile, 위쪽 바의 사람 버튼): 닉네임·칭호, 레벨·경험치 바, 지갑(뽀모도로 화폐), 다음 조각까지, 업적 목록, 칭호 고르기
//   업적: 달성 전에는 칭호를 「???」로 숨기고, 오른쪽 끝에 "EXP 300", 달성 날짜는 작게 YYYY-MM-DD
//   칭호: 카드의 칭호를 누르면 목록 상자가 위에서 아래로 펼쳐지며 칭호가 하나씩 차례로 나타남 (처음 보는 새 칭호는 NEW + 빛나는 테두리),
//         닫을 때는 아래에서부터 하나씩 사라지면서 상자도 함께 위로 접힘
//   1단계의 간단한 프로필. 캐릭터·미니룸·상점·뽑기는 2~3단계에서 이 화면에 붙임
(() => {
  "use strict";
  const { $, fmtMin, escapeHtml } = DT.utils;
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
      // 칭호를 누르면 칭호 목록이 위에서 아래로 펼쳐지고, 하나를 고르면 접힘
      this.titleOpen = false;
      $("pfTitle").addEventListener("click", () => this.toggleTitles());
      $("pfTitlePanel").addEventListener("click", (e) => {
        const b = e.target.closest("[data-title]");
        if (!b) return;
        this.toggleTitles(false);
        this.arcade.setTitle(b.dataset.title || null);
      });
      // 스크롤바 대신 위/아래 화살표: 더 볼 칭호가 있는 쪽에만 보이고, 누르면 그쪽으로 한 화면 넘김
      const panel = $("pfTitlePanel");
      panel.addEventListener("scroll", () => this.updateTitleArrows(), { passive: true });
      panel.addEventListener("transitionend", (e) => { if (e.target === panel && e.propertyName === "max-height") this.updateTitleArrows(); });
      const page = (dir) => panel.scrollBy({ top: dir * (panel.clientHeight - 60), behavior: "smooth" });
      $("pfTitleUp").addEventListener("click", () => page(-1));
      $("pfTitleDown").addEventListener("click", () => page(1));
      store.onChange(() => { if (this.active) this.render(); });
    }

    setActive(active) {
      this.active = active;
      this.el.classList.toggle("open", active);
      if (!active) this.toggleTitles(false, true);
      if (active) { this.render(); this.el.querySelector(".screen-body").scrollTop = 0; }
    }

    // 칭호 목록 펼치기/접기
    //   펼치기: 목록을 새로 그리고 상자가 위에서 아래로 펼쳐진 뒤 칭호가 위에서부터 하나씩 나타남
    //   접기: 보이는 칭호가 아래에서부터 하나씩 사라지는 동안 상자도 함께 위로 접힘, 안 보이는 칭호는 바로 사라짐 (instant면 애니메이션 없이 바로)
    toggleTitles(open = !this.titleOpen, instant = false) {
      const panel = $("pfTitlePanel");
      clearTimeout(this.closeTimer);
      panel.classList.remove("closing");
      panel.style.maxHeight = "";
      panel.style.removeProperty("--fold");
      this.titleOpen = open;
      this.updateTitleArrows();
      $("pfTitle").setAttribute("aria-expanded", String(open));
      if (open) {
        this.renderTitles();
        panel.scrollTop = 0;
        panel.classList.add("open");
        return;
      }
      if (!panel.classList.contains("open")) return;
      const items = [...panel.querySelectorAll(".title-item")];
      if (instant || !items.length) { panel.classList.remove("open"); return; }
      // 스크롤 기준으로 지금 보이는 칭호만 아래부터 하나씩 사라지고(스태거), 안 보이는 칭호는 바로 사라짐
      //   상자는 그동안 같이 접힘(아코디언) → 보이는 칭호 수만큼만 시간이 걸려 어디까지 내려 있든 똑같이 짧게 닫힘
      const box = panel.getBoundingClientRect();
      const shown = items.filter((el) => {
        const r = el.getBoundingClientRect();
        const off = r.bottom <= box.top || r.top >= box.bottom;
        el.classList.toggle("off", off);
        return !off;
      });
      shown.forEach((el, i) => el.style.setProperty("--r", String(shown.length - 1 - i)));
      const total = Math.max(shown.length - 1, 0) * 45 + 280; // 마지막(맨 위) 보이는 칭호가 다 사라지는 시각 (펼칠 때와 같은 45ms 간격, 0.28초씩)
      panel.style.transition = "none"; // 300px → 실제 높이로 바꾸는 건 애니메이션 없이 즉시
      panel.style.maxHeight = `${panel.offsetHeight}px`;
      void panel.offsetHeight;
      panel.style.transition = "";
      panel.style.setProperty("--fold", `${total}ms`);
      panel.classList.add("closing");
      panel.style.maxHeight = "0px";
      this.closeTimer = setTimeout(() => {
        panel.classList.remove("open", "closing");
        panel.style.maxHeight = "";
        panel.style.removeProperty("--fold");
      }, total);
    }

    // 위로 올릴 공간이 있으면 위 화살표, 아래로 내릴 공간이 있으면 아래 화살표 (열려 있을 때만)
    updateTitleArrows() {
      const p = $("pfTitlePanel");
      const on = this.titleOpen && p.classList.contains("open");
      $("pfTitleUp").classList.toggle("show", on && p.scrollTop > 2);
      $("pfTitleDown").classList.toggle("show", on && p.scrollTop + p.clientHeight < p.scrollHeight - 2);
    }

    renderTitles() {
      const titles = this.arcade.titles();
      const cur = this.arcade.data.title;
      // 처음 보는 새 칭호: 왼쪽 위 NEW + 빛나는 테두리. 한 번 열면 본 것으로 기록 → 다음에 열 땐 평소대로
      const fresh = this.arcade.newTitles();
      this.arcade.markTitlesSeen();
      // --i: 나타나는 순서(위부터). 사라지는 순서 --r은 닫을 때 보이는 칭호 기준으로 매김(toggleTitles)
      const item = (t, i) =>
        `<button type="button" class="title-item${t.title === cur || (!t.title && !cur) ? " on" : ""}${fresh.has(t.title) ? " new" : ""}" data-title="${escapeHtml(t.title || "")}" style="--i:${i}">` +
        `${fresh.has(t.title) ? '<span class="title-new">NEW</span>' : ""}<b>${t.title ? `「${escapeHtml(t.title)}」` : "칭호 없음"}</b><small>${escapeHtml(t.from)}</small></button>`;
      $("pfTitlePanel").innerHTML = titles.length
        ? [{ title: "", from: "칭호를 달지 않아요" }, ...titles].map(item).join("")
        : `<p class="title-empty">업적을 달성하거나 레벨 5가 되면 칭호를 받아요</p>`;
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
      $("pfTitleText").textContent = s.title ? `「${s.title}」` : "칭호 선택";
      $("pfTitle").classList.toggle("empty", !s.title);
      $("pfLevel").textContent = `Lv.${lv.level}`;
      $("pfXpBar").style.width = `${(lv.into / lv.need) * 100}%`;
      $("pfXpText").textContent = `경험치 ${lv.into} / ${lv.need}`;

      // 지갑 + 다음 조각까지
      const w = s.wallet;
      $("pfWallet").innerHTML = I.wallet(w, 22, s.tickets); // 화폐는 왼쪽, 뽑기권은 오른쪽 끝에 따로
      $("pfPieceBar").style.width = `${((60 - w.nextPieceMin) / 60) * 100}%`;
      $("pfPieceText").textContent = `다음 조각까지 ${w.nextPieceMin}분`;
      $("pfStats").textContent = `공부 ${fmtMin(s.minutes.study)} · 운동 ${fmtMin(s.minutes.workout)}`;

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
            <div class="ach-top"><b>${secret ? "???" : escapeHtml(x.name)}</b><span${x.done ? ' class="ach-date"' : ""}>${x.done ? x.done : secret ? "숨은 업적" : `${x.value} / ${x.goal}${x.unit}`}</span></div>
            <div class="ach-sub"><span>칭호 「${x.done ? escapeHtml(x.title) : "???"}」</span><span class="ach-exp">EXP ${x.xp}</span></div>
            ${x.done || secret ? "" : `<div class="ach-bar"><i style="width:${pct}%"></i></div>`}
          </div>`;
        }).join("");
      }).join("");
    }
  }

  DT.ProfileScreen = ProfileScreen;
})();
