// 공부(타이머) 화면: 다이얼, 시작/일시정지, 색상, 시간 설정, 오늘의 뽀모도로 목록
//   집중: 원판이 줄어듦 → 끝나면 알람
//   휴식: 색이 바뀌고 쉰 만큼 원판이 차오름 → "다시 집중"을 누르면 집중 시간만큼 다시 차오르며 시작
// 화면을 닫아도 타이머는 계속 돌고, 홈 상단에 남은(휴식은 지난) 시간이 표시된다
(() => {
  "use strict";
  const { $, todayKey, fmtMin, fmtTimer, fmtShort } = DT.utils;
  const { PomodoroTimer, TimeTimerDial, WindSound, DialHaptics } = DT;

  const FILL_MS = 1100;         // 다시 집중할 때 집중 시간만큼 원판이 차오르는 시간
  const BREAK_DIAL = 60 * 60000; // 휴식 원판은 60분 눈금 기준으로 차오름

  class TimerScreen {
    constructor(store, sessionDialog, toast, router) {
      this.name = "timer";
      this.store = store;
      this.sessions = sessionDialog;
      this.toast = toast;
      this.router = router;
      this.el = $("timerScreen");
      this.wrap = this.el.querySelector(".timer-wrap");
      this.active = false;
      this.lastMode = null; // 집중/휴식이 바뀌었는지 알기 위한 이전 값
      this.fill = null;     // 차오르는 애니메이션 상태

      this.timer = new PomodoroTimer(store, {
        onUpdate: () => this.render(),
        onFocusDone: ({ k, s }) => this.sessions.open(k, s.id, true),
      });

      // 시간을 조절할 때 나는 태엽(래칫) 소리: 돌리는 속도에 따라 "딸-깍" ~ "드르르륵"
      this.sound = new WindSound(() => this.store.settings.pomo.sound);
      // 톱니마다 손끝에 약한 진동 (세기 3/10, dial-haptics.js LEVEL)
      this.haptics = new DialHaptics(() => this.store.settings.pomo.haptic);
      this.sound.onTeeth = () => this.haptics.tick();

      this.dial = new TimeTimerDial(
        { box: $("ttBox"), svg: $("ttDial"), ticks: $("ttTicks"), wedge: $("ttWedge"), hand: $("ttHand") },
        {
          onDragStart: () => this.sound.prepare(),
          onTurn: (pos) => this.sound.turn(pos), // 소수점까지의 위치 → 톱니를 넘을 때마다 딸깍
          onDrag: (min) => {
            this.timer.setMinutes(min, false);
            $("oFocus").value = min;
          },
          onDragEnd: () => {
            this.sound.release();
            this.timer.setMinutes(this.store.settings.pomo.focus, true);
          },
        }
      );

      this.bindControls();
      this.bindOptions();
      this.bindColors();
      $("timerChip").addEventListener("click", () => this.router.go("timer"));
      store.onChange(() => this.renderSessions());

      this.timer.resume();
      this.render();
      this.renderSessions();
      // 화면이 꺼지거나 다른 앱으로 가면 연결 유지를 멈춰 배터리 절약
      document.addEventListener("visibilitychange", () => this.updateKeepAlive());
    }

    setActive(active) {
      this.active = active;
      this.el.classList.toggle("open", active);
      this.updateKeepAlive();
      if (active) this.render();
    }

    // 타이머 화면을 보고 있는 동안에는 스피커 연결을 유지해 "뜨르륵"·"삐삐삐"가 바로 나게 한다
    // (휴대폰 앱의 WebView는 조용하면 연결을 끊고, 기기에 따라 다시 잇지 못하는 경우가 있음)
    updateKeepAlive() {
      DT.audio.keepAlive(this.active && !document.hidden);
    }

    bindControls() {
      // 버튼을 누를 때 소리도 깨워 둬야, 나중에 원판이 차오를 때 "뜨르륵"이 난다
      $("tStart").addEventListener("click", () => {
        this.sound.unlock();
        if (this.timer.onBreak) this.timer.refocus(); // 다시 집중: 집중 시간만큼 차오르며 시작
        else this.timer.toggle();
      });
      $("tReset").addEventListener("click", () => {
        this.sound.unlock();
        this.timer.reset();
        this.startFill();
      });
      $("tSkip").addEventListener("click", async () => {
        const rec = await this.timer.skip((msg, ok) => DT.ask.confirm(msg, { ok }));
        if (rec) this.sessions.open(rec.k, rec.s.id, true);
      });
    }

    bindOptions() {
      const pomo = this.store.settings.pomo;
      const input = $("oFocus");
      input.value = pomo.focus;
      input.addEventListener("change", () => {
        const v = Math.max(1, Math.min(120, Math.round(Number(input.value)) || pomo.focus));
        input.value = v;
        if (v !== pomo.focus) { this.sound.unlock(); this.sound.burst(); }
        this.timer.setDuration(v);
      });
      $("oHaptic").checked = pomo.haptic;
      $("oHaptic").addEventListener("change", () => {
        this.store.updatePomo({ haptic: $("oHaptic").checked });
        if ($("oHaptic").checked) this.haptics.tick(); // 켜면 한 번 미리 느껴보기
      });
      $("oHapticRow").classList.toggle("hidden", !this.haptics.supported);
      $("oSound").checked = pomo.sound;
      $("oSound").addEventListener("change", () => {
        this.store.updatePomo({ sound: $("oSound").checked });
        if ($("oSound").checked) { this.sound.unlock(); this.sound.burst(); } // 켜면 미리 들려주기
      });
    }

    bindColors() {
      const box = $("ttColors");
      box.innerHTML = Object.entries(TimeTimerDial.COLORS).map(([k, c]) =>
        `<button type="button" role="radio" data-color="${k}" title="${c.name}" aria-label="${c.name}" style="background:${c.main}"></button>`).join("");
      box.querySelectorAll("button").forEach((b) =>
        b.addEventListener("click", () => { this.store.updatePomo({ color: b.dataset.color }); this.timer.syncNotice(); this.render(); })
      );
    }

    // 원판이 0에서 집중 시간까지 차오르는 애니메이션 (색은 CSS 전환으로 함께 바뀜)
    startFill() {
      if (!this.active) return;
      this.fill = { start: performance.now(), to: this.timer.duration(), lastMin: 0 };
      const step = () => {
        if (!this.fill) return;
        this.render();
        if (this.fill) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    // 애니메이션 중이면 원판에 보여줄 시간(ms), 아니면 null
    fillValue() {
      if (!this.fill) return null;
      const p = Math.min(1, (performance.now() - this.fill.start) / FILL_MS);
      const v = this.fill.to * (1 - Math.pow(1 - p, 3));
      // 차오르는 동안 1분 지날 때마다 태엽 소리
      const min = Math.floor(v / 60000);
      if (min > this.fill.lastMin) { this.sound.tick(); this.fill.lastMin = min; }
      if (p >= 1) { this.fill = null; return null; }
      return v;
    }

    // 휴식은 구분되도록 그린 (집중 색이 그린이면 틸)
    colorKey() {
      const focus = this.store.settings.pomo.color in TimeTimerDial.COLORS ? this.store.settings.pomo.color : "red";
      if (!this.timer.onBreak) return focus;
      return focus === "green" ? "teal" : "green";
    }

    render() {
      const t = this.timer;
      const onBreak = t.onBreak;
      const rem = t.remaining();
      const elapsed = t.breakElapsed();
      const txt = onBreak ? fmtTimer(elapsed) : fmtTimer(rem);

      // 홈 상단 칩 (타이머 진행 중이거나 휴식 중일 때)
      const chip = $("timerChip");
      chip.classList.toggle("hidden", !onBreak && !t.running && t.isFresh());
      chip.textContent = onBreak ? `휴식 +${txt}` : `🍅 ${txt}${t.running ? "" : " · 멈춤"}`;
      TimeTimerDial.applyColor(chip, this.colorKey());
      document.title = onBreak ? `휴식 ${txt} · Daily Study` : t.running ? `${txt} 🍅 Daily Study` : "Daily Study";

      // 휴식 → 집중으로 바뀌면 집중 시간만큼 원판이 차오른다
      const toFocus = this.lastMode === "break" && t.mode === "focus";
      this.lastMode = t.mode;
      if (!this.active) return;
      if (toFocus) this.startFill();

      TimeTimerDial.applyColor(this.wrap, this.colorKey());
      this.wrap.classList.toggle("on-break", onBreak);
      const shown = this.fillValue();
      if (onBreak) this.dial.render(Math.min(elapsed, BREAK_DIAL), BREAK_DIAL); // 쉰 만큼 차오름
      else this.dial.render(shown != null ? shown : rem, t.duration());
      this.dial.setDraggable(!onBreak && !t.running && !this.fill);

      $("ringLabel").textContent = PomodoroTimer.modeName(t.mode);
      $("ringTime").textContent = onBreak ? `+${txt}` : txt;
      $("ttHint").textContent = onBreak ? "쉰 만큼 원판이 채워져요" : "원판을 드래그해서 집중 시간을 맞출 수 있어요";
      $("ttHint").style.visibility = onBreak || !t.running ? "visible" : "hidden";
      $("tStart").textContent = onBreak ? "다시 집중" : t.running ? "일시정지" : rem < t.duration() ? "계속" : "시작";
      $("tReset").classList.toggle("hidden", onBreak);
      $("tSkip").classList.toggle("hidden", onBreak);
      const focusColor = this.store.settings.pomo.color;
      $("ttColors").querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.color === focusColor)));
    }

    renderSessions() {
      const k = todayKey();
      const r = this.store.get(k);
      const list = (r && r.sessions) || [];
      const sum = list.reduce((a, s) => a + s.minutes, 0);
      $("todaySessionTitle").textContent = `오늘의 뽀모도로 · ${fmtShort(k)}`;
      $("todaySessionSum").textContent = list.length ? `${list.length}개 · ${fmtMin(sum)}` : "";
      $("ringCycle").textContent = `오늘 🍅 ${DT.Store.tomatoes(r)}개`;
      if (list.length) this.sessions.renderList($("todaySessions"), k, list, true);
      else $("todaySessions").innerHTML = `<div class="empty-msg">집중 세션을 마치면 여기에 기록됩니다</div>`;
    }
  }

  DT.TimerScreen = TimerScreen;
})();
