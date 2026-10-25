import { Timestamp } from "firebase/firestore";

export interface UserProfile {
    uid: string;
    employeeId: string;
    displayName?: string;
    approved?: boolean; // 只有管理員能改（server action）
    createdAt: Timestamp;
    lastLoginAt: Timestamp;
}
