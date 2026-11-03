# Daily Study (옛 이름 Daily TOEIC) — Claude 작업 가이드

공부 기록 캘린더 + 타임타이머 스타일 뽀모도로 앱. 웹(www/)과 안드로이드 앱(Capacitor APK) 둘 다.
2026-10-15에 토익 전용 → 일반 공부 타이머로 방향 전환, 보이는 이름만 "Daily Study"로 바꿈.
**내부 이름은 그대로 둔다**: 폴더 DailyToeic, 패키지 com.kch.dailytoeic(바꾸면 다른 앱으로 설치돼 기록이 안 넘어감),
localStorage 키 dailyToeic.*, 백업 JSON의 app:"DailyToeic"(예전 백업 가져오기 호환), SW 캐시 이름 daily-toeic-vNN.
아이콘·스플래시는 `python tools/make_icons.py`로 다시 만든다 (LABEL="STUDY", APP_NAME="Daily Study").
지금까지의 요청·변경 내역과 겪은 문제는 `개발일지/개발기록.md`에 있다 (새 세션은 먼저 읽을 것).

## 사용자와 작업 규칙
- 사용자와는 **한국어**로 대화한다. 코드 주석도 한국어.
- **APK는 사용자가 "APK 새 버전으로 업데이트해줘"처럼 요청할 때만 만든다.** 기능 수정 후 자동으로 빌드하지 않는다.
  웹(www/)에서 확인하고 보고만 한다. 앱(WebView)에서만 확인 가능한 것(진동, 알림, 앱 오디오)은 "APK 업데이트 때 같이 확인"이라고 알린다.
  안드로이드 Java 문법 확인은 APK 없이 `gradlew :app:compileDebugJavaWithJavac` 로 한다.
- APK를 만들 때 **버전을 함께 올린다**: `www/js/app.js`의 `APP_VERSION`, `android/app/build.gradle`의 `versionCode`(+1)/`versionName`.
  설정 창 맨 아래에 "버전 · 태엽 소리 상태"가 보여서 사용자가 설치된 버전을 확인한다.
