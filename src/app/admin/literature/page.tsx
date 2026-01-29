"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Paper } from "@/types/firestore-schema";
import { useAuth } from "@/lib/auth/AuthContext";
import { Plus, Edit, Trash2, FileText, ExternalLink, Archive, Eye } from "lucide-react";
import { format } from "date-fns";

export default function AdminLiteraturePage() {
    const { isAdminUser, loading: authLoading } = useAuth();
    const [papers, setPapers] = useState<Paper[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdminUser && !authLoading) return;

        const q = query(
            collection(db, "papers"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPapers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Paper));
            setPapers(fetchedPapers);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isAdminUser, authLoading]);

    const handleStatusChange = async (paperId: string, newStatus: Paper["status"]) => {
        if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;
        try {
            await updateDoc(doc(db, "papers", paperId), {
                status: newStatus,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status");
        }
    };

    const handleDelete = async (paperId: string) => {
        if (!confirm("Are you sure you want to delete this paper? This cannot be undone.")) return;
        try {
            await deleteDoc(doc(db, "papers", paperId));
        } catch (error) {
            console.error("Error deleting paper:", error);
            alert("Failed to delete paper");
        }
    };

    if (authLoading || loading) return <div className="p-8 text-center text-muted">Loading literature...</div>;

    if (!isAdminUser) return <div className="p-8 text-center text-alert-red font-bold">Access Denied</div>;

    return (
        <div className="min-h-screen bg-background p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">Literature Management</h1>
                    <p className="text-muted">Manage research papers, guidelines, and reading materials.</p>
                </div>
                <Link
                    href="/admin/literature/new"
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={20} />
                    Add New Paper
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-border">
                        <tr>
                            <th className="p-4 font-semibold text-muted text-sm uppercase tracking-wider">Title / Journal</th>
                            <th className="p-4 font-semibold text-muted text-sm uppercase tracking-wider">Status</th>
                            <th className="p-4 font-semibold text-muted text-sm uppercase tracking-wider">Updated</th>
                            <th className="p-4 font-semibold text-muted text-sm uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {papers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-muted">No papers found. Click "Add New Paper" to create one.</td>
                            </tr>
                        ) : (
                            papers.map((paper) => (
                                <tr key={paper.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-4">
                                        <div className="font-semibold text-foreground flex items-center gap-2">
                                            <FileText size={16} className="text-primary" />
                                            {paper.title}
                                        </div>
                                        <div className="text-xs text-muted mt-1">
                                            {paper.authors} • {paper.journal} ({paper.year})
                                        </div>
                                        <div className="flex gap-1 mt-2">
                                            {paper.tags?.map(tag => (
                                                <span key={tag} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
                                        ${paper.status === "published" ? "bg-green-50 text-green-700 border-green-200" :
                                                paper.status === "draft" ? "bg-gray-50 text-gray-700 border-gray-200" :
                                                    "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                            {paper.status === "published" && <Eye size={12} className="mr-1" />}
                                            {paper.status === "archived" && <Archive size={12} className="mr-1" />}
                                            {paper.status.charAt(0).toUpperCase() + paper.status.slice(1)}
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-muted">
                                        {paper.updatedAt ? format(paper.updatedAt.toDate(), "MMM d, yyyy") : "-"}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* Status Toggles */}
                                            {paper.status !== "published" && (
                                                <button
                                                    onClick={() => handleStatusChange(paper.id!, "published")}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                                                    title="Publish"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            )}
                                            {paper.status === "published" && (
                                                <button
                                                    onClick={() => handleStatusChange(paper.id!, "draft")}
                                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded"
                                                    title="Unpublish (Draft)"
                                                >
                                                    <Archive size={18} />
                                                </button>
                                            )}

                                            <Link
                                                href={`/admin/literature/${paper.id}/edit`}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                title="Edit"
                                            >
                                                <Edit size={18} />
                                            </Link>

                                            <button
                                                onClick={() => handleDelete(paper.id!)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
