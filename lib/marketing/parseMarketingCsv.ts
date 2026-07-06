import Papa from "papaparse";
import type { MarketingChannel } from "./types";

export interface RawCsvFile {
  channel: MarketingChannel;
  fileName: string;
  rows: Record<string, string>[];
}

const detectEncoding = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
    if (bytes[i] >= 0xa1 && bytes[i] <= 0xfe) return "euc-kr";
  }
  return "utf-8";
};

export const parseCsvFile = (file: File, channel: MarketingChannel): Promise<RawCsvFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const encoding = detectEncoding(buffer);
        const text = (() => {
          try { return new TextDecoder(encoding).decode(buffer); }
          catch { return new TextDecoder("utf-8").decode(buffer); }
        })();
        const result = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });
        resolve({ channel, fileName: file.name, rows: result.data });
      } catch {
        reject(new Error(`${file.name}: 파일을 읽는 중 오류가 발생했습니다.`));
      }
    };
    reader.onerror = () => reject(new Error(`${file.name}: 파일을 읽는 중 오류가 발생했습니다.`));
    reader.readAsArrayBuffer(file);
  });
};
