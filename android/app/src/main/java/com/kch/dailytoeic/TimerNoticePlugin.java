package com.kch.dailytoeic;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 타이머가 도는 동안 알림창에 떠 있는 게이지 타이머 알림 (그리기·갱신은 TimerNoticeService).
 * show({ mode: focus|break|paused, endAt, startAt, remainingMs, durationMs, focusMin, color, breakColor })
 *   color/breakColor = { main: "#rrggbb" }
 * hide()
 */
@CapacitorPlugin(name = "TimerNotice")
public class TimerNoticePlugin extends Plugin {

    @PluginMethod
    public void show(PluginCall call) {
        Context ctx = getContext();
        if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) {
            call.resolve();
            return;
        }
        TimerNoticeService.State s = new TimerNoticeService.State();
        s.mode = call.getString("mode", "focus");
        s.endAt = num(call, "endAt", 0L);
        s.startAt = num(call, "startAt", 0L);
        s.remainingMs = num(call, "remainingMs", 0L);
        s.durationMs = num(call, "durationMs", 25 * 60000L);
        s.focusMin = call.getInt("focusMin", 25);
        JSObject c = call.getObject("color"), b = call.getObject("breakColor");
        if (c != null) s.main = color(c, "main", s.main);
        if (b != null) s.breakMain = color(b, "main", s.breakMain);

        Intent i = new Intent(ctx, TimerNoticeService.class);
        s.toIntent(i);
        try {
            // 이미 떠 있는 서비스엔 내용만 바꿔 전달, 처음이면 포그라운드 서비스로 시작
            if (TimerNoticeService.running || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) ctx.startService(i);
            else ctx.startForegroundService(i);
        } catch (Exception e) {
            // 백그라운드라 서비스를 못 띄우면: 원판이 멈춘 알림이라도 표시 (앱을 열면 다시 움직임)
            try {
                NotificationManagerCompat.from(ctx).notify(TimerNoticeService.NOTICE_ID, TimerNoticeService.build(ctx, s));
            } catch (SecurityException ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        Context ctx = getContext();
        ctx.stopService(new Intent(ctx, TimerNoticeService.class));
        NotificationManagerCompat.from(ctx).cancel(TimerNoticeService.NOTICE_ID);
        call.resolve();
    }

    /**
     * 숫자(ms) 읽기. call.getLong은 int 범위의 작은 숫자(예: 집중 2분 = 120000)를 못 읽고 기본값을 돌려줘서
     * 게이지가 늘 25분 기준으로 그려지던 버그가 있었음 → 어떤 숫자 형식이든 읽는 optLong 사용
     */
    private static long num(PluginCall call, String key, long fallback) {
        return call.getData().has(key) ? call.getData().optLong(key, fallback) : fallback;
    }

    private static int color(JSObject o, String key, int fallback) {
        try {
            String v = o.getString(key);
            return v != null ? Color.parseColor(v) : fallback;
        } catch (Exception e) {
            return fallback;
        }
    }
}
