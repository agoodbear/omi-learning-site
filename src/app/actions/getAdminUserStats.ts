"use server";

import { adminDb } from "@/lib/firebase/admin";
import { UserStats, PointsStats } from "@/types/firestore-schema";

export interface AdminUserStatRow {
    uid: string;
    employeeId: string;
    email: string; // Add email for identification
    loginCount: number;
    totalAttempts: number;
    totalCorrect: number;
    accuracy: number;
    totalPoints: number;
    lastActivityAt: string | null;
}

export async function getAdminUserStats(uid: string) {
    if (!uid) throw new Error("Unauthorized");

    try {
        // 1. Fetch Users (Profile Data)
        const usersSnap = await adminDb.collection("users").get();
        const usersMap = new Map<string, { employeeId: string, email: string }>();
        usersSnap.forEach(doc => {
            const d = doc.data();
            usersMap.set(doc.id, {
                employeeId: d.employeeId || "UNKNOWN",
                email: d.email || ""
            });
        });

        // 2. Fetch UserStats (Quiz Performance)
        const statsSnap = await adminDb.collection("userStats").get();
        const statsMap = new Map<string, UserStats>();
        statsSnap.forEach(doc => {
            statsMap.set(doc.id, doc.data() as UserStats);
        });

        // 3. Fetch PointsStats (Gamification)
        const pointsSnap = await adminDb.collection("pointsStats").get();
        const pointsMap = new Map<string, PointsStats>();
        pointsSnap.forEach(doc => {
            pointsMap.set(doc.id, doc.data() as PointsStats);
        });

        // 4. Fetch Login Counts (Aggregation)
        // Optimization: Fetch ALL login events. 
        // Warning: If system scales to millions of logs, this will need BigQuery extension.
        // For < 100k events, this is fine.
        const loginSnap = await adminDb.collection("events")
            .where("action", "==", "login")
            .select("uid") // Only need UID
            .get();

        const loginCounts = new Map<string, number>();
        loginSnap.forEach(doc => {
            const uid = doc.data().uid;
            if (uid) {
                loginCounts.set(uid, (loginCounts.get(uid) || 0) + 1);
            }
        });

        // 5. Join Data
        const rows: AdminUserStatRow[] = [];

        // Iterate over usersMap as base
        for (const [userId, profile] of usersMap.entries()) {
            const stat = statsMap.get(userId);
            const points = pointsMap.get(userId);
            const logins = loginCounts.get(userId) || 0;

            // Calculate Accuracy safely
            let accuracy = 0;
            if (stat && stat.totalAnswered > 0) {
                accuracy = Math.round((stat.totalCorrect / stat.totalAnswered) * 100);
            }

            // Last Activity
            let lastActivityAt = null;
            if (stat?.lastActivityAt) {
                lastActivityAt = stat.lastActivityAt.toDate().toISOString();
            }

            rows.push({
                uid: userId,
                employeeId: profile.employeeId,
                email: profile.email,
                loginCount: logins,
                totalAttempts: stat?.totalAttempts || 0,
                totalCorrect: stat?.totalCorrect || 0,
                accuracy,
                totalPoints: points?.totalPoints || 0,
                lastActivityAt
            });
        }

        // Sort by Points descending by default
        rows.sort((a, b) => b.totalPoints - a.totalPoints);

        return { success: true, data: rows };

    } catch (error: any) {
        console.error("getAdminUserStats error:", error);
        return { success: false, error: error.message };
    }
}
