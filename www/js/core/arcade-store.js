// 아케이드 엔진: 뽀모도로 화폐, 경험치·레벨, 업적·칭호 (docs/아케이드_기획안.md 1~3장)
//   화폐와 경험치는 따로 저장하지 않고 공부·운동 "타이머" 기록에서 매번 계산 → 기록을 고치거나 지워도 숫자가 어긋나지 않음
//   저장하는 것(localStorage "dailyToeic.arcade"): 달성한 업적과 날짜, 쓴 화폐, 고른 칭호, 닉네임, 쓴 뽑기권, 정산 날짜, 마지막으로 알린 레벨
//
//   화폐 (모두 조각 단위로 계산, 화면에는 큰 단위부터 = 자동 합치기)
//     토마토 조각 = 타이머 1시간 · 초록 = 조각 10 · 노랑 = 조각 50 · 빨강 = 조각 100
//     번 화폐 = (공부 + 운동 타이머 총 분 ÷ 60)의 몫 + 레벨업 보상(레벨마다 조각 2)
//   경험치 = 타이머 1분당 1 + 달성한 업적의 보너스 경험치
//   레벨 n → n+1에 필요한 경험치 = 60 × (n + 1)
(() => {
  "use strict";
  const { daysBetween, todayKey } = DT.utils;
  const { WorkoutStore } = DT;

  const ARCADE_KEY = "dailyToeic.arcade";
  const UNIT = { red: 100, yellow: 50, green: 10, piece: 1 }; // 조각 몇 개짜리인지
  const LEVEL_PIECES = 2;   // 레벨업마다 받는 조각
  const TICKET_EVERY = 5;   // 이 레벨마다 뽑기권 1장
  // levelSeen: 마지막으로 알려준 레벨 (레벨업 배너용)
  // titlesSeen: 칭호 목록에서 이미 본 칭호 (새 칭호에 NEW 표시용)
  const DEFAULT = { achievements: {}, spent: 0, title: null, nickname: "", ticketsUsed: 0, settledAt: null, levelSeen: 1, titlesSeen: [] };

  const xpToNext = (level) => 60 * (level + 1);

  class ArcadeStore {
    // store: 공부 Store, workouts: WorkoutStore
    constructor(store, workouts) {
      this.store = store;
      this.workouts = workouts;
      this.data = Object.assign({}, DEFAULT, DT.Store.read(ARCADE_KEY, {}));
      this.data.achievements = this.data.achievements || {};
      store.arcade = this; // 백업 내보내기/가져오기에서 같이 다룸
    }

    persist() { this.store.write(ARCADE_KEY, this.data); }

    // ---------- 타이머 시간 ----------
    // 공부: 뽀모도로 기록(일시정지 뺀 집중 시간) / 운동: 운동 타이머 기록. 직접 입력한 시간은 세지 않음
    static studyMinutesOf(r) { return ((r && r.sessions) || []).reduce((s, x) => s + (x.minutes || 0), 0); }
    static workoutMinutesOf(r) { return ((r && r.sessions) || []).reduce((s, x) => s + (x.minutes || 0), 0); }

    minutes() {
      const study = Object.values(this.store.records).reduce((s, r) => s + ArcadeStore.studyMinutesOf(r), 0);
      const workout = Object.values(this.workouts.records).reduce((s, r) => s + ArcadeStore.workoutMinutesOf(r), 0);
      return { study, workout, total: study + workout };
    }

    // ---------- 경험치·레벨 ----------
    achievementXp() {
      return DT.ACHIEVEMENTS.reduce((s, a) => s + (this.data.achievements[a.id] ? a.xp : 0), 0);
    }
    xp() { return this.minutes().total + this.achievementXp(); }

    // 경험치 → { level, into(이번 레벨에서 쌓은 양), need(다음 레벨까지 필요한 양), xp }
    static levelOf(xp) {
      let level = 1, rest = xp;
      while (rest >= xpToNext(level)) { rest -= xpToNext(level); level++; }
      return { level, into: rest, need: xpToNext(level), xp };
    }
    level() { return ArcadeStore.levelOf(this.xp()); }

    // ---------- 화폐 ----------
    earned() {
      const { total } = this.minutes();
      return Math.floor(total / 60) + LEVEL_PIECES * (this.level().level - 1);
    }
    balance() { return Math.max(0, this.earned() - this.data.spent); }

    // 조각 수 → 큰 단위부터 나눔 (예: 137 → 빨강 1, 노랑 0, 초록 3, 조각 7)
    static breakdown(pieces) {
      let rest = pieces;
      const out = {};
      ["red", "yellow", "green", "piece"].forEach((k) => { out[k] = Math.floor(rest / UNIT[k]); rest -= out[k] * UNIT[k]; });
      return out;
    }
    wallet() {
      const total = this.minutes().total;
      const balance = this.balance();
      return Object.assign(ArcadeStore.breakdown(balance), { balance, nextPieceMin: 60 - (total % 60) });
    }
    // 화폐 쓰기 (조각 단위). 모자라면 false
    spend(pieces) {
      if (pieces > this.balance()) return false;
      this.data.spent += pieces;
      this.persist();
      this.store.emit();
      return true;
    }

    // ---------- 뽑기권 ----------
    tickets() { return Math.max(0, Math.floor(this.level().level / TICKET_EVERY) - this.data.ticketsUsed); }

    // ---------- 업적 ----------
    // 공부·운동·시험 기록을 날짜순으로 훑으며 누적 통계를 쌓고, 업적마다 처음 목표를 넘은 날을 찾음
    timeline() {
      const S = this.store.records, W = this.workouts.records;
      const daily = this.store.settings.daily || 0;
      const passDates = (this.store.settings.exams || []).filter((e) => e.pass === true).map((e) => e.date);
      const keys = [...new Set([...Object.keys(S), ...Object.keys(W), ...passDates])].sort();

      const st = {
        studyMin: 0, workoutMin: 0, studyHours: 0, workoutHours: 0, pomodoros: 0, workoutDays: 0,
        studyStreak: 0, workoutStreak: 0, bestDayHours: 0, earlyStarts: 0, lateStarts: 0,
        goalDays: 0, examPasses: 0, weightLogs: 0, prCount: 0, bothDays: 0,
      };
      let runStudy = 0, lastStudy = null, runWorkout = 0, lastWorkout = null;
      const best = {}; // 종목별 최고 무게
      const met = {};  // 업적 id → 처음 달성한 날

      keys.forEach((k) => {
        const r = S[k], w = W[k];
        // 공부
        const dayStudy = ArcadeStore.studyMinutesOf(r);
        (r && r.sessions || []).forEach((x) => {
          st.pomodoros++;
          const h = new Date(x.start).getHours();
          if (h >= 4 && h < 6) st.earlyStarts++;   // 오전 4~6시에 시작 = 새벽
          else if (h < 4) st.lateStarts++;          // 자정~새벽 4시에 시작 = 올빼미
        });
        if (dayStudy > 0) {
          runStudy = lastStudy && daysBetween(lastStudy, k) === 1 ? runStudy + 1 : 1;
          lastStudy = k;
          st.studyStreak = Math.max(st.studyStreak, runStudy);
          st.bestDayHours = Math.max(st.bestDayHours, dayStudy / 60);
          if (daily && dayStudy >= daily) st.goalDays++;
        }
        st.studyMin += dayStudy;
        // 운동
        const dayWorkout = ArcadeStore.workoutMinutesOf(w);
        if (w && WorkoutStore.hasActivity(w)) {
          st.workoutDays++;
          runWorkout = lastWorkout && daysBetween(lastWorkout, k) === 1 ? runWorkout + 1 : 1;
          lastWorkout = k;
          st.workoutStreak = Math.max(st.workoutStreak, runWorkout);
          if (w.weight != null) st.weightLogs++;
          (w.strength || []).forEach((e) => e.sets.forEach((s) => {
            const kg = Number(s.kg) || 0;
            if (!kg) return;
            if (best[e.name] && kg > best[e.name]) st.prCount++; // 처음 기록은 경신이 아님
            best[e.name] = Math.max(best[e.name] || 0, kg);
          }));
        }
        st.workoutMin += dayWorkout;
        if (dayStudy >= 120 && dayWorkout >= 60) st.bothDays++;
        // 시험 합격
        st.examPasses += passDates.filter((d) => d === k).length;

        st.studyHours = st.studyMin / 60;
        st.workoutHours = st.workoutMin / 60;
        DT.ACHIEVEMENTS.forEach((a) => { if (!met[a.id] && st[a.stat] >= a.goal) met[a.id] = k; });
      });
      return { stats: st, met };
    }

    // 업적 목록 + 진행 상황 (달성 날짜는 저장된 것 우선)
    achievements() {
      const { stats, met } = this.timeline();
      return DT.ACHIEVEMENTS.map((a) => {
        const done = this.data.achievements[a.id] || null;
        return Object.assign({}, a, {
          done,                                   // 저장된 달성 날짜 (없으면 null)
          ready: !done && !!met[a.id],            // 조건은 채웠지만 아직 달성 처리 안 됨
          metDate: met[a.id] || null,
          value: Math.min(a.goal, Math.floor((stats[a.stat] || 0) * 10) / 10),
        });
      });
    }

    // 조건을 채운 새 업적을 달성 처리하고 그 목록을 돌려줌 (정산·알림에서 사용)
    unlockReady() {
      const fresh = this.achievements().filter((a) => a.ready);
      if (!fresh.length) return [];
      fresh.forEach((a) => (this.data.achievements[a.id] = a.metDate || todayKey()));
      this.persist();
      return fresh;
    }

    // ---------- 칭호·닉네임 ----------
    // 고를 수 있는 칭호: 달성한 업적의 칭호 + 도달한 레벨 칭호
    titles() {
      const lv = this.level().level;
      const fromAch = DT.ACHIEVEMENTS.filter((a) => this.data.achievements[a.id]).map((a) => ({ title: a.title, from: a.name }));
      const fromLevel = Object.entries(DT.LEVEL_TITLES).filter(([n]) => lv >= Number(n)).map(([n, t]) => ({ title: t, from: `레벨 ${n}` }));
      return [...fromLevel, ...fromAch];
    }
    // 아직 칭호 목록에서 못 본 새 칭호들 (Set)
    newTitles() {
      const seen = new Set(this.data.titlesSeen || []);
      return new Set(this.titles().map((t) => t.title).filter((t) => !seen.has(t)));
    }
    // 칭호 목록을 열었을 때: 지금 가진 칭호를 모두 본 것으로 (다음에 열면 NEW가 사라짐)
    markTitlesSeen() {
      const all = new Set([...(this.data.titlesSeen || []), ...this.titles().map((t) => t.title)]);
      if (all.size === (this.data.titlesSeen || []).length) return;
      this.data.titlesSeen = [...all];
      this.persist();
    }
    setTitle(title) {
      this.data.title = title && this.titles().some((t) => t.title === title) ? title : null;
      this.persist();
      this.store.emit();
    }
    setNickname(name) {
      this.data.nickname = String(name || "").trim().slice(0, 12);
      this.persist();
      this.store.emit();
    }

    // 백업 가져오기: 업적은 합치고(먼저 달성한 날짜), 쓴 화폐는 큰 쪽, 칭호·닉네임은 비어 있을 때만
    importData(d) {
      if (!d || typeof d !== "object") return;
      Object.entries(d.achievements || {}).forEach(([id, date]) => {
        const cur = this.data.achievements[id];
        if (!cur || date < cur) this.data.achievements[id] = date;
      });
      this.data.spent = Math.max(this.data.spent || 0, d.spent || 0);
      this.data.ticketsUsed = Math.max(this.data.ticketsUsed || 0, d.ticketsUsed || 0);
      this.data.levelSeen = Math.max(this.data.levelSeen || 1, d.levelSeen || 1);
      this.data.titlesSeen = [...new Set([...(this.data.titlesSeen || []), ...(d.titlesSeen || [])])];
      if (!this.data.title && d.title) this.data.title = d.title;
      if (!this.data.nickname && d.nickname) this.data.nickname = d.nickname;
      if (!this.data.settledAt && d.settledAt) this.data.settledAt = d.settledAt;
      this.persist();
    }

    // 한눈에 (프로필·테스트용)
    summary() {
      const m = this.minutes();
      return { minutes: m, level: this.level(), wallet: this.wallet(), tickets: this.tickets(), title: this.data.title, nickname: this.data.nickname };
    }
  }

  ArcadeStore.UNIT = UNIT;
  DT.ArcadeStore = ArcadeStore;
})();
