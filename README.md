# ReplyCraft

A lightweight toolkit for Express.js that standardizes API responses, streamlines centralized error handling, calculates pagination, and tracks request IDs.

## Features

- **Standardized Responses**: Attach `res.success()` and `res.fail()` helpers with consistent JSON schemas.
- **Centralized Error Handling**: Express 4 and Express 5 compatible error middleware that masks internal 500 server errors and prevents secret leakage in production.
- **Async Route Wrapper**: `asyncHandler` eliminates unhandled promise rejections and avoids duplicate forwarding.
- **In-Memory Pagination**: `paginate` utility calculates totals, offsets, and page boundaries without mutating data.
- **Request Tracing**: `requestId` middleware validates incoming headers, drops unsafe characters, or generates cryptographically secure UUIDs.
- **Dual Module Support**: Native CommonJS (`require`) and ES Modules (`import`) with full TypeScript definitions.

## Installation

```bash
npm install replycraft
```

Peer dependency: `express` (`^4.18.0` or `^5.0.0`).

## Quick Start

### Middleware Setup Order

Mount middleware in the following sequence for proper execution:

1. `express.json()` (Body parser)
2. `requestId()` (Assigns `req.id` and sets `X-Request-ID`)
3. `responseHandler()` (Decorates `res.success` and `res.fail`)
4. Application Routes
5. `errorHandler()` (Centralized error handler placed after routes)

### CommonJS Example

```javascript
const express = require('express');
const {
  responseHandler,
  errorHandler,
  asyncHandler,
  paginate,
  requestId,
  AppError
} = require('replycraft');

const app = express();
app.use(express.json());
app.use(requestId());
app.use(responseHandler());

// Standard success response
app.get('/api/users', (req, res) => {
  const users = [{ id: 1, name: 'Taylor' }];
  return res.success(users, 'Users retrieved successfully', 200, { total: 1 });
});

// Handled error
app.get('/api/users/:id', asyncHandler(async (req, res) => {
  if (req.params.id === '0') {
    throw new AppError('User not found', 404, { requestedId: req.params.id });
  }
  return res.success({ id: req.params.id, name: 'Taylor' });
}));

// Mount error middleware at the bottom
app.use(errorHandler());

app.listen(3000);
```

### ES Module Example

```javascript
import express from 'express';
import {
  responseHandler,
  errorHandler,
  asyncHandler,
  paginate,
  requestId
} from 'replycraft';

const app = express();
app.use(express.json());
app.use(requestId());
app.use(responseHandler());

app.get('/api/health', (req, res) => {
  res.success({ status: 'healthy', requestId: req.id });
});

app.use(errorHandler());
```

## API Reference

### `responseHandler(options?)`

Express middleware that attaches `res.success` and `res.fail` to the `res` object.

- `res.success(data?, message?, statusCode?, meta?)`
  - `data`: Any payload. Defaults to `null`.
  - `message`: Descriptive string. Defaults to `'Success'`.
  - `statusCode`: HTTP status integer (100–599). Defaults to `200`.
  - `meta`: Optional metadata object (e.g., pagination info).

  *Response format:*
  ```json
  {
    "success": true,
    "message": "Users fetched successfully",
    "data": [{ "id": 1, "name": "Alex" }],
    "meta": { "total": 1 }
  }
  ```

- `res.fail(message?, statusCode?, details?)`
  - `message`: Descriptive string. Defaults to `'Request failed'`.
  - `statusCode`: HTTP status integer (400–599). Defaults to `400`.
  - `details`: Optional structured details. Defaults to `null`.

  *Response format:*
  ```json
  {
    "success": false,
    "message": "User not found",
    "data": null,
    "error": {
      "details": null
    }
  }
  ```

### `errorHandler(options?)`

Centralized Express 4-parameter error middleware (`err, req, res, next`). Can be mounted directly (`app.use(errorHandler)`) or invoked with options:

- `isProduction`: Boolean. When `true`, status 500 messages are masked to `'Internal Server Error'` and error details are suppressed.
- `defaultServerError`: Custom string for 500 error messages (defaults to `'Internal Server Error'`).

### `asyncHandler(fn)`

Wraps async route handlers and catches rejections:

```javascript
app.get('/users', asyncHandler(async (req, res) => {
  const users = await fetchUsersFromDb();
  res.success(users);
}));
```

### `paginate(items, page?, limit?)`

Slices an array and calculates pagination numbers.

- `items`: Array to paginate. Throws `TypeError` if not an array.
- `page`: Page number (1-based, default `1`). Throws `RangeError` if `<= 0` or non-integer.
- `limit`: Number of items per page (default `10`). Throws `RangeError` if `<= 0` or non-integer.

*Output:*
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### `requestId(options?)`

Middleware for request correlation.
- Validates existing `X-Request-ID` headers (alphanumeric, hyphens, underscores up to 128 characters).
- Sanitizes or generates a new `crypto.randomUUID()` when missing or unsafe.
- Attaches the ID to `req.id` and sets the `X-Request-ID` response header.

## Running the Example Application

ReplyCraft includes a runnable example application:

```bash
node examples/express-server.js
```

Or run via npm:

```bash
npm run example
```

Endpoints demonstrated:
- `GET /users` - List all users with success response metadata
- `GET /users/:id` - Fetch user or return structured 404
- `POST /users` - Validate input and return 201 or 400
- `GET /paginated-users?page=1&limit=2` - Pagination demonstration
- `GET /error` - Simulated async failure caught by centralized errorHandler

## Compatibility

- Node.js: `>= 18.0.0`
- Express: `^4.18.0` and `^5.0.0`

## License

MIT
