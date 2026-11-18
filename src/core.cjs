'use strict';

const crypto = require('node:crypto');

/**
 * Custom application error class for ReplyCraft.
 */
class AppError extends Error {
  /**
   * @param {string} message - Error description message
   * @param {number} [statusCode=500] - HTTP status code
   * @param {any} [details=null] - Optional structured error details
   */
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Creates response middleware attaching `res.success` and `res.fail` methods.
 *
 * @param {object} [options] - Configuration options
 * @param {string} [options.defaultSuccessMessage='Success'] - Default success message
 * @param {string} [options.defaultFailMessage='Request failed'] - Default failure message
 * @returns {import('express').RequestHandler} Express middleware
 */
function responseHandler(options) {
  // If used directly as middleware: app.use(responseHandler)
  if (arguments.length >= 2 && options && typeof options.headersSent !== 'undefined') {
    const req = arguments[0];
    const res = arguments[1];
    const next = arguments[2];
    attachResponseMethods(res);
    return next();
  }

  const opts = options || {};
  const defaultSuccessMessage = opts.defaultSuccessMessage || 'Success';
  const defaultFailMessage = opts.defaultFailMessage || 'Request failed';

  return function replycraftResponseMiddleware(req, res, next) {
    attachResponseMethods(res, defaultSuccessMessage, defaultFailMessage);
    next();
  };
}

/**
 * Helper to attach response methods to Express response object.
 *
 * @param {import('express').Response} res
 * @param {string} [defaultSuccessMsg='Success']
 * @param {string} [defaultFailMsg='Request failed']
 */
function attachResponseMethods(res, defaultSuccessMsg = 'Success', defaultFailMsg = 'Request failed') {
  /**
   * Send a standardized success response.
   *
   * @param {any} [data=null] - Payload to return
   * @param {string} [message] - Descriptive success message
   * @param {number} [statusCode=200] - HTTP status code
   * @param {object} [meta] - Optional metadata (e.g., pagination, tracing)
   */
  res.success = function success(data, message, statusCode = 200, meta) {
    const code = typeof statusCode === 'number' && statusCode >= 100 && statusCode <= 599 ? statusCode : 200;
    const msg = typeof message === 'string' && message.trim().length > 0 ? message : defaultSuccessMsg;
    const payloadData = data !== undefined ? data : null;

    const body = {
      success: true,
      message: msg,
      data: payloadData
    };

    if (meta !== undefined && meta !== null) {
      body.meta = meta;
    }

    return res.status(code).json(body);
  };

  /**
   * Send a standardized failure response.
   *
   * @param {string} [message] - Descriptive error message
   * @param {number} [statusCode=400] - HTTP status code
   * @param {any} [details=null] - Optional error details
   */
  res.fail = function fail(message, statusCode = 400, details = null) {
    const code = typeof statusCode === 'number' && statusCode >= 400 && statusCode <= 599 ? statusCode : 400;
    const msg = typeof message === 'string' && message.trim().length > 0 ? message : defaultFailMsg;
    const errorDetails = details !== undefined ? details : null;

    const body = {
      success: false,
      message: msg,
      data: null,
      error: {
        details: errorDetails
      }
    };

    return res.status(code).json(body);
  };
}

/**
 * Centralized Express error-handling middleware.
 * Can be used directly: `app.use(errorHandler)`
 * Or configured: `app.use(errorHandler({ isProduction: true }))`
 *
 * @param {any} err - Error object or options when configuring
 * @param {import('express').Request} [req]
 * @param {import('express').Response} [res]
 * @param {import('express').NextFunction} [next]
 */
function errorHandler(err, req, res, next) {
  // If invoked as a factory function: app.use(errorHandler(options))
  if (arguments.length <= 1 && (typeof err === 'object' || typeof err === 'undefined')) {
    const config = err || {};
    return function configuredErrorHandler(actualErr, request, response, nextFn) {
      return executeErrorHandler(actualErr, request, response, nextFn, config);
    };
  }

  // Direct middleware usage: app.use(errorHandler)
  return executeErrorHandler(err, req, res, next, {});
}

/**
 * Internal logic for processing errors.
 *
 * @param {any} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {object} config
 */
function executeErrorHandler(err, req, res, next, config) {
  if (res.headersSent) {
    return next(err);
  }

  const isProd = typeof config.isProduction === 'boolean'
    ? config.isProduction
    : process.env.NODE_ENV === 'production';

  // Determine status code
  let status = 500;
  if (err && typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode <= 599) {
    status = err.statusCode;
  } else if (err && typeof err.status === 'number' && err.status >= 400 && err.status <= 599) {
    status = err.status;
  }

  // Mask internal 500 messages in production to protect sensitive data
  let message;
  let details = (err && err.details !== undefined) ? err.details : null;

  if (isProd && status >= 500) {
    message = config.defaultServerError || 'Internal Server Error';
    details = null; // Do not leak internal error details in production
  } else {
    message = (err && typeof err.message === 'string' && err.message.trim().length > 0)
      ? err.message
      : (status >= 500 ? 'Internal Server Error' : 'Request failed');
  }

  const responseBody = {
    success: false,
    message: message,
    data: null,
    error: {
      details: details
    }
  };

  return res.status(status).json(responseBody);
}

/**
 * Wraps asynchronous route handlers to forward unhandled rejections to Express error middleware.
 * Compatible with Express 4 and Express 5.
 *
 * @param {Function} fn - Async route handler function
 * @returns {import('express').RequestHandler}
 */
function asyncHandler(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('asyncHandler requires a function argument.');
  }

