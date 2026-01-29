"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Viewer, Worker, SpecialZoomLevel } from "@react-pdf-viewer/core";
import { highlightPlugin, RenderHighlightTargetProps, RenderHighlightsProps, RenderHighlightContentProps } from "@react-pdf-viewer/highlight";
import { toolbarPlugin } from "@react-pdf-viewer/toolbar";
import { searchPlugin } from "@react-pdf-viewer/search";
import { Trash2, Plus, GripVertical, Type, Image as ImageIcon, Check, MousePointer2, ChevronLeft, ChevronRight, ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon, Pen, Crop, Eye, EyeOff, Maximize, Search as SearchIcon } from 'lucide-react';
import html2canvas from "html2canvas";

// Styles
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/highlight/lib/styles/index.css";
import "@react-pdf-viewer/toolbar/lib/styles/index.css";
import "@react-pdf-viewer/search/lib/styles/index.css";

export interface HighlightArea {
    pageIndex: number;
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface RenderHighlightProps {
    id: string;
    areas: HighlightArea[];
    color: string;
    text?: string;
    comment?: string;
    contentImage?: string; // Base64 or URL for image highlights
    type?: 'text' | 'image';
}

export interface PDFReaderRef {
    scrollToHighlight: (id: string) => void;
}

interface PDFReaderProps {
    url: string;
    highlights?: RenderHighlightProps[];
    onAddHighlight?: (highlight: Omit<RenderHighlightProps, "id">) => void;
    onDeleteHighlight?: (id: string) => void;
    onUpdateHighlight?: (id: string, newComment: string) => void;
    readOnly?: boolean;
    initialAutoHighlight?: boolean;
}

const HIGHLIGHT_COLORS = [
    { name: "Yellow", value: "#FFEB3B", class: "bg-yellow-300" },
    { name: "Green", value: "#A5D6A7", class: "bg-green-300" },
    { name: "Blue", value: "#90CAF9", class: "bg-blue-300" },
    { name: "Red", value: "#EF9A9A", class: "bg-red-300" },
];

const PDFReader = forwardRef<PDFReaderRef, PDFReaderProps>(({
    url,
    highlights = [],
    onAddHighlight,
    onDeleteHighlight,
    onUpdateHighlight,
    readOnly = false,
    initialAutoHighlight = false,
}, ref) => {
    // Toolbar State
    const [autoHighlight, setAutoHighlight] = useState(initialAutoHighlight);
    const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value);
    const [showHighlights, setShowHighlights] = useState(true);
    const [isSnapshotMode, setIsSnapshotMode] = useState(false);
    const [comment, setComment] = useState("");
    const [showColorPicker, setShowColorPicker] = useState(false);

    // State for hover and edit interactions
    const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null);
    const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
    const [noteContent, setNoteContent] = useState("");

    // Snapshot State
    const snapshotRef = useRef<HTMLDivElement>(null);
    const [snapshotStart, setSnapshotStart] = useState<{ x: number, y: number } | null>(null);
    const [snapshotRect, setSnapshotRect] = useState<{ left: number, top: number, width: number, height: number } | null>(null);

    // Sync initial auto highlight prop
    useEffect(() => {
        setAutoHighlight(initialAutoHighlight);
    }, [initialAutoHighlight]);

