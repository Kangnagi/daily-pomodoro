package com.kch.dailytoeic;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 앱 종료: 메인 화면에서 뒤로가기 → "앱을 종료할까요?" 창의 [종료] 또는 뒤로가기 한 번 더.
 * 타이머 알림(포그라운드 서비스)은 화면을 닫아도 계속 돈다.
 */
@CapacitorPlugin(name = "AppControl")
public class AppControlPlugin extends Plugin {

    @PluginMethod
    public void exitApp(PluginCall call) {
        call.resolve();
        getActivity().runOnUiThread(() -> getActivity().finish());
    }
}
