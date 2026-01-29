"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import ImageExtension from "@tiptap/extension-image"; // Renamed to avoid Image constructor conflict
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Highlighter, Image as ImageIcon } from "lucide-react";
import { useRef } from "react";

interface TipTapEditorProps {
    content: string;
    onChange: (html: string, json: string) => void;
    onImageUpload?: (file: File) => Promise<string>;
    editable?: boolean;
}

const MenuBar = ({ editor, onImageUpload }: { editor: any, onImageUpload?: (file: File) => Promise<string> }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!editor) {
        return null;
    }

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && onImageUpload) {
            // Save current selection
            const { from, to } = editor.state.selection;

            try {
                // Show uploading state? For now, we wait.
                // Or insert placeholder?
                const url = await onImageUpload(file);
                if (url) {
                    editor.chain().focus().setImage({ src: url }).run();
                }
            } catch (error) {
                console.error("Image upload failed", error);
                alert("Image upload failed");
            } finally {
                // Reset input
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        }
    };

    return (
        <div className="border-b border-border bg-gray-50 p-2 flex flex-wrap gap-1 rounded-t-lg">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("bold") ? "bg-gray-200 text-primary" : "text-gray-600"}`}
                title="Bold"
            >
                <Bold size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("italic") ? "bg-gray-200 text-primary" : "text-gray-600"}`}
                title="Italic"
            >
                <Italic size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("highlight") ? "bg-yellow-100 text-yellow-700" : "text-gray-600"}`}
                title="Highlight"
            >
                <Highlighter size={18} />
            </button>

            <div className="w-[1px] h-6 bg-gray-300 mx-1 self-center"></div>

            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("heading", { level: 2 }) ? "bg-gray-200 text-primary" : "text-gray-600"}`}
                title="Heading 2"
            >
                <Heading1 size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("heading", { level: 3 }) ? "bg-gray-200 text-primary" : "text-gray-600"}`}
                title="Heading 3"
            >
                <Heading2 size={18} />
            </button>

            <div className="w-[1px] h-6 bg-gray-300 mx-1 self-center"></div>

            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("bulletList") ? "bg-gray-200 text-primary" : "text-gray-600"}`}
                title="Bullet List"
            >
                <List size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("orderedList") ? "bg-gray-200 text-primary" : "text-gray-600"}`}
                title="Ordered List"
            >
                <ListOrdered size={18} />
            </button>

            {/* Image Upload Button */}
            {onImageUpload && (
                <>
                    <div className="w-[1px] h-6 bg-gray-300 mx-1 self-center"></div>
                    <button
                        onClick={handleImageClick}
                        className="p-2 rounded hover:bg-gray-200 text-gray-600 hover:text-primary"
                        title="Insert Image"
                    >
                        <ImageIcon size={18} />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                </>
            )}
        </div>
    );
};

export default function TipTapEditor({ content, onChange, onImageUpload, editable = true }: TipTapEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Highlight,
            ImageExtension.configure({
                inline: true,
                allowBase64: true, // Fallback
            }),
        ],
        content: content,
        editable: editable,
        immediatelyRender: false, // Fix hydration mismatch
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose max-w-none p-4 focus:outline-none min-h-[200px] [&_img]:max-w-full [&_img]:rounded-lg [&_img]:shadow-sm',
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            const json = JSON.stringify(editor.getJSON());
            onChange(html, json);
        },
    });

    if (!editable) {
        return (
            <div className="border border-border rounded-lg overflow-hidden bg-white">
                <EditorContent editor={editor} />
            </div>
        )
    }

    return (
        <div className="border border-border rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
            <MenuBar editor={editor} onImageUpload={onImageUpload} />
            <EditorContent editor={editor} />
        </div>
    );
}