    // Handle ESC to cancel snapshot
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isSnapshotMode) {
                setSnapshotStart(null);
                setSnapshotRect(null);
                setIsSnapshotMode(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSnapshotMode]);

    // Snapshot Handler
    const handleSnapshotMouseDown = (e: React.MouseEvent) => {
        if (!isSnapshotMode) return;
        const rect = snapshotRef.current?.getBoundingClientRect();
        if (!rect) return;
        setSnapshotStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleSnapshotMouseMove = (e: React.MouseEvent) => {
        if (!isSnapshotMode || !snapshotStart || !snapshotRef.current) return;
        const rect = snapshotRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        setSnapshotRect({
            left: Math.min(snapshotStart.x, currentX),
            top: Math.min(snapshotStart.y, currentY),
            width: Math.abs(currentX - snapshotStart.x),
            height: Math.abs(currentY - snapshotStart.y),
        });
    };

    const handleSnapshotMouseUp = async () => {
        if (!isSnapshotMode || !snapshotRect || !snapshotRef.current) {
            setSnapshotStart(null);
            return;
        }

        try {
            // we need the viewport rect of the selection
            // snapshotRect is relative to container (snapshotRef)
            // Let's recalculate viewport rects for accuracy
            const containerRect = snapshotRef.current.getBoundingClientRect();
            const selectionViewportRect = {
                left: containerRect.left + snapshotRect.left,
                top: containerRect.top + snapshotRect.top,
                width: snapshotRect.width,
                height: snapshotRect.height,
                right: containerRect.left + snapshotRect.left + snapshotRect.width,
                bottom: containerRect.top + snapshotRect.top + snapshotRect.height
            };

            // Find all page layers
            const pageElements = Array.from(snapshotRef.current.querySelectorAll('.rpv-core__page-layer'));

            let foundPage: { element: HTMLElement, index: number, area: HighlightArea } | null = null;

            for (let i = 0; i < pageElements.length; i++) {
                const pageEl = pageElements[i] as HTMLElement;
                const pageRect = pageEl.getBoundingClientRect();

                // Check intersection
                const intersectLeft = Math.max(selectionViewportRect.left, pageRect.left);
                const intersectTop = Math.max(selectionViewportRect.top, pageRect.top);
                const intersectRight = Math.min(selectionViewportRect.right, pageRect.right);
                const intersectBottom = Math.min(selectionViewportRect.bottom, pageRect.bottom);

                if (intersectLeft < intersectRight && intersectTop < intersectBottom) {
                    const pageIndex = i;

                    const widthRef = pageRect.width;
                    const heightRef = pageRect.height;

                    foundPage = {
                        element: pageEl,
                        index: pageIndex,
                        area: {
                            pageIndex,
                            left: ((intersectLeft - pageRect.left) / widthRef) * 100,
                            top: ((intersectTop - pageRect.top) / heightRef) * 100,
                            width: ((intersectRight - intersectLeft) / widthRef) * 100,
                            height: ((intersectBottom - intersectTop) / heightRef) * 100,
                        }
                    };
                    break;
                }
            }

            if (foundPage && onAddHighlight) {
                // Capture the specific Page
                const canvas = await html2canvas(foundPage.element, {
                    scale: 4,
                    useCORS: true,
                    logging: false,
                });

                // Crop the canvas to the selection
                const cropX = (foundPage.area.left / 100) * canvas.width;
                const cropY = (foundPage.area.top / 100) * canvas.height;
                const cropWidth = (foundPage.area.width / 100) * canvas.width;
                const cropHeight = (foundPage.area.height / 100) * canvas.height;

                const croppedCanvas = document.createElement('canvas');
                croppedCanvas.width = cropWidth;
                croppedCanvas.height = cropHeight;
                const ctx = croppedCanvas.getContext('2d');

                if (ctx) {
                    ctx.drawImage(
                        canvas,
                        cropX, cropY, cropWidth, cropHeight, // Source
                        0, 0, cropWidth, cropHeight // Dest
                    );

                    const imageBase64 = croppedCanvas.toDataURL("image/png");

                    // Add as an image highlight with Area
                    onAddHighlight({
                        areas: [foundPage.area],
                        color: selectedColor,
                        text: "Snapshot",
                        comment: "",
                        contentImage: imageBase64,
                        type: 'image'
                    });
                }
            } else {
                console.warn("No page found under selection");
            }
        } catch (err) {
            console.error("Snapshot failed", err);
            alert("Failed to create snapshot");
        }

        // Reset
        setSnapshotStart(null);
        setSnapshotRect(null);
        setIsSnapshotMode(false);
    };


    // Render highlight target (popup)
    const renderHighlightTarget = (props: RenderHighlightTargetProps) => {
        if (readOnly) return null;

        // Auto Highlight Logic
        if (autoHighlight) {
            // Only trigger if we have a valid selection and we're not just clicking around
            // The plugin handles selection, we just intercept the render
            if (onAddHighlight) {
                // Use a small timeout to allow the 'selection' to settle/verify it's intentional
                // But for immediate feel, we can just add it.
                // We CANNOT call setComment here as it might trigger re-renders loop if not careful.
                // We should just return an effect that adds it? No, render prop must return JSX.
                // But we can trigger the action here.
                // WARNING: calling side-effect in render is bad practice.
                // Valid approach: Return a component that runs the effect on mount.
                return <AutoHighlightTrigger {...props} color={selectedColor} onAdd={onAddHighlight} onCancel={props.cancel} />;
            }
            return null;
        }

        return (
            <div
                className="absolute bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50 flex flex-col gap-2"
                style={{
                    left: `${props.selectionRegion.left}%`,
                    top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
                }}
            >
                {/* Note input only */}
                <input
                    type="text"
                    placeholder="Add a note..."
                    className="w-48 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-primary"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    autoFocus
                />
                <div className="flex gap-2">
                    <button
                        className="flex-1 text-xs bg-primary text-white px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
                        onClick={() => {
                            if (onAddHighlight) {
                                onAddHighlight({
                                    areas: props.highlightAreas,
                                    color: selectedColor,
                                    text: props.selectedText,
                                    comment: comment,
                                    type: 'text'
                                });
                            }
                            setComment("");
                            props.cancel();
                        }}
                    >
                        Highlight
                    </button>
                    <button
                        className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100 transition-colors"
                        onClick={() => {
                            setComment("");
                            props.cancel();
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    };

    // Component to handle auto-highlight side-effect safely
    const AutoHighlightTrigger = ({ onAdd, onCancel, color, ...props }: any) => {
        useEffect(() => {
            onAdd({
                areas: props.highlightAreas,
                color: color,
                text: props.selectedText,
                comment: "",
                type: 'text'
            });
            onCancel();
        }, []);
        return null;
    };


    // Render existing highlights
    const renderHighlights = (props: RenderHighlightsProps) => {
        if (!showHighlights) return null;

        return (
            <div>
                {highlights.map((highlight) => (
                    <div key={highlight.id}>
                        {(highlight.areas || [])
                            .filter((area) => area.pageIndex === props.pageIndex)
                            .map((area, idx, array) => (
                                <div
                                    key={`${highlight.id}-${idx}`}
                                    id={`highlight-${highlight.id}`} // Added ID for DOM query
                                    className={`absolute cursor-pointer group transition-opacity ${(hoveredHighlightId === highlight.id || editingHighlightId === highlight.id) ? 'z-50' : 'z-10'}`}
                                    style={{
                                        left: `${area.left}%`,
                                        top: `${area.top}%`,
                                        width: `${area.width}%`,
                                        height: `${area.height}%`,
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (readOnly) return;

                                        if (onUpdateHighlight) {
                                            setEditingHighlightId(highlight.id);
                                            setNoteContent(highlight.comment || "");
                                            setHoveredHighlightId(null);
                                        } else if (onDeleteHighlight && confirm("Delete this highlight?")) {
                                            onDeleteHighlight(highlight.id);
                                        }
                                    }}
                                    onMouseEnter={() => !editingHighlightId && setHoveredHighlightId(highlight.id)}
                                    onMouseLeave={() => setHoveredHighlightId(null)}
                                >
                                    {/* Separate Background Div for Opacity */}
                                    <div
                                        style={{
                                            backgroundColor: highlight.type === 'image' ? 'transparent' : highlight.color,
                                            border: highlight.type === 'image' ? `2px dashed ${highlight.color}` : 'none',
                                            opacity: highlight.type === 'image' ? 1 : 0.35,
                                        }}
                                        className={`absolute inset-0 z-0 pointer-events-none transition-opacity ${highlight.type !== 'image' && 'group-hover:opacity-60'}`}
                                    />

                                    {/* Tooltip - Anchored to LAST area to avoid covering text */}
                                    {idx === array.length - 1 && hoveredHighlightId === highlight.id && !editingHighlightId && highlight.comment && (
                                        <div className={`absolute left-1/2 -translate-x-1/2 p-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-normal min-w-[150px] max-w-[250px] z-[100] pointer-events-none opacity-100 ${area.top > 80 ? 'bottom-full mb-2' : 'top-full mt-4'}`}>
                                            {highlight.comment}
                                        </div>
                                    )}

                                    {/* Editor Popover - Anchored to LAST area */}
                                    {idx === array.length - 1 && editingHighlightId === highlight.id && (
                                        <div
                                            className={`absolute p-3 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] w-64 cursor-default opacity-100
                                                ${area.top > 80 ? 'bottom-full mb-2' : 'top-full mt-4'}
                                                ${area.left > 60 ? 'right-0' : 'left-0'}
                                            `}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <textarea
                                                className="w-full p-2 border border-gray-300 rounded text-sm mb-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-white"
                                                rows={3}
                                                value={noteContent}
                                                onChange={e => setNoteContent(e.target.value)}
                                                placeholder="Add a note..."
                                                autoFocus
                                            />
                                            <div className="flex justify-between items-center bg-white">
                                                <div className="flex gap-2">
                                                    <button
                                                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors"
                                                        title="Delete highlight"
                                                        onClick={() => {
                                                            if (confirm('Delete this highlight?')) {
                                                                onDeleteHighlight?.(highlight.id);
                                                                setEditingHighlightId(null);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded font-medium transition-colors"
                                                        onClick={() => setEditingHighlightId(null)}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors shadow-sm"
                                                        onClick={() => {
                                                            if (onUpdateHighlight) {
                                                                onUpdateHighlight(highlight.id, noteContent);
                                                                setEditingHighlightId(null);
                                                            }
                                                        }}
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                ))}
            </div>
        );
    };

    const renderHighlightContent = () => <></>;

    const highlightPluginInstance = highlightPlugin({
        renderHighlightTarget: (props) => {
            const target = renderHighlightTarget(props);
            return target || <></>;
        },
        renderHighlights: (props) => {
            const highlights = renderHighlights(props);
            return highlights || <></>;
        },
        renderHighlightContent,
    });

    const toolbarPluginInstance = toolbarPlugin();
    const searchPluginInstance = searchPlugin();

    const { jumpToHighlightArea } = highlightPluginInstance;
    const { Toolbar } = toolbarPluginInstance;
    const { ShowSearchPopover } = searchPluginInstance;

    useImperativeHandle(ref, () => ({
        scrollToHighlight: (id: string) => {
            const highlight = highlights.find(h => h.id === id);
            if (highlight && highlight.areas && highlight.areas.length > 0) {
                jumpToHighlightArea(highlight.areas[0]);
            }
        }
    }));

    return (
        <div
            className="h-[80vh] flex flex-col bg-gray-100 rounded-xl overflow-hidden border border-border relative"
            ref={snapshotRef}
            onMouseDown={handleSnapshotMouseDown}
            onMouseMove={handleSnapshotMouseMove}
            onMouseUp={handleSnapshotMouseUp}
        >
            {/* Snapshot Overlay */}
            {isSnapshotMode && (
                <div className="absolute inset-0 z-[100] cursor-crosshair bg-black/10">
                    {snapshotRect && (
                        <div
                            className="absolute border-2 border-primary bg-primary/20"
                            style={{
                                left: snapshotRect.left,
                                top: snapshotRect.top,
                                width: snapshotRect.width,
                                height: snapshotRect.height
                            }}
                        />
                    )}
                </div>
            )}

            {/* Enhanced Toolbar */}
            <div className="bg-white border-b border-border p-2 flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-1">
                    {/* 1. Auto Highlight (Pen) */}
                    <button
                        className={`p-2 rounded hover:bg-gray-100 transition-colors ${autoHighlight ? 'bg-primary/10 text-primary' : 'text-gray-600'}`}
                        onClick={() => !readOnly && setAutoHighlight(!autoHighlight)}
                        title={readOnly ? "Read Only" : "Auto Highlight"}
                        disabled={readOnly}
                    >
                        <Pen size={18} />
                    </button>

                    {/* 2. Snapshot (Crop) */}
                    <button
                        className={`p-2 rounded hover:bg-gray-100 transition-colors ${isSnapshotMode ? 'bg-primary/10 text-primary' : 'text-gray-600'}`}
                        onClick={() => setIsSnapshotMode(!isSnapshotMode)}
                        title="Snapshot Area"
                    >
                        <Crop size={18} />
                    </button>

                    {/* 3. Color Picker (Circle) */}
                    <div className="relative">
                        <button
                            className="p-2 rounded hover:bg-gray-100 transition-colors"
                            onClick={() => !readOnly && setShowColorPicker(!showColorPicker)}
                            title="Highlight Color"
                        >
                            <div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: selectedColor }}></div>
                        </button>
                        {showColorPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 flex gap-1">
                                {HIGHLIGHT_COLORS.map(c => (
                                    <button
                                        key={c.value}
                                        className={`w-6 h-6 rounded-full border-2 ${selectedColor === c.value ? 'border-gray-800 scale-110' : 'border-gray-300'}`}
                                        style={{ backgroundColor: c.value }}
                                        onClick={() => {
                                            setSelectedColor(c.value);
                                            setShowColorPicker(false);
                                        }}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        )}
                        {showColorPicker && <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />}
                    </div>

                    {/* 4. Hide Highlights (Eye) */}
                    <button
                        className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600"
                        onClick={() => setShowHighlights(!showHighlights)}
                        title={showHighlights ? "Hide Highlights" : "Show Highlights"}
                    >
                        {showHighlights ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>

                    <div className="h-6 w-px bg-gray-200 mx-1" />

                    {/* 5, 6, 7. Zoom & Navigation (from ToolbarPlugin) */}
                    <Toolbar>
                        {(props) => {
                            const {
                                CurrentPageInput,
                                GoToNextPage,
                                GoToPreviousPage,
                                NumberOfPages,
                                ZoomIn,
                                ZoomOut,
                                Zoom,
                            } = props;
                            return (
                                <div className="flex items-center gap-1">
                                    <ZoomOut>
                                        {(props) => (
                                            <button
                                                onClick={props.onClick}
                                                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                                                title="Zoom Out"
                                            >
                                                <ZoomOutIcon size={18} />
                                            </button>
                                        )}
                                    </ZoomOut>

                                    <div className="flex items-center justify-center w-16 text-sm font-medium text-gray-700 select-none">
                                        {/* We can just show the percentage roughly or keep standard Popover */}
                                        <Zoom />
                                    </div>

                                    <ZoomIn>
                                        {(props) => (
                                            <button
                                                onClick={props.onClick}
                                                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                                                title="Zoom In"
                                            >
                                                <ZoomInIcon size={18} />
                                            </button>
                                        )}
                                    </ZoomIn>


                                    <div className="h-6 w-px bg-gray-200 mx-2" />

                                    <GoToPreviousPage>
                                        {(props) => (
                                            <button
                                                onClick={props.onClick}
                                                disabled={props.isDisabled}
                                                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                                title="Previous Page"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>
                                        )}
                                    </GoToPreviousPage>

                                    <div className="flex items-center gap-1 text-sm text-gray-600 font-medium mx-1">
                                        <CurrentPageInput /> <span className="text-gray-400">/</span> <NumberOfPages />
                                    </div>

                                    <GoToNextPage>
                                        {(props) => (
                                            <button
                                                onClick={props.onClick}
                                                disabled={props.isDisabled}
                                                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                                title="Next Page"
                                            >
                                                <ChevronRight size={20} />
                                            </button>
                                        )}
                                    </GoToNextPage>
                                </div>
                            );
                        }}
                    </Toolbar>

                </div>

                {/* 8. Search (SearchPlugin) */}
                <div className="flex items-center relative custom-search-container">
                    {/* Global Style Override for Search Popover */}
                    <style jsx global>{`
                        .rpv-search__popover {
                            position: absolute !important;
                            top: 100% !important;
                            right: 0 !important;
                            left: auto !important;
                            transform: none !important;
                            margin-right: 8px; /* Safe margin */
                            z-index: 9999 !important;
                            width: 300px !important; /* Fixed width to prevent squeezing */
                            background-color: #ffffff !important;
                            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
                            border: 1px solid #e2e8f0 !important;
                            border-radius: 0.5rem !important;
                            padding: 0.5rem !important;
                        }
                    `}</style>
                    <ShowSearchPopover />
                </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-auto bg-gray-100 text-center">
                <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                    <Viewer
                        fileUrl={url}
                        plugins={[highlightPluginInstance, toolbarPluginInstance, searchPluginInstance]}
                        defaultScale={SpecialZoomLevel.PageWidth}
                    />
                </Worker>
            </div>
        </div>
    );
});

PDFReader.displayName = "PDFReader";

export default PDFReader;
