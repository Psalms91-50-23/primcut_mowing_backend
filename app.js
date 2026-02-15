// src/app.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';

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

// Middleware
import { errorHandler } from './middleware/error.middleware.js';

// ✅ Load dotenv only for development
if (process.env.NODE_ENV !== "production") {
  import('dotenv').then(dotenv => dotenv.config());
}


const app = express();
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("SESSION_SECRET:", process.env.SESSION_SECRET);
// CORS setup
const allowedOrigins = [
  process.env.FRONTEND_HAPPY_LAWNS || process.env.FRONTEND_URL || "http://localhost:3000"
];
//for developtment
// const allowedOrigins = [
//     `${process.env.CLIENT_URL}`,
//     `${process.env.FRONTEND_URL}`
// ];
console.log("CORS allowed origins:", allowedOrigins);

app.use(cookieParser());
app.use(express.json());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.options(/.*/, cors({ origin: allowedOrigins, credentials: true }));

// Session middleware (AFTER CORS, BEFORE routes)
if (!process.env.SESSION_SECRET) {
  console.error("❌ SESSION_SECRET is not defined!");
  process.exit(1); // crash early to avoid silent 500s
}

app.use(
  session({
    name: "quote_session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

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

// Error handler (last)
app.use(errorHandler);

export default app;