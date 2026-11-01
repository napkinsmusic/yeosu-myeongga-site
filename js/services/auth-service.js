(function initializeAuthService(global) {
  async function getFirebase() {
    const firebase = await global.YEOSU_FIREBASE_READY;
    if (!firebase?.available) {
      const error = new Error('Firebase Authentication이 연결되지 않았습니다.');
      error.code = 'auth/firebase-unavailable';
      throw error;
    }
    return firebase;
  }

  async function signIn(email, password) {
    const firebase = await getFirebase();
    const credential = await firebase.sdk.auth.signInWithEmailAndPassword(
      firebase.auth,
      email.trim(),
      password,
    );
    await credential.user.getIdToken(true);
    return credential.user;
  }

  async function signOut() {
    const firebase = await getFirebase();
    return firebase.sdk.auth.signOut(firebase.auth);
  }

  async function getCurrentUser() {
    const firebase = await getFirebase();
    return new Promise((resolve) => {
      const unsubscribe = firebase.sdk.auth.onAuthStateChanged(
        firebase.auth,
        (user) => {
          unsubscribe();
          resolve(user);
        },
      );
    });
  }

  async function verifyAdmin(user) {
    if (!user) return false;
    const firebase = await getFirebase();
    const token = await user.getIdTokenResult(true);
    if (token.claims.admin !== true) return false;

    const verifyAccess = firebase.sdk.functions.httpsCallable(
      firebase.functions,
      'verifyAdminAccess',
    );
    const response = await verifyAccess();
    return response.data?.isAdmin === true;
  }

  async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user) {
      global.location.replace('./login.html?reason=login-required');
      return null;
    }

    const isAdmin = await verifyAdmin(user);
    if (!isAdmin) {
      await signOut();
      global.location.replace('./login.html?reason=forbidden');
      return null;
    }
    return user;
  }

  global.YEOSU_AUTH_SERVICE = Object.freeze({
    signIn,
    signOut,
    getCurrentUser,
    verifyAdmin,
    requireAdmin,
  });
})(window);
