"use server";

import { adminDb } from "@/lib/firebase/admin";
import { ResearchEvent } from "@/types/firestore-schema";

export async function getAdminChartsData(uid: string) {
    if (!uid) throw new Error("Unauthorized");

    // 1. Define Range (Last 30 Days)
    const now = new Date();
    const past30 = new Date();
    past30.setDate(now.getDate() - 30);

    // Firestore Timestamp comparison
    // We rely on "adminDb" events collection
    // Note: If events are huge, this query might be heavy. 
    // Ideally we use a composite index on createdAt.
    const eventsRef = adminDb.collection("events");
    const snapshot = await eventsRef
        .where("createdAt", ">=", past30)
        .orderBy("createdAt", "asc") // Ensure chronological for easy aggregation
        .get();

    // 2. Aggregate Data
    // Structure: { "YYYY-MM-DD": { views: 0, quizzes: 0, logins: 0, correct: 0, totalAnswered: 0 } }
    const dailyStats: Record<string, any> = {};

    snapshot.docs.forEach(doc => {
        const data = doc.data() as ResearchEvent;
        if (!data.createdAt) return;

        // Convert Timestamp to Date string YYYY-MM-DD
        const date = data.createdAt.toDate().toISOString().split('T')[0];

        if (!dailyStats[date]) {
            dailyStats[date] = { date, views: 0, quizzes: 0, logins: 0, correct: 0, totalAnswered: 0 };
        }

        const stats = dailyStats[date];

        if (data.action === "view_case" || data.action === "view_literature") {
            stats.views++;
        } else if (data.action === "finish_quiz") {
            stats.quizzes++;
        } else if (data.action === "login") {
            stats.logins++;
        } else if (data.action === "submit_case_answer") {
            stats.totalAnswered++;
            if (data.meta?.isCorrect) {
                stats.correct++;
            }
        }
    });

    // 3. Transform to Array for Recharts
    // Fill in missing days
    const chartData = [];
    for (let d = new Date(past30); d <= now; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayData = dailyStats[dateStr] || { date: dateStr, views: 0, quizzes: 0, logins: 0, correct: 0, totalAnswered: 0 };

        // Calculate Accuracy
        const accuracy = dayData.totalAnswered > 0
            ? Math.round((dayData.correct / dayData.totalAnswered) * 100)
            : 0; // Or null if we want gaps

        chartData.push({
            ...dayData,
            accuracy
        });
    }

    return { success: true, data: chartData };
}
