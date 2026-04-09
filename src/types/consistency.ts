/** 一致性问题 */
export interface ConsistencyIssue {
  chapterId: string;
  offset: number;
  length: number;
  foundText: string;
  suggestedName: string;
  similarity: number;
  ignored: boolean;
}

/** 一致性检查结果 */
export interface ConsistencyCheckResult {
  issues: ConsistencyIssue[];
  totalIssues: number;
  fixedCount: number;
}
