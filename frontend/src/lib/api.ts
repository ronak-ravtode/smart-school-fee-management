const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
  message: string;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly statusCode: number;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
    } catch (err) {
      throw new ApiError(0, "NETWORK_ERROR", "Network request failed. Please check your connection.");
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(response.status, "PARSE_ERROR", "Invalid response from server");
    }

    if (!response.ok) {
      const errorData = data as ApiErrorResponse;
      throw new ApiError(
        response.status,
        errorData.error?.code || "UNKNOWN_ERROR",
        errorData.error?.message || errorData.message || `Request failed with status ${response.status}`,
        errorData.error?.details
      );
    }

    return data as ApiResponse<T>;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
