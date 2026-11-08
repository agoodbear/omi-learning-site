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

const ADMIN = { uid: "admin", email: "16022@omi.local", admin: true };
const NOCLAIM = { uid: "noclaim", email: "16022@omi.local" }; // 帳號字串像管理員、但沒有 admin claim
const OK = { uid: "ok", email: "20001@omi.local" };       // 已核准
const PENDING = { uid: "pending", email: "20002@omi.local" }; // 待核准

const as = (u) => env.authenticatedContext(u.uid, u.admin ? { email: u.email, admin: true } : { email: u.email }).firestore();

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

test("病人資料（caseRegistry）只有管理員能讀寫", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "caseRegistry/c1"), { mrn: "x", age: 60, sex: "男性" });
    });
    await assertFails(getDoc(doc(as(OK), "caseRegistry/c1")));
    await assertFails(setDoc(doc(as(OK), "caseRegistry/c9"), { mrn: "y" }));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "caseRegistry/c1")));
    await assertSucceeds(getDoc(doc(as(ADMIN), "caseRegistry/c1")));
    await assertSucceeds(setDoc(doc(as(ADMIN), "caseRegistry/c9"), { mrn: "y" }));
});

test("一般人不能列出所有帳號", async () => {
    await assertFails(getDocs(collection(as(OK), "users")));
});

// ---- 2026-11-08 security-audit 修正 ----

test("管理員只認 admin claim：只有 16022 帳號字串不算", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "caseRegistry/c1"), { mrn: "x" });
    });
    await assertFails(getDoc(doc(as(NOCLAIM), "caseRegistry/c1")));
    await assertFails(getDoc(doc(as(NOCLAIM), "cases/c2")));
    await assertSucceeds(getDoc(doc(as(ADMIN), "caseRegistry/c1")));
});

test("註冊時 employeeId 必須跟登入帳號一致", async () => {
    const u = { uid: "new2", email: "20010@omi.local" };
    await assertFails(setDoc(doc(as(u), "users/new2"), { uid: "new2", employeeId: "16022", approved: false }));
    await assertFails(setDoc(doc(as(u), "users/new2"), { uid: "new2", approved: false }));
    await assertSucceeds(setDoc(doc(as(u), "users/new2"), { uid: "new2", employeeId: "20010", approved: false }));
});

test("留言不能冒用別人的員編、不能自帶表情", async () => {
    const base = { caseId: "c1", userId: "ok", content: "hi", reactions: {} };
    await assertFails(addDoc(collection(as(OK), "comments"), { ...base, userEmail: "16022" }));
    await assertFails(addDoc(collection(as(OK), "comments"), { ...base, userEmail: "20001", reactions: { "👍": ["a", "b"] } }));
    await assertFails(addDoc(collection(as(OK), "comments"), { ...base, userEmail: "20001", isPinned: true }));
    await assertSucceeds(addDoc(collection(as(OK), "comments"), { ...base, userEmail: "20001" }));
});

test("作者改留言不能改顯示名稱", async () => {
    await assertFails(updateDoc(doc(as(OK), "comments/m1"), { userEmail: "16022" }));
});

test("表情只能加減自己、只能用四種、名單要是陣列", async () => {
    const other = { uid: "other", email: "20009@omi.local" };
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/other"), { uid: "other", employeeId: "20009", approved: true });
        await setDoc(doc(ctx.firestore(), "comments/m2"), { userId: "ok", content: "hi", reactions: { "👍": ["ok"] } });
    });
    await assertFails(updateDoc(doc(as(other), "comments/m2"), { reactions: { "👍": ["ok", "x"] } }));
    await assertFails(updateDoc(doc(as(other), "comments/m2"), { reactions: { "👍": [] } }));       // 把別人拿掉
    await assertFails(updateDoc(doc(as(other), "comments/m2"), { reactions: {} }));                // 整個表情刪掉
    await assertFails(updateDoc(doc(as(other), "comments/m2"), { reactions: { "👍": ["ok"], "💩": ["other"] } }));
    await assertFails(updateDoc(doc(as(other), "comments/m2"), { reactions: { "👍": "ok" } }));
    await assertSucceeds(updateDoc(doc(as(other), "comments/m2"), { reactions: { "👍": ["ok", "other"] } }));
    await assertSucceeds(updateDoc(doc(as(other), "comments/m2"), { reactions: { "👍": ["ok"] } }));
    await assertSucceeds(updateDoc(doc(as(OK), "comments/m2"), { reactions: {} }));                 // 只剩自己時可以整個拿掉
});
