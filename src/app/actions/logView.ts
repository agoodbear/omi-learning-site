"use server";

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function logView(uid: string, type: "case" | "paper", id: string, meta: any = {}) {
    if (!uid) return;

    const batch = adminDb.batch();
    const timestamp = FieldValue.serverTimestamp();

    // 0. Fetch Employee ID
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const employeeId = userDoc.data()?.employeeId || "UNKNOWN";

    // 1. Log Event
    const eventRef = adminDb.collection("events").doc();
    batch.set(eventRef, {
        uid,
        employeeId,
        action: type === "case" ? "view_case" : "view_literature",
        targetType: type,
        targetId: id,
        createdAt: timestamp,
        meta
    });

    // 2. Update Content Status (for Unread Counts)
    const statusRef = adminDb.collection("userContentStatus").doc(uid);
    const fieldObj = type === "case" ? { casesRead: FieldValue.arrayUnion(id) } : { papersRead: FieldValue.arrayUnion(id) };

    batch.set(statusRef, {
        uid, // Ensure doc exists
        ...fieldObj,
        updatedAt: timestamp
    }, { merge: true });

    // 3. Update Gamification Points (Optional: Points for reading?)
    // Requirement D-2 says: "閱讀 Case/Literature: +1 (首次)".
    // We need to check if it's FIRST time.
    // If we use conditional update, we need to know if it was ALREADY read.
    // We can read `userContentStatus` first.
    // However, reads in Server Action are fast.

    // Check if ALREADY read
    // But `arrayUnion` doesn't tell us if it added or not (it's idempotent).
    // So we fetch status first.

    const statusSnap = await statusRef.get();
    const data = statusSnap.data() || {};
    const list = type === "case" ? (data.casesRead || []) : (data.papersRead || []);

    const isFirstView = !list.includes(id);
    const pointsToAward = isFirstView ? 5 : 1; // First view +5, repeat +1
    const breakdownField = type === "case" ? "casePoints" : "paperPoints";

    const pointsRef = adminDb.collection("pointsStats").doc(uid);

    // Award first_case badge on first ever case view
    const badgeToAward = isFirstView && type === "case" && list.length === 0 ? "first_case" : null;

    const updateData: any = {
        uid,
        totalPoints: FieldValue.increment(pointsToAward),
        [`pointsBreakdown.${breakdownField}`]: FieldValue.increment(pointsToAward),
        updatedAt: timestamp
    };

    if (badgeToAward) {
        updateData.badges = FieldValue.arrayUnion(badgeToAward);
    }

    batch.set(pointsRef, updateData, { merge: true });

    await batch.commit();
    return { success: true, isFirstView, pointsAwarded: pointsToAward, badgeAwarded: badgeToAward };
}

