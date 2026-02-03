import express from 'express';

import { verifyRecaptchaV3 } from '../controllers/recaptchaV3Controller.js';

const router = express.Router();

// POST /api/verify-recaptcha-v3
router.post('/', verifyRecaptchaV3);

export default router;