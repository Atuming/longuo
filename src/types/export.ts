/** 排版选项 */
export interface TypographyOptions {
  fontFamily: string;    // 默认 "宋体"
  fontSize: number;      // 默认 12 (pt)
  lineHeight: number;    // 默认 1.5
  marginMm: number;      // 默认 20 (mm)
}

/** 排版默认值 */
export const DEFAULT_TYPOGRAPHY: TypographyOptions = {
  fontFamily: '宋体',
  fontSize: 12,
  lineHeight: 1.5,
  marginMm: 20,
};

/** 导出选项 */
export interface ExportOptions {
  format: 'pdf' | 'epub' | 'markdown' | 'chapter-txt';
  title: string;
  author: string;
  typography?: TypographyOptions;
}

/** 导出结果 */
export interface ExportResult {
  success: boolean;
  data?: Blob;
  error?: string;
  partialData?: Blob;
}
