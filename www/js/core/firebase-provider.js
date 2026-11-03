// Firebase 연결 (로그인 + Firestore 저장). 다른 서비스로 바꾸려면 같은 메서드를 가진 클래스로 교체하면 된다
//   load()                    SDK를 불러오고 초기화 (설정이 켜졌을 때만 호출됨)
//   onAuthChange(cb)          로그인 상태가 바뀌면 cb(user | null)
//   signIn() / signOut()      Google 로그인 / 로그아웃
//   pull(uid)                 { settings, records } 내려받기
//   push(uid, change)         { settings?, upserts: {날짜: 기록}, deletes: [날짜] } 올리기
//
// Firestore 구조 (문서 하나 1MB 제한을 피하려고 날짜별로 나눔)
//   users/{uid}                 { settings, updatedAt }
//   users/{uid}/days/{날짜}     { record, updatedAt }
(() => {
  "use strict";

  const SDK_VERSION = "10.12.2";
  const SDK_URLS = ["app", "auth", "firestore"].map(
    (name) => `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-${name}-compat.js`
  );
  const BATCH_LIMIT = 450; // Firestore 일괄 쓰기 한도(500)보다 조금 작게

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`스크립트를 불러오지 못했습니다: ${src}`));
    document.head.appendChild(s);
  });

  class FirebaseProvider {
    constructor(config) {
      this.config = config;
      this.auth = null;
      this.db = null;
    }

    async load() {
      const c = this.config;
      if (!c || !c.apiKey || !c.projectId) throw new Error("Firebase 설정값(apiKey, projectId)이 비어 있습니다");
      for (const url of SDK_URLS) await loadScript(url); // 순서대로 (app → auth → firestore)
      const fb = window.firebase;
      const app = fb.apps.length ? fb.app() : fb.initializeApp(c);
      this.auth = app.auth();
      this.db = app.firestore();
      // 오프라인에서도 쓰고, 다시 연결되면 자동으로 올라가도록
      try { await this.db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* 지원 안 되는 브라우저면 무시 */ }
    }

    onAuthChange(cb) {
      this.auth.onAuthStateChanged((u) => cb(u ? { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL } : null));
    }

    async signIn() {
      const provider = new window.firebase.auth.GoogleAuthProvider();
      try {
        await this.auth.signInWithPopup(provider);
      } catch (e) {
        // 팝업이 막힌 환경(일부 모바일 브라우저)에서는 페이지 이동 방식으로
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
          await this.auth.signInWithRedirect(provider);
        } else {
          throw e;
        }
      }
    }

    signOut() { return this.auth.signOut(); }

    userRef(uid) { return this.db.collection("users").doc(uid); }

    async pull(uid) {
      const ref = this.userRef(uid);
      const [userDoc, days] = await Promise.all([ref.get(), ref.collection("days").get()]);
      const records = {};
      days.forEach((d) => { const v = d.data(); if (v && v.record) records[d.id] = v.record; });
      return { settings: (userDoc.exists && userDoc.data().settings) || null, records };
    }

    async push(uid, change) {
      const fb = window.firebase;
      const now = fb.firestore.FieldValue.serverTimestamp();
      const ref = this.userRef(uid);
      const ops = [];
      if (change.settings) ops.push((b) => b.set(ref, { settings: change.settings, updatedAt: now }, { merge: true }));
      Object.entries(change.upserts || {}).forEach(([k, record]) => ops.push((b) => b.set(ref.collection("days").doc(k), { record, updatedAt: now })));
      (change.deletes || []).forEach((k) => ops.push((b) => b.delete(ref.collection("days").doc(k))));
      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = this.db.batch();
        ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
        await batch.commit();
      }
    }
  }

  DT.FirebaseProvider = FirebaseProvider;
})();
