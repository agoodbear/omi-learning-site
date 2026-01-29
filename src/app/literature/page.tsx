"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { Paper } from "@/types/firestore-schema";
import { FileText, Search, Tag, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import LatestPaperHero from "@/components/literature/LatestPaperHero";

import { useAuth } from "@/lib/auth/AuthContext";

export default function LiteraturePage() {
    const { isAdminUser } = useAuth();
    const [papers, setPapers] = useState<Paper[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPapers() {
            try {
                // Only fetch published papers
                const q = query(
                    collection(db, "papers"),
                    where("status", "==", "published"),
                    orderBy("createdAt", "desc")
                );

                const snapshot = await getDocs(q);
                const fetchedPapers = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Paper));

                setPapers(fetchedPapers);
            } catch (error) {
                console.error("Error fetching literature:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchPapers();
    }, []);

    // Extract all unique tags
    const allTags = Array.from(new Set(papers.flatMap(p => p.tags || []))).sort();

    // Client-side filtering
    const filteredPapers = papers.filter(p => {
        const matchesSearch = (p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.authors.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesTag = selectedTag ? p.tags?.includes(selectedTag) : true;
        return matchesSearch && matchesTag;
    });

    // Hero Logic: Latest paper is the first one in the sorted list
    const heroPaper = papers.length > 0 ? papers[0] : null;

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-8 flex justify-center">
                <div className="flex flex-col items-center gap-4 text-primary animate-pulse mt-20">
                    <FileText size={48} />
                    <span className="text-muted">Loading library...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 mb-8 gap-4">
                <div>
                    <p className="text-muted text-sm mb-1">Research & Guidelines</p>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">
                        Literature Library
                    </h1>
                </div>
            </div>

            {/* Top Section: Latest Paper Hero */}
            {heroPaper && <LatestPaperHero paper={heroPaper} />}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Filters */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search papers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                            <Tag size={14} /> Filter by Tag
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedTag(null)}
                                className={`px-3 py-1 text-xs rounded-full border transition-all ${selectedTag === null
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white text-muted border-gray-200 hover:border-primary"
                                    }`}
                            >
                                All
                            </button>
                            {allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                    className={`px-3 py-1 text-xs rounded-full border transition-all ${selectedTag === tag
                                        ? "bg-primary text-white border-primary"
                                        : "bg-white text-muted border-gray-200 hover:border-primary"
                                        }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3 space-y-4">
                    {filteredPapers.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-border rounded-lg bg-gray-50">
                            <p className="text-muted">No papers found matching your criteria.</p>
                        </div>
                    ) : (
                        filteredPapers.map(paper => (
                            <Link
                                href={isAdminUser ? `/admin/literature/${paper.id}/edit` : `/literature/${paper.id}`}
                                key={paper.id}
                                className="block group"
                            >
                                <div className="bg-white border border-border rounded-xl p-6 hover:shadow-md hover:border-primary/50 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors flex-1">
                                            {paper.title}
                                        </h2>
                                        {paper.year && (
                                            <span className="shrink-0 text-sm font-medium bg-gray-100 px-2 py-1 rounded text-gray-600">
                                                {paper.year}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-muted mb-4">
                                        <User size={14} />
                                        <span>{paper.authors}</span>
                                        {paper.journal && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                <span className="font-medium text-gray-700">{paper.journal}</span>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between mt-auto">
                                        <div className="flex gap-2">
                                            {paper.tags?.map(tag => (
                                                <span key={tag} className="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-100">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                        <span className="text-xs text-muted">
                                            Added {paper.createdAt ? format(paper.createdAt.toDate(), "MMM d, yyyy") : ""}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
