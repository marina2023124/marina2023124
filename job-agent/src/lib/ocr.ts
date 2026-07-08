export async function extractTextFromImage(file: File): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("chi_sim+eng", 1, {
    logger: () => {},
  });

  try {
    const { data } = await worker.recognize(file);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}
