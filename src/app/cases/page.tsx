"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Case, CaseCategory } from "@/types/firestore-schema";
import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

export default function CasesPage() {
    const { user, loading: authLoading } = useAuth();
    const [cases, setCases] = useState<Case[]>([]);
    const [loading, setLoading] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState<CaseCategory | "All">("All");

    useEffect(() => {
        async function fetchCases() {
            try {
                const casesRef = collection(db, "cases");
                const q = query(casesRef, where("status", "==", "published"));
                const snapshot = await getDocs(q);

                const fetchedCases = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Case));

                setCases(fetchedCases);
            } catch (err) {
                console.error("Error fetching cases:", err);
            } finally {
                setLoading(false);
            }
        }

        if (user) {
            fetchCases();
        }
    }, [user]);

    const filteredCases = categoryFilter === "All"
        ? cases
        : cases.filter(c => c.category === categoryFilter);

    const getCategoryBadgeClass = (category: CaseCategory) => {
        switch (category) {
            case "OMI": return "badge badge-omi";
            case "STEMI_mimics": return "badge badge-mimics";
            case "Electrolyte": return "badge badge-electrolyte";
            default: return "badge";
        }
    };

    // Sort cases by creation time (descending) to find the newest
    const sortedCases = [...filteredCases].sort((a, b) => {
        // Handle varying timestamp formats if necessary, but assuming Firestore Timestamp or standard string
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
    });

    const featuredCase = sortedCases[0];
    const restCases = sortedCases.slice(1);

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 w-full">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 mb-8 gap-4">
                    <div>
                        <p className="text-muted text-sm mb-1">Browse & Study</p>
                        <h1 className="text-3xl font-bold text-foreground tracking-tight">
                            ECG Case Library
                        </h1>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted font-medium">Filter:</span>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value as CaseCategory | "All")}
                            className="bg-white border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary cursor-pointer min-w-[150px]"
                        >
                            <option value="All">All Categories</option>
                            <option value="OMI">OMI</option>
                            <option value="STEMI_mimics">STEMI Mimics</option>
                            <option value="Electrolyte">Electrolyte</option>
                        </select>
                    </div>
                </div>

                {/* Featured Case Section */}
                {featuredCase && (
                    <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <Activity size={20} /> Latest Case
                        </h2>
                        <Link href={`/cases/${featuredCase.id}`} className="group block">
                            <div className="card p-0 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-0 border-primary/20 hover:border-primary transition-all shadow-lg hover:shadow-xl">
                                {/* Large Image Preview */}
                                <div className="h-64 lg:h-auto bg-amber-50 relative overflow-hidden">
                                    {featuredCase.ecg_images[0] && (
                                        <img
                                            src={featuredCase.ecg_images[0]}
                                            alt="Featured ECG"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-8 flex flex-col justify-center bg-gradient-to-br from-white to-gray-50">
                                    <div className="mb-4 text-sm text-muted">
                                        Featured Case #{featuredCase.id?.slice(0, 6)}
                                    </div>
                                    <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors">
                                        {featuredCase.title}
                                    </h3>
                                    <p className="text-muted text-base leading-relaxed mb-8 line-clamp-3">
                                        {featuredCase.clinical_context}
                                    </p>
                                    <div className="flex items-center text-primary font-semibold group-hover:translate-x-2 transition-transform">
                                        Study This Case <ChevronRight size={20} className="ml-1" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </div>
                )}

                {/* Divider */}
                {restCases.length > 0 && (
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-[1px] bg-border flex-1"></div>
                        <span className="text-muted text-sm font-medium uppercase tracking-wider">Recent Cases</span>
                        <div className="h-[1px] bg-border flex-1"></div>
                    </div>
                )}

                {/* Grid for Other Cases */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {restCases.map((c) => (
                        <Link href={`/cases/${c.id}`} key={c.id} className="group">
                            <div className="card p-0 overflow-hidden h-full flex flex-col cursor-pointer hover:-translate-y-1 transition-transform duration-300">
                                {/* Image Preview */}
                                <div className="h-40 bg-amber-50 border-b border-border relative overflow-hidden">
                                    {c.ecg_images[0] && (
                                        <img src={c.ecg_images[0]} alt="ECG Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    )}
                                </div>

                                <div className="p-5 flex-1 flex flex-col">
                                    <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                                        {c.title}
                                    </h3>
                                    <p className="text-muted text-sm mb-4 line-clamp-3 flex-1 leading-relaxed">
                                        {c.clinical_context}
                                    </p>

                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                                        <span className="text-xs text-muted">Case #{c.id?.slice(0, 6)}</span>
                                        <div className="flex items-center gap-1 text-primary text-sm font-medium group-hover:gap-2 transition-all">
                                            View Case <ChevronRight size={16} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {filteredCases.length === 0 && (
                    <div className="text-center py-20 border border-dashed border-border rounded-lg bg-gray-50">
                        <p className="text-muted">No cases found in this category.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
