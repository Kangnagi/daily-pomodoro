package com.kch.dailytoeic;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * 알림창의 게이지 타이머: 알약 모양 게이지 바 + "집중 중 · N분" + 큰 시간.
 * 집중은 고른 색이 가득 찬 게이지가 서서히 줄어들고, 휴식은 초록 게이지가 쉰 만큼 늘어난다(60분에 가득).
 * 포그라운드 서비스로 2초마다 게이지를 갱신해서 앱을 닫아도 움직인다.
 * 집중이 끝나는 순간 서비스가 스스로 휴식 화면으로 바꾼다 (앱을 열면 앱의 타이머도 같은 시각으로 맞춰짐).
 */
public class TimerNoticeService extends Service {

    static final String CHANNEL = "timer-running"; // MainActivity에서 만듦 (조용한 채널)
    static final int NOTICE_ID = 7002;              // 집중 종료 알림(7001)과 다른 번호
    private static final long TICK_MS = 2000;
    private static final long MIN = 60000;
    private static final int GAUGE_MAX = 1000;
    private static final long BREAK_FULL_MS = 60 * MIN; // 휴식 게이지는 60분에 가득 (앱 원판과 같은 기준)

    static boolean running = false;

    /** 알림에 그릴 상태 (플러그인 → 서비스 Intent extras) */
    static class State {
        String mode = "focus";        // focus | break | paused
        long endAt, startAt, remainingMs, durationMs;
        int focusMin;
        int main = Color.parseColor("#e2432a");      // 집중 색 (설정에서 고른 색)
        int breakMain = Color.parseColor("#2e6a48"); // 휴식 색 (집중 색이 그린이면 틸)

        void toIntent(Intent i) {
            i.putExtra("mode", mode).putExtra("endAt", endAt).putExtra("startAt", startAt)
                .putExtra("remainingMs", remainingMs).putExtra("durationMs", durationMs).putExtra("focusMin", focusMin)
                .putExtra("colors", new int[] { main, breakMain });
        }

        static State fromIntent(Intent i) {
            State s = new State();
            s.mode = i.getStringExtra("mode");
            if (s.mode == null) s.mode = "focus";
            s.endAt = i.getLongExtra("endAt", 0);
            s.startAt = i.getLongExtra("startAt", 0);
            s.remainingMs = i.getLongExtra("remainingMs", 0);
            s.durationMs = i.getLongExtra("durationMs", 25 * MIN);
            s.focusMin = i.getIntExtra("focusMin", 25);
            int[] c = i.getIntArrayExtra("colors");
            if (c != null && c.length == 2) {
                s.main = c[0];
                s.breakMain = c[1];
            }
            return s;
        }
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private State state;
    private final Runnable ticker = this::tick;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { // 시스템이 다시 살린 경우: 상태를 모르니 조용히 끝냄 (앱을 열면 다시 표시)
            stopSelf();
            return START_NOT_STICKY;
        }
        state = State.fromIntent(intent);
        Notification n = build(this, state);
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTICE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTICE_ID, n);
        }
        running = true;
        handler.removeCallbacks(ticker);
        if (!"paused".equals(state.mode)) handler.postDelayed(ticker, TICK_MS);
        return START_NOT_STICKY;
    }

    private void tick() {
        if (state == null) return;
        boolean changed = false;
        if ("focus".equals(state.mode) && System.currentTimeMillis() >= state.endAt) {
            // 집중 끝 → 휴식 (쉰 시간은 집중이 끝난 시각부터)
            state.mode = "break";
            state.startAt = state.endAt;
            changed = true;
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        boolean screenOn = pm == null || pm.isInteractive();
        if (changed || screenOn) { // 화면이 꺼져 있으면 그리지 않음 (배터리)
            try {
                NotificationManagerCompat.from(this).notify(NOTICE_ID, build(this, state));
            } catch (SecurityException e) {
                // 알림 권한 없음
            }
        }
        handler.postDelayed(ticker, TICK_MS);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(ticker);
        running = false;
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    // ---------- 알림 만들기 ----------

    static Notification build(Context ctx, State s) {
        long now = System.currentTimeMillis();
        boolean onBreak = "break".equals(s.mode);
        boolean paused = "paused".equals(s.mode);

        // 게이지: 집중 = 남은 시간 / 집중 시간 (가득 → 줄어듦), 휴식 = 쉰 시간 / 60분 (비어 있음 → 늘어남)
        float frac;
        if (onBreak) frac = Math.max(0, now - s.startAt) / (float) BREAK_FULL_MS;
        else frac = (paused ? s.remainingMs : Math.max(0, s.endAt - now)) / (float) Math.max(1, s.durationMs);
        int progress = Math.round(Math.max(0, Math.min(1, frac)) * GAUGE_MAX);
        int color = onBreak ? s.breakMain : s.main;

        String title = onBreak ? "휴식 중" : paused ? "일시정지 · " + s.focusMin + "분" : "🍅 집중 중 · " + s.focusMin + "분";
        String sub = onBreak ? "쉰 시간 · 눌러서 다시 집중" : paused ? "남은 시간 · 눌러서 이어서 집중" : "남은 시간";

        RemoteViews small = views(ctx, R.layout.notice_small, title, s, now, progress, color);
        RemoteViews big = views(ctx, R.layout.notice_big, title, s, now, progress, color);

        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(color)
            .setContentTitle(title)
            .setContentText(sub)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(small)
            .setCustomBigContentView(big)
            .setContentIntent(tap)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    private static RemoteViews views(Context ctx, int layout, String title, State s, long now, int progress, int color) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), layout);
        v.setTextViewText(R.id.noticeTitle, title);
        v.setProgressBar(R.id.noticeGauge, GAUGE_MAX, progress, false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // 채워진 부분 = 고른 색, 빈 부분 = 같은 색을 어둡게 (흰 글자가 어디서든 잘 보이게)
            v.setColorStateList(R.id.noticeGauge, "setProgressTintList", ColorStateList.valueOf(color));
            v.setColorStateList(R.id.noticeGauge, "setProgressBackgroundTintList", ColorStateList.valueOf(darken(color)));
        }
        long elapsedNow = SystemClock.elapsedRealtime();
        if ("paused".equals(s.mode)) {
            v.setViewVisibility(R.id.noticeTime, View.GONE);
            v.setViewVisibility(R.id.noticeTimeStatic, View.VISIBLE);
            v.setTextViewText(R.id.noticeTimeStatic, fmt(s.remainingMs));
        } else {
            v.setViewVisibility(R.id.noticeTime, View.VISIBLE);
            v.setViewVisibility(R.id.noticeTimeStatic, View.GONE);
            boolean onBreak = "break".equals(s.mode);
            // 시계는 안드로이드가 직접 1초마다 움직임
            long base = onBreak ? elapsedNow - Math.max(0, now - s.startAt) : elapsedNow + Math.max(0, s.endAt - now);
            v.setChronometer(R.id.noticeTime, base, null, true);
            v.setChronometerCountDown(R.id.noticeTime, !onBreak);
        }
        return v;
    }

    /** 게이지 빈 부분 색: 같은 색을 절반 어둡게 */
    private static int darken(int c) {
        return Color.rgb(Math.round(Color.red(c) * 0.5f), Math.round(Color.green(c) * 0.5f), Math.round(Color.blue(c) * 0.5f));
    }

    private static String fmt(long ms) {
        long sec = Math.max(0, ms) / 1000;
        long h = sec / 3600, m = (sec % 3600) / 60, ss = sec % 60;
        return h > 0 ? String.format("%d:%02d:%02d", h, m, ss) : String.format("%02d:%02d", m, ss);
    }
}
