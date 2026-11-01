(function initializeFirebase(global) {
  const FIREBASE_SDK_VERSION = '10.14.1';
  const SDK_BASE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

  async function loadFirebase() {
    try {
      const configResponse = await fetch('/__/firebase/init.json', {
        headers: { Accept: 'application/json' },
      });
      if (!configResponse.ok) {
        throw new Error(`Firebase Hosting config unavailable (${configResponse.status})`);
      }

      const firebaseConfig = await configResponse.json();
      const [appSdk, authSdk, firestoreSdk, storageSdk, functionsSdk] = await Promise.all([
        import(`${SDK_BASE_URL}/firebase-app.js`),
        import(`${SDK_BASE_URL}/firebase-auth.js`),
        import(`${SDK_BASE_URL}/firebase-firestore.js`),
        import(`${SDK_BASE_URL}/firebase-storage.js`),
        import(`${SDK_BASE_URL}/firebase-functions.js`),
      ]);

      const app = appSdk.initializeApp(firebaseConfig);

      return Object.freeze({
        available: true,
        app,
        auth: authSdk.getAuth(app),
        db: firestoreSdk.getFirestore(app),
        storage: storageSdk.getStorage(app),
        functions: functionsSdk.getFunctions(app),
        sdk: Object.freeze({
          auth: authSdk,
          firestore: firestoreSdk,
          storage: storageSdk,
          functions: functionsSdk,
        }),
      });
    } catch (error) {
      console.info('Firebase가 설정되지 않아 로컬 데이터 모드로 실행합니다.');
      return Object.freeze({
        available: false,
        error,
      });
    }
  }

  /*
   * Firebase Web API Key는 클라이언트 식별값이며 보안 규칙을 대신하지 않습니다.
   * 키를 소스에 직접 기록하지 않고 Firebase Hosting의 예약 URL에서 구성값을 받습니다.
   */
  global.YEOSU_FIREBASE_READY = loadFirebase();
})(window);
