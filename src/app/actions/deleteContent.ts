"use server";

import { requireAdmin } from "@/lib/auth/server";

import { adminDb, adminStorage } from "@/lib/firebase/admin";

// 刪內容時一起刪 Storage 檔案，不然舊的下載連結（含 token）會一直有效（2026-11-08 security-audit）
async function deleteStoragePrefix(prefix: string): Promise<string | null> {
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) return "未設定 NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET，Storage 檔案沒刪";
    try {
        await adminStorage.bucket(bucketName).deleteFiles({ prefix, force: true });
        return null;
    } catch (error: unknown) {
        console.error("Delete storage error:", prefix, error);
        return `Storage 檔案刪除失敗：${error instanceof Error ? error.message : String(error)}`;
    }
}

export async function deleteCase(idToken: string, caseId: string) {
    await requireAdmin(idToken);
    if (!caseId) throw new Error("Case ID required");

    try {
        const batch = adminDb.batch();
        const caseRef = adminDb.collection("cases").doc(caseId);

        // Delete the case itself
        batch.delete(caseRef);

        // Delete case stats
        batch.delete(adminDb.collection("caseStats").doc(caseId));

        // Patient registry (MRN etc.) goes with the case
        batch.delete(adminDb.collection("caseRegistry").doc(caseId));

        // Note: We are keeping comments and attempts for now to avoid massive fan-out deletion
        // or we could delete them if strict cleanup is needed. 
        // For typical "soft" admin management, deleting the main pointer is often enough, 
        // but let's try to be clean with top-level collections.
        // Queries for comments/attempts usually filter by valid cases or parents.

        await batch.commit();
        const storageWarning = await deleteStoragePrefix(`cases/${caseId}/`);
        return { success: true, storageWarning };
    } catch (error: any) {
        console.error("Delete case error:", error);
        return { success: false, error: error.message };
    }
}

export async function deletePaper(idToken: string, paperId: string) {
    await requireAdmin(idToken);
    if (!paperId) throw new Error("Paper ID required");

    try {
        const batch = adminDb.batch();
        const paperRef = adminDb.collection("papers").doc(paperId);

        // Delete paper
        batch.delete(paperRef);

        // Delete highlights (Optional - can be expensive if many)
        // Let's just delete the paper for now.

        await batch.commit();
        const storageWarning = await deleteStoragePrefix(`papers/${paperId}/`);
        return { success: true, storageWarning };
    } catch (error: any) {
        console.error("Delete paper error:", error);
        return { success: false, error: error.message };
    }
}
