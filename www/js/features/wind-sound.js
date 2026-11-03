// 타이머 조절 효과음: 태엽 타이머 안의 래칫(톱니 + 멈춤쇠)을 실시간으로 합성
//   원판 1분 = 톱니 2개. 손가락이 톱니를 넘을 때마다 "딸깍"
//   천천히: 무겁고 또렷한 "철-컥" (멈춤쇠 두 박자, 낮은 금속 울림, 큰 몸체 울림, 긴 여운)
//   빠르게: 가볍고 높은 "치르르르륵" (아주 짧고 높은 딸깍이 촘촘히 + 태엽이 스치는 마찰음이 크게)
//   시간을 줄이는 방향은 조금 더 가볍고 높게
(() => {
  "use strict";

  const TEETH_PER_MIN = 2;      // 원판 1분당 톱니 수
  const SLOW = 1.5, FAST = 18;  // 분/초. 이 사이에서 소리 성격이 천천히 → 빠르게로 바뀜
  const MAX_CLICKS_PER_MOVE = 10; // 한 번 움직임에 너무 많이 몰리면 이만큼만 (아주 빠른 회전)
  const MAX_AHEAD = 0.08;       // 이보다 많이 밀리면 예약을 버리고 지금부터 (지연 방지)

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const jitter = (x, amt) => x * (1 + (Math.random() * 2 - 1) * amt);
  // 중간 구간을 좁히고 양 끝(천천히/빠르게)으로 확실히 나뉘게 하는 곡선
  const contrast = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

  class WindSound {
    // isEnabled(): 설정에서 소리를 켰는지
    constructor(isEnabled) {
      this.isEnabled = isEnabled;
      this.ctx = DT.audio.get();
      this.status = this.ctx ? "합성 태엽 소리" : "오디오 미지원";
      this.noise = null;       // 딸깍·마찰음에 쓰는 잡음 (한 번 만들어 재사용)
      this.friction = null;    // 돌리는 동안 이어지는 마찰음 { src, gain }
      this.onTeeth = null;     // 톱니를 넘을 때마다 호출 (n, v) — 진동에 사용 (소리를 꺼도 동작)
      this.reset();
    }

    reset() {
      this.lastPos = null;   // 마지막 연속 위치(분)
      this.lastT = 0;
      this.acc = 0;          // 아직 소리로 못 바꾼 톱니 몫
      this.speed = 0;        // 부드럽게 만든 회전 속도(분/초)
      this.nextAt = 0;       // 다음 딸깍을 놓을 수 있는 가장 이른 시각(오디오 시각)
    }

    noiseBuffer() {
      if (!this.noise) {
        const sr = this.ctx.sampleRate, n = Math.floor(sr * 1.0);
        this.noise = this.ctx.createBuffer(1, n, sr);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      return this.noise;
    }

    // 소리를 낼 수 있는 상태인지 (스피커 연결을 다시 여는 중이면 이번엔 건너뜀)
    ready() {
      if (!this.ctx || !this.isEnabled()) return false;
      DT.audio.wake();
      if (DT.audio.waking) return false;
      if (this.ctx.state !== "running") { DT.audio.unlock(); return false; }
      return true;
    }

    // ---------- 딸깍 한 번 ----------
    // v: 0(천천히) ~ 1(빠르게), down: 시간을 줄이는 방향
    click(at, v, down) {
      const c = this.ctx;
      const level = jitter(lerp(1.0, 0.32, v), 0.12) * (down ? 0.8 : 1);
      const pitch = lerp(0.75, 1.35, v) * (down ? 1.12 : 1); // 천천히는 낮고 무겁게, 빠르게는 높고 가볍게
      // 천천히 돌릴 때: 멈춤쇠가 톱니에서 들리는 작은 소리 뒤에 떨어지는 큰 소리 → "철-컥"
      if (v < 0.4) {
        this.clickTick(at, lerp(1.1, 0.6, v / 0.4) * level, down, pitch);
        at += jitter(lerp(0.016, 0.01, v / 0.4), 0.2);
      }
      const out = c.createGain();
      out.gain.value = level;
      out.connect(c.destination);

      // 1) 금속 톱니가 튕기는 울림: 잡음을 짧게 때려 공진 필터 3개로 울림
      const hit = c.createBufferSource();
      hit.buffer = this.noiseBuffer();
      const env = c.createGain();
      const decay = lerp(0.014, 0.0015, v); // 천천히: 길게 울림 / 빠르게: 아주 짧게 끊김
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(1, at + 0.0004);
      env.gain.setTargetAtTime(0, at + 0.0004, decay);
      hit.connect(env);
      [[2100, lerp(20, 10, v), 0.9], [3550, lerp(24, 12, v), 0.7], [5900, lerp(26, 14, v), 0.45]].forEach(([f, q, g]) => {
        const bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = jitter(f * pitch, 0.04);
        bp.Q.value = q;
        const gg = c.createGain();
        gg.gain.value = g * 2.6;
        env.connect(bp).connect(gg).connect(out);
      });
      // 아주 높은 "칙" 성분: 빠를수록 크게 (가볍고 날렵한 느낌)
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6500;
      const hg = c.createGain();
      hg.gain.value = lerp(0.15, 0.45, v);
      env.connect(hp).connect(hg).connect(out);
      hit.start(at, Math.random() * 0.9, 0.06);

      // 2) 몸체가 "턱" 울리는 성분: 천천히는 크고 길게, 빠르게는 거의 없음
      if (v < 0.85) {
        const body = c.createOscillator();
        body.type = "sine";
        const bf = jitter(lerp(640, 950, v) * (down ? 1.12 : 1), 0.05);
        body.frequency.setValueAtTime(bf * 1.35, at);
        body.frequency.exponentialRampToValueAtTime(bf, at + 0.01);
        const bg = c.createGain();
        const bodyLen = lerp(0.06, 0.008, v);
        bg.gain.setValueAtTime(0, at);
        bg.gain.linearRampToValueAtTime(lerp(0.36, 0.03, v), at + 0.001);
        bg.gain.setTargetAtTime(0, at + 0.001, bodyLen / 3);
        body.connect(bg).connect(out);
        body.start(at);
        body.stop(at + bodyLen + 0.05);
      }
    }

    // 멈춤쇠가 들릴 때의 작고 가는 소리
    clickTick(at, gain, down, pitch = 1) {
      const c = this.ctx;
      const hit = c.createBufferSource();
      hit.buffer = this.noiseBuffer();
      const env = c.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(gain, at + 0.0003);
      env.gain.setTargetAtTime(0, at + 0.0003, 0.0018);
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = jitter(4300 * pitch, 0.05);
      bp.Q.value = 5;
      hit.connect(env).connect(bp).connect(c.destination);
      hit.start(at, Math.random() * 0.9, 0.03);
    }

    // ---------- 돌리는 동안 이어지는 마찰음 ("스르르") ----------
    startFriction() {
      if (this.friction || !this.ctx) return;
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 3200;
      bp.Q.value = 0.9;
      const gain = c.createGain();
      gain.gain.value = 0;
      src.connect(bp).connect(gain).connect(c.destination);
      src.start();
      this.friction = { src, gain, bp };
    }
    setFriction(v) {
      if (!this.friction) return;
      const t = this.ctx.currentTime;
      // 빠를수록 커지고 높아짐. 천천히 돌릴 땐 거의 안 들림
      this.friction.gain.gain.setTargetAtTime(Math.pow(v, 1.0) * 0.1, t, 0.025);
      this.friction.bp.frequency.setTargetAtTime(lerp(2400, 5200, v), t, 0.04);
    }
    stopFriction() {
      if (!this.friction) return;
      const { src, gain } = this.friction;
      const t = this.ctx.currentTime;
      gain.gain.setTargetAtTime(0, t, 0.03);
      try { src.stop(t + 0.2); } catch (e) {}
      this.friction = null;
    }

    // ---------- 원판 드래그 ----------
    // 원판을 잡는 순간: 스피커 연결을 미리 열고 마찰음 준비
    prepare() {
      DT.audio.unlock();
      DT.audio.wake();
      this.reset();
      if (this.isEnabled()) this.startFriction();
    }

    // 손가락이 움직일 때마다 연속 위치(분)를 받아서, 넘은 톱니 수만큼 딸깍을 고르게 배치
    turn(pos) {
      const now = performance.now();
      if (this.lastPos == null) { this.lastPos = pos; this.lastT = now; return; }
      const d = pos - this.lastPos;
      const dt = Math.max(0.008, (now - this.lastT) / 1000);
      this.lastPos = pos;
      this.lastT = now;
      if (!d) { this.speed *= 0.5; this.setFriction(0); return; }

      // 속도(분/초)를 부드럽게: 손가락 움직임의 들쭉날쭉함을 줄임
      this.speed = this.speed * 0.4 + (Math.abs(d) / dt) * 0.6;
      const v = contrast((this.speed - SLOW) / (FAST - SLOW));

      this.acc += Math.abs(d) * TEETH_PER_MIN;
      let n = Math.floor(this.acc);
      this.acc -= n;
      if (n && this.onTeeth) this.onTeeth(n, v);

      if (!this.ready()) return;
      this.setFriction(v);
      if (!n) return;
      n = Math.min(n, MAX_CLICKS_PER_MOVE);

      // 이번 움직임 시간(dt) 동안 딸깍 n개를 고르게 + 살짝 불규칙하게
      const t0 = this.ctx.currentTime;
      let at = Math.max(t0 + 0.005, this.nextAt);
      if (at - t0 > MAX_AHEAD) at = t0 + 0.005;
      const gap = Math.min(dt, 0.25) / n;
      for (let i = 0; i < n; i++) {
        this.click(at, v, d < 0);
        at += jitter(gap, 0.15);
      }
      this.nextAt = at;
    }

    // 원판에서 손을 뗌
    release() {
      this.stopFriction();
      this.reset();
    }

    // ---------- 그 밖의 사용 ----------
    // 1분 단위로만 알 때 (집중 시간만큼 원판이 차오르는 애니메이션): 보통 속도 딸깍 2번
    tick() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime + 0.005;
      this.click(t, 0.55, false);
      this.click(t + 0.03, 0.55, false);
    }

    // 숫자로 시간을 바꿨을 때: 빠르게 감는 "드르륵" 한 번
    burst() {
      if (!this.ctx || !this.isEnabled()) return;
      if (DT.audio.waking || Date.now() - DT.audio.lastUse > 10000) { DT.audio.wake().then(() => this.burst()); return; }
      if (!this.ready()) return;
      const t0 = this.ctx.currentTime + 0.01;
      for (let i = 0; i < 12; i++) this.click(t0 + i * 0.026 + Math.random() * 0.004, 0.85, false);
    }

    // 예전 방식 호환 (원판 잡을 때 호출되던 이름)
    unlock() { DT.audio.unlock(); }
  }

  DT.WindSound = WindSound;
})();
