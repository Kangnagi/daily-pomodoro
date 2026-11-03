// 캘린더 확대/축소 제스처
//  - 휴대폰: 두 손가락을 오므리면 onZoomOut(), 벌리면 onZoomIn(가운데 지점)
//  - PC: 트랙패드 핀치(Ctrl + 휠)도 같은 동작
(() => {
  "use strict";

  const OUT_RATIO = 0.75; // 손가락 간격이 처음의 75% 이하로 줄면 축소
  const IN_RATIO = 1.33;  // 133% 이상으로 벌어지면 확대

  class CalendarZoom {
    // handlers: { onZoomOut(), onZoomIn({x, y}) }
    constructor(el, handlers) {
      this.el = el;
      this.handlers = handlers;
      this.startDist = 0;
      this.fired = false;
      this.pinching = false; // 두 손가락이 닿아 있는 동안 true (스와이프와 구분용)
      this.wheelLock = 0;
      this.bindTouch();
      this.bindWheel();
    }

    static dist(t) {
      return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    }
    static mid(t) {
      return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
    }

    bindTouch() {
      this.el.addEventListener("touchstart", (e) => {
        if (e.touches.length === 2) {
          this.pinching = true;
          this.fired = false;
          this.startDist = CalendarZoom.dist(e.touches);
        }
      }, { passive: true });

      this.el.addEventListener("touchmove", (e) => {
        if (!this.pinching || e.touches.length !== 2 || this.fired || !this.startDist) return;
        const ratio = CalendarZoom.dist(e.touches) / this.startDist;
        if (ratio <= OUT_RATIO) { this.fired = true; this.handlers.onZoomOut(); }
        else if (ratio >= IN_RATIO) { this.fired = true; this.handlers.onZoomIn(CalendarZoom.mid(e.touches)); }
      }, { passive: true });

      const end = (e) => { if (e.touches.length === 0) this.pinching = false; };
      this.el.addEventListener("touchend", end);
      this.el.addEventListener("touchcancel", end);
    }

    bindWheel() {
      this.el.addEventListener("wheel", (e) => {
        if (!e.ctrlKey) return; // 트랙패드 핀치는 ctrlKey가 켜진 wheel 이벤트로 들어온다
        e.preventDefault();
        const now = Date.now();
        if (now < this.wheelLock || Math.abs(e.deltaY) < 2) return;
        this.wheelLock = now + 500;
        if (e.deltaY > 0) this.handlers.onZoomOut();
        else this.handlers.onZoomIn({ x: e.clientX, y: e.clientY });
      }, { passive: false });
    }
  }

  DT.CalendarZoom = CalendarZoom;
})();
