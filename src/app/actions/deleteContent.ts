"use server";

import { adminDb } from "@/lib/firebase/admin";

export async function deleteCase(caseId: string) {
    if (!caseId) throw new Error("Case ID required");

    try {
        const batch = adminDb.batch();
        const caseRef = adminDb.collection("cases").doc(caseId);

        // Delete the case itself
        batch.delete(caseRef);

        // Delete case stats
        batch.delete(adminDb.collection("caseStats").doc(caseId));

        // Note: We are keeping comments and attempts for now to avoid massive fan-out deletion
        // or we could delete them if strict cleanup is needed. 
        // For typical "soft" admin management, deleting the main pointer is often enough, 
        // but let's try to be clean with top-level collections.
        // Queries for comments/attempts usually filter by valid cases or parents.

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error("Delete case error:", error);
        return { success: false, error: error.message };
    }
}

export async function deletePaper(paperId: string) {
    if (!paperId) throw new Error("Paper ID required");

    try {
        const batch = adminDb.batch();
        const paperRef = adminDb.collection("papers").doc(paperId);

        // Delete paper
        batch.delete(paperRef);

        // Delete highlights (Optional - can be expensive if many)
        // Let's just delete the paper for now.

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error("Delete paper error:", error);
        return { success: false, error: error.message };
    }
}
