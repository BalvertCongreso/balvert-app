"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Underline from "@tiptap/extension-underline";
import ImageExt from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import { subirArchivo } from "@/lib/apiCliente";

const FUENTES = [
  { etiqueta: "Por defecto", valor: "" },
  { etiqueta: "Arial", valor: "Arial, Helvetica, sans-serif" },
  { etiqueta: "Georgia", valor: "Georgia, serif" },
  { etiqueta: "Times New Roman", valor: "'Times New Roman', Times, serif" },
  { etiqueta: "Verdana", valor: "Verdana, Geneva, sans-serif" },
  { etiqueta: "Courier New", valor: "'Courier New', Courier, monospace" },
];

interface Props {
  value: string;
  onChange: (html: string) => void;
}

function BotonBarra({
  activo,
  onClick,
  children,
  titulo,
}: {
  activo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  titulo: string;
}) {
  return (
    <button
      type="button"
      title={titulo}
      onClick={onClick}
      className={`rounded px-2 py-1 text-sm font-medium ${
        activo ? "bg-[var(--balvert-azul)] text-white" : "text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

export default function EditorNewsletter({ value, onChange }: Props) {
  const inputImagenRef = useRef<HTMLInputElement>(null);
  const inputDocumentoRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      Underline,
      ImageExt.configure({
        HTMLAttributes: { style: "max-width:100%; height:auto; border-radius:4px;" },
      }),
      LinkExt.configure({ openOnClick: false, autolink: true }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "campo-input min-h-[220px] max-w-none prose prose-sm focus:outline-none",
      },
    },
  });

  if (!editor) return null;

  async function subirImagen(archivo: File) {
    setSubiendo(true);
    setErrorSubida(null);
    try {
      const { url } = await subirArchivo(archivo);
      editor?.chain().focus().setImage({ src: url }).run();
    } catch (e) {
      setErrorSubida(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  async function subirDocumento(archivo: File) {
    setSubiendo(true);
    setErrorSubida(null);
    try {
      const { url, nombre } = await subirArchivo(archivo);
      const seleccionVacia = editor?.state.selection.empty;
      if (seleccionVacia) {
        editor
          ?.chain()
          .focus()
          .insertContent(`<a href="${url}">${nombre}</a>`)
          .run();
      } else {
        editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }
    } catch (e) {
      setErrorSubida(e instanceof Error ? e.message : "No se pudo subir el documento.");
    } finally {
      setSubiendo(false);
    }
  }

  function insertarEnlace() {
    if (!editor) return;
    const url = window.prompt("Pega la URL del enlace:");
    if (!url) return;
    if (editor.state.selection.empty) {
      editor.chain().focus().insertContent(`<a href="${url}">${url}</a>`).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1 rounded-md border border-[var(--borde)] bg-zinc-50 p-1">
        <BotonBarra
          titulo="Negrita"
          activo={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>N</strong>
        </BotonBarra>
        <BotonBarra
          titulo="Cursiva"
          activo={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>K</em>
        </BotonBarra>
        <BotonBarra
          titulo="Subrayado"
          activo={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">S</span>
        </BotonBarra>
        <BotonBarra
          titulo="Lista"
          activo={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •—
        </BotonBarra>

        <span className="mx-1 h-5 w-px bg-[var(--borde)]" />

        <label className="flex items-center gap-1 text-xs text-zinc-600" title="Color del texto">
          Color
          <input
            type="color"
            className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>

        <select
          className="rounded border border-[var(--borde)] px-1 py-1 text-xs"
          title="Fuente"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              editor.chain().focus().setFontFamily(e.target.value).run();
            } else {
              editor.chain().focus().unsetFontFamily().run();
            }
          }}
        >
          {FUENTES.map((f) => (
            <option key={f.etiqueta} value={f.valor}>
              {f.etiqueta}
            </option>
          ))}
        </select>

        <span className="mx-1 h-5 w-px bg-[var(--borde)]" />

        <BotonBarra titulo="Insertar enlace" onClick={insertarEnlace}>
          🔗
        </BotonBarra>
        <BotonBarra titulo="Insertar imagen" onClick={() => inputImagenRef.current?.click()}>
          🖼️
        </BotonBarra>
        <BotonBarra titulo="Adjuntar documento (como enlace)" onClick={() => inputDocumentoRef.current?.click()}>
          📎
        </BotonBarra>
        {subiendo && <span className="text-xs text-zinc-400">Subiendo…</span>}
      </div>

      <input
        ref={inputImagenRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) subirImagen(archivo);
          e.target.value = "";
        }}
      />
      <input
        ref={inputDocumentoRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) subirDocumento(archivo);
          e.target.value = "";
        }}
      />

      {errorSubida && <p className="mb-2 text-xs text-red-600">{errorSubida}</p>}

      <EditorContent editor={editor} />
    </div>
  );
}
