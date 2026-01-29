"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Play, Activity, AlertTriangle, Zap } from "lucide-react";

type QuizCategory = "All" | "OMI" | "STEMI_mimics" | "Electrolyte";

export default function QuizPage() {
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState<QuizCategory>("All");
    const [loading, setLoading] = useState(false);

    const handleStart = () => {
        setLoading(true);
        router.push(`/quiz/run?category=${selectedCategory}`);
    };

    const categories = [
        { id: "All", label: "All Categories", icon: BrainCircuit, desc: "A comprehensive mix of all case types." },
        { id: "OMI", label: "Occlusion MI (OMI)", icon: Activity, desc: "Identify acute coronary occlusions." },
        { id: "STEMI_mimics", label: "STEMI Mimics", icon: AlertTriangle, desc: "Pericarditis, BER, LVH, and more." },
        { id: "Electrolyte", label: "Electrolyte Abnormalities", icon: Zap, desc: "Hyperkalemia, Hypokalemia, and others." },
    ] as const;

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">

                <div className="text-center mb-10">
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                        ECG Quiz
                    </h1>
                    <p className="text-muted max-w-md mx-auto">
                        Test your diagnostic skills with 5 randomized cases. Select a category to begin.
                    </p>
                </div>

                <div className="space-y-3 mb-8">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`w-full text-left p-5 rounded-xl border transition-all cursor-pointer flex items-start gap-4
                        ${selectedCategory === cat.id
                                    ? "bg-primary/5 border-primary shadow-sm"
                                    : "bg-white border-border hover:border-gray-300"}`}
                        >
                            <div className={`p-3 rounded-lg ${selectedCategory === cat.id ? 'bg-primary text-white' : 'bg-gray-100 text-muted'}`}>
                                <cat.icon size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-semibold text-lg ${selectedCategory === cat.id ? 'text-primary' : 'text-foreground'}`}>
                                    {cat.label}
                                </h3>
                                <p className="text-sm text-muted mt-1">{cat.desc}</p>
                            </div>

                            {/* Radio indicator */}
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1
                        ${selectedCategory === cat.id ? 'border-primary' : 'border-gray-300'}`}>
                                {selectedCategory === cat.id && <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>}
                            </div>
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleStart}
                    disabled={loading}
                    className="w-full btn-success py-4 text-lg flex items-center justify-center gap-3 cursor-pointer"
                >
                    {loading ? "Starting..." : (
                        <>
                            Start Quiz <Play size={20} className="fill-current" />
                        </>
                    )}
                </button>

                <p className="text-center text-muted text-sm mt-6">
                    You will answer 5 questions. Take your time — there's no time limit.
                </p>
            </div>
        </div>
    );
}
