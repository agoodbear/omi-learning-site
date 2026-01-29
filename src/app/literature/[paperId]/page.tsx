"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Paper } from "@/types/firestore-schema";
import { useAuth } from "@/lib/auth/AuthContext";
import { ArrowLeft, BookOpen, Quote, X } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { logEvent } from "@/lib/events";
import { logView } from "@/app/actions/logView";
import TipTapEditor from "@/components/content/TipTapEditor";
import type { HighlightArea } from "@/components/pdf/PDFReader";

// Dynamically import PDFReader to avoid SSR issues
const PDFReader = dynamic(() => import("@/components/pdf/PDFReader"), { ssr: false });
import { PDFReaderRef } from "@/components/pdf/PDFReader"; // Import ref type

// Firestore highlight document type
interface FirestoreHighlight {
    id?: string;
    paperId: string;
    // New format
    areas?: {
        pageIndex: number;
        left: number;
        top: number;
        width: number;
        height: number;
    }[];
    // Legacy single rect format
    pageIndex?: number;
    left?: number;
    top?: number;
    width?: number;
    height?: number;

    color: string;
    text?: string;
    comment?: string;
    type?: 'text' | 'image';
    imageUrl?: string;
    createdAt?: any;
    updatedAt?: any;
}

export default function LiteratureDetailPage() {
    const { paperId } = useParams();
    const { user, loading: authLoading } = useAuth();
    const pdfReaderRef = useRef<PDFReaderRef>(null);
    const containerRef = useRef<HTMLDivElement>(null); // Ref for container

    const [paper, setPaper] = useState<Paper | null>(null);
    const [highlights, setHighlights] = useState<FirestoreHighlight[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [expandedHighlightId, setExpandedHighlightId] = useState<string | null>(null);
    const [clickedHighlightId, setClickedHighlightId] = useState<string | null>(null); // Track clicked highlight

    // Resizable Sidebar State
    const [sidebarWidth, setSidebarWidth] = useState(384); // Default 384px (w-96)
    const [isDragging, setIsDragging] = useState(false);

    const startResizing = (mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsDragging(true);
    };

    const stopResizing = () => {
        setIsDragging(false);
    };

    const resize = (mouseMoveEvent: any) => {
        if (isDragging) {
            // Calculate new width: Total Width - Mouse X (since sidebar is on the right)
            // But actually we are resizing from the left of the sidebar? 
            // Wait, standard sidebar is usually on the LEFT in global layout, but here highlight sidebar is on RIGHT?
            // "右邊藍色區塊移到最右側". Yes, Highlight Sidebar is on the RIGHT.
            // So width = Window Width - Mouse X.
            const newWidth = window.innerWidth - mouseMoveEvent.clientX;
            if (newWidth > 250 && newWidth < window.innerWidth * 0.6) {
                setSidebarWidth(newWidth);
            }
        }
    };

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isDragging]);

    // Arrow State
    const [arrowCoords, setArrowCoords] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);

    // Recalculate arrow position - Same logic as Admin Page
    const updateArrowPosition = () => {
        if (!clickedHighlightId || !containerRef.current) {
            setArrowCoords(null);
            return;
        }

        const containerRect = containerRef.current.getBoundingClientRect();
        const sidebarEl = document.getElementById(`sidebar-highlight-${clickedHighlightId}`);
        const highlightEl = document.getElementById(`highlight-${clickedHighlightId}`);

        if (sidebarEl && highlightEl) {
            const sidebarRect = sidebarEl.getBoundingClientRect();
            const highlightRect = highlightEl.getBoundingClientRect();

            const x1 = sidebarRect.left - containerRect.left;
            const y1 = sidebarRect.top + sidebarRect.height / 2 - containerRect.top;

            const x2 = highlightRect.right - containerRect.left;
            const y2 = highlightRect.top + highlightRect.height / 2 - containerRect.top;

            setArrowCoords({ x1, y1, x2, y2 });
        } else {
            setArrowCoords(null);
        }
    };

    useEffect(() => {
        if (!clickedHighlightId) return;
        updateArrowPosition();
        const interval = setInterval(updateArrowPosition, 100);
        window.addEventListener('resize', updateArrowPosition);
        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', updateArrowPosition);
        };
    }, [clickedHighlightId]);


    useEffect(() => {
        if (!paperId || (!user && !authLoading)) return;

        async function fetchPaper() {
            try {
                const paperRef = doc(db, "papers", paperId as string);
                const snap = await getDoc(paperRef);

                if (snap.exists()) {
                    const data = snap.data() as Paper;

                    if (data.status !== 'published') {
                        setError("This paper is not available.");
                        return;
                    }

                    setPaper({ id: snap.id, ...data });
                } else {
                    setError("Paper not found.");
                }
            } catch (err) {
                console.error("Error fetching paper:", err);
                setError("Failed to load paper.");
            }
        }

        fetchPaper();

        // Listen for Highlights (ReadOnly)
        const contentRef = doc(db, "papers", paperId as string);
        const highlightsQ = query(collection(contentRef, "highlights"), orderBy("createdAt", "asc"));

        const unsubscribe = onSnapshot(highlightsQ, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreHighlight));
            setHighlights(fetched);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching highlights:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [paperId, user, authLoading]);

    // Log View Event
    const hasLoggedView = useRef(false);
    useEffect(() => {
        if (user && paper && !hasLoggedView.current) {
            logView(user.uid, "paper", paper.id!, {
                title: paper.title
            });
            hasLoggedView.current = true;
        }
    }, [user, paper]);

    if (authLoading || loading) return <div className="p-8 text-center text-muted">Loading Paper...</div>;

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                <div className="border border-alert-red text-alert-red bg-red-50 p-6 rounded-lg text-center">
                    Please log in to access the Literature Library.
                </div>
            </div>
        );
    }

    if (error || !paper) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                <div className="text-xl font-semibold text-muted">{error || "Paper not found"}</div>
                <Link href="/literature" className="text-primary hover:underline">Return to Library</Link>
            </div>
        );
    }

    // Convert Firestore Highlights to PDFReader format
    // @ts-ignore
    const viewerHighlights = highlights.map(h => {
        // Handle legacy highlights that don't have 'areas'
        const areas = h.areas || (h.pageIndex !== undefined ? [{
            pageIndex: h.pageIndex!,
            left: h.left!,
            top: h.top!,
            width: h.width!,
            height: h.height!
        }] : []);

        return {
            id: h.id!,
            areas: areas,
            color: h.color,
            text: h.text,
            comment: h.comment,
            // Include image if present to match types, though read-only logic is same
            contentImage: h.imageUrl,
            type: h.type
        };
    });

    return (
        <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-border p-4 flex items-center justify-between shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <Link href="/literature" className="text-muted hover:text-foreground transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="font-bold text-lg text-foreground truncate max-w-md">{paper.title}</h1>
                        <div className="flex items-center gap-2 text-xs text-muted">
                            {paper.year && <span>{paper.year}</span>}
                            {paper.journal && <span>• {paper.journal}</span>}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden relative" ref={containerRef}>

                {/* Arrow Overlay */}
                <svg className="absolute inset-0 z-50 pointer-events-none w-full h-full overflow-visible">
                    {arrowCoords && (
                        <>
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                                </marker>
                            </defs>
                            <path
                                d={`M ${arrowCoords.x1} ${arrowCoords.y1} C ${arrowCoords.x1 - 50} ${arrowCoords.y1}, ${arrowCoords.x2 + 50} ${arrowCoords.y2}, ${arrowCoords.x2} ${arrowCoords.y2}`}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                                markerEnd="url(#arrowhead)"
                                className="animate-pulse"
                            />
                            <circle cx={arrowCoords.x1} cy={arrowCoords.y1} r="4" fill="#ef4444" />
                        </>
                    )}
                </svg>

                {/* PDF Viewer */}
                {/* PDF Viewer - Flex 1 to take remaining space */}
                <div className="flex-1 bg-gray-100 p-4 overflow-auto relative min-w-0">
                    {paper.pdf?.downloadURL ? (
                        <PDFReader
                            ref={pdfReaderRef} // Attach ref
                            url={paper.pdf.downloadURL}
                            highlights={viewerHighlights}
                            readOnly={true}
                        />
                    ) : (
                        <div className="text-center p-12 text-muted">Unable to load PDF.</div>
                    )}
                </div>

                {/* Highlights Sidebar (Read Only) */}
                {/* Resizer Handle */}
                {highlights.length > 0 && (
                    <div
                        className="w-2 cursor-col-resize bg-border hover:bg-primary transition-colors z-30 flex items-center justify-center"
                        onMouseDown={startResizing}
                    >
                        <div className="w-1 h-8 bg-gray-300 rounded-full" />
                    </div>
                )}

                {/* Highlights Sidebar (Resizable) */}
                {highlights.length > 0 && (
                    <div
                        className="bg-white border-l border-border flex flex-col shrink-0"
                        style={{ width: sidebarWidth }}
                    >
                        <div className="p-4 border-b border-border font-semibold text-sm text-gray-700 bg-gray-50 flex items-center gap-2">
                            <Quote size={16} />
                            <span>Highlights</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {highlights.map(h => (
                                <div
                                    key={h.id}
                                    id={`sidebar-highlight-${h.id}`} // Added ID for arrow target
                                    className={`p-3 rounded-lg border text-sm relative cursor-pointer transition-all ${clickedHighlightId === h.id ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20' : 'border-gray-100 bg-gray-50 hover:border-primary/30'}`}
                                    onClick={() => {
                                        setClickedHighlightId(h.id!); // Set active clicked ID
                                        if (pdfReaderRef.current) {
                                            pdfReaderRef.current.scrollToHighlight(h.id!);
                                        }
                                    }}
                                >
                                    <div
                                        className="w-1 h-full absolute left-0 top-0 bottom-0 rounded-l-lg"
                                        style={{ backgroundColor: h.color }}
                                    ></div>

                                    {h.type === 'image' && h.imageUrl ? (
                                        <div
                                            className="mb-2 border border-gray-200 rounded overflow-hidden hover:opacity-90 active:scale-95 transition-transform cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setClickedHighlightId(h.id!);
                                                if (pdfReaderRef.current) {
                                                    pdfReaderRef.current.scrollToHighlight(h.id!);
                                                }
                                            }}
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedImage(h.imageUrl!);
                                            }}
                                        >
                                            <img src={h.imageUrl} alt="Highlight Snapshot" className="w-full h-auto" />
                                        </div>
                                    ) : (
                                        h.text && (
                                            <blockquote
                                                className={`pl-2 border-l-2 border-gray-300 text-xs text-gray-600 mb-2 italic cursor-pointer hover:bg-gray-50 transition-colors ${expandedHighlightId === h.id ? '' : 'line-clamp-4'}`}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedHighlightId(expandedHighlightId === h.id ? null : h.id!);
                                                }}
                                                title="Double click to expand/collapse"
                                            >
                                                "{h.text}"
                                            </blockquote>
                                        )
                                    )}

                                    {h.comment && (
                                        <p className="font-medium text-gray-800 text-xs">
                                            {h.comment}
                                        </p>
                                    )}
                                    <div className="text-[10px] text-muted text-right mt-1">Page {h.areas && h.areas.length > 0 ? h.areas[0].pageIndex + 1 : (h.pageIndex !== undefined ? h.pageIndex + 1 : 'N/A')}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {/* Image Lightbox */}
            {selectedImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedImage(null)}>
                    <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2" onClick={() => setSelectedImage(null)}>
                        <X size={32} />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Enlarged"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