- www/ 파일을 고치면 `www/service-worker.js`의 `CACHE_NAME` 숫자를 올리고, 새 파일은 `ASSETS`에 추가한다.
- 기능은 **기능별 클래스 파일**로 나눈다 (`window.DT` 네임스페이스, ES 모듈 아님 → file:// 로 열어도 동작).
  새 파일은 `www/index.html`의 script 순서(core → features → app.js)와 SW `ASSETS`에 추가.
- 소리·진동은 **사람이 들을 수 없으니 반드시 측정으로 확인**: OfflineAudioContext로 렌더링해 길이·크기·주파수·무음 여부를 재고,
  "재생 함수가 호출됐다"만으로 확인 끝내지 말 것 (과거에 무음 파일을 재생해 놓고 정상이라고 착각한 적 있음).

## 운동모드 (2026-10-27 추가)
- 위쪽 버튼(예전 테마 버튼 자리) 💪/📖로 공부모드 ↔ 운동모드. 테마는 설정 창 "테마"(시스템/밝게/어둡게)로 옮김.
  `core/mode.js` ModeManager: localStorage `dailyToeic.mode`, `<body data-mode="workout">` → CSS 변수로 초록 계열(--primary, --lv1~4),
  제목 "Daily Workout". 모드를 바꾸면 메인으로(router.home).
- 데이터: `core/workout-store.js` WorkoutStore, localStorage `dailyToeic.workouts` (공부 기록과 별도, 형식은 파일 맨 위 주석).
  캘린더·1년 보기가 공부 Store와 같은 함수 이름(records/get/level/streak/minutesInMonth/todayMinutes/isExam/examsOn)으로 씀
  → CalendarView의 `store` getter가 모드에 따라 둘 중 하나를 돌려줌. 하루 운동 시간 = 타이머 시간, 없으면 유산소 시간 합(minutesOf).
  설정 `settings.workout = { daily(하루 목표 운동 분), rest(휴식 초) }`. 백업 JSON에 `workouts` 함께 내보내기/가져오기.
- 화면: `#wtimer` WorkoutScreen(workout-screen.js) + WorkoutTimer(workout-timer.js, 상태 `dailyToeic.wtimer`):
  운동 시간 스톱워치(일시정지 뺀 시간을 "운동 끝"에 세션으로 기록, 1분 미만은 기록 안 함) + 세트 사이 휴식(프리셋 0:30~3:00, ＋15초, 건너뛰기,
  "세트 완료"마다 그날 sets+1, 끝나면 삐삐삐+진동, 시스템 알림 ID 7003 예약 → NativeNotifier.scheduleAt/clear).
  `#wlog/날짜` WorkoutLogScreen: 근력(종목 카드, ＋세트는 윗줄 값 복사), 유산소(분·km), 부위 칩, 몸무게, 컨디션, 메모.
  `#wstats/날짜~day|week|month` WorkoutStatsScreen: 요약(운동 시간·세트·볼륨·유산소 거리·몸무게 변화), 하루 내용, 몸무게 그래프,
  최근 30일, 부위별(인체 픽토그램 BodyMap), 종목별 최고 무게, 전체 기록.
  BodyMap(body-map.js): 앞·뒤 모습 SVG 둥근 사각형 도형. 가슴·복근=앞, 등=뒤, 어깨·팔·하체=앞뒤. "전신"은 모든 부위 +1, "유산소"는 아래 따로.
  진하기 = 최다 부위 대비 4단계, 색은 --primary의 fill-opacity(.3/.5/.75/1), 안 한 부위는 회색 테두리. 부위를 누르면 "가슴 4회".
- 날짜 시트(운동모드): 오늘 = 운동 시작·통계·운동 일지 / 지난 날 = 통계·운동 일지(2칸) / 미래 = 아직 오픈 전. 시험 영역 숨김.
- 요약 카드(운동모드): [⚖️ 몸무게(최근)] [연속 운동] [이번 달] [오늘 운동], 캘린더 점 = 몸무게 기록, 범례 "운동량 · 몸무게".

## 현재 상태 (2026-10-28)
- 최신 APK: `builds/DailyTOEIC.apk` = **2.0** (versionCode 12, 운동모드 추가 기준으로 사용자가 2.0으로 정함). APK 이후 반영됐지만 아직 APK에 안 들어간 것:
  - 모드·테마를 바꿀 때 색이 0.7초 동안 섞이며 바뀜: style.css 맨 아래 `@property --primary/--primary-weak/--lv1~4`(색 타입 등록) + body transition.
    새 색 변수를 모드별로 바꾸게 되면 여기에도 등록해야 부드럽게 바뀜
  - 2.0 에뮬레이터 확인: 운동모드 전환(Daily Workout, 초록), 휴식 30초 → 앱 닫힌 상태에서 시스템 알림 7003 울림·4초 뒤 정리,
    알림 진동 [140,40,140,40,140], 운동 타이머 화면, 뒤로가기 wtimer → 메인, 위쪽 바(운동 칩·모드 버튼·톱니 아이콘) 정상.
  - **에뮬레이터는 `-memory 4096`으로 띄울 것** (기본 메모리면 lowmemorykiller가 앱을 죽여 테스트가 끊김)
  - 테스트용 cdp.mjs는 스크래치 폴더가 지워질 수 있음 → 없으면 다시 작성(WebView devtools 소켓 → Runtime.evaluate)
- 2.0에 들어간 것:
  - **이모지 정리 (사용자 요청 2026-10-27)**: 남기는 이모지는 위쪽 모드 버튼 💪/📖, 🍅, 컨디션 😫😕😐🙂😄 뿐.
    그 외는 지우거나 글자로("휴식", "몸무게", "운동" 등). 아이콘만 있던 ⚙ 설정·⏭ 건너뛰기 버튼은 인라인 SVG 선 아이콘(.ico-svg).
    날짜 시트 버튼의 .ico는 비워 두고 CSS로 숨김. ✓(목표 달성)는 글자 기호라 유지. **새 기능에도 이모지를 넣지 말 것**
  - **운동모드 전체** (위 "운동모드" 절), 위쪽 바 정렬(34px), 모드 버튼 어두운 배경, 운동 통계 인체 픽토그램
  - 1.10 에뮬레이터 확인: 1분 집중 중 20초 일시정지 → 세션 80초 구간, minutes 1, pausedSec 20 / 휴식 26초 게이지가 왼쪽 곡선 안 얇은 띠(캡슐 없음)
  - 에뮬레이터 부팅 직후 메모리 부족(lowmemorykiller)으로 WebView 렌더러가 죽을 수 있음 → 앱 버그 아님, 1분쯤 기다렸다 다시 테스트
- 1.10에 들어간 것:
  - 일시정지 시간은 공부 시간에서 뺌: 타이머 state.pauses에 [멈춘 시각, 다시 시작한 시각] 기록 →
    PomodoroTimer.recordFocus가 세션에 start(첫 시작)·end(실제 끝)·minutes(집중한 시간만)·pauses 저장.
    기록 줄에 "⏸ 일시정지 N분", 하루 시계는 일시정지 구간을 회색 가는 선으로(공부 색 안 칠함)
  - 알림 게이지 채움 방식 scale → **clip** (drawable/notice_gauge.xml). scale은 채운 폭이 바 높이보다 작으면
    (휴식 시작 직후 등) 세로 캡슐이 바 왼쪽에 따로 떠 보였음. clip은 같은 알약을 비율만큼 잘라 왼쪽 곡선을 그대로 따름(오른쪽 끝은 직선)
  - 1.9 에뮬레이터 확인: 실제 뒤로가기 키로 타이머→메인→종료 창→한 번 더 = 종료, 종료 창 [취소]/[종료] 탭,
    원판 진동 `Step=10ms(amplitude=0.30)`, 하루 요약 시계·시험 영역 오류 없음.
    (원판 드래그 테스트는 0/60 경계에서 시작하면 1분에서 멈춰 톱니가 안 넘어감 → 15분 쪽에서 반시계로 드래그할 것)
    로그의 "Error injecting safe area CSS"는 Capacitor 내부 메시지(문서 로드 전 주입)로 앱 동작과 무관
- 1.9에 들어간 것:
  - 날짜 시트 아래 시험 영역 정리: 지난 날 = 시험이 있었으면 "시험 결과" 박스만(시험 추가 없음),
    오늘 = 결과 안 넣은 시험마다 "📝 ○○ 시험 결과 입력" 버튼 + 결과 박스 + ＋ 시험 추가, 미래 = 시험 칩(수정) + ＋ 시험 추가
  - 휴대폰 뒤로가기: **Capacitor는 @capacitor/app 없이는 뒤로가기 = 앱 바로 종료**(웹 history와 무관)였음 →
    MainActivity의 OnBackPressedCallback이 JS `DT.app.onBackButton()`을 불러 결정 ("handled"면 유지, 아니면 finish).
    타이머 → 바로 메인, 통계·기록·시트 → 이전 화면, 열린 창 → 닫기, 메인 → "앱을 종료할까요?" [취소][종료], 그 창에서 뒤로가기 한 번 더 → 종료.
    종료는 AppControlPlugin.exitApp (Activity finish, 타이머 알림 서비스는 계속). (1.9에서 확인)
  - 태엽: 마찰음 최대 크기 0.14 → 0.1 (wind-sound.js setFriction), 원판 진동 세기 2 → 3 (dial-haptics.js LEVEL)
  - 통계 범위: 토요일 = 이 주 요약, 매달 마지막 날 = 이 달 요약, 나머지 = 하루 요약(오늘이면 "오늘 요약") `#stats/날짜~day`.
    하루 요약 = 숫자 6칸(공부한 시간·뽀모도로·쉰 시간·목표·공부 시간대·많이 한 과목) + 24시간 원형 시계(js/features/day-clock.js, DayClock):
    0시 맨 위 시계 방향, 공부 = 파랑 호(시작~끝), 휴식 = 초록 얇은 호(끝~끝+rest분), 오늘이면 지금 시각 바늘.
    호를 누르면 아래 카드에 그 공부(과목·내용·휴식) + "기록 수정"(SessionDialog), 빈 곳을 누르면 선택 해제
- 1.8에 들어간 것:
  - 1.8 에뮬레이터 확인: 앱 시작 오류 없음, 토익 기록 자동 변환, 게이지(2분 중 57초 남음 → 49% 채움, 둥근 끝),
    집중 끝 → 휴식 초록 게이지 자동 전환, 끝 진동 [140,40,140,40,140]
  - 태엽 마찰음: 사용자가 직접 wind-sound.js 157줄 `Math.pow(v, 1.4)` → `Math.pow(v, 1.0)`로 수정 (중간 속도 마찰음이 조금 커짐)
  - **주의(플러그인 숫자)**: Capacitor `call.getLong()`은 int 범위 숫자(예: 120000)를 못 읽고 기본값을 돌려줌 →
    TimerNoticePlugin은 `call.getData().optLong()`(num 함수) 사용. 이것 때문에 게이지가 늘 25분 기준으로 그려졌었음
  - 알림창 "게이지 타이머": 알약 모양 ProgressBar(drawable/notice_gauge.xml, layout/notice_small·notice_big.xml) 위에
    "🍅 집중 중 · N분"(왼쪽 위) + 큰 Chronometer(가운데). 집중 = 고른 색 게이지가 가득→줄어듦, 휴식 = 초록(그린이면 틸)이 60분 기준으로 늘어남.
    색은 Android 12+에서 setProgressTintList/BackgroundTint(빈 부분 = 같은 색 50% 어둡게), 그 이전은 빨강 기본.
    `TimerNoticeService`(포그라운드 서비스, specialUse)가 2초마다 갱신(화면 꺼지면 생략), 집중 끝나면 스스로 휴식으로 전환.
  - 앱 이름 Daily Study로 변경 (앱 이름·아이콘 STUDY·스플래시·화면 제목·꿀팁 일부·"토익 시험일"→"시험일")
  - 일반 공부 앱으로 데이터 구조 변경 (아래 "데이터 구조"). 예전 기록은 Store.migrate()가 처음 열 때 자동 변환
- 위쪽 요약 카드: [🎯 가장 가까운 시험 이름 + 카운트다운] [연속 학습] [이번 달] [오늘 공부] (예전 "최고 점수" 카드는 없앰)
- 설정의 "목표 점수"는 없앰 (점수 기준이 시험마다 달라서)
- 계정 로그인/클라우드 동기화: 환경만 구축, 꺼져 있음 (`www/js/core/cloud-config.js` enabled:false, 방법은 `docs/CLOUD_SETUP.md`)
- 사용자가 원본 태엽 mp3(8mm-movie-camera-wind-up-shutter-timer.mp3)를 다시 보내면 녹음 기반 태엽 소리로 바꿀 수 있음 (현재는 합성)

## 데이터 구조 (localStorage, 키 이름은 예전 그대로 dailyToeic.*)
- `settings.exams`: `[{ id, date:"YYYY-MM-DD", name, score:null|숫자, pass:null|true|false }]` (날짜순). 결과는 시험 날(오늘 포함)부터 입력
- `settings.subjects`: 과목 이름 배열(설정에서 추가·삭제, 기록 칩의 "＋ 과목"으로도 추가). 순서 = 화면 표시 순서
- `records[날짜]`: `{ minutes, parts:[과목], vocab, scores:[{name, score, detail?}], mood, memo, sessions:[{id,start,end,minutes,parts:[과목],note,rest,pauses?}] }`
  (세션 minutes = 일시정지를 뺀 실제 집중 분. end-start와 다를 수 있음. pauses = [[멈춘 시각, 다시 시작한 시각], ...])
- 예전(토익 시절) 형식 변환: 시험일 문자열 → `{name:"토익"}`, `lc/rc` → `scores:[{name:"토익", score:합, detail:"LC x / RC y"}]`,
  P1~P7·단어 → 과목 "토익"(세션 공부 내용 앞에 `[P5·단어]`로 남김). 백업 가져오기·클라우드 합치기도 같은 변환을 거침
- 백업 JSON의 `app:"DailyToeic"`, `version:2`는 호환 때문에 그대로

## 폴더 구조
```
www/                      앱 화면 (웹·안드로이드 공통, Capacitor webDir)
  index.html, style.css, service-worker.js, manifest.json, icon.svg
  js/app.js               App: 모든 객체 생성·연결, APP_VERSION
  js/core/                utils(Toast·날짜) store(기록·설정 localStorage) router(#해시 화면 전환)
                          audio(AudioHub 공용 오디오·깨우기·재연결·keepAlive)
                          workout-store(운동 기록) mode(공부/운동 모드 전환) ask(앱 안 확인·입력 창)
                          cloud-config / firebase-provider / account / cloud-sync (클라우드, 꺼짐)
  js/features/            calendar(CalendarView·시험 카운트다운) calendar-zoom(핀치) year-view(1년 히트맵)
                          tip-banner(꿀팁 바) day-sheet(날짜 바텀시트) record(기록 화면) study-log(공부한 시간)
                          session-dialog(뽀모도로 기록 창) stats(통계·이 주/이 달 요약·이름별 점수 추이·과목별 시간) settings(과목 관리) theme account-panel
                          subject-picker(과목 칩 + "＋ 과목") exam-dialog(시험 추가·수정·결과) day-clock(하루 요약 24시간 원형 시계)
                          workout-timer·workout-screen(운동 타이머) workout-log(운동 일지) workout-stats(운동 통계)
                          pomodoro(PomodoroTimer·Alarm) timer-screen(TimerScreen) timer-dial(TimeTimerDial SVG)
                          wind-sound(합성 래칫 소리) sfx(삐삐삐) dial-haptics(진동) native-notifier(앱 닫혀도 알람)
                          timer-notice(알림창 "집중 중/휴식 중")
android/                  Capacitor 안드로이드 프로젝트
  app/src/main/java/com/kch/dailytoeic/MainActivity.java      플러그인 등록 + 알림 채널 생성
  app/src/main/java/com/kch/dailytoeic/DialHapticsPlugin.java  tick(level 1~10) / pattern(timings) / info
  app/src/main/java/com/kch/dailytoeic/TimerNoticePlugin.java  show({mode,endAt|startAt|remainingMs,durationMs,focusMin,color,breakColor}) / hide
  app/src/main/java/com/kch/dailytoeic/TimerNoticeService.java 알림창 게이지 타이머 (2초 갱신·집중→휴식 전환)
  app/src/main/res/raw/focus_end.wav                           알림 소리(삐삐삐)
builds/DailyTOEIC.apk     빌드 결과 (사용자에게 전달)
docs/CLOUD_SETUP.md       계정 연동 켜는 방법
개발일지/                 사용자가 관리하는 개발 정리 (docx/pdf는 2026-10-15 00:27 시점까지 내용)
firestore.rules           클라우드 보안 규칙
```

## 주요 동작 요약
- 홈: 100dvh 한 화면. 요약 카드(시험 카운트다운 일·시·분·초 한 줄, 시험 날 0시 기준), 꿀팁 바(2줄 고정 높이), 캘린더(학습량 색).
- 날짜 바텀시트: 오늘=공부 시작 / 지난 날=공부한 시간(타이머 기록만, 직접 입력 불가) / 미래=🚧 아직 오픈 전 하나.
  메뉴 아래 시험 영역(day-sheet.js renderExams): 지난 날 = 시험 결과 박스(줄 누르면 수정, 없으면 "결과 미입력"),
  오늘 = "📝 시험 결과 입력" 버튼 + 결과 박스 + ＋ 시험 추가, 미래 = 시험 칩(수정) + ＋ 시험 추가.
  통계 버튼: 토요일=이 주 요약(파랑), 매달 마지막 날=이 달 요약(빨강, 우선), 나머지=하루 요약(원형 시계).
- 기록 화면: 공부한 과목 칩, 외운 단어 수, 점수 기록(이름+점수 여러 줄), 컨디션, 뽀모도로 기록, 메모.
- 통계: 요약에 "많이 한 과목", 점수 추이는 이름 칩으로 골라 보기(시험 결과는 속이 찬 점) + 시험 결과 목록, 과목별 공부 시간(이 달/이 주, 타이머 기록 기준).
- 타이머: 집중(원판 줄어듦) → 끝나면 삐삐삐+진동+기록 → 휴식(설정 없음, 쉰 만큼 초록 원판 차오름) → "다시 집중".
  원판 드래그로 집중 시간 설정. 태엽 소리 = 원판 1분당 톱니 2개, 속도에 따라 "철-컥"(느림)~"치르르륵"(빠름), 진동 세기 3/10(dial-haptics.js LEVEL).
- 앱 닫혀도 알람: 시작 시 시스템 알림 예약(USE_EXACT_ALARM), 울리면 앱 안 소리는 생략(중복 방지).

## 이 PC에서의 빌드·테스트 방법 (중요한 함정 포함)
- **`npm` 명령이 아무 동작 없이 끝난다.** Node로 직접 실행:
  `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" install ...`
  Capacitor: `node node_modules/@capacitor/cli/bin/capacitor sync android` (www만 바뀌면 `copy android`)
- 빌드: `cd android` → `JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"` (JDK 21), SDK `C:\Users\kch36\android-sdk`
  → `./gradlew assembleDebug --no-daemon` → `android/app/build/outputs/apk/debug/app-debug.apk`를 `builds/DailyTOEIC.apk`로 복사.
  `android/local.properties`는 `sdk.dir=C\:\\Users\\kch36\\android-sdk` (백슬래시 두 개).
- 웹 확인: `python -m http.server 5178 --directory www` 후 브라우저 창에서 `http://localhost:5178/index.html`.
  (preview_start는 License_Help_Web의 launch.json을 읽어 엉뚱한 서버를 띄움 → Bash 백그라운드로 직접 실행)
  브라우저가 예전 JS를 캐시할 수 있으니 SW 해제·캐시 삭제 후 `fetch(src,{cache:'reload'})` 하고 새로고침.
- **`confirm()`/`prompt()`/`alert()` 쓰지 말 것**: 브라우저 창(미리보기 등)에서 막혀 바로 "취소"가 돼 삭제가 안 되던 버그가 있었음.
  대신 `await DT.ask.confirm(메시지, { ok: "삭제", danger: true })` / `await DT.ask.prompt(메시지, { placeholder })` (js/core/ask.js, 앱 안 창).
- **Bash 히어독(<<EOF)으로 한글이 든 파이썬 패치를 넘기면 한글이 깨져서 매칭 실패** → 패치 스크립트는 Write로 파일에 쓰고 실행하거나 Edit 도구 사용.
- 에뮬레이터: AVD `DailyToeic_Test` (Android 16, `C:\Users\kch36\AppData\Local\Android\Sdk`).
  PowerShell `Start-Process emulator.exe -avd DailyToeic_Test -no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect -read-only`
  **출력을 파일로 리다이렉트해야 정상 기동**. adb: `C:\Users\kch36\android-sdk\platform-tools\adb.exe`.
  강제 종료된 qemu 프로세스가 "액세스 거부"로 남을 수 있음(무해, 재부팅 시 사라짐). System UI ANR 창이 뜨면 "Wait" 탭.
- 앱 WebView 디버깅: `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>` 후 Node 22의 WebSocket으로
  CDP `Runtime.evaluate` 실행 (스크립트는 스크래치에 작성). 실제 터치는 `adb shell input motionevent DOWN/MOVE/UP`.
  다이얼 중심(1080×2400 화면) ≈ (540, 714), 반지름 180px. 꿀팁 바가 2줄이라 캘린더 탭 좌표는 스크린샷으로 확인할 것.
- 확인용 안드로이드 기록: 오디오 `dumpsys audio`(new/releasing player, state:started), 진동 `dumpsys vibrator_manager`
  (`played: Step=10ms(amplitude=0.30)` = 세기 3), 알림 `dumpsys notification --noredact`, 알람 `dumpsys alarm`.
