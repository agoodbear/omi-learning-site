"use client";

import { useState, useRef } from "react";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, addDoc, updateDoc, collection, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Case, CaseCategory } from "@/types/firestore-schema";
import { Upload, X, Plus, Save, Send, Loader2, Image as ImageIcon, ZoomIn, FileText } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import ECGImageViewer from "@/components/ECGImageViewer";
import { deidentifyEcgPdf } from "@/lib/pdfDeid";

type CaseFormProps = {
    initialData?: Case;
    mode: "create" | "edit" | "submit";
    submitter?: { uid: string; employeeId: string }; // For user submissions
};

export default function CaseForm({ initialData, mode, submitter }: CaseFormProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingPdf, setUploadingPdf] = useState(false);

    // Form State
    const [title, setTitle] = useState(initialData?.title || "");
    const [category, setCategory] = useState<CaseCategory>(initialData?.category || "OMI");
    const [clinicalContext, setClinicalContext] = useState(initialData?.clinical_context || "");
    const [ecgImages, setEcgImages] = useState<string[]>(initialData?.ecg_images || []);
    const [question, setQuestion] = useState(initialData?.question || "");
    const [choices, setChoices] = useState<string[]>(initialData?.choices || ["", "", "", ""]);
    const [correctAnswer, setCorrectAnswer] = useState<number>(initialData?.correct_answer ?? 0);
    const [explanation, setExplanation] = useState(initialData?.explanation || "");
    const [references, setReferences] = useState<string[]>(initialData?.references || [""]);
    // Quiz is optional: default to true for create/edit, false for submit; if editing, check if quiz data exists
    const [includeQuiz, setIncludeQuiz] = useState(() => {
        if (mode === "submit") return false;
        // For edit mode, check if case has quiz data
        if (initialData && !initialData.question) return false;
        return true;
    });

    // Zoom State
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    // Validation
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!title.trim()) newErrors.title = "標題為必填";
        if (!clinicalContext.trim()) newErrors.clinicalContext = "臨床情境為必填";
        if (ecgImages.length === 0) newErrors.ecgImages = "請至少上傳一張 ECG 圖片";

        // Quiz validation only if includeQuiz is true
        if (includeQuiz) {
            if (!question.trim()) newErrors.question = "問題為必填";
            if (choices.some(c => !c.trim())) newErrors.choices = "所有選項都必須填寫";
            if (correctAnswer < 0 || correctAnswer >= choices.length) newErrors.correctAnswer = "請選擇一個正確答案";
            if (!explanation.trim()) newErrors.explanation = "解析為必填";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingImage(true);

        try {
            const caseId = initialData?.id || "temp-" + uuidv4();

            for (const file of Array.from(files)) {
                // Validate file type
                if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                    alert(`檔案類型無效：${file.name}。僅允許 PNG, JPG, WEBP。`);
                    continue;
                }

                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert(`檔案過大：${file.name}。最大允許 5MB。`);
                    continue;
                }

                const ext = file.name.split(".").pop();
                const fileName = `${uuidv4()}.${ext}`;
                const storageRef = ref(storage, `cases/${caseId}/${fileName}`);

                await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(storageRef);

                setEcgImages(prev => [...prev, downloadURL]);
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("圖片上傳失敗。請檢查控制台。");
        } finally {
            setUploadingImage(false);
            // Clear the input
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const removeImage = (index: number) => {
        setEcgImages(prev => prev.filter((_, i) => i !== index));
    };

    // PDF Upload and De-identification
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingPdf(true);

        try {
            const caseId = initialData?.id || "temp-" + uuidv4();

            for (const file of Array.from(files)) {
                // Validate file type
                if (file.type !== "application/pdf") {
                    alert(`檔案類型無效：${file.name}。僅允許 PDF。`);
                    continue;
                }

                // Validate file size (max 10MB for PDFs)
                if (file.size > 10 * 1024 * 1024) {
                    alert(`檔案過大：${file.name}。PDF 最大允許 10MB。`);
                    continue;
                }

                // De-identify the PDF (convert to cropped image)
                const deidentifiedBlob = await deidentifyEcgPdf(file);

                // Create a File object from the Blob
                const fileName = `${uuidv4()}.png`;
                const storageRef = ref(storage, `cases/${caseId}/${fileName}`);

                await uploadBytes(storageRef, deidentifiedBlob);
                const downloadURL = await getDownloadURL(storageRef);

                setEcgImages(prev => [...prev, downloadURL]);
            }
        } catch (err) {
            console.error("PDF upload error:", err);
            alert("PDF 處理失敗。請檢查控制台。");
        } finally {
            setUploadingPdf(false);
            if (pdfInputRef.current) pdfInputRef.current.value = "";
        }
    };

    const handleSave = async (publish: boolean) => {
        if (!validate()) return;

        setLoading(true);

        try {
            // Determine status based on mode
            let status: string;
            if (mode === "submit") {
                status = "pending"; // User submissions always start as pending
            } else {
                status = publish ? "published" : "draft";
            }

            const caseData: any = {
                title: title.trim(),
                category,
                status,
                clinical_context: clinicalContext.trim(),
                ecg_images: ecgImages,
                references: references.filter(r => r.trim()).map(r => r.trim()),
                updatedAt: Timestamp.now(),
            };

            // Include quiz data only if enabled
            if (includeQuiz) {
                caseData.question = question.trim();
                caseData.choices = choices.map(c => c.trim());
                caseData.correct_answer = correctAnswer;
                caseData.explanation = explanation.trim();
            }

            // Add submitter info for user submissions
            if (mode === "submit" && submitter) {
                caseData.submittedBy = submitter;
            }

            if (mode === "create" || mode === "submit") {
                await addDoc(collection(db, "cases"), {
                    ...caseData,
                    createdAt: Timestamp.now(),
                });
            } else if (initialData?.id) {
                await updateDoc(doc(db, "cases", initialData.id), caseData);
            }

            // Redirect based on mode
            if (mode === "submit") {
                router.push("/cases?submitted=true");
            } else {
                router.push("/admin/cases");
            }
        } catch (err) {
            console.error("Save error:", err);
            alert("儲存案例失敗。請檢查控制台。");
        } finally {
            setLoading(false);
        }
    };

    const addChoice = () => setChoices(prev => [...prev, ""]);
    const removeChoice = (index: number) => {
        if (choices.length <= 2) return;
        setChoices(prev => prev.filter((_, i) => i !== index));
        if (correctAnswer >= index && correctAnswer > 0) {
            setCorrectAnswer(correctAnswer - 1);
        }
    };
    const updateChoice = (index: number, value: string) => {
        setChoices(prev => prev.map((c, i) => i === index ? value : c));
    };

    const addReference = () => setReferences(prev => [...prev, ""]);
    const removeReference = (index: number) => {
        if (references.length <= 1) return;
        setReferences(prev => prev.filter((_, i) => i !== index));
    };
    const updateReference = (index: number, value: string) => {
        setReferences(prev => prev.map((r, i) => i === index ? value : r));
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Section 1: Basic Info */}
            <section className="card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">基本資訊</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">標題 *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
                            placeholder="例如：55歲男性胸痛"
                        />
                        {errors.title && <p className="text-alert-red text-sm mt-1">{errors.title}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">分類 *</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as CaseCategory)}
                            className="w-full border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary bg-white"
                        >
                            <option value="OMI">OMI</option>
                            <option value="STEMI_mimics">STEMI Mimics</option>
                            <option value="Electrolyte">Electrolyte</option>
                        </select>
                    </div>
                </div>
            </section>

            {/* Section 2: Clinical Context */}
            <section className="card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">臨床情境</h2>
                <textarea
                    value={clinicalContext}
                    onChange={(e) => setClinicalContext(e.target.value)}
                    rows={4}
                    className="w-full border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary resize-none"
                    placeholder="描述病患的主訴與表現..."
                />
                {errors.clinicalContext && <p className="text-alert-red text-sm mt-1">{errors.clinicalContext}</p>}
            </section>

            {/* Section 3: ECG Images */}
            <section className="card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">ECG 圖片</h2>

                {/* Image Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {ecgImages.map((url, idx) => (
                        <div key={idx} className="relative group aspect-video bg-gray-100 rounded-lg overflow-hidden border border-border">
                            <img
                                src={url}
                                alt={`ECG ${idx + 1}`}
                                className="w-full h-full object-cover cursor-zoom-in"
                                onClick={() => setZoomedImage(url)}
                            />

                            {/* Zoom Icon Overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <ZoomIn className="text-white drop-shadow-md" size={32} />
                            </div>

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeImage(idx);
                                }}
                                className="absolute top-2 right-2 bg-alert-red text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}

                    {/* Upload Button */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="aspect-video border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted hover:border-primary hover:text-primary transition-colors cursor-pointer"
                    >
                        {uploadingImage ? (
                            <Loader2 size={24} className="animate-spin" />
                        ) : (
                            <>
                                <Upload size={24} />
                                <span className="text-sm">上傳圖片</span>
                            </>
                        )}
                    </button>

                    {/* PDF Upload Button */}
                    <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={uploadingPdf}
                        className="aspect-video border-2 border-dashed border-green-300 rounded-lg flex flex-col items-center justify-center gap-2 text-green-600 hover:border-green-500 hover:bg-green-50 transition-colors cursor-pointer"
                    >
                        {uploadingPdf ? (
                            <Loader2 size={24} className="animate-spin" />
                        ) : (
                            <>
                                <FileText size={24} />
                                <span className="text-sm">上傳 ECG PDF</span>
                                <span className="text-xs opacity-70">自動去識別化</span>
                            </>
                        )}
                    </button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                />

                <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handlePdfUpload}
                    className="hidden"
                />

                <p className="text-xs text-muted">接受格式：PNG, JPG, WEBP, PDF。圖片最大 5MB，PDF 最大 10MB。</p>
                <p className="text-xs text-green-600">📋 上傳 ECG PDF 時，會自動裁切掉病患資訊區域。</p>
                {errors.ecgImages && <p className="text-alert-red text-sm mt-1">{errors.ecgImages}</p>}
            </section>

            {/* Section 4: Quiz Question */}
            <section className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground">測驗問題</h2>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeQuiz}
                            onChange={(e) => setIncludeQuiz(e.target.checked)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                        />
                        <span className="text-sm text-muted">包含測驗題目</span>
                    </label>
                </div>

                {!includeQuiz ? (
                    <p className="text-sm text-muted italic">未選擇包含測驗題目，此案例將僅作為討論用途。</p>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">問題 *</label>
                            <textarea
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                rows={2}
                                className="w-full border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary resize-none"
                                placeholder="最可能的診斷是什麼？"
                            />
                            {errors.question && <p className="text-alert-red text-sm mt-1">{errors.question}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">答案選項 *</label>
                            <div className="space-y-2">
                                {choices.map((choice, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="correctAnswer"
                                            checked={correctAnswer === idx}
                                            onChange={() => setCorrectAnswer(idx)}
                                            className="w-4 h-4 accent-primary cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={choice}
                                            onChange={(e) => updateChoice(idx, e.target.value)}
                                            className="flex-1 border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
                                            placeholder={`選項 ${idx + 1}`}
                                        />
                                        {choices.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => removeChoice(idx)}
                                                className="p-2 text-muted hover:text-alert-red cursor-pointer"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={addChoice}
                                className="mt-2 text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <Plus size={14} /> 新增選項
                            </button>
                            {errors.choices && <p className="text-alert-red text-sm mt-1">{errors.choices}</p>}
                            {errors.correctAnswer && <p className="text-alert-red text-sm mt-1">{errors.correctAnswer}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">解析 *</label>
                            <textarea
                                value={explanation}
                                onChange={(e) => setExplanation(e.target.value)}
                                rows={4}
                                className="w-full border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary resize-none"
                                placeholder="解釋正確答案的原因..."
                            />
                            {errors.explanation && <p className="text-alert-red text-sm mt-1">{errors.explanation}</p>}
                        </div>
                    </div>
                )}
            </section>

            {/* Section 5: References */}
            <section className="card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">參考資料</h2>

                <div className="space-y-2">
                    {references.map((ref, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={ref}
                                onChange={(e) => updateReference(idx, e.target.value)}
                                className="flex-1 border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
                                placeholder="例如：Dr. Smith's ECG Blog"
                            />
                            {references.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeReference(idx)}
                                    className="p-2 text-muted hover:text-alert-red cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={addReference}
                    className="mt-2 text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                    <Plus size={14} /> 新增參考資料
                </button>
            </section>

            {/* Actions */}
            <div className="flex justify-end gap-4">
                <button
                    type="button"
                    onClick={() => router.push(mode === "submit" ? "/cases" : "/admin/cases")}
                    className="px-6 py-2 border border-border rounded-lg text-muted hover:text-foreground hover:border-gray-400 transition-colors cursor-pointer"
                >
                    取消
                </button>

                {mode !== "submit" && (
                    <button
                        type="button"
                        onClick={() => handleSave(false)}
                        disabled={loading}
                        className="px-6 py-2 border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                        <Save size={16} /> 儲存為草稿
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => handleSave(mode !== "submit")}
                    disabled={loading}
                    className="btn-success flex items-center gap-2 cursor-pointer"
                >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {mode === "submit" ? "提交審核" : "發布"}
                </button>
            </div>

            {/* Image Viewer Modal */}
            <ECGImageViewer
                src={zoomedImage || ""}
                alt="ECG Preview"
                isOpen={!!zoomedImage}
                onClose={() => setZoomedImage(null)}
            />
        </div>
    );
}
