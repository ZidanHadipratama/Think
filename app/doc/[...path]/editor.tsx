"use client"

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef, useCallback } from "react";

export default function Editor({ initialContent, onChange }: { initialContent: string, onChange: (md: string) => void }) {
  const editor = useCreateBlockNote({
    initialContent: undefined,
  });

  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;

    async function load() {
      const blocks = await editor.tryParseMarkdownToBlocks(initialContent);
      editor.replaceBlocks(editor.document, blocks);
      loadedRef.current = true;
    }

    if (editor) {
      load();
    }
  }, [editor, initialContent]);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      const md = await editor.blocksToMarkdownLossy(editor.document);
      onChange(md);
    }, 1000);
  }, [editor, onChange]);

  return (
    <div className="notion-editor-wrapper">
      <style jsx global>{`
                .notion-editor-wrapper .bn-editor, 
                .notion-editor-wrapper .bn-block-outer,
                .notion-editor-wrapper .bn-block {
                    background-color: transparent !important;
                }
                .notion-editor-wrapper .bn-editor {
                    padding-inline: 0 !important;
                }
                .notion-editor-wrapper .bn-block-content {
                    background-color: transparent !important;
                    /* Adjust spacing to be tighter like Notion */
                    padding-top: 2px !important;
                    padding-bottom: 2px !important;
                }
                /* Remove any default borders or shading */
                .notion-editor-wrapper [data-content-type="paragraph"] {
                     margin-block: 0 !important;
                }
                /* Ensure text color matches */
                .bn-editor { 
                    --bn-colors-editor-background: transparent; 
                    --bn-colors-editor-text: #e4e4e7;
                }
            `}</style>
      <BlockNoteView
        editor={editor}
        theme="dark"
        className="min-h-screen !bg-transparent"
        onChange={handleChange}
      />
    </div>
  )
}
