const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const email = process.argv[2];
const shouldRemove = process.argv.includes('--remove');

if (!email) {
  console.error('사용법: npm run admin:grant -- admin@example.com [--remove]');
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
});

(async () => {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const currentClaims = user.customClaims || {};
  const nextClaims = { ...currentClaims };

  if (shouldRemove) delete nextClaims.admin;
  else nextClaims.admin = true;

  await auth.setCustomUserClaims(user.uid, nextClaims);
  await auth.revokeRefreshTokens(user.uid);

  console.log(
    shouldRemove
      ? `${email} 계정의 관리자 권한을 제거했습니다.`
      : `${email} 계정에 관리자 권한을 부여했습니다.`,
  );
  console.log('해당 사용자는 다시 로그인해야 새 권한이 적용됩니다.');
})().catch((error) => {
  console.error('관리자 권한 설정 실패:', error.message);
  process.exit(1);
});
