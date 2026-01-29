"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, Columns, Rows } from "lucide-react";

interface ECGImageViewerProps {
    src: string;
    alt: string;
    isOpen: boolean;
    onClose: () => void;
}

type Tool = "zoom" | "vertical" | "horizontal";

export default function ECGImageViewer({ src, alt, isOpen, onClose }: ECGImageViewerProps) {
    const [activeTool, setActiveTool] = useState<Tool>("zoom");
    const [isHovering, setIsHovering] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const imgRef = useRef<HTMLImageElement>(null);
    const lensSize = 150; // Size of the zoom lens in pixels
    const zoomLevel = 2.5; // Magnification level

    // Reset state when closed
    useEffect(() => {
        if (!isOpen) {
            setIsHovering(false);
            setActiveTool("zoom");
        }
    }, [isOpen]);

    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!imgRef.current) return;

        const { left, top, width, height } = imgRef.current.getBoundingClientRect();
        const x = e.clientX - left;
        const y = e.clientY - top;

        // Check if cursor is inside the image
        if (x >= 0 && x <= width && y >= 0 && y <= height) {
            setMousePos({ x, y });
            setIsHovering(true);
        } else {
            setIsHovering(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
            {/* Close Button */}
            <button
                className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full bg-black/50 hover:bg-black/70 transition-colors z-[60]"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
            >
                <X size={24} />
            </button>

            {/* Toolbar */}
            <div
                className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4 bg-black/50 p-2 rounded-xl backdrop-blur-md border border-white/10 z-[60]"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={() => setActiveTool("zoom")}
                    className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 min-w-[60px]
                    ${activeTool === "zoom"
                            ? "bg-primary text-white shadow-lg shadow-primary/20"
                            : "text-white/70 hover:text-white hover:bg-white/10"}`}
                    title="局部放大"
                >
                    <ZoomIn size={24} />
                    <span className="text-[10px] font-medium">放大鏡</span>
                </button>

                <button
                    onClick={() => setActiveTool("vertical")}
                    className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 min-w-[60px]
                    ${activeTool === "vertical"
                            ? "bg-primary text-white shadow-lg shadow-primary/20"
                            : "text-white/70 hover:text-white hover:bg-white/10"}`}
                    title="垂直測量線"
                >
                    <Columns size={24} className="rotate-90" />
                    <span className="text-[10px] font-medium">垂直線</span>
                </button>

                <button
                    onClick={() => setActiveTool("horizontal")}
                    className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 min-w-[60px]
                     ${activeTool === "horizontal"
                            ? "bg-primary text-white shadow-lg shadow-primary/20"
                            : "text-white/70 hover:text-white hover:bg-white/10"}`}
                    title="水平測量線"
                >
                    <Rows size={24} />
                    <span className="text-[10px] font-medium">水平線</span>
                </button>
            </div>

            {/* Main Content */}
            <div
                className="relative max-w-[90vw] max-h-[90vh] overflow-visible"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setIsHovering(false)}
            >
                {/* Main Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    ref={imgRef}
                    src={src}
                    alt={alt}
                    className={`max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl select-none
                    ${activeTool === "zoom" ? "cursor-crosshair" : "cursor-default"}`}
                    draggable={false}
                />

                {/* --- Tools Overlay --- */}

                {/* 1. Zoom Lens */}
                {isHovering && activeTool === "zoom" && imgRef.current && (
                    <div
                        className="fixed pointer-events-none border-2 border-white/50 rounded-full shadow-2xl overflow-hidden z-[50]"
                        style={{
                            width: `${lensSize}px`,
                            height: `${lensSize}px`,
                            left: `${imgRef.current.getBoundingClientRect().left + mousePos.x - lensSize / 2}px`,
                            top: `${imgRef.current.getBoundingClientRect().top + mousePos.y - lensSize / 2}px`,
                            backgroundImage: `url(${src})`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: `${imgRef.current.width * zoomLevel}px ${imgRef.current.height * zoomLevel}px`,
                            backgroundPosition: `-${mousePos.x * zoomLevel - lensSize / 2}px -${mousePos.y * zoomLevel - lensSize / 2}px`,
                        }}
                    >
                        <div className="absolute inset-0 flex items-center justify-center opacity-30">
                            <div className="w-1 h-1 bg-red-500 rounded-full shadow-sm"></div>
                        </div>
                    </div>
                )}

                {/* 2. Vertical Line */}
                {isHovering && activeTool === "vertical" && (
                    <div
                        className="absolute top-0 bottom-0 w-[2px] bg-red-500/80 shadow-[0_0_8px_rgba(255,0,0,0.6)] pointer-events-none z-[50] transition-transform duration-75 ease-out"
                        style={{ left: mousePos.x }}
                    >
                        <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                            X: {Math.round(mousePos.x)}
                        </div>
                    </div>
                )}

                {/* 3. Horizontal Line */}
                {isHovering && activeTool === "horizontal" && (
                    <div
                        className="absolute left-0 right-0 h-[2px] bg-red-500/80 shadow-[0_0_8px_rgba(255,0,0,0.6)] pointer-events-none z-[50] transition-transform duration-75 ease-out"
                        style={{ top: mousePos.y }}
                    >
                        <div className="absolute left-2 -top-6 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                            Y: {Math.round(mousePos.y)}
                        </div>
                    </div>
                )}

                {/* Hint Text */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-sm whitespace-nowrap pointer-events-none transition-all">
                    {activeTool === "zoom" && <><ZoomIn size={14} className="inline mr-1" /> 移動滑鼠以局部放大細節</>}
                    {activeTool === "vertical" && "左右移動滑鼠以對齊垂直參考線"}
                    {activeTool === "horizontal" && "上下移動滑鼠以檢查 Baseline 水平"}
                </div>
            </div>
        </div>
    );
}
