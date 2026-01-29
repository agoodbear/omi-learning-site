"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

interface Props {
    onConfirm: (comment: { text: string; emoji: string }, color: string) => void;
    onOpen: () => void;
    onUpdate?: () => void;
}

export default function HighlightTip({ onOpen, onConfirm }: Props) {
    const [text, setText] = useState("");
    const [activeColor, setActiveColor] = useState("yellow");

    const colors = [
        { name: "yellow", class: "bg-yellow-200" },
        { name: "green", class: "bg-green-200" },
        { name: "blue", class: "bg-blue-200" },
        { name: "red", class: "bg-red-200" },
    ];

    return (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-64 animate-in fade-in zoom-in duration-200">
            <div className="flex gap-2 mb-3">
                {colors.map((c) => (
                    <button
                        key={c.name}
                        onClick={() => setActiveColor(c.name)}
                        className={`w-6 h-6 rounded-full ${c.class} border-2 transition-all ${activeColor === c.name ? "border-primary scale-110" : "border-transparent hover:scale-105"}`}
                    />
                ))}
            </div>

            <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment..."
                className="w-full text-xs p-2 border border-gray-200 rounded resize-none focus:outline-none focus:border-primary mb-2 h-16"
            />

            <div className="flex justify-end gap-2">
                <button
                    onClick={() => onConfirm({ text, emoji: "" }, activeColor)}
                    className="flex items-center gap-1 px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary/90"
                >
                    <Check size={12} /> Add
                </button>
            </div>
        </div>
    );
}
