export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Builds the pagination `meta` block, guaranteeing `lastPage >= 1` even when there are no rows. */
export function paginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return { total, page, limit, lastPage: Math.max(1, Math.ceil(total / limit)) };
}
