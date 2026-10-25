// 病例登錄檔：病歷號／年齡／性別／ECG日期只存在這台 Mac（~/phi-local），永遠不上傳。
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const PHI_DIR = process.env.OMI_PHI_DIR || join(homedir(), "phi-local", "omi-learning-site");
export const REGISTRY = join(PHI_DIR, "registry.csv");
export const ORIGINALS = join(PHI_DIR, "originals");

const HEADER = ["case_id", "病歷號", "年齡", "性別", "ECG日期", "主訴", "分類", "建立時間", "原始檔"];

export function ensureDirs() {
    mkdirSync(ORIGINALS, { recursive: true, mode: 0o700 });
    if (!existsSync(REGISTRY)) {
        // BOM 讓 Excel／Numbers 正確顯示中文
        writeFileSync(REGISTRY, "﻿" + HEADER.join(",") + "\n", { mode: 0o600 });
    }
}

function csvCell(v) {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function appendRow(row) {
    ensureDirs();
    appendFileSync(REGISTRY, HEADER.map(h => csvCell(row[h])).join(",") + "\n");
}

function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') q = false;
            else cell += c;
        } else if (c === '"') q = true;
        else if (c === ",") { row.push(cell); cell = ""; }
        else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
        else if (c !== "\r") cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
}

/** 已登錄的 case_id 集合（只回傳 ID，不碰病人資料欄位） */
export function registeredCaseIds() {
    if (!existsSync(REGISTRY)) return new Set();
    const rows = parseCsv(readFileSync(REGISTRY, "utf8").replace(/^﻿/, ""));
    return new Set(rows.slice(1).map(r => r[0]).filter(Boolean));
}
