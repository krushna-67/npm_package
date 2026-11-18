import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';

export class AppError extends Error {
  statusCode: number;
  details: any;
  isOperational: boolean;
  constructor(message: string, statusCode?: number, details?: any);
}

export interface SuccessResponse<T = any> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, any>;
}

export interface FailureResponse {
  success: false;
  message: string;
  data: null;
  error: {
    details: any;
  };
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ResponseHandlerOptions {
  defaultSuccessMessage?: string;
  defaultFailMessage?: string;
}

export interface ErrorHandlerOptions {
  isProduction?: boolean;
  defaultServerError?: string;
  includeStack?: boolean;
}

export interface RequestIdOptions {
  headerName?: string;
  validator?: RegExp | ((id: string) => boolean);
  generator?: () => string;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
    interface Response {
      success<T = any>(data?: T, message?: string, statusCode?: number, meta?: Record<string, any>): Response;
      fail(message?: string, statusCode?: number, details?: any): Response;
    }
  }
}

export function responseHandler(options?: ResponseHandlerOptions): RequestHandler;
export function responseHandler(req: Request, res: Response, next: NextFunction): void;

export function errorHandler(options?: ErrorHandlerOptions): ErrorRequestHandler;
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void;

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => any): RequestHandler;

export function paginate<T>(items: T[], page?: number | string, limit?: number | string): PaginationResult<T>;

export function requestId(options?: RequestIdOptions): RequestHandler;
export function requestId(req: Request, res: Response, next: NextFunction): void;

declare const replycraft: {
  AppError: typeof AppError;
  responseHandler: typeof responseHandler;
  errorHandler: typeof errorHandler;
  asyncHandler: typeof asyncHandler;
  paginate: typeof paginate;
  requestId: typeof requestId;
};

export default replycraft;
