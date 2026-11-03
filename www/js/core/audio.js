// 앱 전체가 함께 쓰는 오디오(AudioContext) 하나
// 브라우저는 사용자가 화면을 탭/클릭하기 전에는 소리를 막아 둔다(자동재생 정책).
// 특히 휴대폰은 손가락이 "닿는 순간"(pointerdown)은 인정하지 않고 "뗄 때"(탭)만 인정하므로,
// 페이지 어디서든 첫 탭·클릭·키 입력이 생기면 바로 오디오를 깨워 둔다.
(() => {
  "use strict";

  const UNLOCK_EVENTS = ["pointerup", "touchend", "click", "keydown"];
  // 안드로이드 앱(WebView)은 약 30초 동안 소리가 없으면 스피커 연결을 끊고, 그 뒤엔 소리를 내도 다시 잇지 않는다.
  // 그래서 이만큼 조용했으면 재생 직전에 오디오를 잠깐 멈췄다 다시 켜서 연결을 새로 연다.
  const IDLE_MS = 10000;
  // 들리지 않는 아주 작은 신호. 0이 아니기만 하면 "조용함"으로 판단되지 않아 연결이 유지된다
  const KEEP_ALIVE_LEVEL = 0.0001;

  class AudioHub {
    constructor() {
      this.ctx = null;
      this.primed = false;
      this.lastUse = 0;     // 마지막으로 소리를 낸 시각
      this.waking = null;   // 연결을 다시 여는 중이면 그 Promise
      this.alive = null;    // 연결 유지 신호(keepAlive)를 내는 중이면 그 노드
      const onGesture = () => {
        this.unlock();
        if (this.ctx && this.ctx.state === "running") {
          UNLOCK_EVENTS.forEach((ev) => document.removeEventListener(ev, onGesture, true));
        }
      };
      UNLOCK_EVENTS.forEach((ev) => document.addEventListener(ev, onGesture, true));
    }

    // 필요할 때 만든다 (지원하지 않는 환경이면 null)
    get() {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
          this.ctx = null;
        }
      }
      return this.ctx;
    }

    get running() { return !!this.ctx && this.ctx.state === "running"; }

    // 소리를 내기 직전에 호출. 오래 조용했으면 연결을 다시 열고, 끝나면 resolve
    wake() {
      const ctx = this.get();
      if (!ctx) return Promise.resolve();
      const idle = Date.now() - this.lastUse > IDLE_MS;
      this.lastUse = Date.now();
      if (this.waking) return this.waking;
      if (ctx.state !== "running") return ctx.resume().catch(() => {});
      if (!idle || this.alive) return Promise.resolve(); // 연결을 유지 중이면 다시 열 필요 없음
      this.waking = ctx.suspend()
        .then(() => ctx.resume())
        .catch(() => {})
        .finally(() => { this.waking = null; });
      return this.waking;
    }

    // 켜 두면 들리지 않는 신호를 계속 내보내서 스피커 연결이 끊기지 않게 한다 (타이머 화면에서만 사용)
    keepAlive(on) {
      const ctx = this.get();
      if (!ctx) return;
      if (on && !this.alive) {
        try {
          const src = ctx.createConstantSource ? ctx.createConstantSource() : null;
          if (!src) return;
          src.offset.value = KEEP_ALIVE_LEVEL;
          src.connect(ctx.destination);
          src.start();
          this.alive = src;
          if (ctx.state !== "running") ctx.resume().catch(() => {});
        } catch (e) {
          this.alive = null;
        }
      } else if (!on && this.alive) {
        try { this.alive.stop(); this.alive.disconnect(); } catch (e) {}
        this.alive = null;
        this.lastUse = 0; // 다음 소리 때는 연결을 새로 열도록
      }
    }

    unlock() {
      const ctx = this.get();
      if (!ctx) return;
      if (ctx.state !== "running") ctx.resume().catch(() => {});
      // 예전 iOS Safari는 사용자 동작 안에서 소리를 한 번 재생해야 풀린다: 무음 1샘플 재생
      if (!this.primed) {
        try {
          const src = ctx.createBufferSource();
          src.buffer = ctx.createBuffer(1, 1, 22050);
          src.connect(ctx.destination);
          src.start(0);
          this.primed = true;
        } catch (e) {}
      }
    }
  }

  DT.audio = new AudioHub();
})();
