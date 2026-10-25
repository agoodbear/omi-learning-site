"use server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isAdmin, emailToEmployeeId } from "@/lib/auth/utils";
import { revalidatePath } from "next/cache";

/**
 * Delete a user by UID. Admin only.
 */
export async function deleteUserAction(adminUid: string, targetUid: string) {
    // Verify admin
    const adminUser = await adminAuth.getUser(adminUid);
    const adminEmployeeId = emailToEmployeeId(adminUser.email);
    if (!adminEmployeeId || !isAdmin(adminEmployeeId)) {
        return { success: false, error: "Unauthorized" };
    }

    // Prevent self-deletion
    if (adminUid === targetUid) {
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
export async function resetPasswordAction(adminUid: string, targetUid: string, newPassword: string) {
    // Verify admin
    const adminUser = await adminAuth.getUser(adminUid);
    const adminEmployeeId = emailToEmployeeId(adminUser.email);
    if (!adminEmployeeId || !isAdmin(adminEmployeeId)) {
        return { success: false, error: "Unauthorized" };
    }

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
