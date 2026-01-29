"use server";

import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// Helper to sanitize data for JSON export (e.g. converting Timestamps to ISO strings)
function sanitizeData(data: any): any {
    if (data === null || data === undefined) return data;
    if (data instanceof Timestamp) {
        return data.toDate().toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(sanitizeData);
    }
    if (typeof data === "object") {
        const newData: any = {};
        for (const key in data) {
            newData[key] = sanitizeData(data[key]);
        }
        return newData;
    }
    return data;
}

export async function exportCollection(uid: string, collectionName: string) {
    if (!uid) throw new Error("Unauthorized");

    // In a real app, verify admin status again here.

    const allowedCollections = [
        "users",
        "events",
        "attempts",
        "clinicalEvents",
        "userStats",
        "caseStats",
        "pointsStats",
        "cases", // Good for referencing IDs
        "papers"
    ];

    if (!allowedCollections.includes(collectionName)) {
        throw new Error("Invalid collection");
    }

    try {
        const snapshot = await adminDb.collection(collectionName).get();
        const data = snapshot.docs.map(doc => ({
            _id: doc.id,
            ...sanitizeData(doc.data())
        }));

        return { success: true, data };
    } catch (error: any) {
        console.error(`Export failed for ${collectionName}:`, error);
        return { success: false, error: error.message };
    }
}
