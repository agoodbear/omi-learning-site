"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, increment, Timestamp, getDoc, setDoc } from "firebase/firestore";
import { Case, AttemptItem, QuizAttempt } from "@/types/firestore-schema";
import { useAuth } from "@/lib/auth/AuthContext";
import { CheckCircle, XCircle, ArrowRight, AlertCircle } from "lucide-react";
import ECGImageViewer from "@/components/ECGImageViewer";
import { logEvent } from "@/lib/events";
import { submitQuizAttempt } from "@/app/actions/submitQuiz";

import { Suspense } from "react";

function QuizRunner() {
    const searchParams = useSearchParams();
    const category = searchParams.get("category") || "All";
    const { user } = useAuth();
    const router = useRouter();

    const [questions, setQuestions] = useState<Case[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [attemptItems, setAttemptItems] = useState<AttemptItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMSG, setErrorMSG] = useState("");
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const hasLoggedStart = useRef(false);

    function shuffleArray<T>(array: T[]) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    useEffect(() => {
        async function fetchQuestions() {
            try {
                const casesRef = collection(db, "cases");
                let q;

                if (category === "All") {
                    q = query(casesRef, where("status", "==", "published"));
                } else {
                    q = query(casesRef, where("status", "==", "published"), where("category", "==", category));
                }

                const snapshot = await getDocs(q);
                const allCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case));

                if (allCases.length < 5) {
                    setErrorMSG(`Not enough cases available. Need at least 5, found ${allCases.length}.`);
                    setLoading(false);
                    return;
                }

                const shuffled = shuffleArray(allCases).slice(0, 5);
                setQuestions(shuffled);
                setLoading(false);

                // Log Start Quiz
                if (!hasLoggedStart.current && user) {
                    logEvent(user.uid, "start_quiz", "quiz", null, { category });
                    hasLoggedStart.current = true;
                }

            } catch (err: any) {
                console.error(err);
                setErrorMSG("Error loading questions: " + err.message);
                setLoading(false);
            }
        }

        if (user) fetchQuestions();
    }, [user, category]);

    const handleConfirm = () => {
        if (selectedChoice === null) return;
        setIsAnswered(true);

        const currentQ = questions[currentIndex];
        const isCorrect = selectedChoice === currentQ.correct_answer;

        // Log Answer
        if (user) {
            logEvent(user.uid, "submit_case_answer", "quiz", currentQ.id!, {
                isCorrect,
                selectedChoice,
                category: currentQ.category
            });
        }

        setAttemptItems(prev => [
            ...prev,
            {
                caseId: currentQ.id!,
                selected: selectedChoice,
                isCorrect,
                answeredAt: Timestamp.now()
            }
        ]);
    };

    const handleNext = async () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedChoice(null);
            setIsAnswered(false);
        } else {
            await saveResult();
        }
    };



    const saveResult = async () => {
        if (!user) return;
        setLoading(true);

        const correctCount = attemptItems.filter(i => i.isCorrect).length;

        // Prepare serializable data for Server Action
        const payload = {
            categoryFilter: category as any,
            total: questions.length,
            correct: correctCount,
            items: attemptItems.map(item => ({
                ...item,
                // Convert Firestore Timestamp to Date for serialization
                answeredAt: item.answeredAt.toDate()
            }))
        };

        try {
            const result = await submitQuizAttempt(user.uid, payload as any);

            if (result.success) {
                // Determine if bonus was earned for notification (optional)
                // For now just redirect
                router.replace(`/quiz/result/${result.attemptId}`);
            } else {
                throw new Error("Submission failed");
            }

        } catch (err) {
            console.error("Save failed", err);
            alert("Failed to save results. Please try again. " + err);
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-background text-muted">
            Loading quiz...
        </div>
    );

    if (errorMSG) {
        return (
            <div className="h-screen flex items-center justify-center p-4 bg-background">
                <div className="card p-8 max-w-md text-center">
                    <AlertCircle size={48} className="mx-auto mb-4 text-alert-red" />
                    <h2 className="text-xl font-semibold text-foreground mb-2">Quiz Unavailable</h2>
                    <p className="text-muted mb-6">{errorMSG}</p>
                    <button onClick={() => router.push('/quiz')} className="btn-primary cursor-pointer">
                        Return to Quiz Setup
                    </button>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentIndex];
    const isCorrect = isAnswered && selectedChoice === currentQ.correct_answer;

    return (
        <div className="min-h-screen bg-background p-4 max-w-4xl mx-auto flex flex-col">
            {/* Header Progress */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
                <div className="text-muted text-sm">
                    Question {currentIndex + 1} of {questions.length}
                </div>
                <div className="flex gap-1">
                    {questions.map((_, idx) => (
                        <div key={idx} className={`w-3 h-3 rounded-full ${idx < currentIndex ? 'bg-success' : idx === currentIndex ? 'bg-primary' : 'bg-gray-200'}`}></div>
                    ))}
                </div>
            </div>

            {/* Question Area */}
            <div className="flex-1">
                <div className="card overflow-hidden mb-6 relative group cursor-pointer" onClick={() => setIsViewerOpen(true)}>
                    <img src={currentQ.ecg_images[0]} alt="ECG" className="w-full h-64 md:h-80 object-contain bg-gray-50 group-hover:bg-gray-100 transition-colors" />
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Click to maximize
                    </div>
                </div>

                <ECGImageViewer
                    src={currentQ.ecg_images[0]}
                    alt="ECG Detail"
                    isOpen={isViewerOpen}
                    onClose={() => setIsViewerOpen(false)}
                />

                <div className="card p-6 mb-6">
                    <p className="text-sm text-muted mb-2">Clinical Context</p>
                    <p className="text-foreground mb-4">{currentQ.clinical_context}</p>
                    <h2 className="text-xl font-semibold text-foreground leading-relaxed">
                        {currentQ.question}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    {currentQ.choices.map((choice, idx) => {
                        let stateClass = "border-border bg-white text-foreground hover:border-primary hover:bg-gray-50";
                        if (isAnswered) {
                            if (idx === currentQ.correct_answer) stateClass = "border-success bg-green-50 text-green-800";
                            else if (idx === selectedChoice) stateClass = "border-alert-red bg-red-50 text-red-800";
                            else stateClass = "border-border bg-gray-50 text-muted opacity-60";
                        } else if (selectedChoice === idx) {
                            stateClass = "border-primary bg-primary/5 text-foreground";
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => !isAnswered && setSelectedChoice(idx)}
                                disabled={isAnswered}
                                className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${stateClass}`}
                            >
                                {choice}
                            </button>
                        );
                    })}
                </div>

                {/* Feedback Area */}
                {isAnswered && (
                    <div className={`card p-5 mb-6 ${isCorrect ? 'border-success bg-green-50' : 'border-alert-red bg-red-50'}`}>
                        <div className="flex items-center gap-2 font-semibold mb-2">
                            {isCorrect ? <CheckCircle size={20} className="text-success" /> : <XCircle size={20} className="text-alert-red" />}
                            <span className={isCorrect ? 'text-green-800' : 'text-red-800'}>
                                {isCorrect ? 'Correct!' : 'Incorrect'}
                            </span>
                        </div>
                        <p className="text-foreground text-sm leading-relaxed">
                            {currentQ.explanation}
                        </p>
                    </div>
                )}
            </div>

            {/* Action Bar */}
            <div className="py-4 border-t border-border mt-auto">
                {!isAnswered ? (
                    <button
                        onClick={handleConfirm}
                        disabled={selectedChoice === null}
                        className={`w-full py-4 rounded-lg font-semibold transition-all cursor-pointer
                        ${selectedChoice !== null ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                        Submit Answer
                    </button>
                ) : (
                    <button
                        onClick={handleNext}
                        className="w-full py-4 btn-success flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {currentIndex < questions.length - 1 ? "Next Question" : "View Results"} <ArrowRight size={18} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function QuizRunnerPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center text-muted">Loading quiz parameters...</div>}>
            <QuizRunner />
        </Suspense>
    );
}
