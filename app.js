import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Routes
import customerRouter from './routes/customerRouter.js';
import businessRouter from './routes/businessRouter.js';
import quoteRouter from './routes/quoteRouter.js';
import jobRouter from './routes/jobRouter.js';
import jobRecurrenceRouter from './routes/jobRecurrenceRouter.js';
import changeLogRouter from './routes/changeLogRouter.js';
import userRouter from './routes/userRouter.js';
import quoteAccessTokenRouter from "./routes/quoteAccessTokenRouter.js";
import jobAccessTokenRouter from "./routes/jobAccessTokenRouter.js";
import employeeRouter from './routes/employeeRouter.js';
import passwordResetRoutes from './routes/passwordResetTokenRouter.js';
import verifyRecaptchaV3Router from './routes/verifyRecaptchaV3Router.js';
import verifyRecaptchaV2Router from './routes/verifyRecaptchaV2Router.js';
import emailRouter from "./routes/emailRouter.js"
import searchRouter from "./routes/searchRouter.js";
import jobBackfillRouter from "./routes/jobBackfillRouter.js";
import userRegistrationRouter from "./routes/userRegistrationRouter.js";
import serviceRouter from "./routes/serviceRouter.js";
import dashboardRouter from "./routes/dashboardRouter.js";
import customerContactRouter from "./routes/customerContactRouter.js";
import termsAndConditionsRouter from "./routes/termsAndConditionsRouter.js";
import quoteTermsAcceptanceRouter from "./routes/quoteTermsAcceptanceRouter.js";
import inquiryRouter from "./routes/inquiryRouter.js";
import privacyPolicyRouter from "./routes/privacyPolicyRouter.js";
// Middleware
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// Determine allowed CORS origins
// let allowedOrigins = [];

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_HAPPY_PROPERTY
].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);

// console.log({allowedOrigins})
app.use(cookieParser());
app.use(express.json());

// Enable CORS
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Preflight support
app.options(/.*/, cors({ origin: allowedOrigins, credentials: true }));

// Routes
app.use("/api", emailRouter);
//contact router
app.use("/api", customerContactRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/services", serviceRouter);
app.use("/api/search", searchRouter);
app.use("/api/pre-users", userRegistrationRouter);
app.use('/api/customers', customerRouter);
app.use('/api/businesses', businessRouter);
app.use('/api/quotes', quoteRouter);
app.use('/api/quotes/public', quoteAccessTokenRouter);
app.use('/api/employees', employeeRouter);
app.use('/api/jobs', jobRouter);
app.use("/api/jobs/backfill-amounts-from-quotes", jobBackfillRouter);
app.use('/api/job-recurrences', jobRecurrenceRouter);
app.use('/api/logs', changeLogRouter);
app.use('/api/users', userRouter);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/verify-recaptcha-v3', verifyRecaptchaV3Router);
app.use('/api/verify-recaptcha-v2', verifyRecaptchaV2Router);
app.use("/api/terms-and-conditions", termsAndConditionsRouter);
app.use("/api/privacy-policies", privacyPolicyRouter);
app.use("/api/quote-terms-acceptances", quoteTermsAcceptanceRouter);
app.use("/api/inquiries", inquiryRouter);
app.use("/api/jobs/public", jobAccessTokenRouter);

// Global error handler (last)
app.use(errorHandler);

export default app;