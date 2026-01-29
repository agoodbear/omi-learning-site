"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Case } from "@/types/firestore-schema";
import { useAuth } from "@/lib/auth/AuthContext";
import { ArrowLeft, ZoomIn, CheckCircle, XCircle, BookOpen, Stethoscope } from "lucide-react";
import Link from "next/link";
import ECGImageViewer from "@/components/ECGImageViewer";
import CommentsSection from "@/components/CommentsSection";
import { logView } from "@/app/actions/logView";
import { logEvent } from "@/lib/events"; // Keep for submit_case_answer (or replace later)

export default function CaseDetailPage() {
    const { caseId } = useParams();
    const { user, userProfile, loading: authLoading } = useAuth(); // Get userProfile for employeeId if needed

    const [caseData, setCaseData] = useState<Case | null>(null);
    const [loading, setLoading] = useState(true);

    const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);

    const hasLoggedView = useRef(false);

    useEffect(() => {
        async function fetchCase() {
            if (!caseId || typeof caseId !== "string") return;
            try {
                const docRef = doc(db, "cases", caseId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setCaseData({ id: docSnap.id, ...docSnap.data() } as Case);
                }
            } catch (error) {
                console.error("Error fetching case:", error);
            } finally {
                setLoading(false);
            }
        }

        if (user) fetchCase();
    }, [user, caseId]);

    // Log View Event (once per view)
    useEffect(() => {
        if (user && caseData && !hasLoggedView.current) {
            // Use Server Action to track read status & points
            logView(user.uid, "case", caseData.id || (caseId as string), {
                category: caseData.category,
                title: caseData.title
            });
            hasLoggedView.current = true;
        }
    }, [user, caseData, caseId]);

    if (authLoading || loading) {
        return <div className="h-screen flex items-center justify-center bg-background text-muted">Loading case data...</div>;
    }

    if (!caseData) {
        return (
            <div className="h-screen flex items-center justify-center flex-col gap-4 bg-background">
                <div className="text-alert-red text-xl font-semibold">Case Not Found</div>
                <Link href="/cases" className="text-primary hover:underline">Return to Case Library</Link>
            </div>
        );
    }

    const handleSubmit = () => {
        if (selectedChoice === null) return;
        setIsSubmitted(true);

        if (user && caseData) {
            const isCorrect = selectedChoice === caseData.correct_answer;
            logEvent(user.uid, "submit_case_answer", "case", caseData.id!, {
                isCorrect,
                selectedChoice,
                category: caseData.category
            });
        }
    };

    const isCorrect = selectedChoice === caseData.correct_answer;

    const getCategoryBadgeClass = (category: string) => {
        switch (category) {
            case "OMI": return "badge badge-omi";
            case "STEMI_mimics": return "badge badge-mimics";
            case "Electrolyte": return "badge badge-electrolyte";
            default: return "badge";
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto">
            {/* Navigation */}
            <Link href="/cases" className="inline-flex items-center gap-2 text-muted hover:text-primary mb-6 text-sm transition-colors group">
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Case Library
            </Link>

            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                    {/* Category hidden to prevent spoilers until answered */}
                    <span className="text-muted text-xs">Case ID: {caseData.id}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{caseData.title}</h1>
            </header>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Clinical Context & ECG */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Context Card */}
                    <div className="card p-6">
                        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Stethoscope size={16} className="text-primary" /> Clinical Presentation
                        </h2>
                        <p className="text-foreground leading-relaxed">
                            {caseData.clinical_context}
                        </p>
                    </div>

                    {/* ECG Visualizer */}
                    <div className="card overflow-hidden relative group">
                        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => setIsZoomed(true)}
                                className="bg-white/90 text-foreground p-2 rounded-lg border border-border hover:border-primary hover:text-primary transition-all shadow-sm cursor-pointer"
                                title="Expand ECG"
                            >
                                <ZoomIn size={20} />
                            </button>
                        </div>

                        <div className="relative bg-gray-50">
                            {caseData.ecg_images[0] && (
                                <img
                                    src={caseData.ecg_images[0]}
                                    alt="ECG"
                                    className="w-full h-auto object-contain cursor-zoom-in"
                                    onClick={() => setIsZoomed(true)}
                                />
                            )}
                        </div>

                        <div className="bg-gray-50 p-3 text-center text-xs text-muted border-t border-border">
                            Click image to enlarge • Standard 12-Lead ECG
                        </div>
                    </div>
                </div>

                {/* Right Column: Question & Interaction */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8 space-y-6">
                        <div className="card p-6">
                            <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-4">
                                Diagnostic Question
                            </h2>

                            <p className="font-medium text-foreground text-lg mb-6 leading-snug">{caseData.question}</p>

                            <div className="space-y-3 mb-6">
                                {caseData.choices.map((choice, idx) => {
                                    let stateStyle = "border-border bg-white text-foreground hover:border-primary hover:bg-gray-50";

                                    if (isSubmitted) {
                                        if (idx === caseData.correct_answer) {
                                            stateStyle = "border-success bg-green-50 text-green-800";
                                        } else if (idx === selectedChoice && idx !== caseData.correct_answer) {
                                            stateStyle = "border-alert-red bg-red-50 text-red-800";
                                        } else {
                                            stateStyle = "border-border bg-gray-50 text-muted opacity-60";
                                        }
                                    } else if (selectedChoice === idx) {
                                        stateStyle = "border-primary bg-primary/5 text-foreground";
                                    }

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => !isSubmitted && setSelectedChoice(idx)}
                                            disabled={isSubmitted}
                                            className={`w-full text-left p-4 rounded-lg border transition-all text-sm flex items-start gap-3 cursor-pointer ${stateStyle}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5
                                            ${isSubmitted && idx === caseData.correct_answer ? 'border-success bg-success' :
                                                    isSubmitted && idx === selectedChoice ? 'border-alert-red bg-alert-red' :
                                                        selectedChoice === idx ? 'border-primary' : 'border-gray-300'}`}>
                                                {selectedChoice === idx && !isSubmitted && <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>}
                                                {isSubmitted && idx === caseData.correct_answer && <CheckCircle size={12} className="text-white" />}
                                                {isSubmitted && idx === selectedChoice && idx !== caseData.correct_answer && <XCircle size={12} className="text-white" />}
                                            </div>
                                            <span>{choice}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {!isSubmitted ? (
                                <button
                                    onClick={handleSubmit}
                                    disabled={selectedChoice === null}
                                    className={`w-full py-3 rounded-lg font-semibold transition-all cursor-pointer
                                    ${selectedChoice !== null
                                            ? "btn-primary"
                                            : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                                >
                                    Submit Answer
                                </button>
                            ) : (
                                <div className={`p-5 rounded-lg border ${isCorrect ? 'border-success bg-green-50' : 'border-alert-red bg-red-50'}`}>
                                    <div className="flex items-center gap-2 mb-3 font-semibold">
                                        {isCorrect ? (
                                            <><CheckCircle className="text-success" size={20} /> <span className="text-green-800">Correct!</span></>
                                        ) : (
                                            <><XCircle className="text-alert-red" size={20} /> <span className="text-red-800">Incorrect</span></>
                                        )}
                                    </div>

                                    {/* Reveal Category Here */}
                                    <div className="mb-4">
                                        <span className={`text-xs font-semibold px-2 py-1 rounded border ${caseData.category === "OMI" ? "bg-red-100 text-red-800 border-red-200" :
                                            caseData.category === "STEMI_mimics" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                                                "bg-blue-100 text-blue-800 border-blue-200"
                                            }`}>
                                            Category: {caseData.category === "STEMI_mimics" ? "STEMI Mimic" : caseData.category}
                                        </span>
                                    </div>

                                    <p className="text-sm text-foreground leading-relaxed mb-4">
                                        {caseData.explanation}
                                    </p>

                                    <div className="pt-4 border-t border-gray-200">
                                        <p className="text-xs text-muted uppercase tracking-wide mb-2 flex items-center gap-1">
                                            <BookOpen size={12} /> References
                                        </p>
                                        <ul className="list-disc pl-4 text-xs text-muted space-y-1">
                                            {caseData.references.map((ref, i) => (
                                                <li key={i}>{ref}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Comments Section */}
            <div className="mt-12 max-w-4xl mx-auto">
                <CommentsSection caseId={caseData.id!} />
            </div>

            {/* Modal for Zoom */}
            <ECGImageViewer
                src={caseData.ecg_images[0]}
                alt={caseData.title}
                isOpen={isZoomed}
                onClose={() => setIsZoomed(false)}
            />
        </div>
    );
}
