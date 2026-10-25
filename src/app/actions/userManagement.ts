"use server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";

/**
 * Delete a user by UID. Admin only.
 */
export async function deleteUserAction(idToken: string, targetUid: string) {
    const admin = await requireAdmin(idToken);

    // Prevent self-deletion
    if (admin.uid === targetUid) {
        return { success: false, error: "無法刪除自己的帳號" };
    }

    try {
        // 1. Delete from Firebase Auth
        await adminAuth.deleteUser(targetUid);

        // 2. Delete related Firestore documents (optional cleanup)
        const batch = adminDb.batch();
        batch.delete(adminDb.doc(`users/${targetUid}`));
        batch.delete(adminDb.doc(`userContentStatus/${targetUid}`));
        batch.delete(adminDb.doc(`pointsStats/${targetUid}`));
        await batch.commit();

        revalidatePath("/admin/user-management");
        return { success: true };
    } catch (e: any) {
        console.error("Delete user failed:", e);
        return { success: false, error: e.message || "刪除失敗" };
    }
}

/**
 * Reset a user's password. Admin only.
 */
export async function resetPasswordAction(idToken: string, targetUid: string, newPassword: string) {
    await requireAdmin(idToken);

    // Validate password
    if (!newPassword || newPassword.length < 6) {
        return { success: false, error: "密碼至少需要 6 個字元" };
    }

    try {
        await adminAuth.updateUser(targetUid, { password: newPassword });
        return { success: true };
    } catch (e: any) {
        console.error("Reset password failed:", e);
        return { success: false, error: e.message || "重設密碼失敗" };
    }
}

/**
 * Approve (or revoke) a user's access to content. Admin only.
 */
export async function setUserApprovedAction(idToken: string, targetUid: string, approved: boolean) {
    await requireAdmin(idToken);

    try {
        await adminDb.doc(`users/${targetUid}`).set({ approved }, { merge: true });
        revalidatePath("/admin/user-management");
        return { success: true };
    } catch (e: any) {
        console.error("Set approval failed:", e);
        return { success: false, error: e.message || "更新失敗" };
    }
}
