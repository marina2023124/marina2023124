import { extractTextFromImage, isImageFile } from "./ocr";

export type DocumentKind =
  | "pdf"
  | "word"
  | "excel"
  | "image"
  | "text"
  | "unknown";

import type { WorkbookSheet } from "./project-workbook-parser";

export interface ExtractedDocument {
  text: string;
  kind: DocumentKind;
  fileName: string;
  /** Excel 原始行（首张表，兼容旧逻辑） */
  excelRows?: Record<string, string>[];
  /** Excel 全部工作表（个人项目管理等多 sheet 文件） */
  excelWorkbook?: WorkbookSheet[];
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

async function extractExcelData(file: File): Promise<{
  text: string;
  rows: Record<string, string>[];
  workbook: WorkbookSheet[];
}> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const workbook: WorkbookSheet[] = wb.SheetNames.map((sheetName) => ({
    name: sheetName,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    }) as unknown[][],
  }));

  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { text: "", rows: [], workbook: [] };

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  const text = workbook
    .flatMap((ws) =>
      ws.rows.map((row) =>
        (Array.isArray(row) ? row : [])
          .map((cell) => String(cell ?? "").trim())
          .filter(Boolean)
          .join("\t")
      )
    )
    .join("\n");

  return { text, rows, workbook };
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
      const { text, rows, workbook } = await extractExcelData(file);
      return { kind, fileName: file.name, text, excelRows: rows, excelWorkbook: workbook };
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
