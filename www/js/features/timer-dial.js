// 타임타이머 스타일 다이얼(SVG): 남은 시간만큼 색 원판이 채워지고 점점 줄어든다
// 멈춰 있을 때 원판을 드래그해서 시간을 맞출 수 있다
(() => {
  "use strict";

  const SIZE = 240, CX = 120, CY = 120, R_WEDGE = 80;

  // 타임타이머 제품 색상 참고: main=원판, frame=테두리, knob=가운데 손잡이
  const COLORS = {
    red:   { name: "레드",   main: "#e2432a", frame: "#f8b49c", knob: "#f9c3b1" },
    pink:  { name: "핑크",   main: "#e06aa3", frame: "#f5d0d4", knob: "#f6d9dc" },
    navy:  { name: "네이비", main: "#283152", frame: "#b3bed1", knob: "#c8d0dd" },
    green: { name: "그린",   main: "#2e6a48", frame: "#80c08e", knob: "#a8d8b1" },
    teal:  { name: "틸",     main: "#0e5a6c", frame: "#a5d9e5", knob: "#bfe4ec" },
  };

  // 0이 맨 위, 숫자는 반시계 방향으로 증가 (실제 타임타이머와 동일)
  const polar = (deg, r) => [CX - r * Math.sin((deg * Math.PI) / 180), CY - r * Math.cos((deg * Math.PI) / 180)];

  class TimeTimerDial {
    // els: { box, svg, ticks, wedge, hand }
    // handlers: { onDragStart(), onTurn(연속 분), onDrag(정수 분), onDragEnd() }
    constructor(els, handlers) {
      this.els = els;
      this.handlers = handlers;
      this.max = 0;
      this.draggable = true;
      this.dragging = false;
      this.lastDragMin = null;
      this.bindDrag();
    }

    // 60분 또는 120분 눈금
    setMax(max) {
      if (this.max === max) return;
      this.max = max;
      const degPerMin = 360 / max;
      const labelStep = max === 60 ? 5 : 10;
      let g = "";
      for (let m = 0; m < max; m++) {
        const major = m % labelStep === 0;
        const [x1, y1] = polar(m * degPerMin, major ? 82 : 85);
        const [x2, y2] = polar(m * degPerMin, 90);
        if (max === 60 || m % 2 === 0) g += `<line class="tt-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${major ? 2.6 : 1.3}"/>`;
        if (major) {
          const [tx, ty] = polar(m * degPerMin, 103);
          g += `<text class="tt-num" x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central">${m}</text>`;
        }
      }
      this.els.ticks.innerHTML = g;
    }

    wedgePath(min) {
      const frac = Math.max(0, Math.min(1, min / this.max));
      if (frac <= 0) return "";
      if (frac >= 0.9999) return `M${CX - R_WEDGE},${CY} a${R_WEDGE},${R_WEDGE} 0 1,0 ${R_WEDGE * 2},0 a${R_WEDGE},${R_WEDGE} 0 1,0 ${-R_WEDGE * 2},0 Z`;
      const [ex, ey] = polar(frac * 360, R_WEDGE);
      // 맨 위에서 시작해 반시계 방향(sweep=0)으로 남은 시간만큼
      return `M${CX},${CY} L${CX},${CY - R_WEDGE} A${R_WEDGE},${R_WEDGE} 0 ${frac > 0.5 ? 1 : 0},0 ${ex},${ey} Z`;
    }

    render(remainingMs, durationMs) {
      this.setMax(Math.max(durationMs, remainingMs) > 60 * 60000 ? 120 : 60);
      const remMin = remainingMs / 60000;
      this.els.wedge.setAttribute("d", this.wedgePath(remMin));
      const [hx, hy] = polar((Math.min(remMin, this.max) / this.max) * 360, R_WEDGE);
      this.els.hand.setAttribute("x2", hx);
      this.els.hand.setAttribute("y2", hy);
    }

    setDraggable(on) {
      this.draggable = on;
      this.els.box.classList.toggle("draggable", on);
    }

    // CSS 변수로 색 지정 (target 요소 아래 전체에 적용)
    static applyColor(target, key) {
      const c = COLORS[key] || COLORS.red;
      target.style.setProperty("--tt-main", c.main);
      target.style.setProperty("--tt-frame", c.frame);
      target.style.setProperty("--tt-knob", c.knob);
    }

    pointerAngle(e) {
      const rect = this.els.svg.getBoundingClientRect();
      const dx = ((e.clientX - rect.left) / rect.width) * SIZE - CX;
      const dy = ((e.clientY - rect.top) / rect.height) * SIZE - CY;
      let deg = (Math.atan2(-dx, -dy) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      return deg;
    }

    minutesFromPointer(e) {
      const deg = this.pointerAngle(e);
      const max = this.max, last = this.lastDragMin;
      let m = Math.round((deg / 360) * max);
      // 0 근처에서 최대값 ↔ 0 으로 튀지 않게
      if (last != null && last > max * 0.75 && m < max * 0.25) m = max;
      if (last != null && last < max * 0.25 && m > max * 0.75) m = 1;
      if (m === 0) m = last > max / 2 ? max : 1;
      return Math.max(1, Math.min(max, m));
    }

    // 반올림하지 않은 연속 위치(분, 소수점 포함). 태엽 소리가 톱니 단위로 나도록 사용
    // 끝(1분·최대)에 닿으면 그 값에 머물러서 소리가 나지 않음
    continuousFromPointer(e) {
      const max = this.max, last = this.lastCont;
      let v = (this.pointerAngle(e) / 360) * max;
      if (last != null && last > max * 0.75 && v < max * 0.25) v = max;
      if (last != null && last < max * 0.25 && v > max * 0.75) v = 1;
      return Math.max(1, Math.min(max, v));
    }

    bindDrag() {
      const svg = this.els.svg;
      const move = (e) => {
        const cont = this.continuousFromPointer(e);
        this.lastCont = cont;
        if (this.handlers.onTurn) this.handlers.onTurn(cont);
        const m = this.minutesFromPointer(e);
        this.lastDragMin = m;
        this.handlers.onDrag(m);
      };
      svg.addEventListener("pointerdown", (e) => {
        if (!this.draggable) return;
        this.dragging = true;
        this.lastDragMin = null;
        this.lastCont = null;
        this.els.box.classList.add("dragging");
        svg.setPointerCapture(e.pointerId);
        if (this.handlers.onDragStart) this.handlers.onDragStart();
        move(e);
      });
      svg.addEventListener("pointermove", (e) => { if (this.dragging) move(e); });
      const end = () => {
        if (!this.dragging) return;
        this.dragging = false;
        this.els.box.classList.remove("dragging");
        this.handlers.onDragEnd();
      };
      svg.addEventListener("pointerup", end);
      svg.addEventListener("pointercancel", end);
    }
  }

  TimeTimerDial.COLORS = COLORS;
  DT.TimeTimerDial = TimeTimerDial;
})();
