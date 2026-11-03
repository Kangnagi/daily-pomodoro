// 공통 유틸리티: 날짜/시간 포맷, DOM 헬퍼, 토스트
// 모든 파일은 window.DT 네임스페이스에 등록된다 (file:// 로 열어도 동작하도록 ES 모듈 대신 사용)
window.DT = window.DT || {};

(() => {
  "use strict";

  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
  const pad = (n) => String(n).padStart(2, "0");

  const utils = {
    MOOD_ICON: { 1: "😫", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" },
    WEEK,

    $: (id) => document.getElementById(id),
    pad,

    // "2026-10-14" 형식의 날짜 키
    keyOf: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    parseKey: (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); },
    todayKey: () => utils.keyOf(new Date()),
    daysBetween: (fromKey, toKey) => Math.round((utils.parseKey(toKey) - utils.parseKey(fromKey)) / 86400000),

    fmtLong: (k) => { const d = utils.parseKey(k); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`; },
    fmtShort: (k) => { const d = utils.parseKey(k); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`; },
    fmtMin: (m) => {
      if (!m) return "0분";
      const h = Math.floor(m / 60), r = m % 60;
      return h ? (r ? `${h}시간 ${r}분` : `${h}시간`) : `${r}분`;
    },
    fmtMinShort: (m) => (m >= 60 ? `${(m / 60).toFixed(m % 60 ? 1 : 0)}h` : `${m}m`),
    fmtClock: (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; },
    fmtTimer: (ms) => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; },

    escapeHtml: (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),

    // 과목 선택 칩 HTML (+ 맨 끝에 "과목 추가" 칩)
    partChecksHtml: (names) =>
      names.map((p) => `<label><input type="checkbox" value="${utils.escapeHtml(p)}"><span>${utils.escapeHtml(p)}</span></label>`).join("") +
      `<button type="button" class="chip-add" data-add-subject>＋ 과목</button>`,
    checkedValues: (root) => [...root.querySelectorAll("input:checked")].map((c) => c.value),
    setChecked: (root, values) => root.querySelectorAll("input").forEach((c) => (c.checked = values.includes(c.value))),
  };

  class Toast {
    constructor(el) {
      this.el = el;
      this.timer = null;
    }
    show(msg) {
      this.el.textContent = msg;
      this.el.classList.add("show");
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.el.classList.remove("show"), 2200);
    }
  }

  DT.utils = utils;
  DT.Toast = Toast;
})();
