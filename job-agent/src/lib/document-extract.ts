import { extractTextFromImage, isImageFile } from "./ocr";

export type DocumentKind =
  | "pdf"
  | "word"
  | "excel"
  | "image"
  | "text"
  | "unknown";

export interface ExtractedDocument {
  text: string;
  kind: DocumentKind;
  fileName: string;
  /** Excel 原始行（用于项目列表解析） */
  excelRows?: Record<string, string>[];
}

const ACCEPT_EXTENSIONS =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp";

export function getAcceptedDocumentExtensions(): string {
  return ACCEPT_EXTENSIONS;
}

export function detectDocumentKind(file: File): DocumentKind {
  const name = file.name.toLowerCase();
  if (isImageFile(file)) return "image";
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || name.endsWith(".doc") || file.type.includes("word")) {
    return "word";
  }
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv") ||
    file.type.includes("spreadsheet") ||
    file.type.includes("excel")
  ) {
    return "excel";
  }
  if (name.endsWith(".txt") || file.type.startsWith("text/")) return "text";
  return "unknown";
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    if (line.trim()) parts.push(line.trim());
  }

  return parts.join("\n");
}

async function extractWordText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value.trim();
}

async function extractExcelData(file: File): Promise<{ text: string; rows: Record<string, string>[] }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { text: "", rows: [] };

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  const text = rows
    .map((row) => Object.values(row).filter(Boolean).join("\t"))
    .join("\n");

  return { text, rows };
}

async function extractPlainText(file: File): Promise<string> {
  return (await file.text()).trim();
}

export async function extractTextFromDocument(file: File): Promise<ExtractedDocument> {
  const kind = detectDocumentKind(file);

  switch (kind) {
    case "image":
      return {
        kind,
        fileName: file.name,
        text: await extractTextFromImage(file),
      };
    case "pdf":
      return {
        kind,
        fileName: file.name,
        text: await extractPdfText(file),
      };
    case "word":
      return {
        kind,
        fileName: file.name,
        text: await extractWordText(file),
      };
    case "excel": {
      const { text, rows } = await extractExcelData(file);
      return { kind, fileName: file.name, text, excelRows: rows };
    }
    case "text":
      return {
        kind,
        fileName: file.name,
        text: await extractPlainText(file),
      };
    default:
      throw new Error(`不支持的文件格式：${file.name}，请使用 PDF、Word、Excel 或图片`);
  }
}
