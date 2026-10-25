import "server-only";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { emailToEmployeeId, isAdmin } from "./utils";

export interface VerifiedUser {
    uid: string;
    employeeId: string;
    isAdmin: boolean;
}

/**
 * Verifies a Firebase ID token sent from the client.
 * Server actions must never trust a uid passed from the browser.
 */
export async function requireUser(idToken: string): Promise<VerifiedUser> {
    if (!idToken) throw new Error("Unauthorized");

    const decoded = await adminAuth.verifyIdToken(idToken);
    const employeeId = emailToEmployeeId(decoded.email);
    if (!employeeId) throw new Error("Unauthorized");

    return { uid: decoded.uid, employeeId, isAdmin: isAdmin(employeeId) };
}

/**
 * Logged-in user whose account has been approved by an admin.
 */
export async function requireApproved(idToken: string): Promise<VerifiedUser> {
    const user = await requireUser(idToken);
    if (user.isAdmin) return user;

    const profile = await adminDb.collection("users").doc(user.uid).get();
    if (profile.data()?.approved !== true) throw new Error("帳號尚未核准");
    return user;
}

export async function requireAdmin(idToken: string): Promise<VerifiedUser> {
    const user = await requireUser(idToken);
    if (!user.isAdmin) throw new Error("Unauthorized");
    return user;
}
