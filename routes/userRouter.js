import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';
import {
    // getUsers,
    getUserByUUID,
    registerUser,
    updateUser,
    hardDeleteFull,
    deleteSupabaseUser,
    resendVerificationEmail,
    verifyEmail,
    getUsers,
    hardDeleteUserLocally,
    deleteUserByEmail,
    getCurrentUser,
    login,
    logout,
    // sendPasswordResetEmail,
    getUserByEmail,
    checkCookiesExists,
    createUserEmptyEmployee,
    getUserByAuthUserId,

} from '../controllers/userController.js';

const router = express.Router();

router.get('/test', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

router.get('/all', getUsers);
router.get('/auth/me', requireAuth, authenticatedRateLimit, getCurrentUser);

// router.get('/auth/check', requireAuth, checkCookiesExists);
router.get('/auth/check',  checkCookiesExists);
router.post('/auth/login', authRateLimit, login);
router.post('/auth/logout', logout);
router.post('/auth/create/employee', requireAuth, authenticatedRateLimit, requireRole(["admin","owner"]), createUserEmptyEmployee);
// router.post("/reset-password", sendPasswordResetEmail);
router.get('/uuid/:uuid', requireAuth, authenticatedRateLimit, requireRole(["owner", "admin", "employee"]), getUserByUUID);
router.get('/email', requireAuth, authenticatedRateLimit, requireRole(["owner", "admin", "employee"]), getUserByEmail);
router.post('/register', publicRateLimit, registerUser);
router.post('/verify', publicRateLimit, verifyEmail);
router.post('/resend-verify-email', publicRateLimit, resendVerificationEmail);
router.patch('/:uuid', requireAuth, authenticatedRateLimit, requireRole(["admin","owner", "employee", "customer"]), updateUser);
router.get('/auth-user/:authUserId', requireAuth, authenticatedRateLimit, requireRole(["admin","owner"]), getUserByAuthUserId);
router.delete('/admin/hard-delete/uuid/:uuid', requireAuth, requireRole(["admin","owner"]), hardDeleteFull);
router.delete('/admin/supabase-user/hard-delete', requireAuth, requireRole(["admin","owner"]), deleteUserByEmail);
router.delete('/supabase-user/:authUserId', requireAuth, authenticatedRateLimit, requireRole(["admin","owner"]),deleteSupabaseUser);
router.delete('/hard-delete-local/uuid/:uuid', requireAuth, authenticatedRateLimit, requireRole(["admin","owner"]), hardDeleteUserLocally);




export default router;
