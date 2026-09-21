/* =============================================================================
   Firebase 설정 파일
   -----------------------------------------------------------------------------
   Firebase 콘솔(console.firebase.google.com) > 프로젝트 설정 > 일반 탭 맨 아래
   "내 앱" 섹션에서 웹 앱(</>)을 추가하면 아래와 똑같이 생긴 코드가 나옵니다.
   그 안의 firebaseConfig 객체 내용을 아래 FIREBASE_CONFIG 값 자리에 그대로
   붙여넣고 저장한 뒤, 이 파일 하나만 다시 업로드하면 모든 도구에 적용됩니다.

   이 값들은 공개되어도 안전합니다(공개 저장소에 올려도 문제 없음). 실제 접근
   권한은 Firebase 콘솔의 "Firestore Database > 규칙(Rules)"에서 별도로
   제어합니다 — 배포 가이드 문서의 "보안 규칙 설정" 단계를 참고하세요.
   ============================================================================= */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAeYLGvlHAp4p3mJNJE_D8TkN5eya-1CjY",
  authDomain: "safety-pcm.firebaseapp.com",
  projectId: "safety-pcm",
  storageBucket: "safety-pcm.firebasestorage.app",
  messagingSenderId: "476522688529",
  appId: "1:476522688529:web:4ea74dd7baa843adac81b0"
};
