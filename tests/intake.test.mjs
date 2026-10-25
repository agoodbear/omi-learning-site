// 本機建檔工具測試：npm run test:intake（Firestore＋Storage 模擬器、暫存登錄檔，不碰正式資料與 ~/phi-local）
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new Error("必須在模擬器裡跑（npm run test:intake），避免寫到正式資料");
}

const PORT = 5399;
const BASE = `http://127.0.0.1:${PORT}`;
const PHI = mkdtempSync(join(tmpdir(), "omi-phi-test-"));
let server;

// 用 Python 畫測試圖：一張乾淨波形、一張帶病歷號與日期
function makePng(withPhi) {
    const out = join(PHI, `${withPhi}.png`);
    execFileSync("python3", ["-c", `
from PIL import Image, ImageDraw, ImageFont
f=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',40)
im=Image.new('RGB',(1400,300),'white'); d=ImageDraw.Draw(im)
d.line([(0,150),(300,150),(320,40),(340,260),(360,150),(1400,150)],fill='black',width=3)
d.text((20,240),'25mm/s 10mm/mV',fill='black',font=f)
if '${withPhi}' == 'cjk':
    d.text((700,20),'王小明',fill='black',font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',40,index=0))
if '${withPhi}' == 'true':
    d.text((20,20),'Chart No 12345678',fill='black',font=f); d.text((700,20),'2026/10/25 14:23',fill='black',font=f)
im.save('${out}')`]);
    return readFileSync(out).toString("base64");
}

const post = (path, body, origin = BASE) => fetch(BASE + path, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
});

const person = { mrn: "12345678", age: 67, sex: "男性", ecgDate: "2026-10-25" };

before(async () => {
    server = spawn("node", ["intake/server.mjs"], { env: { ...process.env, INTAKE_PORT: String(PORT), OMI_PHI_DIR: PHI }, stdio: "pipe" });
    for (let i = 0; i < 100; i++) {
        try { await fetch(BASE + "/"); return; } catch { await new Promise(r => setTimeout(r, 200)); }
    }
    throw new Error("intake server did not start");
});

after(() => { server?.kill(); rmSync(PHI, { recursive: true, force: true }); });

test("別的網站送來的請求會被擋", async () => {
    const r = await post("/api/check", { png: "", mrn: "" }, "https://evil.example");
    assert.equal(r.status, 403);
});

test("圖裡有病歷號和日期：檢查不過、也不能建立", async () => {
    const png = makePng(true);
    const chk = await (await post("/api/check", { png, mrn: person.mrn })).json();
    assert.ok(chk.reasons.some(x => x.includes("病歷號")));
    assert.ok(chk.reasons.some(x => x.includes("日期")));
    const r = await post("/api/create", { ...person, png, cc: "胸痛", category: "OMI", showAgeSex: true, confirmed: true });
    assert.equal(r.status, 400);
    assert.ok(!existsSync(join(PHI, "registry.csv")) || !readFileSync(join(PHI, "registry.csv"), "utf8").includes(person.mrn));
});

test("圖裡有中文（可能是姓名）會被擋", async () => {
    const chk = await (await post("/api/check", { png: makePng("cjk"), mrn: person.mrn })).json();
    assert.ok(chk.reasons.some(x => x.includes("中文")));
});

test("沒勾目視確認不能建立", async () => {
    const r = await post("/api/create", { ...person, png: makePng(false), cc: "胸痛", category: "OMI", showAgeSex: true, confirmed: false });
    assert.equal(r.status, 400);
});

test("乾淨的圖：網站只有主訴與年齡性別，病歷號與日期只在本機登錄檔", async () => {
    const png = makePng(false);
    const r = await post("/api/create", {
        ...person, png, cc: "胸痛30分鐘", category: "OMI", showAgeSex: true, confirmed: true,
        original: Buffer.from("%PDF-fake").toString("base64"), originalName: "x.pdf",
    });
    assert.equal(r.status, 200);
    const { caseId } = await r.json();

    const { getFirestore } = await import("firebase-admin/firestore");
    const { initializeApp, getApps } = await import("firebase-admin/app");
    if (!getApps().length) initializeApp({ projectId: "omi-ecg-learning-site" });
    const doc = (await getFirestore().doc(`cases/${caseId}`).get()).data();
    const onSite = JSON.stringify(doc);
    assert.equal(doc.status, "draft");
    assert.equal(doc.clinical_context, "67歲男性，主訴：胸痛30分鐘");
    assert.ok(!onSite.includes(person.mrn), "網站資料不能有病歷號");
    assert.ok(!onSite.includes("2026-10-25"), "網站資料不能有ECG日期");

    const reg = readFileSync(join(PHI, "registry.csv"), "utf8");
    assert.ok(reg.includes(caseId) && reg.includes(person.mrn) && reg.includes("2026-10-25"));
    assert.ok(existsSync(join(PHI, "originals", `${caseId}.pdf`)));
});

test("90歲以上只顯示「90歲以上」、可選擇不顯示年齡性別", async () => {
    const png = makePng(false);
    const r1 = await (await post("/api/create", { ...person, age: 93, png, cc: "暈倒", category: "OMI", showAgeSex: true, confirmed: true })).json();
    const r2 = await (await post("/api/create", { ...person, png, cc: "心悸", category: "OMI", showAgeSex: false, confirmed: true })).json();
    const { getFirestore } = await import("firebase-admin/firestore");
    assert.equal((await getFirestore().doc(`cases/${r1.caseId}`).get()).data().clinical_context, "90歲以上男性，主訴：暈倒");
    assert.equal((await getFirestore().doc(`cases/${r2.caseId}`).get()).data().clinical_context, "主訴：心悸");
});

test("補登：網站已有的病例可補登一次，重複補登會被擋", async () => {
    const { getFirestore } = await import("firebase-admin/firestore");
    await getFirestore().doc("cases/existing1").set({ title: "舊病例", status: "published", category: "OMI", clinical_context: "x" });
    const ok = await post("/api/link", { ...person, mrn: "87654321", caseId: "existing1" });
    assert.equal(ok.status, 200);
    const dup = await post("/api/link", { ...person, mrn: "87654321", caseId: "existing1" });
    assert.equal(dup.status, 409);
    const missing = await post("/api/link", { ...person, caseId: "nope" });
    assert.equal(missing.status, 404);
    assert.ok(readFileSync(join(PHI, "registry.csv"), "utf8").includes("87654321"));
});
