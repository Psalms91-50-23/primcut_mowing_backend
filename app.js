// src/app.js
import express from 'express';
import customerRouter from './router/customerRouter.js';
import businessRouter from './router/businessRouter.js';
import quoteRouter from './router/quoteRouter.js';
import jobRouter from './router/jobRouter.js';
import { requireAuth } from './middleware/auth.middleware.js';
import { requireRole } from './middleware/role.middleware.js';
import { rateLimit } from './middleware/rateLimit.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

app.use(express.json());

// Global middleware
app.use(rateLimit);

// Routers
app.use('/api/customers', customerRouter);
app.use('/api/businesses', businessRouter);
app.use('/api/quotes', quoteRouter);
app.use('/api/jobs', jobRouter);

// Error handling (last)
app.use(errorHandler);

export default app;