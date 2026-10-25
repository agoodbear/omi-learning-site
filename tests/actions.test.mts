// Server action 權限測試：npm run test:actions（Auth＋Firestore 模擬器，不碰正式資料）
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

const PROJECT = "omi-rules-test";
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;

// admin.ts 需要服務帳戶；模擬器不驗簽，給一把拋棄式金鑰即可
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
    type: "service_account",
    project_id: PROJECT,
    client_email: `test@${PROJECT}.iam.gserviceaccount.com`,
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
});
process.env.GCLOUD_PROJECT = PROJECT;
process.env.NEXT_PUBLIC_ADMIN_EMPLOYEE_IDS = "16022";

const { adminDb } = await import("@/lib/firebase/admin");
const { submitQuizAttempt } = await import("@/app/actions/submitQuiz");
const { deleteCase } = await import("@/app/actions/deleteContent");
const { exportCollection } = await import("@/app/actions/exportData");
const { setUserApprovedAction } = await import("@/app/actions/userManagement");
const { logView } = await import("@/app/actions/logView");

async function signUp(employeeId: string): Promise<{ uid: string; token: string }> {
    const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${employeeId}@omi.local`, password: "test-pass-123", returnSecureToken: true }),
    });
    const j = await res.json();
    return { uid: j.localId, token: j.idToken };
}

// 偽造的 token：格式像 JWT，但沒有簽章
const FORGED = "eyJhbGciOiJub25lIn0.eyJ1aWQiOiJhZG1pbiJ9.";

let admin: { uid: string; token: string };
let ok: { uid: string; token: string };
let pending: { uid: string; token: string };

before(async () => {
    await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
    admin = await signUp("16022");
    ok = await signUp("20001");
    pending = await signUp("20002");
    await adminDb.doc(`users/${ok.uid}`).set({ uid: ok.uid, employeeId: "20001", approved: true });
    await adminDb.doc(`users/${pending.uid}`).set({ uid: pending.uid, employeeId: "20002", approved: false });
    await adminDb.doc("cases/q1").set({ status: "published", correct_answer: 2, title: "q1" });
    await adminDb.doc("cases/q2").set({ status: "published", correct_answer: 0, title: "q2" });
});

test("沒有 token／偽造 token 不能刪病例", async () => {
    await assert.rejects(deleteCase("", "q1"));
    await assert.rejects(deleteCase(FORGED, "q1"));
    assert.ok((await adminDb.doc("cases/q1").get()).exists);
});

test("一般使用者不能刪病例、不能匯出、不能核准別人", async () => {
    await assert.rejects(deleteCase(ok.token, "q1"));
    await assert.rejects(exportCollection(ok.token, "users"));
    await assert.rejects(setUserApprovedAction(pending.token, pending.uid, true));
    assert.ok((await adminDb.doc("cases/q1").get()).exists);
    assert.equal((await adminDb.doc(`users/${pending.uid}`).get()).data()?.approved, false);
});

test("管理員可以匯出", async () => {
    const res: any = await exportCollection(admin.token, "cases");
    assert.ok(res);
});

test("待核准帳號不能作答、不能記閱讀點數", async () => {
    await assert.rejects(submitQuizAttempt(pending.token, { categoryFilter: "All", items: [{ caseId: "q1", selected: 2 }] }));
    await assert.rejects(logView(pending.token, "case", "q1"));
});

test("分數由伺服器算：前端無法謊報答對", async () => {
    // 故意答錯兩題，但就算前端想送 correct 欄位也不會被採用
    const fake: any = { categoryFilter: "All", items: [{ caseId: "q1", selected: 0 }, { caseId: "q2", selected: 1 }], correct: 2, total: 2 };
    const res = await submitQuizAttempt(ok.token, fake);
    const attempt = (await adminDb.doc(`attempts/${res.attemptId}`).get()).data()!;
    assert.equal(attempt.total, 2);
    assert.equal(attempt.correct, 0);
    assert.equal(attempt.uid, ok.uid);
    assert.equal(attempt.employeeId, "20001");
});

test("答對才算對", async () => {
    const res = await submitQuizAttempt(ok.token, { categoryFilter: "All", items: [{ caseId: "q1", selected: 2 }, { caseId: "q2", selected: 0 }] });
    const attempt = (await adminDb.doc(`attempts/${res.attemptId}`).get()).data()!;
    assert.equal(attempt.correct, 2);
});

test("不能用草稿或不存在的病例作答", async () => {
    await adminDb.doc("cases/d1").set({ status: "draft", correct_answer: 0 });
    await assert.rejects(submitQuizAttempt(ok.token, { categoryFilter: "All", items: [{ caseId: "d1", selected: 0 }] }));
    await assert.rejects(submitQuizAttempt(ok.token, { categoryFilter: "All", items: [{ caseId: "nope", selected: 0 }] }));
});
