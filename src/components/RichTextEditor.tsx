"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import {
  Bold,
  Code,
  FileUp,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

interface RichTextEditorProps {
  initialHtml: string;
  contentSyncVersion: number;
  canEdit: boolean;
  onChangeHtml: (html: string) => void;
  onRequestImportIntoDraft?: () => void;
}

interface ToolbarButtonProps {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition ${
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      } disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />;
}

export function RichTextEditor({
  initialHtml,
  contentSyncVersion,
  canEdit,
  onChangeHtml,
  onRequestImportIntoDraft,
}: RichTextEditorProps) {
  const suppressNextUpdateRef = useRef(false);
  const lastSyncVersionRef = useRef(contentSyncVersion);

  const editor = useEditor({
    immediatelyRender: false,
    editable: canEdit,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          "Start writing, or type # for a heading, - for bullets, 1. for a numbered list…",
      }),
      CharacterCount,
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "ajaia-editor",
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (suppressNextUpdateRef.current) {
        suppressNextUpdateRef.current = false;
        return;
      }
      onChangeHtml(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(canEdit);
  }, [editor, canEdit]);

  useEffect(() => {
    if (!editor) return;
    if (lastSyncVersionRef.current !== contentSyncVersion) {
      lastSyncVersionRef.current = contentSyncVersion;
      suppressNextUpdateRef.current = true;
      editor.commands.setContent(initialHtml, { emitUpdate: false });
      suppressNextUpdateRef.current = false;
    }
  }, [editor, contentSyncVersion, initialHtml]);

  const wordCount = editor?.storage.characterCount.words() ?? 0;
  const charCount = editor?.storage.characterCount.characters() ?? 0;

  return (
    <div className="flex flex-col">
      {/* Sticky Formatting Toolbar */}
      <div className="sticky top-14 z-20 border-b border-gray-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-0.5 px-4 py-2">
          <ToolbarButton
            title="Undo (Ctrl/Cmd+Z)"
            disabled={!canEdit || !editor?.can().chain().focus().undo().run()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Redo (Ctrl/Cmd+Shift+Z)"
            disabled={!canEdit || !editor?.can().chain().focus().redo().run()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            title="Normal text"
            active={Boolean(editor?.isActive("paragraph"))}
            disabled={!canEdit}
            onClick={() => editor?.chain().focus().setParagraph().run()}
          >
            <Pilcrow className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 1"
            active={Boolean(editor?.isActive("heading", { level: 1 }))}
            disabled={!canEdit}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 2"
            active={Boolean(editor?.isActive("heading", { level: 2 }))}
            disabled={!canEdit}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3"
            active={Boolean(editor?.isActive("heading", { level: 3 }))}
            disabled={!canEdit}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            title="Bold (Ctrl/Cmd+B)"
            active={Boolean(editor?.isActive("bold"))}
            disabled={!canEdit}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic (Ctrl/Cmd+I)"
            active={Boolean(editor?.isActive("italic"))}
            disabled={!canEdit}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Underline (Ctrl/Cmd+U)"
            active={Boolean(editor?.isActive("underline"))}
            disabled={!canEdit}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Strikethrough"
            active={Boolean(editor?.isActive("strike"))}
            disabled={!canEdit}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Inline code"
            active={Boolean(editor?.isActive("code"))}
            disabled={!canEdit}
            onClick={() => editor?.chain().focus().toggleCode().run()}
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            title="Bulleted list"
            active={Boolean(editor?.isActive("bulletList"))}
            disabled={!canEdit}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            active={Boolean(editor?.isActive("orderedList"))}
            disabled={!canEdit}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Blockquote"
            active={Boolean(editor?.isActive("blockquote"))}
            disabled={!canEdit}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Horizontal divider"
            disabled={!canEdit}
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          {canEdit && onRequestImportIntoDraft && (
            <>
              <ToolbarDivider />
              <button
                type="button"
                onClick={onRequestImportIntoDraft}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700 cursor-pointer"
                title="Import .txt, .md, or .docx content into this document"
              >
                <FileUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Import into draft</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Paper Canvas */}
      <div className="mx-auto w-full max-w-[820px] px-4 py-8 sm:px-6">
        <div
          className={`rounded-2xl border bg-white px-7 py-9 shadow-xs sm:px-12 sm:py-12 ${
            canEdit
              ? "border-gray-200/90"
              : "border-gray-200/70 bg-gray-50/30"
          }`}
        >
          <EditorContent editor={editor} />
        </div>

        {/* Subtle Footer Word Counter */}
        <div className="mt-3 flex items-center justify-between px-2 text-[11px] text-gray-400">
          <span>
            {wordCount} {wordCount === 1 ? "word" : "words"} · {charCount}{" "}
            characters
          </span>
          <span>
            {canEdit
              ? "Autosaves automatically · Press Cmd/Ctrl+S to save now"
              : "Read-only preview"}
          </span>
        </div>
      </div>
    </div>
  );
}
