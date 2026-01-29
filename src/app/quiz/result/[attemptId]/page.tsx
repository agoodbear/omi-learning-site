"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { QuizAttempt, Case } from "@/types/firestore-schema";
import Link from "next/link";
import { CheckCircle, XCircle, RotateCcw, Home, Award, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

type ResultData = QuizAttempt & {
    caseDetails: Record<string, Case>;
};

export default function ResultPage() {
    const { attemptId } = useParams();
    const { user } = useAuth();
    const router = useRouter();
    const [result, setResult] = useState<ResultData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchResult() {
            if (!attemptId || typeof attemptId !== 'string') return;
            try {
                const attemptRef = doc(db, "attempts", attemptId);
                const attemptSnap = await getDoc(attemptRef);

                if (!attemptSnap.exists()) {
                    setLoading(false);
                    return;
                }

                const attemptData = attemptSnap.data() as QuizAttempt;

                const casesData: Record<string, Case> = {};
                for (const item of attemptData.items) {
                    const cRef = doc(db, "cases", item.caseId);
                    const cSnap = await getDoc(cRef);
                    if (cSnap.exists()) {
                        casesData[item.caseId] = cSnap.data() as Case;
                    }
                }

                setResult({ ...attemptData, caseDetails: casesData });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        if (user) fetchResult();
    }, [user, attemptId]);

    if (loading) return <div className="h-screen flex items-center justify-center bg-background text-muted">Loading results...</div>;

    if (!result) return (
        <div className="h-screen flex items-center justify-center flex-col gap-4 bg-background">
            <div className="text-alert-red text-xl font-semibold">Result Not Found</div>
            <Link href="/quiz" className="text-primary hover:underline">Return to Quiz</Link>
        </div>
    );

    const percentage = Math.round((result.correct / result.total) * 100);
    let gradeColor = "text-alert-red";
    let gradeBg = "bg-red-50";
    if (percentage >= 80) { gradeColor = "text-success"; gradeBg = "bg-green-50"; }
    else if (percentage >= 60) { gradeColor = "text-yellow-600"; gradeBg = "bg-yellow-50"; }

    return (
        <div className="min-h-screen bg-background p-4 py-12 max-w-2xl mx-auto">
            <div className="text-center mb-10">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${gradeBg} mb-6`}>
                    {percentage >= 80 ? <Award size={40} className={gradeColor} /> : <Activity size={40} className={gradeColor} />}
                </div>

                <h1 className="text-xl text-muted mb-2">Quiz Complete</h1>
                <div className={`text-6xl md:text-7xl font-bold mb-3 ${gradeColor}`}>
                    {percentage}%
                </div>
                <p className="text-foreground text-lg">
                    You answered {result.correct} out of {result.total} correctly.
                </p>
            </div>

            <div className="card p-6 mb-8">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Review Your Answers</h2>
                <div className="space-y-3">
                    {result.items.map((item, idx) => {
                        const caseDetail = result.caseDetails[item.caseId];
                        if (!caseDetail) return null;

                        return (
                            <div key={idx} className="flex items-center justify-between p-4 rounded-lg border border-border bg-gray-50 hover:bg-white transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="shrink-0">
                                        {item.isCorrect ? <CheckCircle className="text-success" size={22} /> : <XCircle className="text-alert-red" size={22} />}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-foreground">{caseDetail.title}</h3>
                                        <p className="text-xs text-muted mt-0.5">
                                            {caseDetail.category === "STEMI_mimics" ? "STEMI Mimic" : caseDetail.category}
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href={`/cases/${item.caseId}`}
                                    className="text-sm text-primary font-medium hover:underline"
                                >
                                    Review
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => router.push('/quiz')}
                    className="py-4 rounded-lg border border-border bg-white text-foreground font-semibold hover:bg-gray-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                    <RotateCcw size={18} /> Try Again
                </button>
                <button
                    onClick={() => router.push('/')}
                    className="py-4 rounded-lg btn-primary flex items-center justify-center gap-2 cursor-pointer"
                >
                    <Home size={18} /> Home
                </button>
            </div>
        </div>
    );
}
