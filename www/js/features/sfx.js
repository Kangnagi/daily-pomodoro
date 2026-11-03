// 타이머 효과음 (파일 없이 Web Audio로 합성)
//   endBeep():   집중이 끝날 때 "삐삐삐" 한 번
//   startBeep(): 시작할 때 "삐삐삐"를 부드러운 사인파로, START_PITCH 반음 올리고 START_SPEED배 빠르게 한 번
(() => {
  "use strict";

  const START_PITCH = 7;  // 시작음은 끝음보다 반음 7개(5도) 높게 — 너무 높으면 날카로움
  const START_SPEED = 3;  // 시작음은 끝음보다 3배 빠르게
  const BEEP_AT = [0, 0.18, 0.36]; // 세 음의 시작 시각(초)
  // 끝 "삐삐삐"에 맞춘 진동 박자(ms): 140 울림 / 40 쉼 × 3 → 세 음과 같은 0.18초 간격
  const END_VIBRATION = [140, 40, 140, 40, 140];

  class SoundFx {
    constructor() { this.ctx = null; }

    // 앱 공용 오디오를 사용 (첫 탭/클릭 때 자동으로 깨워짐)
    unlock() {
      DT.audio.unlock();
      this.ctx = DT.audio.get();
    }

    // "삐삐삐": 0.18초 간격 세 음 (마지막 음이 조금 높음). semitones만큼 피치를 올리고 speed배 빠르게
    // wave: "triangle"(또렷함) / "sine"(부드러움, 날카롭지 않음)
    // onStart(): 첫 음이 실제로 울리기 시작하는 순간 호출 (진동을 소리에 맞추는 용도)
    beep(semitones, speed = 1, wave = "triangle", onStart) {
      this.ctx = this.ctx || DT.audio.get();
      if (!this.ctx) { if (onStart) onStart(); return; }
      // 앱 공용 오디오면 오래 조용했을 때 스피커 연결을 다시 연 뒤 재생 (테스트용 다른 오디오는 바로 재생)
      if (this.ctx === DT.audio.ctx && !this.waited) {
        DT.audio.wake().then(() => { this.waited = true; this.beep(semitones, speed, wave, onStart); this.waited = false; });
        return;
      }
      const shift = Math.pow(2, semitones / 12);
      const k = 1 / speed; // 간격과 길이를 함께 줄임
      const t0 = this.ctx.currentTime + 0.01;
      if (onStart) setTimeout(onStart, Math.max(0, (t0 - this.ctx.currentTime) * 1000));
      BEEP_AT.forEach((d, i) => {
        const at = t0 + d * k;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = wave;
        o.frequency.value = (i === 2 ? 1318 : 1046) * shift;
        g.gain.setValueAtTime(0.0001, at);
        // 아주 짧은 음도 '틱' 튀지 않도록 커지는 시간은 최소 6ms
        g.gain.exponentialRampToValueAtTime(0.35, at + Math.max(0.006, 0.015 * k));
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16 * k);
        o.connect(g).connect(this.ctx.destination);
        o.start(at);
        o.stop(at + 0.18 * k);
      });
    }

    endBeep(onStart) { this.beep(0, 1, "triangle", onStart); }
    startBeep() { this.beep(START_PITCH, START_SPEED, "sine"); }
  }

  SoundFx.END_VIBRATION = END_VIBRATION;
  DT.SoundFx = SoundFx;
})();
