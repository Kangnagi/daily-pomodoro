// 계정 로그인 / 클라우드 동기화 설정
// ※ 아직 사용하지 않음 (enabled: false). 켜는 방법은 docs/CLOUD_SETUP.md 참고
//   enabled가 false인 동안에는 외부 스크립트를 전혀 불러오지 않고, 기록은 이 기기에만 저장된다.
window.DT = window.DT || {};

DT.CLOUD_CONFIG = {
  enabled: false,
  provider: "firebase",

  // Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)에서 복사해 붙여넣기
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    appId: "",
  },
};
