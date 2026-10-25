// 原始 PDF（含姓名等完整病人資料）只存在這台 Mac；病歷號等登錄資料存在 Firestore caseRegistry（只有管理員讀得到）。
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const PHI_DIR = process.env.OMI_PHI_DIR || join(homedir(), "phi-local", "omi-learning-site");
export const ORIGINALS = join(PHI_DIR, "originals");

export function ensureDirs() {
    mkdirSync(ORIGINALS, { recursive: true, mode: 0o700 });
}
