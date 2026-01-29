"use client";

import { useState } from "react";
import { Paper } from "@/types/firestore-schema";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import TipTapEditor from "@/components/content/TipTapEditor";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

// Styles
import "@react-pdf-viewer/core/lib/styles/index.css";

interface LatestPaperHeroProps {
    paper: Paper;
}

import { useAuth } from "@/lib/auth/AuthContext";

export default function LatestPaperHero({ paper }: LatestPaperHeroProps) {
    const { isAdminUser } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);

    if (!paper) return null;

    const paperLink = isAdminUser ? `/admin/literature/${paper.id}/edit` : `/literature/${paper.id}`;

    return (
        <div className="bg-white border border-border rounded-xl shadow-sm p-6 md:p-8 mb-8">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Left: PDF Thumbnail (First Page) */}
                <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
                    <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-inner relative group">
                        {paper.pdf?.downloadURL ? (
                            <div className="h-full w-full pointer-events-none select-none">
                                <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                                    <Viewer
                                        fileUrl={paper.pdf.downloadURL}
                                        initialPage={0}
                                        defaultScale={0.4} // Small scale for thumbnail
                                        renderLoader={(percentages) => (
                                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                                Loading... {Math.round(percentages)}%
                                            </div>
                                        )}
                                    />
                                </Worker>
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <FileText size={48} />
                            </div>
                        )}

                        {/* Overlay to indicate clickable */}
                        <Link href={paperLink} className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 bg-white shadow-lg px-4 py-2 rounded-full text-sm font-medium text-primary transition-all transform translate-y-2 group-hover:translate-y-0">
                                {isAdminUser ? "Edit Paper" : "Read Paper"}
                            </span>
                        </Link>
                    </div>
                </div>

                {/* Right: Info & Summary */}
                <div className="flex-1 flex flex-col">
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded">
                                Newest Upload
                            </span>
                            <span className="text-sm text-muted">
                                {paper.year}
                            </span>
                        </div>
                        <Link href={paperLink} className="hover:text-primary transition-colors">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
                                {paper.title}
                            </h2>
                        </Link>
                        <p className="text-sm text-gray-600 mb-4">{paper.authors}</p>
                    </div>

                    <div className={`flex-1 bg-gray-50 rounded-lg p-4 border border-gray-100 mb-4 overflow-hidden relative transition-all duration-500 ease-in-out ${isExpanded ? '' : 'max-h-[300px]'}`}>
                        <div className="absolute top-0 right-0 p-2 bg-gray-50 rounded-bl-lg border-l border-b border-gray-100 text-xs font-medium text-gray-400">
                            Summary
                        </div>
                        {paper.summaryHtml ? (
                            <div className={`prose prose-sm max-w-none text-gray-600 ${isExpanded ? '' : 'line-clamp-[10]'}`}>
                                <div dangerouslySetInnerHTML={{ __html: paper.summaryHtml }} />
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 italic">No summary available.</p>
                        )}

                        {/* Gradient fade only when NOT expanded */}
                        {!isExpanded && (
                            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" />
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        {/* Read Paper Link */}
                        <Link
                            href={paperLink}
                            className="inline-flex items-center gap-2 text-muted hover:text-foreground font-medium text-sm border border-transparent hover:border-gray-200 px-3 py-1.5 rounded transition-all"
                        >
                            <FileText size={16} /> Open PDF
                        </Link>

                        {/* Expand/Collapse Button */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm px-3 py-1.5 rounded hover:bg-primary/5 transition-all"
                        >
                            {isExpanded ? (
                                <>Show Less <ArrowRight size={16} className="rotate-180 transition-transform" /></>
                            ) : (
                                <>Read Full Summary <ArrowRight size={16} /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
