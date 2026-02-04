// src/app.js
import express from 'express';
import customerRouter from './routes/customerRouter.js';
import businessRouter from './routes/businessRouter.js';
import quoteRouter from './routes/quoteRouter.js';
import jobRouter from './routes/jobRouter.js';
import jobRecurrenceRoutes from './routes/jobRecurrenceRouter.js';
import logChangeRoutes from './routes/logChangeRouter.js';
import userRoutes from './routes/userRouter.js';
import passwordResetRoutes from './routes/passwordResetTokenRouter.js';
import verifyRecaptchaV3Router from './routes/verifyRecaptchaV3Router.js';
import verifyRecaptchaV2Router from './routes/verifyRecaptchaV2Router.js';
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from './middleware/rateLimit.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';


const app = express();
const allowedOrigins = [
  process.env.FRONTEND_HAPPY_LAWNS || process.env.FRONTEND_URL || "http://localhost:3000"
];

console.log("CORS allowed origins:", allowedOrigins);
// const allowedOrigins = [
//     `${process.env.CLIENT_URL}`,
//     `${process.env.FRONTEND_URL}`
// ];

app.use(cookieParser());
app.use(express.json());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Add this to allow preflight requests
// Allow preflight for all routes
app.options(/.*/, cors({
  origin: allowedOrigins,
  credentials: true
}));

// Global middleware
// app.use(rateLimit);

// Routers
app.use('/api/customers', customerRouter);
app.use('/api/businesses', businessRouter);
app.use('/api/quotes', publicRateLimit, quoteRouter);
app.use('/api/jobs', publicRateLimit, jobRouter);
app.use('/api/job-recurrences', publicRateLimit, jobRecurrenceRoutes);
app.use('/api/logs', logChangeRoutes);
app.use('/api/users', publicRateLimit, userRoutes);
app.use('/api/password-reset', publicRateLimit, passwordResetRoutes);
app.use('/api/verify-recaptcha-v3', verifyRecaptchaV3Router);
app.use('/api/verify-recaptcha-v2', verifyRecaptchaV2Router);


// Error handling (last)
app.use(errorHandler);

export default app;