  return function wrappedAsyncHandler(req, res, next) {
    let nextCalled = false;

    const safeNext = function (err) {
      if (nextCalled) return;
      nextCalled = true;
      if (err) {
        if (!res.headersSent) {
          next(err);
        }
      } else {
        next();
      }
    };

    try {
      const result = fn(req, res, safeNext);
      if (result && typeof result.then === 'function') {
        result.catch((error) => {
          if (!nextCalled && !res.headersSent) {
            nextCalled = true;
            next(error);
          }
        });
      }
    } catch (syncError) {
      if (!nextCalled && !res.headersSent) {
        nextCalled = true;
        next(syncError);
      }
    }
  };
}

/**
 * Paginates an array of items and returns the slice with pagination metadata.
 *
 * @template T
 * @param {T[]} items - Array of items to paginate
 * @param {number|string} [page=1] - Current page number (1-indexed)
 * @param {number|string} [limit=10] - Number of items per page
 * @returns {{ data: T[], pagination: { page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean } }}
 */
function paginate(items, page = 1, limit = 10) {
  if (!Array.isArray(items)) {
    throw new TypeError('The "items" argument must be an array.');
  }

  const parsedPage = typeof page === 'string' ? Number(page) : page;
  const parsedLimit = typeof limit === 'string' ? Number(limit) : limit;

  if (
    typeof parsedPage !== 'number' ||
    !Number.isInteger(parsedPage) ||
    parsedPage <= 0 ||
    Number.isNaN(parsedPage)
  ) {
    throw new RangeError('The "page" argument must be a positive integer.');
  }

  if (
    typeof parsedLimit !== 'number' ||
    !Number.isInteger(parsedLimit) ||
    parsedLimit <= 0 ||
    Number.isNaN(parsedLimit)
  ) {
    throw new RangeError('The "limit" argument must be a positive integer.');
  }

  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / parsedLimit);

  const startIndex = (parsedPage - 1) * parsedLimit;
  const data = items.slice(startIndex, startIndex + parsedLimit);

  const hasNextPage = parsedPage < totalPages;
  const hasPreviousPage = parsedPage > 1 && totalPages > 0;

  return {
    data,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasNextPage,
      hasPreviousPage
    }
  };
}

// Regular expression to validate incoming request IDs:
// Safe alphanumeric, hyphen, underscore, length 1 to 128 characters.
const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-]{1,128}$/;

/**
 * Request ID middleware.
 * Generates or validates request IDs, attaches to `req.id` and sets `X-Request-ID` header.
 *
 * @param {object} [options]
 * @param {string} [options.headerName='X-Request-ID'] - Header to inspect and set
 * @param {RegExp|Function} [options.validator] - Custom validator
 * @param {Function} [options.generator] - Custom ID generator
 * @returns {import('express').RequestHandler}
 */
function requestId(options) {
  // If invoked directly: app.use(requestId)
  if (arguments.length >= 2 && options && typeof options.headersSent !== 'undefined') {
    const req = arguments[0];
    const res = arguments[1];
    const next = arguments[2];
    processRequestId(req, res, 'X-Request-ID', SAFE_REQUEST_ID_REGEX, () => crypto.randomUUID());
    return next();
  }

  const opts = options || {};
  const headerName = opts.headerName || 'X-Request-ID';
  const validator = opts.validator || SAFE_REQUEST_ID_REGEX;
  const generator = typeof opts.generator === 'function' ? opts.generator : () => crypto.randomUUID();

  return function replycraftRequestIdMiddleware(req, res, next) {
    processRequestId(req, res, headerName, validator, generator);
    next();
  };
}

/**
 * Helper to process request ID on req and res.
 */
function processRequestId(req, res, headerName, validator, generator) {
  const incomingHeaderKey = headerName.toLowerCase();
  const incomingRaw = req.headers ? req.headers[incomingHeaderKey] : undefined;
  let finalId;

  if (typeof incomingRaw === 'string') {
    const trimmed = incomingRaw.trim();
    let isValid = false;

    if (typeof validator === 'function') {
      isValid = Boolean(validator(trimmed));
    } else if (validator instanceof RegExp) {
      isValid = validator.test(trimmed);
    }

    if (isValid && trimmed.length <= 128) {
      finalId = trimmed;
    }
  }

  if (!finalId) {
    finalId = generator();
  }

  req.id = finalId;
  res.setHeader(headerName, finalId);
}

module.exports = {
  AppError,
  responseHandler,
  errorHandler,
  asyncHandler,
  paginate,
  requestId
};
