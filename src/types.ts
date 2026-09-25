export interface Hit {
  /** Stable id used for de-duplication */
  id: string;
  title: string;
  url: string;
  /** Which query/page produced it */
  source: string;
}

export interface FetchResult {
  hits: Hit[];
  /** Source names that were fetched successfully */
  ok: string[];
  /** Source name -> error message for those that failed */
  errors: Record<string, string>;
}
