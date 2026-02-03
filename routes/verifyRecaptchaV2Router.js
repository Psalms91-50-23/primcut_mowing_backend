import express from 'express';

import { verifyRecaptchaV2 } from '../controllers/recaptchaV2Controller.js';

const router = express.Router();

// POST /api/verify-recaptcha-v3
router.post('/', verifyRecaptchaV2);

export default router;