// 本機病例建檔工具：npm run intake → http://127.0.0.1:5317
// 原始 PDF、病歷號、年齡、性別、ECG日期只寫進 ~/phi-local；上傳到網站的只有裁切後的波形圖與主訴。
import http from "node:http";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { appendRow, ensureDirs, registeredCaseIds, ORIGINALS, REGISTRY } from "./registry.mjs";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PORT = Number(process.env.INTAKE_PORT || 5317);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SITE = "https://omi-learning-site.vercel.app";
const CATEGORIES = ["OMI", "STEMI_mimics", "Electrolyte"];

const env = Object.fromEntries(readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")
    .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, "")]));
initializeApp({ credential: cert(JSON.parse(readFileSync(join(ROOT, "service-account-key.json"), "utf8"))) });
const db = getFirestore();
const bucket = getStorage().bucket(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

// --- OCR 去識別檢查 ---------------------------------------------------------
const OCR_BIN = join(HERE, ".bin", "ocr");
async function ocrBin() {
    if (!existsSync(OCR_BIN)) await run("swiftc", ["-O", join(HERE, "ocr.swift"), "-o", OCR_BIN]);
    return OCR_BIN;
}

async function ocrLines(pngBuffer) {
    const dir = mkdtempSync(join(tmpdir(), "omi-intake-"));
    try {
        const p = join(dir, "crop.png");
        writeFileSync(p, pngBuffer);
        const { stdout } = await run(await ocrBin(), [p]);
        return JSON.parse(stdout);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const DATE_RE = /((19|20)\d{2}\s*[\/\-.年]\s*\d{1,2}\s*[\/\-.月]\s*\d{1,2})|(\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*(19|20)?\d{2}\b)/;
const TIME_RE = /\b\d{1,2}:\d{2}(:\d{2})?\b/;
const LONG_DIGITS_RE = /\d{7,}/;

/** 回傳擋下的理由（空陣列＝通過）。只回給本機瀏覽器，不寫 log。 */
function phiFindings(lines, mrn) {
    const text = lines.join(" ");
    const digits = text.replace(/\D/g, "");
    const mrnDigits = String(mrn || "").replace(/\D/g, "");
    const reasons = [];
    if (mrnDigits.length >= 4 && digits.includes(mrnDigits)) reasons.push("圖裡讀得到病歷號");
    if (DATE_RE.test(text)) reasons.push("圖裡有日期");
    if (TIME_RE.test(text)) reasons.push("圖裡有時間");
    if (LONG_DIGITS_RE.test(text.replace(/\s/g, ""))) reasons.push("圖裡有7位以上的連續數字（可能是證號或病歷號）");
    // 波形區不該有中文；有就可能是姓名或病房（MUSE 報告裁上方29%時曾殘留一行）
    if (/[\u4e00-\u9fff]/.test(text)) reasons.push("圖裡有中文字（可能是姓名）");
    return reasons;
}

// --- 網站上的呈現 ------------------------------------------------------------
function ageLabel(age) {
    const n = Number(age);
    return n >= 90 ? "90歲以上" : `${n}歲`;
}

function publicContext({ age, sex, cc, showAgeSex }) {
    return showAgeSex ? `${ageLabel(age)}${sex}，主訴：${cc}` : `主訴：${cc}`;
}

// --- HTTP ---------------------------------------------------------------------
function send(res, code, body, type = "application/json; charset=utf-8") {
    res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}

async function readJson(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validatePerson({ mrn, age, sex }) {
    if (!String(mrn || "").trim()) return "請填病歷號";
    const n = Number(age);
    if (!Number.isInteger(n) || n < 0 || n > 120) return "年齡要是 0–120 的整數";
    if (!["男性", "女性"].includes(sex)) return "請選性別";
    return null;
}

const STATIC = {
    "/": [join(HERE, "index.html"), "text/html; charset=utf-8"],
    "/pdf.min.js": [join(ROOT, "node_modules/pdfjs-dist/build/pdf.min.js"), "text/javascript"],
    "/pdf.worker.min.js": [join(ROOT, "node_modules/pdfjs-dist/build/pdf.worker.min.js"), "text/javascript"],
};

const server = http.createServer(async (req, res) => {
    try {
        // 擋 DNS rebinding：只認直接打 127.0.0.1 的請求
        if (req.headers.host !== `127.0.0.1:${PORT}`) return send(res, 403, { error: "forbidden" });
        if (req.method === "GET" && STATIC[req.url]) {
            const [file, type] = STATIC[req.url];
            return send(res, 200, readFileSync(file), type);
        }
        // 只接受這個頁面自己送來的請求（擋掉其他網站對 localhost 的偷打）
        if (req.method === "POST" && req.headers.origin !== ORIGIN) return send(res, 403, { error: "forbidden" });

        if (req.method === "GET" && req.url === "/api/cases") {
            const done = registeredCaseIds();
            const snap = await db.collection("cases").select("title", "status", "category").get();
            const cases = snap.docs.map(d => ({ id: d.id, ...d.data(), registered: done.has(d.id) }));
            return send(res, 200, { cases, registry: REGISTRY });
        }

        if (req.method === "POST" && req.url === "/api/check") {
            const { png, mrn } = await readJson(req);
            const lines = await ocrLines(Buffer.from(png, "base64"));
            return send(res, 200, { lines, reasons: phiFindings(lines, mrn) });
        }

        if (req.method === "POST" && req.url === "/api/create") {
            const b = await readJson(req);
            const bad = validatePerson(b);
            if (bad) return send(res, 400, { error: bad });
            if (!String(b.cc || "").trim()) return send(res, 400, { error: "請填主訴" });
            if (!CATEGORIES.includes(b.category)) return send(res, 400, { error: "請選分類" });
            if (!b.confirmed) return send(res, 400, { error: "請先目視確認裁切後的圖沒有病人資料" });

            const png = Buffer.from(b.png, "base64");
            const reasons = phiFindings(await ocrLines(png), b.mrn);
            if (reasons.length) return send(res, 400, { error: "去識別沒過：" + reasons.join("、") });

            const ref = db.collection("cases").doc();
            const token = randomUUID();
            const path = `cases/${ref.id}/${randomUUID()}.png`;
            await bucket.file(path).save(png, {
                contentType: "image/png",
                metadata: { metadata: { firebaseStorageDownloadTokens: token } },
            });
            const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

            const cc = String(b.cc).trim();
            const now = Timestamp.now();
            await ref.set({
                title: b.showAgeSex ? `${ageLabel(b.age)}${b.sex} ${cc}` : cc,
                category: b.category,
                status: "draft",
                clinical_context: publicContext({ ...b, cc }),
                ecg_images: [url],
                references: [],
                createdAt: now,
                updatedAt: now,
            });

            ensureDirs();
            let original = "";
            if (b.original && b.originalName) {
                original = `${ref.id}${extname(b.originalName) || ".pdf"}`;
                writeFileSync(join(ORIGINALS, original), Buffer.from(b.original, "base64"), { mode: 0o600 });
            }
            appendRow({
                case_id: ref.id, 病歷號: String(b.mrn).trim(), 年齡: b.age, 性別: b.sex,
                ECG日期: b.ecgDate || "", 主訴: cc, 分類: b.category,
                建立時間: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }), 原始檔: original,
            });
            return send(res, 200, { caseId: ref.id, editUrl: `${SITE}/admin/cases/${ref.id}/edit` });
        }

        if (req.method === "POST" && req.url === "/api/link") {
            const b = await readJson(req);
            const bad = validatePerson(b);
            if (bad) return send(res, 400, { error: bad });
            const snap = await db.doc(`cases/${b.caseId}`).get();
            if (!snap.exists) return send(res, 404, { error: "網站上找不到這個病例" });
            if (registeredCaseIds().has(b.caseId)) return send(res, 409, { error: "這個病例已經登錄過了" });
            appendRow({
                case_id: b.caseId, 病歷號: String(b.mrn).trim(), 年齡: b.age, 性別: b.sex,
                ECG日期: b.ecgDate || "", 主訴: snap.data().clinical_context || "", 分類: snap.data().category || "",
                建立時間: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }), 原始檔: "",
            });
            return send(res, 200, { caseId: b.caseId });
        }

        send(res, 404, { error: "not found" });
    } catch (e) {
        // 不印 request 內容，避免病人資料進 log
        console.error("intake error:", e?.message);
        send(res, 500, { error: "伺服器錯誤：" + (e?.message || "") });
    }
});

server.listen(PORT, "127.0.0.1", () => {
    ensureDirs();
    console.log(`OMI 病例建檔工具：${ORIGIN}`);
    console.log(`登錄檔（只在本機）：${REGISTRY}`);
});
