/** 导出选项 */
export interface ExportOptions {
  format: 'pdf' | 'epub' | 'markdown' | 'chapter-txt';
  title: string;
  author: string;
}

/** 导出结果 */
export interface ExportResult {
  success: boolean;
  data?: Blob;
  error?: string;
  partialData?: Blob;
}
