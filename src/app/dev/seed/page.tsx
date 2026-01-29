"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, setDoc, Timestamp } from "firebase/firestore";
import { Case } from "@/types/firestore-schema";
import { ShieldAlert, Check, X } from "lucide-react";

// MOCK DATA for Phase 2 Seeding
const MOCK_CASES: Omit<Case, "id" | "createdAt" | "updatedAt">[] = [
    // 1. OMI - Anterior
    {
        title: "Projected 55M with Chest Pain",
        category: "OMI",
        status: "published",
        clinical_context: "55M presents with 2 hours of crushing substernal chest pain radiating to left arm. Diaphoretic. BP 150/90.",
        ecg_images: ["/ecg/demo1.png"], // Placeholder
        question: "Based on the ECG findings, what is the most likely diagnosis?",
        choices: [
            "Anterior STEMI / OMI",
            "Pericarditis",
            "Early Repolarization",
            "Left Bundle Branch Block"
        ],
        correct_answer: 0,
        explanation: "Hyperacute T waves and ST elevation in V2-V4 indicate an acute LAD occlusion (Anterior OMI). Reciprocal changes are seen in inferior leads.",
        references: ["Smith, S. W. (2006). The ECG in Acute MI."]
    },
    // 2. OMI - Inferior
    {
        title: "62F with Nausea and Epigastric Pain",
        category: "OMI",
        status: "published",
        clinical_context: "62F with diabetic history c/o nausea and vague epigastric discomfort for 4 hours.",
        ecg_images: ["/ecg/demo2.png"],
        question: "What is the primary abnormality?",
        choices: [
            "Nonspecific ST changes",
            "Inferior OMI",
            "Gastritis",
            "Lateral Ischemia"
        ],
        correct_answer: 1,
        explanation: "ST elevation in II, III, aVF with reciprocal ST depression in aVL confirms Inferior OMI.",
        references: ["Dr. Smith's ECG Blog - Inferior MI"]
    },
    // 3. STEMI Mimic - Pericarditis
    {
        title: "28M with Pleuritic Chest Pain",
        category: "STEMI_mimics",
        status: "published",
        clinical_context: "28M with sharp chest pain worse when lying flat. Recent viral illness.",
        ecg_images: ["/ecg/demo3.png"],
        question: "Which feature supports Pericarditis over OMI?",
        choices: [
            "Reciprocal ST depression in aVL",
            "Diffuse STE with PR depression",
            "Hyperacute T waves",
            "Q waves in V1-V3"
        ],
        correct_answer: 1,
        explanation: "Diffuse ST elevation (concave up) with PR depression (especially in II) and PR elevation in aVR is classic for Pericarditis. No reciprocal depression (except aVR/V1).",
        references: ["European Society of Cardiology - Pericardial Diseases"]
    },
    // 4. STEMI Mimic - BER
    {
        title: "22M Asymptomatic Athlete",
        category: "STEMI_mimics",
        status: "published",
        clinical_context: "22M collegiate runner, routine screen. Asymptomatic.",
        ecg_images: ["/ecg/demo4.png"],
        question: "Diagnosis?",
        choices: [
            "Anterior OMI",
            "Brugada Syndrome",
            "Benign Early Repolarization (BER)",
            "Septal Ischemia"
        ],
        correct_answer: 2,
        explanation: "High voltage, widespread concave STE, notched J-points (fishhook) in V4, and absence of reciprocal changes favor BER.",
        references: ["Life in the Fast Lane - BER"]
    },
    // 5. Electrolyte - Hyperkalemia
    {
        title: "45F Dialysis Patient Missed Session",
        category: "Electrolyte",
        status: "published",
        clinical_context: "45F ESRD missed dialysis yesterday. Feels weak.",
        ecg_images: ["/ecg/demo5.png"],
        question: "What is the urgent treatment indicated by this ECG?",
        choices: [
            "Aspirin + Heparin",
            "Calcium Gluconate",
            "Nitroglycerin",
            "Amiodarone"
        ],
        correct_answer: 1,
        explanation: "Peaked T waves and widened QRS suggest severe Hyperkalemia. Calcium is needed to stabilize the membrane.",
        references: ["AHA ACLS Guidelines - Electrolyte Abnormalities"]
    },
    // 6. Electrolyte - Hypokalemia
    {
        title: "30F with Eating Disorder",
        category: "Electrolyte",
        status: "published",
        clinical_context: "30F with history of anorexia, weakness and palpitations.",
        ecg_images: ["/ecg/demo6.png"],
        question: "Identify the prominent electrolyte-induced wave.",
        choices: [
            "Delta wave",
            "Osborn wave",
            "U wave",
            "Epsilon wave"
        ],
        correct_answer: 2,
        explanation: "Hypokalemia causes ST depression, T wave flattening, and prominent U waves.",
        references: ["Goldberger's Clinical Electrocardiography"]
    }
];

export default function SeedPage() {
    const [loading, setLoading] = useState(false);
    const [log, setLog] = useState<string[]>([]);
    const isDev = process.env.NODE_ENV === "development";

    const addToLog = (msg: string) => setLog((prev) => [...prev, msg]);

    const handleSeed = async () => {
        if (!confirm("This will overwrite/add database cases. Continue?")) return;
        setLoading(true);
        setLog([]);
        addToLog("Starting Seed Process...");

        try {
            const casesRef = collection(db, "cases");

            for (const caseData of MOCK_CASES) {
                const docData = {
                    ...caseData,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };
                const docRef = await addDoc(casesRef, docData);
                addToLog(`✅ Created Case: ${caseData.title} (ID: ${docRef.id})`);
            }

            addToLog("🎉 Seeding Complete!");
        } catch (err: any) {
            console.error(err);
            addToLog(`❌ Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!isDev) {
        return (
            <div className="flex h-screen items-center justify-center p-4">
                <div className="bg-alert-red/10 text-alert-red border border-alert-red p-6 rounded flex items-center gap-4">
                    <ShieldAlert size={32} />
                    <div>
                        <h1 className="font-bold text-xl">ACCESS DENIED</h1>
                        <p>This tool is only available in DEVELOPMENT environment.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto py-12 px-4">
            <h1 className="text-2xl font-mono text-ecg-green mb-6 border-b border-gray-800 pb-2">
                Database Seeder (Phase 2)
            </h1>

            <div className="bg-gray-900 rounded p-6 border border-gray-800 mb-8">
                <p className="text-gray-400 mb-4 text-sm font-mono">
                    將寫入 6 筆測試 Cases (2 OMI, 2 Mimics, 2 Electrolyte) 至 Firestore。
                    <br />確保 firestore.rules 允許 Admin (16022) 寫入。
                </p>

                <button
                    onClick={handleSeed}
                    disabled={loading}
                    className={`w-full py-3 rounded font-bold font-mono transition-all ${loading ? 'bg-gray-700 text-gray-400' : 'bg-ecg-green text-black hover:bg-white'}`}
                >
                    {loading ? "SEEDING..." : "INJECT MOCK DATA"}
                </button>
            </div>

            <div className="bg-black border border-gray-800 rounded p-4 h-64 overflow-y-auto font-mono text-xs">
                {log.length === 0 ? (
                    <span className="text-gray-600">Waiting for command...</span>
                ) : (
                    log.map((msg, idx) => (
                        <div key={idx} className="mb-1 text-gray-300">
                            {msg.startsWith("✅") ? <span className="text-green-400">{msg}</span> :
                                msg.startsWith("❌") ? <span className="text-red-400">{msg}</span> : msg}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
