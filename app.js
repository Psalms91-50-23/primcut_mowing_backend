// src/app.js
import express from 'express';
import customerRouter from './routes/customerRouter.js';
import businessRouter from './routes/businessRouter.js';
import quoteRouter from './routes/quoteRouter.js';
import jobRouter from './routes/jobRouter.js';
import jobRecurrenceRouter from './routes/jobRecurrenceRouter.js';
import logChangeRouter from './routes/logChangeRouter.js';
import userRouter from './routes/userRouter.js';
import  quoteAccessTokenRouter from "./routes/quoteAccessTokenRouter.js"
import employeeRouter from './routes/employeeRouter.js';
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
import session from "express-session";


const app = express();
//productin
const allowedOrigins = [
  process.env.FRONTEND_HAPPY_LAWNS || process.env.FRONTEND_URL || "http://localhost:3000"
];

//for developtment
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
console.log("CORS allowed origins:", allowedOrigins);
// Add this to allow preflight requests
// Allow preflight for all routes
app.options(/.*/, cors({
  origin: allowedOrigins,
  credentials: true
}));

// 3️⃣ Session middleware (AFTER cors, BEFORE routes)
app.use(
  session({
    name: "quote_session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // ✅ automatically true in prod
      // secure: false, // ⚠️ IMPORTANT for localhost
      sameSite: "lax",
    },
  })
);
// Global middleware
// app.use(rateLimit);
// Routers
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


// Error handling (last)
app.use(errorHandler);

export default app;