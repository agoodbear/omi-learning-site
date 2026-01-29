import { Timestamp } from "firebase/firestore";

export interface UserProfile {
    uid: string;
    employeeId: string;
    createdAt: Timestamp;
    lastLoginAt: Timestamp;
}
