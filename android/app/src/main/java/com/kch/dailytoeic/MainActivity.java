package com.kch.dailytoeic;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** 집중 종료 알림 채널 (www/js/features/native-notifier.js 의 CHANNEL_ID 와 같아야 함) */
    static final String FOCUS_END_CHANNEL = "focus-end-2";
    /** "삐삐삐"(0, 0.18, 0.36초)에 맞춘 진동: [대기, 울림, 쉼, 울림, 쉼, 울림] (ms) */
    static final long[] FOCUS_END_VIBRATION = { 0, 140, 40, 140, 40, 140 };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱에 직접 만든 플러그인 등록: 원판을 돌릴 때 약한 진동, 알람 박자 진동
        registerPlugin(DialHapticsPlugin.class);
        // 타이머가 도는 동안 알림창에 떠 있는 "집중 중 / 휴식 중" 알림
        registerPlugin(TimerNoticePlugin.class);
        // 메인 화면에서 "앱을 종료할까요?" → 종료
        registerPlugin(AppControlPlugin.class);
        super.onCreate(savedInstanceState);
        createFocusEndChannel();
        createTimerRunningChannel();
        handleBackButton();
    }

    /**
     * 휴대폰 뒤로가기: 기본 동작(앱 바로 종료) 대신 앱 화면(js/app.js 의 onBackButton)에 맡긴다.
     *   다른 화면·창이 열려 있으면 닫고, 메인 화면이면 "앱을 종료할까요?" 창, 그 창에서 한 번 더 누르면 종료.
     *   JS가 "exit"를 돌려주거나 앱 화면이 아직 준비 전이면 종료.
     */
    private void handleBackButton() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) { finish(); return; }
                getBridge().getWebView().evaluateJavascript(
                    "(window.DT && DT.app && DT.app.onBackButton) ? DT.app.onBackButton() : 'exit'",
                    (result) -> { if (!"\"handled\"".equals(result)) finish(); });
            }
        });
    }

    /** 진행 중 알림 채널: 조용히 떠 있기만 (소리·진동·배지 없음) */
    private void createTimerRunningChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(TimerNoticeService.CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(TimerNoticeService.CHANNEL, "타이머 진행 중", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("집중·휴식 타이머가 도는 동안 알림창에 남은 시간을 보여줘요");
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setShowBadge(false);
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    /**
     * 앱을 닫아도 울리는 집중 종료 알림의 채널: 소리(res/raw/focus_end.wav)와 같은 박자의 진동.
     * 안드로이드는 한 번 만든 채널의 소리·진동을 바꿀 수 없어서 새 이름으로 만들고, 예전 채널은 지운다.
     */
    private void createFocusEndChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        nm.deleteNotificationChannel("focus-end"); // 예전 채널 (기본 진동 박자)
        if (nm.getNotificationChannel(FOCUS_END_CHANNEL) != null) return;

        NotificationChannel ch = new NotificationChannel(FOCUS_END_CHANNEL, "집중 종료 알림", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("집중 시간이 끝나면 알려줘요");
        Uri sound = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/raw/focus_end");
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        ch.setSound(sound, attrs);
        ch.enableVibration(true);
        ch.setVibrationPattern(FOCUS_END_VIBRATION);
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }
}
