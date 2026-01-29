"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/auth/AuthContext";
import { ArrowLeft, Upload, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { PaperStatus } from "@/types/firestore-schema";

export default function NewLiteraturePage() {
    const { isAdminUser } = useAuth();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [formData, setFormData] = useState({
        title: "",
        authors: "",
        journal: "",
        year: new Date().getFullYear().toString(),
        tags: "",
        status: "draft" as PaperStatus
    });
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !isAdminUser) return;

        setIsSubmitting(true);
        try {
            // 1. Create Paper Document first to get ID
            const paperRef = await addDoc(collection(db, "papers"), {
                title: formData.title,
                authors: formData.authors,
                journal: formData.journal,
                year: parseInt(formData.year) || null,
                tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
                status: formData.status,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                // Placeholder for PDF info, will update after upload
                pdf: {
                    storagePath: "",
                    downloadURL: "",
                    fileName: ""
                }
            });

            // 2. Upload PDF
            const fileExtension = file.name.split('.').pop();
            const storagePath = `papers/${paperRef.id}/${uuidv4()}.${fileExtension}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // 3. Update Document with PDF info
            // We use updateDoc (imported from firebase/firestore but using the db instance requires doc() wrapper)
            // Re-importing doc and updateDoc properly at top
            const { doc, updateDoc } = await import("firebase/firestore");
            await updateDoc(doc(db, "papers", paperRef.id), {
                pdf: {
                    storagePath,
                    downloadURL,
                    fileName: file.name
                }
            });

            router.push("/admin/literature");
        } catch (error) {
            console.error("Error creating paper:", error);
            alert("Failed to create paper. See console for details.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAdminUser) return <div className="p-8 text-center text-alert-red">Access Denied</div>;

    return (
        <div className="min-h-screen bg-background p-8 max-w-3xl mx-auto">
            <Link href="/admin/literature" className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-6 transition-colors">
                <ArrowLeft size={16} /> Back to Literature
            </Link>

            <h1 className="text-2xl font-bold text-foreground mb-8">Add New Literature</h1>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl border border-border shadow-sm">

                {/* File Upload - Prominent */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative cursor-pointer group">
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        required
                    />
                    <div className="flex flex-col items-center gap-2 text-muted group-hover:text-primary transition-colors">
                        {file ? (
                            <>
                                <FileText size={48} className="text-primary" />
                                <span className="font-semibold text-foreground">{file.name}</span>
                                <span className="text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </>
                        ) : (
                            <>
                                <Upload size={48} />
                                <span className="font-medium">Click to upload PDF</span>
                                <span className="text-xs">Only .pdf files allowed</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-2">
                        <label className="text-sm font-semibold text-foreground">Title</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full p-3 rounded-lg border border-border focus:border-primary focus:outline-none"
                            placeholder="e.g. 2023 ESC Guidelines for..."
                            required
                        />
                    </div>

                    <div className="space-y-2 col-span-2">
                        <label className="text-sm font-semibold text-foreground">Authors</label>
                        <input
                            type="text"
                            value={formData.authors}
                            onChange={e => setFormData({ ...formData, authors: e.target.value })}
                            className="w-full p-3 rounded-lg border border-border focus:border-primary focus:outline-none"
                            placeholder="e.g. Smith J, Doe A et al."
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Journal / Source</label>
                        <input
                            type="text"
                            value={formData.journal}
                            onChange={e => setFormData({ ...formData, journal: e.target.value })}
                            className="w-full p-3 rounded-lg border border-border focus:border-primary focus:outline-none"
                            placeholder="e.g. NEJM"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Year</label>
                        <input
                            type="number"
                            value={formData.year}
                            onChange={e => setFormData({ ...formData, year: e.target.value })}
                            className="w-full p-3 rounded-lg border border-border focus:border-primary focus:outline-none"
                            placeholder="2023"
                        />
                    </div>

                    <div className="space-y-2 col-span-2">
                        <label className="text-sm font-semibold text-foreground">Tags (comma separated)</label>
                        <input
                            type="text"
                            value={formData.tags}
                            onChange={e => setFormData({ ...formData, tags: e.target.value })}
                            className="w-full p-3 rounded-lg border border-border focus:border-primary focus:outline-none"
                            placeholder="e.g. OMI, Guidelines, Review"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Status</label>
                        <select
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value as PaperStatus })}
                            className="w-full p-3 rounded-lg border border-border focus:border-primary focus:outline-none bg-white"
                        >
                            <option value="draft">Draft (Hidden)</option>
                            <option value="published">Published (Visible)</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                </div>

                <div className="pt-6 border-t border-border flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting || !file}
                        className="btn-primary flex items-center gap-2 px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <><Loader2 className="animate-spin" /> Uploading...</> : "Create & Upload PDF"}
                    </button>
                </div>
            </form>
        </div>
    );
}
