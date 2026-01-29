import { Timestamp } from "firebase/firestore";

export type CaseCategory = "OMI" | "STEMI_mimics" | "Electrolyte";
export type CaseStatus = "published" | "draft" | "archived";

export interface Case {
    id?: string; // Document ID
    title: string;
    category: CaseCategory;
    status: CaseStatus;
    clinical_context: string;
    ecg_images: string[];
    question: string;
    choices: string[];
    correct_answer: number; // Index of correct choice
    explanation: string;
    references: string[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface AttemptItem {
    caseId: string;
    selected: number;
    isCorrect: boolean;
    answeredAt: Timestamp;
}

export interface QuizAttempt {
    id?: string;
    uid: string;
    createdAt: Timestamp;
    categoryFilter: CaseCategory | "All";
    total: number;
    correct: number;
    items: AttemptItem[];
}

export interface UserProgress {
    uid: string;
    totalAnswered: number;
    totalCorrect: number;
    accuracy: number; // 0.0 to 1.0
    updatedAt: Timestamp;
}

export interface Comment {
    id?: string;
    caseId: string;
    userId: string;
    userEmail?: string; // Optional display identifier
    content: string;
    createdAt: Timestamp;
    // Map of emoji char (e.g. "❤️") to list of user IDs who reacted
    reactions: Record<string, string[]>;
}

export type PaperStatus = "draft" | "published" | "archived";

export interface Paper {
    id?: string;
    title: string;
    authors: string; // Stored as a comma-separated string or simple text for simplicity
    journal?: string;
    year?: number;
    tags: string[]; // e.g. ["OMI", "Guideline"]
    status: PaperStatus;
    pdf: {
        storagePath: string;
        downloadURL: string;
        fileName: string;
    };
    summaryHtml?: string; // HTML content from TipTap
    summaryJson?: string; // JSON content from TipTap for re-editing
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Highlight {
    id?: string;
    paperId: string; // Parent ID
    content: {
        text?: string;
        image?: string;
    };
    position: { // react-pdf-highlighter ScaledPosition
        boundingRect: {
            x1: number; y1: number; x2: number; y2: number; width: number; height: number;
        };
        rects: Array<{
            x1: number; y1: number; x2: number; y2: number; width: number; height: number;
        }>;
        pageNumber: number;
    };
    comment: {
        text: string;
        emoji: string;
    };
    color: string; // e.g. "yellow", "blue"
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ============================================================================
// Phase 4: Research & Analytics Schemas
// ============================================================================

export type EventAction =
    | "login"
    | "view_case"
    | "submit_case_answer"
    | "start_quiz"
    | "finish_quiz"
    | "view_literature"
    | "publish_case"
    | "publish_paper";

export type EventTargetType = "case" | "quiz" | "paper" | null;

export interface ResearchEvent {
    id?: string;
    uid: string;
    employeeId?: string; // Snapshot for easier export join
    createdAt: Timestamp;
    action: EventAction;
    targetType: EventTargetType;
    targetId: string | null;
    meta?: {
        category?: string; // OMI, STEMI_mimics, etc.
        isCorrect?: boolean;
        device?: string;
        sessionId?: string;
        attemptId?: string;
        [key: string]: any;
    };
}

// Replaces/Extends the simple UserProgress
export interface UserStats {
    uid: string;
    employeeId?: string;
    totalAttempts: number; // Number of quizzes finished
    totalAnswered: number; // Total questions answered
    totalCorrect: number;
    accuracy: number;
    attemptsByCategory: {
        [key in CaseCategory | "All"]?: {
            answered: number;
            correct: number;
            accuracy: number;
        }
    };
    firstActivityAt?: Timestamp;
    lastActivityAt?: Timestamp;
    updatedAt: Timestamp;
}

export interface CaseStats {
    caseId: string;
    title?: string;
    category?: string;
    totalAnswered: number;
    totalCorrect: number;
    accuracy: number;
    updatedAt: Timestamp;
}

export interface ClinicalEvent {
    id?: string;
    patientEncounterId: string; // De-identified
    attendingEmployeeId: string;
    shiftDateTime?: string | Timestamp; // Flexible input

    // Timestamps
    ecgTime?: Timestamp; // or string if raw import
    doorTime?: Timestamp;
    activationTime?: Timestamp;
    cathStartTime?: Timestamp;

    // Outcome / Adjudication
    outcomeAdjudication?: {
        isTrueOMI?: boolean | null;
        isCulpritOcclusion?: boolean | null;
        adjudicator?: string | null;
        adjudicatedAt?: Timestamp | null;
    };

    // Activation
    activation: {
        activated: boolean;
        activationAppropriate?: boolean | null; // Derived: True OMI & Activated = true
    };

    // Derived Timing (in minutes)
    timingDerived?: {
        doorToActivationMinutes?: number | null;
        ecgToActivationMinutes?: number | null;
    };

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface ResearchConfig {
    id: "schedule"; // Singleton
    interventionStartAt: Timestamp;
    prePeriodMonths: number;
    postPeriodMonths: number;
    notes?: string;
}

// ============================================================================
// Phase 4: Gamification Schemas
// ============================================================================

export interface UserContentStatus {
    uid: string;
    casesRead: string[];        // Array of caseIds
    papersRead: string[];       // Array of paperIds
    quizzesCompleted: string[]; // Array of attemptIds
    updatedAt: Timestamp;
}

export interface PointsStats {
    uid: string;
    employeeId?: string;
    totalPoints: number;
    pointsBreakdown: {
        loginPoints: number;
        casePoints: number;
        paperPoints: number;
        quizPoints: number;
        bonusPoints: number;
    };
    updatedAt: Timestamp;
}
