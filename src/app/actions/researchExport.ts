"use server";

import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// Helper to format date for CSV
function formatDate(ts: Timestamp | string | null | undefined): string {
    if (!ts) return "";
    if (typeof ts === 'string') return ts;
    return ts.toDate().toISOString();
}

// Helper to calculate days difference
function diffDays(eventTime: Timestamp, anchorTime: Timestamp): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return (anchorTime.toMillis() - eventTime.toMillis()) / msPerDay;
}

export async function generateLinkedExport(uid: string) {
    if (!uid) throw new Error("Unauthorized");

    // 1. Fetch all Clinical Events
    const clinicalSnap = await adminDb.collection("clinicalEvents").get();
    const clinicalEvents = clinicalSnap.docs.map(doc => doc.data());

    if (clinicalEvents.length === 0) {
        return { success: true, csv: "No clinical events found" };
    }

    // 2. Identify relevant Employees
    const employeeIds = new Set<string>();
    clinicalEvents.forEach(e => {
        if (e.attendingEmployeeId) employeeIds.add(e.attendingEmployeeId);
    });

    // 3. Fetch User Events for these employees (Batching if needed)
    // Firestore 'in' limit is 10. We might need loop if > 10 employees.
    // For MVP, we assume small number or fetch all events (expensive but accurate).
    // Better: Fetch all events where employeeId is in array? 
    // Or just fetch ALL logs and filter in memory? 
    // Given "Research-grade", accuracy > speed. 
    // And "Website usage" might be huge.
    // Optimization: Queries by employeeId.

    // Let's implement chunked query.
    const allUserEvents: any[] = [];
    const empArray = Array.from(employeeIds);
    // Chunk size 10
    for (let i = 0; i < empArray.length; i += 10) {
        const chunk = empArray.slice(i, i + 10);
        if (chunk.length === 0) continue;
        const q = adminDb.collection("events").where("employeeId", "in", chunk);
        const snap = await q.get();
        snap.forEach(doc => allUserEvents.push(doc.data()));
    }

    // 4. In-Memory Join & Calculation
    const rows = clinicalEvents.map(ce => {
        const ecgTime = ce.ecgTime as Timestamp;
        const empId = ce.attendingEmployeeId;

        // Filter events for this user before ECG time
        const userHistory = allUserEvents.filter(ue =>
            ue.employeeId === empId &&
            ue.createdAt &&
            ue.createdAt.toMillis() < ecgTime.toMillis()
        );

        // Exposure Windows
        const stats = {
            d7_login: 0, d14_login: 0, d30_login: 0,
            d7_view_case: 0, d30_view_case: 0,
            d30_view_paper: 0,
            d30_quiz: 0,
            d7_omi_answered: 0, // Need meta analysis
            lastLoginRecency: -1 // Days
        };

        let lastLoginTime: Timestamp | null = null;

        userHistory.forEach(ue => {
            const daysDiff = diffDays(ue.createdAt, ecgTime);
            if (daysDiff < 0) return; // Future event (shouldn't happen due to filter)

            if (daysDiff <= 30) {
                // 30 Day Window
                if (ue.action === 'login') stats.d30_login++;
                if (ue.action === 'view_case') stats.d30_view_case++;
                if (ue.action === 'view_literature') stats.d30_view_paper++;
                if (ue.action === 'finish_quiz') stats.d30_quiz++;
                if (ue.action === 'submit_case_answer') {
                    // Check category OMI?
                    if (ue.meta?.category === 'OMI') stats.d7_omi_answered++; // Wait, logic below
                }

                if (daysDiff <= 14) {
                    if (ue.action === 'login') stats.d14_login++;
                }

                if (daysDiff <= 7) {
                    if (ue.action === 'login') stats.d7_login++;
                    if (ue.action === 'view_case') stats.d7_view_case++;
                    if (ue.action === 'submit_case_answer' && ue.meta?.category === 'OMI') stats.d7_omi_answered++;
                }
            }

            // Recency (Login)
            if (ue.action === 'login') {
                if (!lastLoginTime || ue.createdAt.toMillis() > lastLoginTime.toMillis()) {
                    lastLoginTime = ue.createdAt;
                }
            }
        });

        if (lastLoginTime) {
            stats.lastLoginRecency = parseFloat(diffDays(lastLoginTime, ecgTime).toFixed(2));
        }

        return {
            attendingEmployeeId: empId,
            ecgTime: formatDate(ecgTime),
            ecgToActivationMinutes: ce.timingDerived?.ecgToActivationMinutes || "",
            isTrueOMI: ce.outcomeAdjudication?.isTrueOMI,
            isActivated: ce.activation?.activated,
            falsePositive: (ce.activation?.activated && !ce.outcomeAdjudication?.isTrueOMI),

            // Exposures
            exposure_7d_login: stats.d7_login,
            exposure_14d_login: stats.d14_login,
            exposure_30d_login: stats.d30_login,

            exposure_7d_view_case: stats.d7_view_case,
            exposure_30d_view_case: stats.d30_view_case,

            exposure_30d_view_paper: stats.d30_view_paper,
            exposure_30d_quizCount: stats.d30_quiz,
            exposure_7d_omiAnswered: stats.d7_omi_answered,

            lastLoginRecencyAtECG: stats.lastLoginRecency
        };
    });

    // 5. Generate CSV
    if (rows.length === 0) return { success: true, csv: "" };

    const headers = Object.keys(rows[0]);
    const csvRows = [
        headers.join(","),
        ...rows.map(row => headers.map(h => JSON.stringify((row as any)[h] ?? "")).join(","))
    ];

    return { success: true, csv: csvRows.join("\n") };
}
