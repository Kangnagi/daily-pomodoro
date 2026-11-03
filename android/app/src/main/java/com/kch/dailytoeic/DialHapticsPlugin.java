package com.kch.dailytoeic;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 타이머 원판을 돌릴 때 손끝에 느껴지는 아주 짧고 약한 "톡" 진동.
 * 세기(level)는 1~10 단계로 받아서 진동 모터 세기(1~255)로 바꾼다.
 *  - 세기 조절이 되는 휴대폰: 10ms 동안 level/10 세기로
 *  - 세기 조절이 안 되는 휴대폰(Android 10+): 시스템의 가장 가벼운 "틱" 진동
 *  - 그보다 오래된 휴대폰: 아주 짧게(6ms)
 */
@CapacitorPlugin(name = "DialHaptics")
public class DialHapticsPlugin extends Plugin {

    private static final int TICK_MS = 10;
    private Vibrator vibrator;

    @Override
    public void load() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = vm != null ? vm.getDefaultVibrator() : null;
        } else {
            vibrator = getLegacyVibrator(ctx);
        }
    }

    @SuppressWarnings("deprecation")
    private Vibrator getLegacyVibrator(Context ctx) {
        return (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    }

    @PluginMethod
    public void tick(PluginCall call) {
        int level = Math.max(1, Math.min(10, call.getInt("level", 2)));
        if (vibrator == null || !vibrator.hasVibrator()) {
            call.resolve();
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && vibrator.hasAmplitudeControl()) {
                int amplitude = Math.max(1, Math.round(255f * level / 10f));
                vibrator.vibrate(VibrationEffect.createOneShot(TICK_MS, amplitude));
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK));
            } else {
                vibrateLegacy(6);
            }
        } catch (Exception e) {
            // 진동이 안 되는 기기에서는 조용히 무시
        }
        call.resolve();
    }

    @SuppressWarnings("deprecation")
    private void vibrateLegacy(long ms) {
        vibrator.vibrate(ms);
    }

    /**
     * 박자 진동 (집중이 끝날 때 "삐삐삐"에 맞춘 "징-징-징").
     * timings = [울림, 쉼, 울림, ...] (ms), 세기는 휴대폰 기본 세기.
     */
    @PluginMethod
    public void pattern(PluginCall call) {
        com.getcapacitor.JSArray arr = call.getArray("timings");
        if (vibrator == null || !vibrator.hasVibrator() || arr == null || arr.length() == 0) {
            call.resolve();
            return;
        }
        try {
            // 안드로이드 형식: [대기, 울림, 쉼, 울림, ...] → 맨 앞에 대기 0을 붙임
            long[] wave = new long[arr.length() + 1];
            wave[0] = 0;
            for (int i = 0; i < arr.length(); i++) wave[i + 1] = arr.getLong(i);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(wave, -1));
            } else {
                vibratePatternLegacy(wave);
            }
        } catch (Exception e) {
            // 진동이 안 되는 기기에서는 조용히 무시
        }
        call.resolve();
    }

    @SuppressWarnings("deprecation")
    private void vibratePatternLegacy(long[] wave) {
        vibrator.vibrate(wave, -1);
    }

    /** 이 기기에서 어떤 방식으로 진동하는지 (설정 화면 표시·확인용) */
    @PluginMethod
    public void info(PluginCall call) {
        com.getcapacitor.JSObject r = new com.getcapacitor.JSObject();
        boolean has = vibrator != null && vibrator.hasVibrator();
        boolean amp = has && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && vibrator.hasAmplitudeControl();
        r.put("hasVibrator", has);
        r.put("amplitudeControl", amp);
        r.put("mode", !has ? "none" : amp ? "amplitude" : Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? "system-tick" : "short");
        call.resolve(r);
    }
}
