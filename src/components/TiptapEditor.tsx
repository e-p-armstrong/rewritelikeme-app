import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TurndownService from 'turndown';
import { marked } from 'marked';
import './TiptapEditor.css';

// Create a turndown instance for HTML to markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx', // Use # for headings
  bulletListMarker: '-', // Use - for bullet lists
  codeBlockStyle: 'fenced', // Use ``` for code blocks
});

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-100 border-b border-gray-300 rounded-t-lg">
      {/* Heading Group */}
      <div className="flex items-center gap-1 mr-3">
        <button 
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
          className={`px-2 py-1 rounded text-sm font-semibold ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
          title="Heading 1"
        >
          H1
        </button>
        <button 
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
          className={`px-2 py-1 rounded text-sm font-semibold ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
          title="Heading 2"
        >
          H2
        </button>
        <button 
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} 
          className={`px-2 py-1 rounded text-sm font-semibold ${editor.isActive('heading', { level: 3 }) ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
          title="Heading 3"
        >
          H3
        </button>
      </div>

      {/* Text Formatting Group */}
      <div className="flex items-center gap-1 mr-3">
        <button 
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()} 
          className={`px-2 py-1 rounded text-sm font-bold ${editor.isActive('bold') ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button 
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          className={`px-2 py-1 rounded text-sm ${editor.isActive('italic') ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button 
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()} 
          className={`px-2 py-1 rounded text-sm ${editor.isActive('strike') ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
          title="Strikethrough"
        >
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </button>
        <button 
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()} 
          className={`px-2 py-1 rounded text-sm font-mono ${editor.isActive('code') ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
          title="Code"
        >
          Code
        </button>
      </div>

      {/* List Group */}
      <div className="flex items-center gap-1">
        <button 
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          className={`px-2 py-1 rounded text-sm ${editor.isActive('bulletList') ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
          title="Bullet List"
        >
          • List
        </button>
        <button 
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          className={`px-2 py-1 rounded text-sm ${editor.isActive('orderedList') ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
          title="Numbered List"
        >
          1. List
        </button>
      </div>
    </div>
  );
};

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  isEditable?: boolean;
  className?: string;
}

const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange, isEditable = true, className = '' }) => {
  const isSettingContentRef = useRef(false);
  const decodeHtmlEntities = (input: string): string => {
    if (typeof window === 'undefined') return input;
    const el = document.createElement('textarea');
    el.innerHTML = input;
    return el.value;
  };
  
  const editor = useEditor({
    extensions: [StarterKit],
    content: content,
    editable: isEditable,
    onUpdate: ({ editor }) => {
      // Skip turndown conversion if we're programmatically setting content
      if (isSettingContentRef.current) {
        return;
      }
      
      const html = editor.getHTML();
      const markdown = turndownService.turndown(html);
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        // 1. Removed `m-5` to prevent overflow.
        // 2. Added `max-w-none` to allow text to fill the container width.
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none w-full',
      },
    },
  });

  useEffect(() => {
    if (editor) {
      const markdown = turndownService.turndown(editor.getHTML());
      if (content !== markdown) {
        isSettingContentRef.current = true;
        const normalized = decodeHtmlEntities(content);
        const html = marked(normalized) as string;
        editor.commands.setContent(html);
        // Reset the flag after a brief delay to ensure the onUpdate has been processed
        setTimeout(() => {
          isSettingContentRef.current = false;
        }, 0);
      }
    }
  }, [content, editor]);

  return (
    <div className={`border bg-white border-gray-300 rounded-lg flex flex-col w-full ${className}`}>
      {isEditable && <MenuBar editor={editor} />}
      {/* 3. Added padding `p-5` here for spacing. */}
      {/* 4. Changed to `overflow-y-auto` to only allow vertical scroll. */}
      <EditorContent editor={editor} className="grow overflow-y-auto p-5" />
    </div>
  );
};

export default TiptapEditor;