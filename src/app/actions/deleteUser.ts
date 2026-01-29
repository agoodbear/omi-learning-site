"use server";

import { adminDb, adminAuth } from "@/lib/firebase/admin";

export async function deleteUser(uid: string) {
    if (!uid) throw new Error("UID Required");

    try {
        // 1. Delete from Firebase Auth
        try {
            await adminAuth.deleteUser(uid);
        } catch (e: any) {
            // If user not found in Auth (already deleted), continue to clean DB
            if (e.code !== 'auth/user-not-found') {
                console.error("Auth delete failed", e);
                // Proceeding anyway to clean up DB orphans
            }
        }

        // 2. Delete Firestore Documents
        const batch = adminDb.batch();

        // Core Profile
        batch.delete(adminDb.collection("users").doc(uid));

        // Stats & Gamification
        batch.delete(adminDb.collection("userStats").doc(uid));
        batch.delete(adminDb.collection("pointsStats").doc(uid));
        batch.delete(adminDb.collection("userContentStatus").doc(uid));

        // Note: We do NOT delete 'events', 'attempts' or 'comments' to preserve 
        // research integrity and audit trails. The 'uid' will just be orphaned, 
        // which is standard for research data retention (de-identified effectively if auth is gone).

        await batch.commit();

        return { success: true };
    } catch (error: any) {
        console.error("Delete user failed:", error);
        return { success: false, error: error.message };
    }
}
