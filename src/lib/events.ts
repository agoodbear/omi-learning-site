import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ResearchEvent, EventAction, EventTargetType } from "@/types/firestore-schema";

/**
 * Logs a research event to the 'events' collection.
 * Uses serverTimestamp for strict temporal ordering.
 */
export async function logEvent(
    uid: string,
    action: EventAction,
    targetType: EventTargetType = null,
    targetId: string | null = null,
    meta: any = {}
) {
    try {
        const employeeId = meta.employeeId || null;

        const eventData: any = { // Use 'any' to bypass strict typed ResearchEvent which expects Timestamp
            uid,
            employeeId, // Should be passed if known client-side, but 'logView' (Server Action) is preferred source of truth
            createdAt: serverTimestamp(),
            action,
            targetType,
            targetId,
            meta
        };

        await addDoc(collection(db, "events"), eventData);
        // Console log optional, disabled for cleaner prod logs
        // console.log(`[Event Logged] ${action}`);
    } catch (error) {
        console.error("Failed to log event:", error);
    }
}
