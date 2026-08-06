// Genera los dos formatos de salida que pide el despacho: un .docx
// editable (para ajustar antes de la firma) y un .pdf (para compartir una
// vez aprobado). Ambos se construyen a partir del mismo texto plano que
// devuelve Claude.
import { Document, Packer, Paragraph } from "npm:docx@9.0.3";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

export async function buildDocx(text: string): Promise<Uint8Array> {
  const doc = new Document({
    sections: [
      {
        children: text.split("\n").map((line) => new Paragraph(line)),
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

export async function buildPdf(text: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const lineHeight = fontSize * 1.4;
  const margin = 50;
  const pageWidth = 612; // carta
  const pageHeight = 792;
  const maxWidth = pageWidth - margin * 2;

  const lines = wrapLines(text, font, fontSize, maxWidth);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  for (const line of lines) {
    if (y < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= lineHeight;
  }

  return pdf.save();
}

function wrapLines(text: string, font: import("npm:pdf-lib@1.17.1").PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (rawLine.trim() === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of rawLine.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
