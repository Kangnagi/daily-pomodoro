const CACHE_NAME = "daily-toeic-v72";
const ASSETS = [
  "./", "./index.html", "./style.css", "./manifest.json", "./icon.svg",
  "./js/core/utils.js", "./js/core/audio.js", "./js/core/ask.js", "./js/core/store.js", "./js/core/workout-store.js", "./js/core/mode.js", "./js/core/router.js", "./js/core/cloud-config.js", "./js/core/firebase-provider.js", "./js/core/account.js", "./js/core/cloud-sync.js",
  "./js/features/theme.js", "./js/features/calendar-zoom.js", "./js/features/year-view.js", "./js/features/calendar.js", "./js/features/tip-banner.js", "./js/features/day-sheet.js",
  "./js/features/subject-picker.js", "./js/features/session-dialog.js", "./js/features/exam-dialog.js", "./js/features/study-log.js", "./js/features/record.js", "./js/features/wind-sound.js", "./js/features/dial-haptics.js", "./js/features/timer-dial.js",
  "./js/features/sfx.js", "./js/features/native-notifier.js", "./js/features/timer-notice.js", "./js/features/pomodoro.js", "./js/features/timer-screen.js", "./js/features/day-clock.js", "./js/features/stats.js", "./js/features/workout-timer.js", "./js/features/workout-screen.js", "./js/features/workout-log.js", "./js/features/body-map.js", "./js/features/workout-stats.js",
  "./js/features/settings.js", "./js/features/account-panel.js", "./js/app.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // 앱 파일만 캐시. 로그인/클라우드 같은 다른 사이트 요청은 브라우저가 직접 처리
  if (new URL(e.request.url).origin !== location.origin) return;
  // 네트워크 우선, 오프라인이면 캐시 사용
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }) // 브라우저 HTTP 캐시의 오래된 파일 대신 항상 서버에 확인 (바뀌지 않았으면 304로 빠름)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
