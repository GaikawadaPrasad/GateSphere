export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages?: number;
}

export interface ListQueryParams {
  page?: number;
  page_size?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  community_id?: string;
  active?: boolean;
}
