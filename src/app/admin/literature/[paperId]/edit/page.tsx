"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, addDoc, deleteDoc, onSnapshot, serverTimestamp, orderBy, query } from "firebase/firestore";
import { ref, uploadString, getDownloadURL, uploadBytes } from "firebase/storage";
import { Paper, PaperStatus } from "@/types/firestore-schema";
import { useAuth } from "@/lib/auth/AuthContext";
import { ArrowLeft, Save, Eye, Archive, Trash2, List, Quote, Pencil, X, GripHorizontal } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import TipTapEditor from "@/components/content/TipTapEditor";
import type { HighlightArea, RenderHighlightProps } from "@/components/pdf/PDFReader";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";


// Local Highlight Type without ID (incoming new highlight)
type Highlight = Omit<RenderHighlightProps, "id">;

// Dynamically import PDFReader to avoid SSR issues
const PDFReader = dynamic(() => import("@/components/pdf/PDFReader"), { ssr: false });
import { PDFReaderRef } from "@/components/pdf/PDFReader"; // Import ref type

// Firestore highlight document type
interface FirestoreHighlight {
    id?: string;
    paperId: string;
    areas?: {
        pageIndex: number;
        left: number;
        top: number;
        width: number;
        height: number;
    }[];
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

export default function EditLiteraturePage() {
    const { paperId } = useParams();
    const router = useRouter();
    const { isAdminUser } = useAuth();
    const pdfReaderRef = useRef<PDFReaderRef>(null);
    const containerRef = useRef<HTMLDivElement>(null); // Ref for the split-pane container

    const [paper, setPaper] = useState<Paper | null>(null);
    const [highlights, setHighlights] = useState<FirestoreHighlight[]>([]);
    const [loading, setLoading] = useState(true);

    const [summaryHtml, setSummaryHtml] = useState("");
    const [summaryJson, setSummaryJson] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
    const [editCommentText, setEditCommentText] = useState("");
    const [expandedHighlightId, setExpandedHighlightId] = useState<string | null>(null);
    const [clickedHighlightId, setClickedHighlightId] = useState<string | null>(null); // New state for arrow

    // Arrow State


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
            // Sidebar is on the right, so width = Window Width - Mouse X?
            // Actually this page has margins/padding possibly? 
            // Wait, this page is full height/width? Yes, "h-screen".
            // However, the mouse X is global. The sidebar right edge is at window right edge?
            // Yes, checking layout: `h-screen flex flex-col`.
            // So logic `window.innerWidth - mouseMoveEvent.clientX` works if sidebar is flush right.
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

    // Dedupe Ref
    const lastAddedRef = useRef<{ signature: string; time: number } | null>(null);

    useEffect(() => {
        if (!paperId || !isAdminUser) return;

        const paperRef = doc(db, "papers", paperId as string);

        getDoc(paperRef).then(snap => {
            if (snap.exists()) {
                const data = snap.data() as Paper;
                setPaper({ id: snap.id, ...data });
                setSummaryHtml(data.summaryHtml || "");
                setSummaryJson(data.summaryJson || "");
            }
        });

        const highlightsQ = query(collection(paperRef, "highlights"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(highlightsQ, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreHighlight));
            setHighlights(fetched);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [paperId, isAdminUser]);

    // Recalculate arrow position
    const updateArrowPosition = useCallback(() => {
        if (!clickedHighlightId || !containerRef.current) {
            setArrowCoords(null);
            return;
        }

        const containerRect = containerRef.current.getBoundingClientRect();
        const sidebarEl = document.getElementById(`sidebar-highlight-${clickedHighlightId}`);
        // Highlight logic: may be multiple rects, try to find the one visible or just the first one
        const highlightEl = document.getElementById(`highlight-${clickedHighlightId}`);

        if (sidebarEl && highlightEl) {
            const sidebarRect = sidebarEl.getBoundingClientRect();
            const highlightRect = highlightEl.getBoundingClientRect();

            // Calculate coordinates relative to the container
            const x1 = sidebarRect.left - containerRect.left; // Start from left edge of sidebar
            const y1 = sidebarRect.top + sidebarRect.height / 2 - containerRect.top; // Center vertically

            const x2 = highlightRect.right - containerRect.left; // End at right edge of PDF highlight
            const y2 = highlightRect.top + highlightRect.height / 2 - containerRect.top; // Center vertically

            setArrowCoords({ x1, y1, x2, y2 });
        } else {
            // If target not visible (e.g. not rendered yet), hide arrow
            setArrowCoords(null);
        }
    }, [clickedHighlightId]);

    // Auto-update arrow on scroll/resize
    useEffect(() => {
        if (!clickedHighlightId) return;

        // Initial update
        updateArrowPosition();

        const interval = setInterval(updateArrowPosition, 100); // Polling for smooth updates during scroll animations or pdf rendering
        window.addEventListener('resize', updateArrowPosition);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', updateArrowPosition);
        };
    }, [clickedHighlightId, updateArrowPosition]);

    const handleAddHighlight = async (highlight: Highlight) => {
        if (!paperId) return;

        const signature = `${highlight.text}-${highlight.type}-${highlight.areas?.[0]?.pageIndex}-${highlight.areas?.[0]?.top}`;
        const now = Date.now();

        if (lastAddedRef.current &&
            lastAddedRef.current.signature === signature &&
            (now - lastAddedRef.current.time < 1000)) {
            console.log("Duplicate highlight prevented");
            return;
        }
        lastAddedRef.current = { signature, time: now };

        try {
            let imageUrl = "";
            let highlightType = highlight.type || 'text';

            if (highlightType === 'image' && highlight.contentImage) {
                const storageRef = ref(storage, `papers/${paperId}/highlights/${Date.now()}.png`);
                await uploadString(storageRef, highlight.contentImage, 'data_url');
                imageUrl = await getDownloadURL(storageRef);
            }

            await addDoc(collection(db, "papers", paperId as string, "highlights"), {
                paperId,
                areas: highlight.areas,
                color: highlight.color,
                text: highlight.text || "",
                comment: highlight.comment || "",
                type: highlightType,
                imageUrl: imageUrl,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        } catch (err: any) {
            console.error("Error adding highlight:", err);
            alert(`Failed to save highlight: ${err.message || err}`);
        }
    };

    const handleDeleteHighlight = async (highlightId: string) => {
        if (!paperId) return;
        if (!confirm("Delete highlight?")) return;
        try {
            await deleteDoc(doc(db, "papers", paperId as string, "highlights", highlightId));
        } catch (err) {
            console.error("Error deleting highlight", err);
        }
    };

    const handleUpdateHighlight = async (highlightId: string, newComment: string) => {
        try {
            await updateDoc(doc(db, "papers", paperId as string, "highlights", highlightId), {
                comment: newComment,
                updatedAt: serverTimestamp()
            });
            setEditingHighlightId(null);
            setEditCommentText("");
        } catch (err) {
            console.error("Error updating highlight", err);
            alert("Failed to update highlight");
        }
    };

    const handleSaveSummary = async () => {
        if (!paperId) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(db, "papers", paperId as string), {
                summaryHtml,
                summaryJson,
                updatedAt: serverTimestamp()
            });
            alert("Summary saved!");
        } catch (err) {
            console.error("Error saving summary", err);
            alert("Error saving study notes.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: PaperStatus) => {
        if (!paperId) return;
        if (!confirm(`Change status to ${newStatus}?`)) return;
        try {
            await updateDoc(doc(db, "papers", paperId as string), { status: newStatus });
            setPaper(prev => prev ? { ...prev, status: newStatus } : null);
        } catch (err) {
            console.error("Error update status", err);
        }
    };

    const handleImageUpload = async (file: File): Promise<string> => {
        if (!paperId) throw new Error("No paper ID");
        const timestamp = Date.now();
        const storageRef = ref(storage, `papers/${paperId}/uploads/${timestamp}_${file.name}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    };

    if (loading) return <div className="p-8 text-center text-muted">Loading Editor...</div>;
    if (!paper) return <div className="p-8 text-center">Paper not found</div>;

    // Convert Firestore Highlights to PDFReader format
    // @ts-ignore
    const viewerHighlights = highlights.map(h => {
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
            contentImage: h.imageUrl, // Map imageUrl to contentImage for viewer rendering if needed
            type: h.type as 'text' | 'image' | undefined
        };
    });

    return (
        <div className="h-screen bg-background flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-border p-4 flex items-center justify-between shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <Link href="/admin/literature" className="text-muted hover:text-foreground transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="font-bold text-lg text-foreground truncate max-w-md">{paper.title}</h1>
                        <div className="flex items-center gap-2 text-xs text-muted">
                            <span className={`px-2 py-0.5 rounded-full border ${paper.status === "published" ? "bg-green-100 text-green-700 border-green-200" :
                                paper.status === "draft" ? "bg-gray-100 text-gray-700 border-gray-200" :
                                    "bg-amber-100 text-amber-700 border-amber-200"
                                }`}>{paper.status}</span>
                            <span>ID: {paper.id}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Save Button moved to Editor Panel */}

                    <div className="h-6 w-[1px] bg-gray-200 mx-2"></div>
                    {paper.status !== "published" && (
                        <button onClick={() => handleStatusChange("published")} className="p-2 text-green-600 hover:bg-green-50 rounded" title="Publish">
                            <Eye size={20} />
                        </button>
                    )}
                    {paper.status !== "archived" && (
                        <button onClick={() => handleStatusChange("archived")} className="p-2 text-amber-600 hover:bg-amber-50 rounded" title="Archive">
                            <Archive size={20} />
                        </button>
                    )}
                </div>
            </header>

            {/* Resizable Layout */}
            <div className="flex-1 overflow-hidden relative">
                <PanelGroup orientation="vertical">

                    {/* Top Panel: PDF + Sidebar (65%) */}
                    <Panel defaultSize={65} minSize={30}>
                        {/* We use a wrapper div here to be the reference container for the arrow overlay */}
                        <div className="flex h-full w-full relative" ref={containerRef}>

                            {/* Arrow Overlay */}
                            <svg className="absolute inset-0 z-50 pointer-events-none w-full h-full overflow-visible">
                                {arrowCoords && (
                                    <>
                                        {/* Defs for arrow marker */}
                                        <defs>
                                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                                <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                                            </marker>
                                        </defs>
                                        {/* Dashed Line */}
                                        <path
                                            d={`M ${arrowCoords.x1} ${arrowCoords.y1} C ${arrowCoords.x1 - 50} ${arrowCoords.y1}, ${arrowCoords.x2 + 50} ${arrowCoords.y2}, ${arrowCoords.x2} ${arrowCoords.y2}`}
                                            fill="none"
                                            stroke="#ef4444"
                                            strokeWidth="2"
                                            strokeDasharray="5,5"
                                            markerEnd="url(#arrowhead)"
                                            className="animate-pulse" // Simple animation
                                        />
                                        {/* Dot at start */}
                                        <circle cx={arrowCoords.x1} cy={arrowCoords.y1} r="4" fill="#ef4444" />
                                    </>
                                )}
                            </svg>

                            {/* PDF Viewer */}
                            <div className="flex-1 bg-gray-100 relative overflow-hidden min-w-0">
                                {paper.pdf?.downloadURL ? (
                                    <PDFReader
                                        ref={pdfReaderRef}
                                        url={paper.pdf.downloadURL}
                                        highlights={viewerHighlights}
                                        onAddHighlight={handleAddHighlight}
                                        onDeleteHighlight={handleDeleteHighlight}
                                        onUpdateHighlight={handleUpdateHighlight}
                                    />
                                ) : (
                                    <div className="text-center p-12 text-alert-red">No PDF found for this paper.</div>
                                )}
                            </div>

                            {/* Resizer Handle */}
                            <div
                                className="w-2 cursor-col-resize bg-border hover:bg-primary transition-colors z-30 flex items-center justify-center shrink-0"
                                onMouseDown={startResizing}
                            >
                                <div className="w-1 h-8 bg-gray-300 rounded-full" />
                            </div>

                            {/* Sidebar (Highlights List) */}
                            <div
                                className="bg-white border-l border-border flex flex-col shrink-0 overflow-y-auto"
                                style={{ width: sidebarWidth }}
                            >
                                <div className="p-4 border-b border-border font-semibold text-sm text-gray-700 bg-gray-50 flex items-center justify-between sticky top-0 z-10">
                                    <span className="flex items-center gap-2"><Quote size={16} /> Highlights ({highlights.length})</span>
                                </div>

                                <div className="p-4 space-y-4">
                                    {highlights.length === 0 && <p className="text-xs text-muted italic text-center">Select text in PDF to add highlights.</p>}

                                    {highlights.map(h => (
                                        <div
                                            key={h.id}
                                            id={`sidebar-highlight-${h.id}`} // Added ID for arrow target
                                            className={`group p-3 rounded-lg border transition-all text-sm relative cursor-pointer ${clickedHighlightId === h.id ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20' : 'border-gray-100 bg-gray-50 hover:border-primary/30'}`}
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
                                                    className="mb-2 border border-gray-200 rounded overflow-hidden hover:opacity-90 active:scale-95 transition-transform"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Also trigger here
                                                        setClickedHighlightId(h.id!);
                                                        if (pdfReaderRef.current) pdfReaderRef.current.scrollToHighlight(h.id!);
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
                                                        className={`pl-2 border-l-2 border-gray-300 text-xs text-gray-600 mb-2 italic cursor-pointer hover:bg-gray-50 transition-colors ${expandedHighlightId === h.id ? '' : 'line-clamp-3'}`}
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

                                            {editingHighlightId === h.id ? (
                                                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                                    <textarea
                                                        value={editCommentText}
                                                        onChange={(e) => setEditCommentText(e.target.value)}
                                                        className="w-full text-xs p-2 border rounded mb-2 focus:ring-1 focus:ring-primary"
                                                        rows={3}
                                                        placeholder="Add a comment..."
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            onClick={() => setEditingHighlightId(null)}
                                                            className="p-1 px-2 text-xs text-gray-500 hover:bg-gray-100 rounded"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateHighlight(h.id!, editCommentText)}
                                                            className="p-1 px-2 text-xs bg-primary text-white rounded hover:bg-primary/90"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                h.comment && (
                                                    <p className="font-medium text-gray-800 text-xs mb-1">
                                                        {h.comment}
                                                    </p>
                                                )
                                            )}

                                            <div className="flex justify-between items-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[10px] text-muted">Page {h.areas && h.areas.length > 0 ? h.areas[0].pageIndex + 1 : (h.pageIndex !== undefined ? h.pageIndex + 1 : 'N/A')}</span>
                                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => {
                                                            setEditingHighlightId(h.id!);
                                                            setEditCommentText(h.comment || "");
                                                        }}
                                                        className="text-gray-500 hover:bg-gray-100 p-1 rounded"
                                                        title="Edit Comment"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteHighlight(h.id!)}
                                                        className="text-red-500 hover:bg-red-50 p-1 rounded"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Panel>

                    <PanelResizeHandle className="h-3 bg-gray-50 hover:bg-primary/10 transition-colors flex items-center justify-center cursor-row-resize border-y border-gray-200 focus:outline-none shrink-0 z-50">
                        <GripHorizontal size={16} className="text-gray-400" />
                    </PanelResizeHandle>

                    {/* Bottom Panel: Editor (35%) */}
                    <Panel defaultSize={35} minSize={20} className="bg-white">
                        <div className="h-full p-6 flex flex-col overflow-hidden">
                            {/* Editor Container - Removed max-w-4xl mx-auto to align left */}
                            <div className="w-full h-full flex flex-col">
                                <div className="flex items-center justify-between mb-2 shrink-0">
                                    <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                                        <List size={20} /> Admin Study Notes (WYSIWYG)
                                    </h3>

                                    {/* Moved Save Button Here */}
                                    <button
                                        onClick={handleSaveSummary}
                                        disabled={isSaving}
                                        className="btn-primary flex items-center gap-2 px-3 py-1.5 text-sm"
                                    >
                                        <Save size={16} /> Save Notes
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg shadow-inner bg-gray-50">
                                    <TipTapEditor
                                        content={summaryHtml}
                                        onChange={(html, json) => {
                                            setSummaryHtml(html);
                                            setSummaryJson(json);
                                        }}
                                        onImageUpload={handleImageUpload}
                                    />
                                </div>
                            </div>
                        </div>
                    </Panel>
                </PanelGroup>
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
                        onClick={(e) => e.stopPropagation()} // Prevent close on image click
                    />
                </div>
            )}
        </div>
    );
}
