// Storage 規則測試：npm run test:storage（Firestore＋Storage 模擬器；Storage 規則會跨查 Firestore 的核准狀態）
import { readFileSync } from "node:fs";
import { test, before, after, beforeEach } from "node:test";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { ref, getBytes, uploadBytes, listAll } from "firebase/storage";

let env;
const ADMIN = { uid: "admin", email: "16022@omi.local", admin: true };
const NOCLAIM = { uid: "noclaim", email: "16022@omi.local" };
const OK = { uid: "ok", email: "20001@omi.local" };
const PENDING = { uid: "pending", email: "20002@omi.local" };
const STRANGER = { uid: "stranger", email: "99999@omi.local" }; // 自己註冊、還沒建 profile

const st = (u) => env.authenticatedContext(u.uid, u.admin ? { email: u.email, admin: true } : { email: u.email }).storage();
const png = new Uint8Array([137, 80, 78, 71]);

before(async () => {
    env = await initializeTestEnvironment({
        projectId: "omi-storage-test",
        firestore: { rules: readFileSync("firestore.rules", "utf8") },
        storage: { rules: readFileSync("storage.rules", "utf8") },
    });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
    await env.clearFirestore();
    await env.clearStorage();
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/ok"), { uid: "ok", employeeId: "20001", approved: true });
        await setDoc(doc(ctx.firestore(), "users/pending"), { uid: "pending", employeeId: "20002", approved: false });
        await uploadBytes(ref(ctx.storage(), "cases/c1/ecg.png"), png, { contentType: "image/png" });
        await uploadBytes(ref(ctx.storage(), "papers/p1/a.pdf"), png, { contentType: "application/pdf" });
    });
});

test("未登入讀不到病例圖", async () => {
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), "cases/c1/ecg.png")));
});

test("自己註冊、未核准的帳號讀不到病例圖和論文、列不出檔案", async () => {
    for (const u of [STRANGER, PENDING, NOCLAIM]) {
        await assertFails(getBytes(ref(st(u), "cases/c1/ecg.png")));
        await assertFails(getBytes(ref(st(u), "papers/p1/a.pdf")));
        await assertFails(listAll(ref(st(u), "cases/c1")));
    }
});

test("已核准、管理員讀得到", async () => {
    await assertSucceeds(getBytes(ref(st(OK), "cases/c1/ecg.png")));
    await assertSucceeds(getBytes(ref(st(OK), "papers/p1/a.pdf")));
    await assertSucceeds(getBytes(ref(st(ADMIN), "cases/c1/ecg.png")));
});

test("未核准不能上傳病例圖；已核准可以；論文只有管理員能傳", async () => {
    await assertFails(uploadBytes(ref(st(PENDING), "cases/c9/x.png"), png, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(st(STRANGER), "cases/c9/x.png"), png, { contentType: "image/png" }));
    await assertSucceeds(uploadBytes(ref(st(OK), "cases/c9/x.png"), png, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(st(OK), "papers/p9/x.pdf"), png, { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(st(NOCLAIM), "papers/p9/x.pdf"), png, { contentType: "application/pdf" }));
    await assertSucceeds(uploadBytes(ref(st(ADMIN), "papers/p9/x.pdf"), png, { contentType: "application/pdf" }));
});
