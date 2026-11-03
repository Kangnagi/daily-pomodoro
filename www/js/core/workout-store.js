// 운동 기록 저장소 (운동모드). 공부 기록과 따로 localStorage "dailyToeic.workouts"에 날짜별로 보관
//   캘린더·1년 보기가 공부 Store와 같은 방식으로 쓸 수 있게 records/get/level/streak/minutesInMonth 등을 맞춰 둠
//   바뀌면 공부 Store의 emit()으로 알려서 화면들이 한 번에 다시 그려지게 함
//
//   records[날짜] = {
//     minutes,                       // 운동 시간(분) = 운동 타이머(스톱워치)로 잰 시간. 없으면 유산소 시간 합으로 계산
//     sessions: [{ start, end, minutes }],   // 운동 타이머 기록 (일시정지 뺀 시간)
//     sets,                          // 휴식 타이머로 끝낸 세트 수
//     strength: [{ name, sets: [{ kg, reps }] }],   // 근력: 종목별 세트(무게·횟수)
//     cardio: [{ name, min, km }],   // 유산소: 종목·시간(분)·거리(km)
//     parts: ["가슴", ...],          // 운동 부위
//     weight,                        // 몸무게(kg)
//     mood, memo
//   }
(() => {
  "use strict";
  const { keyOf, todayKey } = DT.utils;

  const WORKOUT_KEY = "dailyToeic.workouts";
  const PARTS = ["가슴", "등", "어깨", "팔", "하체", "복근", "전신", "유산소"];
  const DEFAULT_STRENGTH = ["벤치프레스", "스쿼트", "데드리프트", "숄더프레스", "랫풀다운", "바벨로우", "푸시업", "턱걸이", "레그프레스", "덤벨컬"];
  const DEFAULT_CARDIO = ["러닝", "걷기", "사이클", "줄넘기", "수영", "계단 오르기"];
  const DEFAULT_SETTINGS = { daily: 60, rest: 90 }; // 하루 목표 운동 시간(분), 세트 사이 휴식(초)

  const emptyRecord = () => ({ minutes: 0, sessions: [], sets: 0, strength: [], cardio: [], parts: [], weight: null, mood: null, memo: "" });

  class WorkoutStore {
    constructor(store) {
      this.store = store; // 공부 Store (설정·알림 공유)
      this.records = DT.Store.read(WORKOUT_KEY, {});
      store.settings.workout = Object.assign({}, DEFAULT_SETTINGS, store.settings.workout);
      store.workouts = this; // 백업 내보내기/가져오기에서 같이 다룸
    }

    get settings() { return { daily: this.store.settings.workout.daily }; }
    get prefs() { return this.store.settings.workout; }
    updatePrefs(patch) { Object.assign(this.store.settings.workout, patch); this.store.persistSettings(); }

    persist() { this.store.write(WORKOUT_KEY, this.records); this.store.emit(); }

    get(k) { return this.records[k] || null; }
    getOrNew(k) { return this.records[k] ? JSON.parse(JSON.stringify(this.records[k])) : emptyRecord(); }

    static hasActivity(r) {
      return !!r && (r.minutes > 0 || (r.sessions || []).length > 0 || r.sets > 0 || (r.strength || []).length > 0 ||
        (r.cardio || []).length > 0 || (r.parts || []).length > 0 || r.weight != null || !!r.mood || !!(r.memo && r.memo.trim()));
    }
    // 그날 운동 시간: 타이머로 잰 시간, 없으면 유산소 시간 합
    static minutesOf(r) {
      if (!r) return 0;
      if (r.minutes) return r.minutes;
      return (r.cardio || []).reduce((s, c) => s + (Number(c.min) || 0), 0);
    }
    static setCount(r) { return ((r && r.strength) || []).reduce((s, e) => s + e.sets.length, 0); }
    static volume(r) { return ((r && r.strength) || []).reduce((s, e) => s + e.sets.reduce((t, x) => t + (Number(x.kg) || 0) * (Number(x.reps) || 0), 0), 0); }
    static distance(r) { return ((r && r.cardio) || []).reduce((s, c) => s + (Number(c.km) || 0), 0); }

    save(k, r) {
      if (WorkoutStore.hasActivity(r)) this.records[k] = r;
      else delete this.records[k];
      this.persist();
    }
    remove(k) { delete this.records[k]; this.persist(); }

    activeKeys() { return Object.keys(this.records).filter((k) => WorkoutStore.hasActivity(this.records[k])).sort(); }

    // ---------- 캘린더가 쓰는 공통 모양 (공부 Store와 같은 이름) ----------
    level(min) {
      if (!min) return 0;
      const g = this.prefs.daily || 60;
      if (min < g * 0.5) return 1;
      if (min < g) return 2;
      if (min < g * 2) return 3;
      return 4;
    }
    streak() {
      let n = 0;
      const d = new Date();
      if (!WorkoutStore.hasActivity(this.records[keyOf(d)])) d.setDate(d.getDate() - 1);
      while (WorkoutStore.hasActivity(this.records[keyOf(d)])) { n++; d.setDate(d.getDate() - 1); }
      return n;
    }
    minutesInMonth(y, m) {
      const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
      return Object.keys(this.records).filter((k) => k.startsWith(prefix)).reduce((s, k) => s + WorkoutStore.minutesOf(this.records[k]), 0);
    }
    todayMinutes() { return WorkoutStore.minutesOf(this.records[todayKey()]); }
    isExam() { return false; }
    examsOn() { return []; }

    // ---------- 운동 타이머 ----------
    addSession(start, end, minutes) {
      const k = keyOf(new Date(start));
      const r = this.records[k] || emptyRecord();
      r.sessions = r.sessions || [];
      r.sessions.push({ start, end, minutes });
      r.minutes = (r.minutes || 0) + minutes;
      this.records[k] = r;
      this.persist();
      return { k };
    }
    // 휴식 타이머로 세트 하나를 끝냄
    addSet(k = todayKey()) {
      const r = this.records[k] || emptyRecord();
      r.sets = (r.sets || 0) + 1;
      this.records[k] = r;
      this.persist();
      return r.sets;
    }

    // ---------- 이름 후보·몸무게·최고 기록 ----------
    names(kind) {
      const used = [];
      Object.values(this.records).forEach((r) => (r[kind] || []).forEach((e) => used.push(e.name)));
      return [...new Set([...used.reverse(), ...(kind === "strength" ? DEFAULT_STRENGTH : DEFAULT_CARDIO)])].filter(Boolean);
    }
    // 날짜순 몸무게 [{k, v}]
    weights() { return this.activeKeys().filter((k) => this.records[k].weight != null).map((k) => ({ k, v: Number(this.records[k].weight) })); }
    latestWeight() { const w = this.weights(); return w.length ? w[w.length - 1] : null; }
    // 종목별 최고 무게 [{name, kg, reps, k}]
    bests() {
      const best = {};
      this.activeKeys().forEach((k) => (this.records[k].strength || []).forEach((e) => e.sets.forEach((s) => {
        const kg = Number(s.kg) || 0;
        if (!kg) return;
        const b = best[e.name];
        if (!b || kg > b.kg || (kg === b.kg && (Number(s.reps) || 0) > b.reps)) best[e.name] = { name: e.name, kg, reps: Number(s.reps) || 0, k };
      })));
      return Object.values(best).sort((a, b) => b.kg - a.kg);
    }

    // ---------- 백업 ----------
    importData(records) {
      if (!records || typeof records !== "object") return 0;
      Object.assign(this.records, records);
      this.store.write(WORKOUT_KEY, this.records);
      return Object.keys(records).length;
    }
  }

  WorkoutStore.PARTS = PARTS;
  WorkoutStore.emptyRecord = emptyRecord;
  DT.WorkoutStore = WorkoutStore;
})();
