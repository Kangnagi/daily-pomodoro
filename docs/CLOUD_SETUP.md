# 계정 로그인 / 클라우드 동기화 켜는 방법

지금은 **꺼져 있습니다** (`www/js/core/cloud-config.js`의 `enabled: false`).
꺼져 있는 동안에는 외부 스크립트를 전혀 불러오지 않고, 기록은 이 기기(브라우저)에만 저장됩니다.

## 구조

| 파일 | 클래스 | 역할 |
|---|---|---|
| `www/js/core/cloud-config.js` | – | 켜기/끄기, Firebase 설정값 |
| `www/js/core/firebase-provider.js` | `FirebaseProvider` | Firebase SDK 불러오기, Google 로그인, Firestore 읽기/쓰기 |
| `www/js/core/account.js` | `AccountService` | 로그인 상태 관리 (`disabled` / `loading` / `signedOut` / `signedIn` / `error`) |
| `www/js/core/cloud-sync.js` | `CloudSync` | 로그인 시 내려받아 합치기 → 이후 바뀐 날짜만 올리기 |
| `www/js/features/account-panel.js` | `AccountPanel` | 설정 창 "계정" 칸 |
| `firestore.rules` | – | 보안 규칙 (자기 기록만 읽고 쓰기) |

다른 서비스(예: Supabase)로 바꾸려면 `FirebaseProvider`와 같은 메서드
(`load`, `onAuthChange`, `signIn`, `signOut`, `pull`, `push`)를 가진 클래스를 만들고
`account.js`의 `PROVIDERS`에 등록한 뒤 `cloud-config.js`의 `provider`를 바꾸면 됩니다.

### 저장 구조 (Firestore)

```
users/{uid}                 { settings, updatedAt }
users/{uid}/days/{날짜}     { record, updatedAt }     예: days/2026-10-14
```

날짜별로 문서를 나눠서 문서 하나 크기 제한(1MB)에 걸리지 않고, 바뀐 날짜만 올립니다.

### 합치기 규칙 (1차 버전)

- 로그인하면 계정의 기록을 내려받아 이 기기 기록과 합칩니다.
  - 같은 날짜가 양쪽에 있으면 **이 기기 기록 우선**
  - 한쪽에만 있는 날짜는 가져옴
  - 시험일은 양쪽을 합침, 나머지 설정은 이 기기 우선
- 그 뒤로는 기록이 바뀔 때마다(2.5초 모아서) 달라진 날짜만 올리고, 지운 날짜는 계정에서도 지웁니다.
- 타이머 진행 상태와 테마는 기기마다 따로입니다(올리지 않음).
- 두 기기에서 같은 날을 동시에 고치는 경우는 아직 처리하지 않습니다. 필요해지면 기록마다 수정 시각을 넣어 최신 것을 고르도록 바꾸면 됩니다.

## 켜는 순서

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 만들기
2. **Authentication → 로그인 방법 → Google** 사용 설정
3. **Authentication → 설정 → 승인된 도메인**에 앱 주소 추가
   (예: `localhost`, 배포할 도메인. `file://`로 연 페이지에서는 로그인이 안 됩니다)
4. **Firestore Database** 만들기 → **규칙** 탭에 `firestore.rules` 내용을 붙여넣고 게시
5. **프로젝트 설정 → 내 앱 → 웹 앱 추가** 후 나오는 설정값을 `www/js/core/cloud-config.js`의 `firebase`에 붙여넣기
6. `enabled: true` 로 바꾸기
7. `www/service-worker.js`의 `CACHE_NAME` 버전 올리기

> Firebase 웹 설정값(apiKey 등)은 비밀번호가 아니라 앱을 구분하는 값이라 코드에 들어가도 괜찮습니다.
> 실제 보호는 4번의 보안 규칙이 합니다.

## 안드로이드 앱(Capacitor)으로 만들 때

앱 안에서는 Google 로그인 팝업이 동작하지 않을 수 있습니다.
그때는 `@capacitor-firebase/authentication` 플러그인으로 로그인한 뒤
받은 토큰으로 `firebase.auth().signInWithCredential(...)` 하도록 `FirebaseProvider.signIn()`만 바꾸면 됩니다.
