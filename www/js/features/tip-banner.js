// 홈 배너: 앱 사용 팁 + 공부 동기부여 문구 + 내 기록에 맞춘 한마디. 터치할 때마다 바뀜
// (시험 D-day는 위쪽 요약 카드와 캘린더에서 보여주므로 여기선 표시하지 않음)
(() => {
  "use strict";
  const { $, todayKey, fmtMin } = DT.utils;

  // 앱 사용 팁
  const TIPS = [
    "미래 날짜를 누르고 ‘＋ 시험 추가’를 누르면 D-day가 떠요",
    "캘린더를 두 손가락으로 오므리면 1년 학습량을 한눈에 볼 수 있어요",
    "캘린더를 좌우로 밀면 다음 달, 이전 달로 넘어가요",
    "타이머 원판을 돌려서 집중 시간을 맞출 수 있어요",
    "집중이 끝나면 쉰 만큼 초록 원판이 차올라요. ‘다시 집중’으로 이어가요",
    "토요일엔 파란 ‘이 주 요약’, 마지막 날엔 빨간 ‘이 달 요약’을 확인해 보세요",
    "뽀모도로 기록 칸을 누르면 공부한 과목과 내용을 고칠 수 있어요",
    "설정에서 공부 과목을 추가하면 통계에서 과목별 공부 시간을 볼 수 있어요",
    "날짜를 누르고 ‘＋ 시험 추가’로 시험 이름과 D-day를 등록해 보세요",
    "시험이 끝나면 그 날짜의 시험 칩을 눌러 점수와 합격 여부를 남겨요",
    "설정에서 하루 목표 시간을 정하면 달성한 날에 ✓가 붙어요",
    "기록은 이 기기에만 저장돼요. 설정에서 가끔 백업해 두세요",
    "설정의 테마에서 밝은 테마와 어두운 테마를 고를 수 있어요",
    "위쪽 운동모드 버튼을 누르면 운동모드로 바꿔 운동 일지를 쓸 수 있어요",
    "지난 날짜의 ‘공부한 시간’에서 그날 타이머 기록을 다시 볼 수 있어요",
  ];

  // 공부 동기부여 문구
  const QUOTES = [
    "오늘 외운 단어 하나가 시험장에서 1점이 돼요",
    "완벽한 하루보다 꾸준한 하루가 점수를 올려요",
    "25분만 집중해 봐요. 시작이 제일 어려워요",
    "어제의 나보다 한 문제만 더 맞히면 성공이에요",
    "틀린 문제는 다음에 맞힐 문제예요",
    "쉬고 싶은 마음, 딱 10분만 미뤄볼까요?",
    "목표 점수는 하루하루 쌓인 공부 시간의 합이에요",
    "어려운 과목일수록 짧게, 자주 만나요",
    "공부한 시간은 배신하지 않아요",
    "작은 진전도 진전이에요. 오늘도 한 칸 채워볼까요?",
    "복습은 잊기 직전에! 어제 공부한 걸 5분만 다시 봐요",
    "No pain, no gain — 오늘의 노력이 내일의 점수!",
    "Slow and steady wins the race",
  ];

  // 운동모드 팁·응원
  const WORKOUT_TIPS = [
    "날짜를 누르고 ‘운동 시작’으로 운동 시간과 세트 사이 휴식을 잴 수 있어요",
    "세트가 끝나면 ‘세트 완료’를 누르세요. 휴식이 끝나면 삐삐삐로 알려줘요",
    "운동 일지에서 ‘＋ 세트’를 누르면 바로 위 세트의 무게·횟수가 그대로 채워져요",
    "운동 일지에 몸무게를 적으면 통계에서 몸무게 변화를 볼 수 있어요",
    "통계의 ‘종목별 최고 기록’에서 내 최고 무게를 확인해 보세요",
    "위쪽 공부모드 버튼을 누르면 공부모드로 돌아가요",
  ];
  const WORKOUT_QUOTES = [
    "오늘의 한 세트가 내일의 체력이에요",
    "운동은 하기 전이 제일 힘들어요. 일단 시작!",
    "무게보다 자세가 먼저예요",
    "쉬는 것도 운동이에요. 휴식 시간을 지켜 보세요",
    "어제보다 한 번만 더!",
    "물 한 컵 마시고 시작해요",
  ];

  class TipBanner {
    constructor(store, modes, workouts) {
      this.store = store;
      this.modes = modes;
      this.workouts = workouts;
      modes.onChange(() => { this.current = this.pick(); this.render(); });
      this.el = $("examBanner");
      this.current = null; // 지금 보여주는 문구
      this.el.setAttribute("role", "button");
      this.el.setAttribute("tabindex", "0");
      this.el.setAttribute("aria-label", "팁과 응원 문구 (누르면 바뀜)");
      this.el.addEventListener("click", () => this.next());
      this.el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.next(); } });
      store.onChange(() => this.render());
      this.current = this.pick();
      this.render();
    }

    // 내 기록에 맞춘 한마디
    personal() {
      if (this.modes.workout) return this.personalWorkout();
      const out = [];
      const s = this.store;
      const streak = s.streak();
      if (streak >= 2) out.push(`${streak}일 연속 공부 중! 오늘도 이어가 볼까요?`);
      const today = s.get(todayKey());
      const min = (today && today.minutes) || 0;
      const goal = s.settings.daily || 0;
      if (!min) out.push("오늘 첫 뽀모도로를 시작해 볼까요? 🍅");
      else if (goal && min >= goal) out.push(`오늘 ${fmtMin(min)} 공부! 목표 달성, 정말 잘했어요`);
      else if (goal) out.push(`오늘 목표까지 ${fmtMin(goal - min)} 남았어요. 조금만 더!`);
      return out.map((text) => ({ kind: "me", text }));
    }

    personalWorkout() {
      const out = [];
      const w = this.workouts;
      const streak = w.streak();
      if (streak >= 2) out.push(`${streak}일 연속 운동 중! 오늘도 이어가 볼까요?`);
      const min = w.todayMinutes();
      const goal = w.prefs.daily || 0;
      if (!min) out.push("오늘 운동을 시작해 볼까요?");
      else if (goal && min >= goal) out.push(`오늘 ${fmtMin(min)} 운동! 목표 달성`);
      else if (goal) out.push(`오늘 운동 목표까지 ${fmtMin(goal - min)} 남았어요`);
      return out.map((text) => ({ kind: "me", text }));
    }

    deck() {
      const workout = this.modes.workout;
      return [
        ...this.personal(),
        ...(workout ? WORKOUT_TIPS : TIPS).map((text) => ({ kind: "tip", text })),
        ...(workout ? WORKOUT_QUOTES : QUOTES).map((text) => ({ kind: "quote", text })),
      ];
    }

    // 방금 본 문구는 빼고 무작위로
    pick() {
      const items = this.deck().filter((it) => !this.current || it.text !== this.current.text);
      return items[Math.floor(Math.random() * items.length)];
    }

    next() {
      this.current = this.pick();
      this.render();
      this.el.classList.remove("tip-swap");
      void this.el.offsetWidth; // 애니메이션 다시 시작
      this.el.classList.add("tip-swap");
    }

    render() {
      this.el.classList.remove("none");
      this.el.classList.add("tip-mode");
      const badge = { tip: "팁", quote: "한마디", me: "나의 기록" }[this.current.kind];
      this.el.innerHTML = `<span class="tip-text"><b class="tip-kind ${this.current.kind}">${badge}</b>${this.current.text}</span>`;
    }
  }

  DT.TipBanner = TipBanner;
})();
