'use strict';

const express = require('express');
const {
  AppError,
  responseHandler,
  errorHandler,
  asyncHandler,
  paginate,
  requestId
} = require('../src/index.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware stack
app.use(express.json());
app.use(requestId());
app.use(responseHandler());

// In-memory sample database
const usersDatabase = [
  { id: 1, name: 'Alice Smith', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Jones', email: 'bob@example.com', role: 'member' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'member' },
  { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'engineer' },
  { id: 5, name: 'Evan Wright', email: 'evan@example.com', role: 'designer' },
  { id: 6, name: 'Fiona Gallagher', email: 'fiona@example.com', role: 'manager' }
];

/**
 * 1. GET /users
 * Returns list of users with res.success
 */
app.get('/users', (req, res) => {
  return res.success(usersDatabase, 'Users fetched successfully', 200, {
    count: usersDatabase.length,
    requestId: req.id
  });
});

/**
 * 2. GET /users/:id
 * Returns single user or 404 via res.fail
 */
app.get('/users/:id', (req, res) => {
  const userId = Number(req.params.id);
  const user = usersDatabase.find((u) => u.id === userId);

  if (!user) {
    return res.fail(`User with ID ${req.params.id} not found`, 404, {
      requestedId: req.params.id
    });
  }

  return res.success(user, 'User retrieved successfully');
});

/**
 * 3. POST /users
 * Creates a new user with validation, returns 201 via res.success or 400 via res.fail
 */
app.post('/users', (req, res) => {
  const { name, email, role = 'member' } = req.body || {};

  if (!name || typeof name !== 'string') {
    return res.fail('Validation error: name is required', 400, {
      field: 'name',
      issue: 'Name must be a non-empty string'
    });
  }

  if (!email || !email.includes('@')) {
    return res.fail('Validation error: valid email is required', 400, {
      field: 'email',
      issue: 'Email format is invalid'
    });
  }

  const newUser = {
    id: usersDatabase.length + 1,
    name,
    email,
    role
  };
  usersDatabase.push(newUser);

  return res.success(newUser, 'User created successfully', 201);
});

/**
 * 4. GET /paginated-users
 * Demonstrates pagination utility combined with res.success
 */
app.get('/paginated-users', (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 2;

  try {
    const result = paginate(usersDatabase, page, limit);
    return res.success(result.data, 'Paginated users retrieved successfully', 200, result.pagination);
  } catch (err) {
    return res.fail(err.message, 400);
  }
});

/**
 * 5. GET /error
 * Demonstrates asyncHandler and centralized errorHandler forwarding
 */
app.get(
  '/error',
  asyncHandler(async (req, res) => {
    // Simulate an unexpected asynchronous database or service failure
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new AppError('Simulated upstream service outage', 503, {
      service: 'payment-gateway',
      retryAfterSeconds: 30
    });
  })
);

// Centralized error handler mounted at the end of the middleware chain
app.use(errorHandler());

// Start server when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ReplyCraft example server running on http://localhost:${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  GET  /users`);
    console.log(`  GET  /users/:id`);
    console.log(`  POST /users`);
    console.log(`  GET  /paginated-users?page=1&limit=2`);
    console.log(`  GET  /error`);
  });
}

module.exports = app;
