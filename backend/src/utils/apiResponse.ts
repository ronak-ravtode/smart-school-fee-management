export interface SuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedSuccessResponse<T> {
  success: true;
  data: T[];
  meta: PaginatedMeta;
  message: string;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ErrorResponse {
  success: false;
  error: ErrorBody;
  message: string;
}

export function sendSuccess<T>(
  data: T,
  message: string
): SuccessResponse<T> {
  return { success: true, data, message };
}

export function sendPaginatedSuccess<T>(
  data: T[],
  meta: PaginatedMeta,
  message: string
): PaginatedSuccessResponse<T> {
  return { success: true, data, meta, message };
}

export function sendError(
  code: string,
  message: string,
  details?: unknown
): ErrorResponse {
  return {
    success: false,
    error: { code, message, details },
    message,
  };
}
