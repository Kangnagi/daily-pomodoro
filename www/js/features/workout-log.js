// 운동 일지 화면 (#wlog/날짜): 운동 시간(타이머 기록), 근력(종목별 세트: 무게·횟수), 유산소(시간·거리), 운동 부위, 몸무게, 컨디션, 메모
(() => {
  "use strict";
  const { $, fmtLong, fmtMin, fmtClock, escapeHtml } = DT.utils;
  const { WorkoutStore } = DT;

  const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

  class WorkoutLogScreen {
    constructor(workouts, toast, router) {
      this.name = "wlog";
      this.workouts = workouts;
      this.toast = toast;
      this.router = router;
      this.el = $("wlogScreen");
      this.key = null;

      $("wlParts").innerHTML = WorkoutStore.PARTS.map((p) => `<label><input type="checkbox" value="${p}"><span>${p}</span></label>`).join("");
      $("wlAddStrength").addEventListener("click", () => this.addStrength({ name: "", sets: [{ kg: "", reps: "" }] }, true));
      $("wlAddCardio").addEventListener("click", () => this.addCardio({ name: "", min: "", km: "" }, true));
      // 카드 안 버튼들 (종목 지우기, 세트 추가·지우기, 유산소 줄 지우기)
      this.el.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.classList.contains("ex-del")) b.closest(".ex-card").remove();
        else if (b.classList.contains("set-add")) this.addSetRow(b.closest(".ex-card"), true);
        else if (b.classList.contains("set-del")) { const card = b.closest(".ex-card"); b.closest(".set-row").remove(); this.renumber(card); }
        else if (b.classList.contains("cd-del")) b.closest(".cardio-row").remove();
      });
      $("wlogForm").addEventListener("submit", (e) => { e.preventDefault(); this.save(); });
      $("wlDelete").addEventListener("click", () => this.remove());
    }

    setActive(active, param) {
      if (active && param && param !== this.key) this.load(param);
      this.el.classList.toggle("open", active);
      if (!active) this.key = null;
    }

    load(k) {
      this.key = k;
      const r = this.workouts.getOrNew(k);
      $("wlogTitle").textContent = fmtLong(k);
      const min = r.minutes || 0;
      $("wlMinutes").textContent = min ? fmtMin(min) : "0분";
      $("wlMinutesSub").textContent = (r.sessions || []).length
        ? r.sessions.map((s) => `${fmtClock(s.start)}–${fmtClock(s.end)} ${s.minutes}분`).join(" · ") + (r.sets ? ` · 세트 ${r.sets}` : "")
        : "운동 타이머로 운동하면 자동으로 기록돼요";
      $("wlStrengthNames").innerHTML = this.workouts.names("strength").map((n) => `<option value="${escapeHtml(n)}">`).join("");
      $("wlCardioNames").innerHTML = this.workouts.names("cardio").map((n) => `<option value="${escapeHtml(n)}">`).join("");
      $("wlStrength").innerHTML = "";
      (r.strength || []).forEach((e) => this.addStrength(e, false));
      $("wlCardio").innerHTML = "";
      (r.cardio || []).forEach((c) => this.addCardio(c, false));
      $("wlParts").querySelectorAll("input").forEach((c) => (c.checked = (r.parts || []).includes(c.value)));
      $("wlWeight").value = r.weight != null ? r.weight : "";
      document.querySelectorAll("#wlMoods input").forEach((c) => (c.checked = Number(c.value) === r.mood));
      $("wlMemo").value = r.memo || "";
      $("wlDelete").classList.toggle("hidden", !this.workouts.get(k));
      this.el.querySelector(".screen-body").scrollTop = 0;
    }

    // ---------- 근력: 종목 카드 ----------
    addStrength(e, focus) {
      const card = document.createElement("div");
      card.className = "ex-card";
      card.innerHTML =
        `<div class="ex-head"><input type="text" class="ex-name" list="wlStrengthNames" maxlength="20" placeholder="종목 (예: 벤치프레스)" value="${escapeHtml(e.name || "")}">` +
        `<button type="button" class="ex-del" aria-label="이 종목 지우기">×</button></div>` +
        `<div class="ex-sets"></div><button type="button" class="set-add">＋ 세트</button>`;
      $("wlStrength").appendChild(card);
      (e.sets && e.sets.length ? e.sets : [{ kg: "", reps: "" }]).forEach((s) => this.addSetRow(card, false, s));
      if (focus) card.querySelector(".ex-name").focus();
    }
    // 세트 한 줄. 새로 추가하면 바로 위 세트의 무게·횟수를 그대로 채움 (같은 무게로 여러 세트가 많아서)
    addSetRow(card, focus, s) {
      const rows = card.querySelector(".ex-sets");
      const last = rows.lastElementChild;
      const v = s || (last ? { kg: last.querySelector(".set-kg").value, reps: last.querySelector(".set-reps").value } : { kg: "", reps: "" });
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML =
        `<span class="set-no"></span>` +
        `<input type="number" class="set-kg" inputmode="decimal" step="any" min="0" placeholder="0" value="${v.kg != null ? v.kg : ""}"><span class="unit">kg ×</span>` +
        `<input type="number" class="set-reps" inputmode="numeric" step="1" min="0" placeholder="0" value="${v.reps != null ? v.reps : ""}"><span class="unit">회</span>` +
        `<button type="button" class="set-del" aria-label="이 세트 지우기">−</button>`;
      rows.appendChild(row);
      this.renumber(card);
      if (focus) row.querySelector(".set-reps").focus();
    }
    renumber(card) { card.querySelectorAll(".set-row").forEach((r, i) => (r.querySelector(".set-no").textContent = `${i + 1}세트`)); }

    // ---------- 유산소 ----------
    addCardio(c, focus) {
      const row = document.createElement("div");
      row.className = "cardio-row";
      row.innerHTML =
        `<input type="text" class="cd-name" list="wlCardioNames" maxlength="20" placeholder="종목 (예: 러닝)" value="${escapeHtml(c.name || "")}">` +
        `<label class="cd-f"><input type="number" class="cd-min" inputmode="numeric" step="1" min="0" placeholder="0" value="${c.min != null ? c.min : ""}">분</label>` +
        `<label class="cd-f"><input type="number" class="cd-km" inputmode="decimal" step="any" min="0" placeholder="0" value="${c.km != null ? c.km : ""}">km</label>` +
        `<button type="button" class="cd-del" aria-label="이 유산소 지우기">×</button>`;
      $("wlCardio").appendChild(row);
      if (focus) row.querySelector(".cd-name").focus();
    }

    read() {
      const strength = [...$("wlStrength").querySelectorAll(".ex-card")].map((card) => ({
        name: card.querySelector(".ex-name").value.trim(),
        sets: [...card.querySelectorAll(".set-row")]
          .map((r) => ({ kg: num(r.querySelector(".set-kg").value), reps: num(r.querySelector(".set-reps").value) }))
          .filter((s) => s.kg != null || s.reps != null),
      })).filter((e) => e.name && e.sets.length);
      const cardio = [...$("wlCardio").querySelectorAll(".cardio-row")].map((r) => ({
        name: r.querySelector(".cd-name").value.trim(),
        min: num(r.querySelector(".cd-min").value),
        km: num(r.querySelector(".cd-km").value),
      })).filter((c) => c.name && (c.min != null || c.km != null));
      return { strength, cardio };
    }

    save() {
      const k = this.key;
      const prev = this.workouts.getOrNew(k);
      const { strength, cardio } = this.read();
      const mood = document.querySelector("#wlMoods input:checked");
      const weight = num($("wlWeight").value);
      const r = Object.assign(prev, {
        strength, cardio,
        parts: [...$("wlParts").querySelectorAll("input:checked")].map((c) => c.value),
        weight: weight != null && weight > 0 ? weight : null,
        mood: mood ? Number(mood.value) : null,
        memo: $("wlMemo").value.trim(),
      });
      this.key = null;
      this.workouts.save(k, r);
      this.toast.show("운동 일지를 저장했어요");
      this.router.back();
    }

    async remove() {
      const k = this.key;
      if (!(await DT.ask.confirm(`${fmtLong(k)} 운동 기록을 모두 삭제할까요? 운동 시간 기록도 지워져요.`, { ok: "삭제", danger: true }))) return;
      this.key = null;
      this.workouts.remove(k);
      this.toast.show("삭제했습니다");
      this.router.back();
    }
  }

  DT.WorkoutLogScreen = WorkoutLogScreen;
})();
