// 앱을 닫아도 집중 종료 알람이 울리도록 휴대폰 시스템 알림을 예약 (안드로이드 앱에서만 동작)
//   집중 시작 → 끝나는 시각에 알림 예약 / 일시정지·처음부터·끝내기 → 예약 취소
//   웹(브라우저)에서는 아무 일도 하지 않음 (active === false)
(() => {
  "use strict";

  const NOTIFY_ID = 7001;            // 집중 종료 알림 (하나만 사용)
  // 알림 채널: 소리/진동 설정 묶음. 안드로이드는 채널의 진동을 나중에 바꿀 수 없어서,
  // "삐삐삐" 박자 진동을 넣은 새 채널(focus-end-2)을 MainActivity에서 직접 만든다 (예전 focus-end는 삭제)
  const CHANNEL_ID = "focus-end-2";
  const SOUND = "focus_end.wav";     // android/app/src/main/res/raw/focus_end.wav ("삐삐삐")

  class NativeNotifier {
    constructor() {
      const cap = window.Capacitor;
      this.native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
      this.plugin = null;
      this.granted = false;
      this.scheduledAt = 0; // 지금 예약된 알림 시각 (없으면 0)
      if (!this.native) return;
      this.plugin = (cap.Plugins && cap.Plugins.LocalNotifications) || cap.registerPlugin("LocalNotifications");
      this.ready = this.setup();
    }

    // 알림이 실제로 울릴 수 있는 상태인지 (앱 + 알림 허용)
    get active() { return this.native && this.granted; }

    async setup() {
      try {
        const st = await this.plugin.checkPermissions();
        this.granted = st.display === "granted";
        // 채널은 MainActivity에서 진동 박자까지 넣어 미리 만들어 둠
      } catch (e) {
        console.warn("[notify] 준비 실패", e);
      }
    }

    // 처음 집중을 시작할 때 알림 허용을 물어봄 (안드로이드 13+)
    async ensurePermission() {
      if (!this.native) return false;
      await this.ready;
      if (this.granted) return true;
      try {
        const st = await this.plugin.requestPermissions();
        this.granted = st.display === "granted";
      } catch (e) {
        this.granted = false;
      }
      return this.granted;
    }

    async scheduleFocusEnd(at) {
      if (!this.native || !(at > Date.now())) return;
      if (!(await this.ensurePermission())) return;
      try {
        await this.plugin.cancel({ notifications: [{ id: NOTIFY_ID }] });
        await this.plugin.schedule({
          notifications: [{
            id: NOTIFY_ID,
            title: "집중 완료! 🍅",
            body: "수고했어요. 앱을 열어 공부한 내용을 기록하고 휴식하세요.",
            channelId: CHANNEL_ID,
            sound: SOUND,
            smallIcon: "ic_stat_notify",
            iconColor: "#2F6FED",
            schedule: { at: new Date(at), allowWhileIdle: true }, // 절전 모드에서도 정확한 시각에
          }],
        });
        this.scheduledAt = at;
      } catch (e) {
        console.warn("[notify] 예약 실패", e);
      }
    }

    async cancelFocusEnd() {
      if (!this.native) return;
      this.scheduledAt = 0;
      try { await this.plugin.cancel({ notifications: [{ id: NOTIFY_ID }] }); } catch (e) {}
    }

    // 이미 울린 알림을 알림창에서 지움 (앱을 열어 확인했으므로). 예약 취소(cancel)로는 울린 알림이 안 지워짐
    async dismissFocusEnd() {
      if (!this.native) return;
      this.scheduledAt = 0;
      try {
        await this.plugin.cancel({ notifications: [{ id: NOTIFY_ID }] });
        await this.plugin.removeDeliveredNotifications({ notifications: [{ id: NOTIFY_ID }] });
      } catch (e) {}
    }

    // 다른 알림 예약 (운동모드 휴식 끝 등). 소리·진동은 집중 종료와 같은 채널("삐삐삐" + 징징징)
    async scheduleAt(id, at, title, body) {
      if (!this.native || !(at > Date.now())) return false;
      if (!(await this.ensurePermission())) return false;
      try {
        await this.plugin.cancel({ notifications: [{ id }] });
        await this.plugin.schedule({
          notifications: [{
            id, title, body, channelId: CHANNEL_ID, sound: SOUND, smallIcon: "ic_stat_notify", iconColor: "#2F6FED",
            schedule: { at: new Date(at), allowWhileIdle: true },
          }],
        });
        return true;
      } catch (e) {
        console.warn("[notify] 예약 실패", e);
        return false;
      }
    }
    // 예약 취소 + 이미 울린 알림 지우기
    async clear(id) {
      if (!this.native) return;
      try {
        await this.plugin.cancel({ notifications: [{ id }] });
        await this.plugin.removeDeliveredNotifications({ notifications: [{ id }] });
      } catch (e) {}
    }

    // 끝나는 시각에 알림이 예약돼 있었는지 (그렇다면 앱 안 소리는 생략해 두 번 울리지 않게)
    coveredBy(endAt) {
      return this.active && this.scheduledAt > 0 && Math.abs(this.scheduledAt - endAt) < 2000;
    }
  }

  DT.NativeNotifier = NativeNotifier;
})();
