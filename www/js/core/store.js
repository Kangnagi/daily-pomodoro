// 데이터 저장소: 날짜별 기록(records)과 설정(settings)을 localStorage에 보관
// 데이터가 바뀌면 onChange로 등록한 화면들에 알린다
(() => {
  "use strict";
  const { keyOf, todayKey, daysBetween } = DT.utils;

  const RECORDS_KEY = "dailyToeic.records";
  const SETTINGS_KEY = "dailyToeic.settings";

  // exams: [{ id, date, name, score(null|숫자), pass(null|true|false) }] / subjects: 공부 과목 이름 목록
  const DEFAULT_SETTINGS = { exams: [], subjects: [], daily: 60 };
  const DEFAULT_POMO = { focus: 25, color: "red", sound: true, haptic: true };
  // parts = 공부한 과목 이름, scores = [{ name, score }] (모의고사·문제집 점수 등)
  const emptyRecord = () => ({ minutes: 0, parts: [], vocab: 0, scores: [], mood: null, memo: "", sessions: [] });
  const OLD_TOEIC = "토익"; // 토익 전용이던 시절의 기록을 옮길 때 쓰는 이름
  const OLD_PARTS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "단어"];
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  class Store {
    constructor(onError) {
      this.onError = onError || (() => {});
      this.listeners = [];
      this.records = Store.read(RECORDS_KEY, {});
      this.settings = Object.assign({}, DEFAULT_SETTINGS, Store.read(SETTINGS_KEY, {}));
      this.settings.pomo = Object.assign({}, DEFAULT_POMO, this.settings.pomo);
      this.migrate();
    }

    static read(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    }
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        this.onError("저장에 실패했습니다");
      }
    }

    // 예전 형식을 지금 형식으로 옮김 (토익 전용 → 일반 공부 앱)
    //   시험일(날짜 문자열) → 이름 있는 시험 { name: "토익" } / LC·RC 점수 → scores [{ name: "토익" }]
    //   토익 파트(P1~P7·단어) → 과목 "토익" (세부 파트는 공부 내용 앞에 [P5·단어]로 남김)
    migrate() {
      const s = this.settings;
      let changed = false;
      s.exams = s.exams || [];
      if (s.examDate) { s.exams.push(s.examDate); delete s.examDate; changed = true; }
      if (s.exams.some((e) => typeof e === "string")) {
        const seen = new Set();
        s.exams = s.exams.map((e) => (typeof e === "string" ? { id: newId() + e, date: e, name: OLD_TOEIC, score: null, pass: null } : e))
          .filter((e) => { const key = e.date + "|" + e.name; if (seen.has(key)) return false; seen.add(key); return true; });
        changed = true;
      }
      s.exams.sort((a, b) => a.date.localeCompare(b.date));
      if (!Array.isArray(s.subjects)) { s.subjects = []; changed = true; }
      if ("goal" in s) { delete s.goal; changed = true; }

      let recChanged = false;
      const toSubject = (parts) => {
        const old = (parts || []).filter((p) => OLD_PARTS.includes(p));
        if (!old.length) return { parts: parts || [], detail: "" };
        recChanged = true;
        return { parts: [...new Set([...(parts || []).filter((p) => !OLD_PARTS.includes(p)), OLD_TOEIC])], detail: old.join("·") };
      };
      Object.values(this.records).forEach((r) => {
        if ("lc" in r || "rc" in r) {
          r.scores = r.scores || [];
          if (r.lc != null && r.rc != null) r.scores.push({ name: OLD_TOEIC, score: r.lc + r.rc, detail: `LC ${r.lc} / RC ${r.rc}` });
          delete r.lc; delete r.rc;
          recChanged = true;
        }
        r.parts = toSubject(r.parts).parts;
        (r.sessions || []).forEach((x) => {
          const { parts, detail } = toSubject(x.parts);
          x.parts = parts;
          if (detail) x.note = x.note ? `[${detail}] ${x.note}` : `[${detail}]`;
        });
      });
      if (recChanged && !s.subjects.includes(OLD_TOEIC)) { s.subjects.unshift(OLD_TOEIC); changed = true; }
      if (changed) this.write(SETTINGS_KEY, s);
      if (recChanged) this.write(RECORDS_KEY, this.records);
    }

    onChange(fn) { this.listeners.push(fn); }
    emit() { this.listeners.forEach((fn) => fn()); }
    persistRecords() { this.write(RECORDS_KEY, this.records); this.emit(); }
    persistSettings() { this.write(SETTINGS_KEY, this.settings); this.emit(); }

    // ---------- 기록 ----------
    get(k) { return this.records[k] || null; }

    static scores(r) { return (r && r.scores) || []; }
    // 뽀모도로(타이머로 기록된 공부) 개수
    static tomatoes(r) { return ((r && r.sessions) || []).length; }
    static hasActivity(r) {
      return !!r && (r.minutes > 0 || (r.sessions && r.sessions.length > 0) || (r.parts && r.parts.length > 0) ||
        r.vocab > 0 || Store.scores(r).length > 0 || !!(r.memo && r.memo.trim()) || !!r.mood);
    }

    saveRecord(k, r) {
      if (Store.hasActivity(r)) this.records[k] = r;
      else delete this.records[k];
      this.persistRecords();
    }
    deleteRecord(k) {
      delete this.records[k];
      this.persistRecords();
    }

    activeKeys() { return Object.keys(this.records).filter((k) => Store.hasActivity(this.records[k])).sort(); }

    // 하루 목표 대비 학습량 단계 (캘린더 색 진하기)
    level(min) {
      if (!min) return 0;
      const g = this.settings.daily || 60;
      if (min < g * 0.5) return 1;
      if (min < g) return 2;
      if (min < g * 2) return 3;
      return 4;
    }

    // 연속 학습일: 오늘 기록이 없으면 어제부터 센다
    streak() {
      let n = 0;
      const d = new Date();
      if (!Store.hasActivity(this.records[keyOf(d)])) d.setDate(d.getDate() - 1);
      while (Store.hasActivity(this.records[keyOf(d)])) { n++; d.setDate(d.getDate() - 1); }
      return n;
    }
    minutesInMonth(y, m) {
      const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
      return Object.keys(this.records).filter((k) => k.startsWith(prefix)).reduce((s, k) => s + (this.records[k].minutes || 0), 0);
    }
    todayMinutes() { return (this.records[todayKey()] && this.records[todayKey()].minutes) || 0; }

    // ---------- 뽀모도로 세션 ----------
    findSession(k, id) { return ((this.records[k] && this.records[k].sessions) || []).find((s) => s.id === id) || null; }

    // extra: { minutes: 실제 집중한 분(일시정지 제외), pauses: [[멈춘 시각, 다시 시작한 시각], ...] }
    addSession(start, end, extra = {}) {
      const k = keyOf(new Date(start));
      const minutes = extra.minutes != null ? extra.minutes : Math.max(1, Math.round((end - start) / 60000));
      const r = this.records[k] || emptyRecord();
      r.sessions = r.sessions || [];
      const s = { id: String(end), start, end, minutes, parts: [], note: "" };
      if (extra.pauses && extra.pauses.length) s.pauses = extra.pauses;
      r.sessions.push(s);
      r.minutes = (r.minutes || 0) + minutes;
      this.records[k] = r;
      this.persistRecords();
      return { k, s };
    }
    updateSession(k, id, parts, note) {
      const s = this.findSession(k, id);
      if (!s) return;
      s.parts = parts;
      s.note = note;
      // 세션에서 고른 과목을 그날 기록의 과목에도 반영 (설정의 과목 순서대로)
      const r = this.records[k];
      r.parts = this.sortSubjects([...new Set([...(r.parts || []), ...parts])]);
      this.persistRecords();
    }
    // 집중 뒤에 쉰 시간(분)을 그 집중 기록에 남김 (공부 시간에는 포함하지 않음)
    setSessionRest(k, id, minutes) {
      const s = this.findSession(k, id);
      if (!s) return;
      s.rest = minutes;
      this.persistRecords();
    }

    deleteSession(k, id) {
      const r = this.records[k];
      const s = this.findSession(k, id);
      if (!s) return;
      r.sessions = r.sessions.filter((x) => x.id !== id);
      r.minutes = Math.max(0, (r.minutes || 0) - s.minutes);
      if (!Store.hasActivity(r)) delete this.records[k];
      this.persistRecords();
    }
    // 직전 세션에서 고른 파트 (다음 세션 기록 시 기본값으로 사용)
    lastSessionParts(k, exceptId) {
      const prev = ((this.records[k] && this.records[k].sessions) || []).filter((x) => x.id !== exceptId && x.parts.length).pop();
      return prev ? prev.parts : [];
    }

    // ---------- 과목 ----------
    get subjects() { return this.settings.subjects; }
    addSubject(name) {
      name = String(name || "").trim().slice(0, 12);
      if (!name || this.settings.subjects.includes(name)) return false;
      this.settings.subjects.push(name);
      this.persistSettings();
      return true;
    }
    removeSubject(name) {
      this.settings.subjects = this.settings.subjects.filter((x) => x !== name);
      this.persistSettings();
    }
    sortSubjects(list) {
      const order = this.settings.subjects;
      const idx = (x) => (order.includes(x) ? order.indexOf(x) : 999);
      return list.slice().sort((a, b) => idx(a) - idx(b) || a.localeCompare(b));
    }

    // ---------- 시험 일정 (이름 있는 시험 여러 개) ----------
    examsOn(k) { return this.settings.exams.filter((e) => e.date === k); }
    isExam(k) { return this.settings.exams.some((e) => e.date === k); }
    addExam(date, name) {
      const e = { id: newId(), date, name: String(name).trim().slice(0, 20), score: null, pass: null };
      this.settings.exams.push(e);
      this.settings.exams.sort((a, b) => a.date.localeCompare(b.date));
      this.persistSettings();
      return e;
    }
    updateExam(id, patch) {
      const e = this.settings.exams.find((x) => x.id === id);
      if (!e) return;
      Object.assign(e, patch);
      this.persistSettings();
    }
    deleteExam(id) {
      this.settings.exams = this.settings.exams.filter((x) => x.id !== id);
      this.persistSettings();
    }
    findExam(id) { return this.settings.exams.find((x) => x.id === id) || null; }
    // 오늘 이후 가장 가까운 시험 (같은 날이면 먼저 등록한 것)
    nextExam() { return this.settings.exams.find((e) => e.date >= todayKey()) || null; }
    // 이름 후보: 과목 + 시험 이름 + 점수 기록 이름
    knownNames() {
      const names = [...this.settings.subjects, ...this.settings.exams.map((e) => e.name)];
      Object.values(this.records).forEach((r) => Store.scores(r).forEach((x) => names.push(x.name)));
      return [...new Set(names.filter(Boolean))];
    }
    // 이름별 점수 추이: 날짜별 점수 기록 + 시험 결과 점수
    scoreSeries(name) {
      const pts = [];
      Object.keys(this.records).sort().forEach((k) => Store.scores(this.records[k]).forEach((x) => {
        if (x.name === name && x.score != null) pts.push({ k, v: x.score, detail: x.detail || "", exam: false });
      }));
      this.settings.exams.forEach((e) => {
        if (e.name === name && e.score != null) pts.push({ k: e.date, v: e.score, detail: e.pass == null ? "" : e.pass ? "합격" : "불합격", exam: true });
      });
      return pts.sort((a, b) => a.k.localeCompare(b.k));
    }
    scoredNames() { return this.knownNames().filter((n) => this.scoreSeries(n).length); }
    static ddayText(k) {
      const n = daysBetween(todayKey(), k);
      return n > 0 ? `D-${n}` : n === 0 ? "D-DAY" : `D+${-n}`;
    }

    // ---------- 설정 ----------
    updateSettings(patch) {
      Object.assign(this.settings, patch);
      this.persistSettings();
    }
    updatePomo(patch, silent) {
      Object.assign(this.settings.pomo, patch);
      if (silent) this.write(SETTINGS_KEY, this.settings);
      else this.persistSettings();
    }

    // ---------- 클라우드 동기화 (CloudSync가 사용) ----------
    snapshot() { return { settings: this.settings, records: this.records }; }

    // 시험·과목 목록 합치기 (같은 id 또는 같은 날짜+이름의 시험은 이 기기 것 유지)
    mergeLists(settings) {
      let changed = false;
      (settings.exams || []).forEach((e) => {
        if (typeof e === "string") e = { id: newId() + e, date: e, name: OLD_TOEIC, score: null, pass: null };
        if (this.settings.exams.some((x) => x.id === e.id || (x.date === e.date && x.name === e.name))) return;
        this.settings.exams.push(e);
        changed = true;
      });
      this.settings.exams.sort((a, b) => a.date.localeCompare(b.date));
      (settings.subjects || []).forEach((n) => { if (!this.settings.subjects.includes(n)) { this.settings.subjects.push(n); changed = true; } });
      return changed;
    }

    // 계정에서 내려받은 기록 합치기: 같은 날짜는 이 기기 우선, 한쪽에만 있으면 가져옴. 시험·과목은 양쪽 합침
    mergeRemote(remote) {
      if (!remote) return;
      let changed = false;
      Object.entries(remote.records || {}).forEach(([k, r]) => {
        if (!this.records[k]) { this.records[k] = r; changed = true; }
      });
      if (remote.settings && this.mergeLists(remote.settings)) changed = true;
      if (!changed) return;
      this.migrate();
      this.write(RECORDS_KEY, this.records);
      this.write(SETTINGS_KEY, this.settings);
      this.emit();
    }

    // ---------- 백업 ----------
    exportJson() {
      const data = { app: "DailyToeic", version: 2, exportedAt: new Date().toISOString(), settings: this.settings, records: this.records };
      if (this.workouts) data.workouts = this.workouts.records; // 운동모드 기록 (WorkoutStore)
      return JSON.stringify(data, null, 2);
    }
    importData(data) {
      if (!data || typeof data.records !== "object") throw new Error("형식 오류");
      Object.assign(this.records, data.records);
      if (data.settings) {
        this.mergeLists(data.settings);
        this.settings.pomo = Object.assign({}, this.settings.pomo, data.settings.pomo);
        if (data.settings.daily != null) this.settings.daily = data.settings.daily;
        if (data.settings.workout) this.settings.workout = Object.assign({}, this.settings.workout, data.settings.workout);
      }
      if (data.workouts && this.workouts) this.workouts.importData(data.workouts);
      this.migrate(); // 예전 형식 백업(토익 LC·RC 등)도 지금 형식으로
      this.write(RECORDS_KEY, this.records);
      this.write(SETTINGS_KEY, this.settings);
      this.emit();
      return Object.keys(data.records).length;
    }
  }

  Store.emptyRecord = emptyRecord;
  DT.Store = Store;
})();
