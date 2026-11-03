// 기록 클라우드 동기화: 로그인하면 계정의 기록을 내려받아 합치고, 이후 바뀐 날짜만 올린다
//   - 합치기 규칙(1차 버전): 같은 날짜가 양쪽에 있으면 이 기기 기록을 우선, 한쪽에만 있으면 가져옴
//                           시험일은 양쪽을 합침, 나머지 설정은 이 기기 우선
//   - 마지막으로 올린 내용을 기억해 두었다가(dailyToeic.sync.{uid}) 달라진 날짜만 올리고, 지운 날짜는 삭제
(() => {
  "use strict";

  const PUSH_DELAY = 2500; // 연속으로 고칠 때 모아서 한 번에 올리기
  const SYNC_KEY = (uid) => `dailyToeic.sync.${uid}`;
  const hash = (v) => JSON.stringify(v);

  class CloudSync {
    constructor(store, account) {
      this.store = store;
      this.account = account;
      this.uid = null;
      this.synced = null;   // { settings: 해시, days: { 날짜: 해시 } }
      this.timer = null;
      this.busy = false;
      this.lastSyncedAt = null;
      this.listeners = [];

      account.onChange(() => (account.signedIn ? this.start(account.user.uid) : this.stop()));
      store.onChange(() => this.schedule());
    }

    onChange(fn) { this.listeners.push(fn); }
    emit() { this.listeners.forEach((fn) => fn(this)); }

    async start(uid) {
      if (this.uid === uid) return;
      this.uid = uid;
      this.synced = DT.Store.read(SYNC_KEY(uid), { settings: null, days: {} });
      try {
        this.busy = true;
        this.emit();
        const remote = await this.account.provider.pull(uid);
        this.store.mergeRemote(remote); // 합친 결과로 화면도 갱신됨
        await this.pushNow();
      } catch (e) {
        console.warn("[sync] 처음 동기화 실패", e);
      } finally {
        this.busy = false;
        this.emit();
      }
    }

    stop() {
      clearTimeout(this.timer);
      this.uid = null;
      this.synced = null;
      this.emit();
    }

    schedule() {
      if (!this.uid) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.pushNow(), PUSH_DELAY);
    }

    // 마지막으로 올린 것과 비교해서 달라진 부분만 모으기
    diff() {
      const { settings, records } = this.store.snapshot();
      const days = {};
      const upserts = {};
      Object.entries(records).forEach(([k, r]) => {
        days[k] = hash(r);
        if (this.synced.days[k] !== days[k]) upserts[k] = r;
      });
      const deletes = Object.keys(this.synced.days).filter((k) => !(k in records));
      const settingsHash = hash(settings);
      return {
        change: { settings: this.synced.settings !== settingsHash ? settings : null, upserts, deletes },
        next: { settings: settingsHash, days },
      };
    }

    async pushNow() {
      if (!this.uid) return;
      const uid = this.uid;
      const { change, next } = this.diff();
      if (!change.settings && !Object.keys(change.upserts).length && !change.deletes.length) return;
      try {
        await this.account.provider.push(uid, change);
        if (this.uid !== uid) return; // 그새 로그아웃했으면 무시
        this.synced = next;
        this.store.write(SYNC_KEY(uid), next);
        this.lastSyncedAt = Date.now();
        this.emit();
      } catch (e) {
        console.warn("[sync] 올리기 실패, 다음 변경 때 다시 시도", e);
      }
    }
  }

  DT.CloudSync = CloudSync;
})();
