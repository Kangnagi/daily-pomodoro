// 아케이드: 업적과 레벨 칭호 정의 (데이터만. 계산은 arcade-store.js)
//   업적 하나 = { id, cat(분류), name(업적 이름), title(달성하면 받는 칭호), xp(보너스 경험치), goal(목표값), stat(누적 통계 이름), unit, hidden }
//   stat 값이 goal 이상이 되는 날 달성. 통계는 날짜순으로 기록을 훑으며 쌓음 (ArcadeStore.timeline)
(() => {
  "use strict";

  // 같은 모양의 여러 단계를 한 번에 만드는 도우미
  const steps = (cat, idBase, stat, unit, list) =>
    list.map(([goal, name, title, xp]) => ({ id: `${idBase}_${goal}`, cat, name, title, xp, goal, stat, unit }));

  const ACHIEVEMENTS = [
    // 처음
    { id: "first_pomodoro", cat: "처음", name: "첫 뽀모도로 완료", title: "첫걸음", xp: 30, goal: 1, stat: "pomodoros", unit: "개" },
    { id: "first_workout", cat: "처음", name: "첫 운동 기록", title: "땀 한 방울", xp: 30, goal: 1, stat: "workoutDays", unit: "일" },

    // 공부 누적 (타이머 시간)
    ...steps("공부 누적", "study_hours", "studyHours", "시간", [
      [10, "공부 10시간", "공부 입문자", 100],
      [50, "공부 50시간", "성실한 학생", 300],
      [100, "공부 100시간", "100시간의 주인공", 600],
      [300, "공부 300시간", "공부 장인", 1000],
      [500, "공부 500시간", "전설의 수험생", 2000],
    ]),

    // 운동 누적 (운동 타이머 시간)
    ...steps("운동 누적", "workout_hours", "workoutHours", "시간", [
      [10, "운동 10시간", "운동 입문자", 100],
      [50, "운동 50시간", "땀의 기록", 300],
      [100, "운동 100시간", "강철 체력", 600],
    ]),

    // 연속
    ...steps("연속", "study_streak", "studyStreak", "일", [
      [3, "3일 연속 공부", "작심삼일 극복", 50],
      [7, "7일 연속 공부", "일주일 개근", 150],
      [30, "30일 연속 공부", "한 달의 기적", 500],
      [100, "100일 연속 공부", "백일의 약속", 1500],
    ]),
    ...steps("연속", "workout_streak", "workoutStreak", "일", [
      [7, "7일 연속 운동", "운동 습관", 150],
      [30, "30일 연속 운동", "운동 중독", 500],
    ]),

    // 하루
    ...steps("하루", "day_hours", "bestDayHours", "시간", [
      [4, "하루 4시간 공부", "몰입", 100],
      [8, "하루 8시간 공부", "공부 기계", 300],
    ]),

    // 시간대
    { id: "early_bird", cat: "시간대", name: "오전 6시 전에 공부 시작", title: "새벽형 인간", xp: 100, goal: 1, stat: "earlyStarts", unit: "번" },
    { id: "night_owl", cat: "시간대", name: "자정 넘어 공부", title: "올빼미", xp: 50, goal: 1, stat: "lateStarts", unit: "번" },

    // 목표 (설정의 하루 목표 공부 시간)
    ...steps("목표", "goal_days", "goalDays", "번", [
      [10, "하루 목표 10번 달성", "목표 달성러", 150],
      [50, "하루 목표 50번 달성", "목표 사냥꾼", 500],
    ]),

    // 시험
    ...steps("시험", "exam_pass", "examPasses", "번", [
      [1, "시험 합격", "합격자", 500],
      [3, "시험 3번 합격", "합격 수집가", 1500],
    ]),

    // 운동 기록
    { id: "weight_30", cat: "운동", name: "몸무게 30번 기록", title: "기록하는 몸", xp: 200, goal: 30, stat: "weightLogs", unit: "번" },
    { id: "pr_10", cat: "운동", name: "최고 무게 10번 경신", title: "기록 갱신자", xp: 300, goal: 10, stat: "prCount", unit: "번" },

    // 숨은 업적 (조건을 보여주지 않음)
    { id: "hidden_marathon", cat: "숨은 업적", name: "하루 12시간 공부", title: "인간 타이머", xp: 500, goal: 12, stat: "bestDayHours", unit: "시간", hidden: true },
    { id: "hidden_both", cat: "숨은 업적", name: "같은 날 공부 2시간 + 운동 1시간 30번", title: "문무겸비", xp: 400, goal: 30, stat: "bothDays", unit: "일", hidden: true },
  ];

  // 레벨 칭호 (5레벨마다)
  const LEVEL_TITLES = { 5: "새싹", 10: "꾸준러", 15: "성실왕", 20: "집중의 달인", 25: "시간의 지배자", 30: "전설" };

  DT.ACHIEVEMENTS = ACHIEVEMENTS;
  DT.LEVEL_TITLES = LEVEL_TITLES;
})();
