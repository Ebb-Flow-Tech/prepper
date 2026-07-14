'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Link as LinkIcon, X } from 'lucide-react';

interface NotesEditorProps {
  initialContent?: string | null;
  onChange: (html: string) => void;
  onSave: (html: string) => void;
}

export function NotesEditor({ initialContent, onChange, onSave }: NotesEditorProps) {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    ],
    content: initialContent ?? '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: ({ editor, event }) => {
      // Don't save when focus moves to the link modal
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      if (relatedTarget?.closest('[data-link-modal]')) return;
      onSave(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'min-h-[80px] px-3 py-2 text-sm text-foreground focus:outline-none',
      },
    },
  });

  // Sync initialContent when it first loads from the server
  const initialised = useRef(false);
  useEffect(() => {
    if (editor && initialContent && !initialised.current) {
      initialised.current = true;
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  // Focus the input when modal opens
  useEffect(() => {
    if (linkModalOpen) {
      setTimeout(() => linkInputRef.current?.focus(), 0);
    }
  }, [linkModalOpen]);

  const openLinkModal = () => {
    if (!editor) return;
    setLinkUrl(editor.getAttributes('link').href ?? '');
    setLinkModalOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkModalOpen(false);
  };

  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkModalOpen(false);
  };

  if (!editor) return null;

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 border-b border-border bg-muted/40 px-2 py-1">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton
            active={editor.isActive('link')}
            onClick={openLinkModal}
            title="Link"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>

        {/* Editor — links styled as primary-coloured underlined text */}
        <div className="[&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/60 [&_a]:cursor-pointer">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Link modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[var(--color-scrim)]" onClick={() => setLinkModalOpen(false)} />
          <div
            data-link-modal
            className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-elevation-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Insert link</h3>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              ref={linkInputRef}
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyLink();
                if (e.key === 'Escape') setLinkModalOpen(false);
              }}
              className="w-full rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />

            <div className="mt-3 flex items-center justify-between">
              {editor.isActive('link') ? (
                <button
                  type="button"
                  onClick={removeLink}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove link
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyLink}
                  className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded p-1.5 transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
