// Firestore 規則測試：npm run test:rules（會自動開本機模擬器）
import { readFileSync } from "node:fs";
import { test, before, after, beforeEach } from "node:test";
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, addDoc } from "firebase/firestore";

let env;

const ADMIN = { uid: "admin", email: "16022@omi.local" };
const OK = { uid: "ok", email: "20001@omi.local" };       // 已核准
const PENDING = { uid: "pending", email: "20002@omi.local" }; // 待核准

const as = (u) => env.authenticatedContext(u.uid, { email: u.email }).firestore();

before(async () => {
    env = await initializeTestEnvironment({
        projectId: "omi-rules-test",
        firestore: { rules: readFileSync(process.env.RULES_FILE || "firestore.rules", "utf8") },
    });
});

after(async () => { await env.cleanup(); });

beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, "users/ok"), { uid: "ok", employeeId: "20001", approved: true });
        await setDoc(doc(db, "users/pending"), { uid: "pending", employeeId: "20002", approved: false });
        await setDoc(doc(db, "cases/c1"), { status: "published", title: "t", correct_answer: 0 });
        await setDoc(doc(db, "cases/c2"), { status: "draft", title: "d" });
        await setDoc(doc(db, "comments/m1"), { userId: "ok", content: "hi", reactions: {} });
        await setDoc(doc(db, "clinicalEvents/e1"), { x: 1 });
    });
});

test("未登入讀不到病例", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "cases/c1")));
});

test("待核准帳號讀不到病例", async () => {
    await assertFails(getDoc(doc(as(PENDING), "cases/c1")));
});

test("已核准帳號讀得到已發布、讀不到草稿", async () => {
    await assertSucceeds(getDoc(doc(as(OK), "cases/c1")));
    await assertFails(getDoc(doc(as(OK), "cases/c2")));
});

test("自己不能把 approved 改成 true", async () => {
    await assertFails(updateDoc(doc(as(PENDING), "users/pending"), { approved: true }));
});

test("自己可以更新登入時間", async () => {
    await assertSucceeds(updateDoc(doc(as(PENDING), "users/pending"), { lastLoginAt: new Date() }));
});

test("新註冊不能自帶 approved: true", async () => {
    const u = { uid: "new", email: "20003@omi.local" };
    await assertFails(setDoc(doc(as(u), "users/new"), { uid: "new", employeeId: "20003", approved: true }));
    await assertSucceeds(setDoc(doc(as(u), "users/new"), { uid: "new", employeeId: "20003", approved: false }));
});

test("不能改自己的 employeeId", async () => {
    await assertFails(updateDoc(doc(as(OK), "users/ok"), { employeeId: "16022" }));
});

test("別人的留言只能動表情回應", async () => {
    const other = { uid: "other", email: "20009@omi.local" };
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/other"), { uid: "other", employeeId: "20009", approved: true });
    });
    await assertFails(updateDoc(doc(as(other), "comments/m1"), { content: "改掉" }));
    await assertFails(updateDoc(doc(as(other), "comments/m1"), { userId: "other" }));
    await assertSucceeds(updateDoc(doc(as(other), "comments/m1"), { reactions: { "❤️": ["other"] } }));
    await assertSucceeds(updateDoc(doc(as(OK), "comments/m1"), { content: "我改自己的" }));
});

test("待核准帳號不能留言", async () => {
    await assertFails(addDoc(collection(as(PENDING), "comments"), { userId: "pending", content: "x", reactions: {} }));
});

test("投稿病例必須是 pending 且是自己", async () => {
    await assertSucceeds(addDoc(collection(as(OK), "cases"), { status: "pending", submittedBy: { uid: "ok" } }));
    await assertFails(addDoc(collection(as(OK), "cases"), { status: "published", submittedBy: { uid: "ok" } }));
    await assertFails(addDoc(collection(as(OK), "cases"), { status: "pending", submittedBy: { uid: "admin" } }));
    await assertFails(addDoc(collection(as(PENDING), "cases"), { status: "pending", submittedBy: { uid: "pending" } }));
});

test("臨床資料連管理員都不能從前端讀寫", async () => {
    await assertFails(getDoc(doc(as(ADMIN), "clinicalEvents/e1")));
    await assertFails(setDoc(doc(as(ADMIN), "clinicalEvents/e2"), { x: 1 }));
});

test("管理員可以核准別人、讀所有人", async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN), "users/pending"), { approved: true }));
    await assertSucceeds(getDocs(collection(as(ADMIN), "users")));
});

test("一般人不能列出所有帳號", async () => {
    await assertFails(getDocs(collection(as(OK), "users")));
});
