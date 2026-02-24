import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Routes
import customerRouter from './routes/customerRouter.js';
import businessRouter from './routes/businessRouter.js';
import quoteRouter from './routes/quoteRouter.js';
import jobRouter from './routes/jobRouter.js';
import jobRecurrenceRouter from './routes/jobRecurrenceRouter.js';
import logChangeRouter from './routes/logChangeRouter.js';
import userRouter from './routes/userRouter.js';
import quoteAccessTokenRouter from "./routes/quoteAccessTokenRouter.js";
import employeeRouter from './routes/employeeRouter.js';
import passwordResetRoutes from './routes/passwordResetTokenRouter.js';
import verifyRecaptchaV3Router from './routes/verifyRecaptchaV3Router.js';
import verifyRecaptchaV2Router from './routes/verifyRecaptchaV2Router.js';
import emailRouter from "./routes/emailRouter.js"
// Middleware
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// Determine allowed CORS origins
// let allowedOrigins = [];

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_HAPPY_LAWNS
]
  .filter(Boolean)
  .filter((v, i, arr) => arr.indexOf(v) === i);

app.use(cookieParser());
app.use(express.json());
console.log({allowedOrigins})
// Enable CORS
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Preflight support
app.options(/.*/, cors({ origin: allowedOrigins, credentials: true }));

// Routes
app.use("/api", emailRouter);
app.use('/api/customers', customerRouter);
app.use('/api/businesses', businessRouter);
app.use('/api/quotes', quoteRouter);
app.use('/api/quotes/public', quoteAccessTokenRouter);
app.use('/api/employees', employeeRouter);
app.use('/api/jobs', jobRouter);
app.use('/api/job-recurrences', jobRecurrenceRouter);
app.use('/api/logs', logChangeRouter);
app.use('/api/users', userRouter);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/verify-recaptcha-v3', verifyRecaptchaV3Router);
app.use('/api/verify-recaptcha-v2', verifyRecaptchaV2Router);

// Global error handler (last)
app.use(errorHandler);

export default app;