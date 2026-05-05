
import {
  ServiceError,
  registerUserService,
  loginService,
  logoutService,
  getCurrentUserService,
  verifyEmailService,
  resendVerificationEmailService,
  deleteSupabaseUserService,
  deleteSupabaseAndDBUsersService,
  verifyUserService,
  deleteUserService,
  getUserByUUIDService,
  updateUserService,
  hardDeleteFullService,
  getUsersService,
  hardDeleteUserLocallyService,
  getUserByEmailService,
  deleteUserByEmailService,
  refreshTokenService,
  generateResetLinkService,
  requestPasswordResetService,
  resetPasswordService,
  checkCookiesExistsService,
  createUserEmptyEmployeeService,
  getUserByAuthUserIdService,
} from "../services/userService.js";
import { getClientIp } from "../util/util.js";

const handleError = (res, err, fallbackMessage = "Internal server error") => {
  if (err instanceof ServiceError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.extra || {}),
    });
  }

  console.error(err);
  return res.status(500).json({
    error: err.message || fallbackMessage,
  });
};

// Register new user
export const registerUser = async (req, res) => {
  try {
    const result = await registerUserService({
      ...req.body,
      actorUserUuid: req.user?.uuid || null,
    });

    return res.status(201).json(result);
  } catch (err) {
    return handleError(res, err, "Failed to register user");
  }
};

export const login = async (req, res) => {
  try {
    const result = await loginService({
      email: req.body?.email,
      password: req.body?.password,
      recaptchaToken: req.body?.recaptchaToken,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });

    res.cookie(
      "accessToken",
      result.cookies.accessToken.value,
      result.cookies.accessToken.options
    );

    res.cookie(
      "refreshToken",
      result.cookies.refreshToken.value,
      result.cookies.refreshToken.options
    );

    res.cookie("role", result.cookies.role.value, result.cookies.role.options);

    return res.status(200).json({
      message: result.message,
      user: result.user,
      warnings: result.warnings,
    });
  } catch (err) {
    return handleError(res, err, "Login failed");
  }
};

export const logout = async (req, res) => {
  try {
    const result = await logoutService({
      accessToken: req.cookies?.accessToken,
    });

    for (const cookie of result.cookiesToClear) {
      res.cookie(cookie.name, "", cookie.options);
    }

    return res.status(200).json({ message: result.message });
  } catch (err) {
    return handleError(res, err, "Failed to log out");
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const result = await getCurrentUserService({
      accessToken: req.cookies.accessToken,
      refreshToken: req.cookies.refreshToken,
    });

    if (result.refreshedSession) {
      res.cookie("accessToken", result.refreshedSession.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 1000 * 60 * 60 * 24,
        path: "/",
      });

      res.cookie("refreshToken", result.refreshedSession.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    return res.status(200).json({
      message: result.message,
      user: result.user,
    });
  } catch (err) {
    return handleError(res, err, "Failed to get current user");
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const token = req.body?.token || req.query?.token;
    const result = await verifyEmailService({ token });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err, "Verification failed");
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const result = await resendVerificationEmailService({
      email: req.body?.email,
      actorUserUuid: req.user?.uuid || null,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err, "Failed to send verification email");
  }
};

export const deleteSupabaseUser = async (req, res) => {
  try {
    const result = await deleteSupabaseUserService({
      authUserId: req.params?.authUserId,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteSupabaseAndDBUsers = async (req, res) => {
  try {
    const result = await deleteSupabaseAndDBUsersService({
      authUserId: req.params?.authUserId,
      actorUserUuid: req.user?.uuid || null,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const verifyUser = async (req, res) => {
  try {
    const result = await verifyUserService({
      authUserId: req.body?.authUserId,
      actorUserUuid: req.user?.uuid || null,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const result = await deleteUserService({
      uuid: req.params?.uuid,
      actorUserUuid: req.user?.uuid || null,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getUserByUUID = async (req, res) => {
  try {
    const result = await getUserByUUIDService({
      uuid: req.params?.uuid,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateUser = async (req, res) => {
  try {
    const result = await updateUserService({
      uuid: req.params?.uuid,
      updates: req.body,
      actorUserUuid: req.user?.uuid || null,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const hardDeleteFull = async (req, res) => {
  try {
    const result = await hardDeleteFullService({
      uuid: req.params?.uuid,
      actorUserUuid: req.user?.uuid || null,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getUsers = async (req, res) => {
  try {
    const result = await getUsersService();
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const hardDeleteUserLocally = async (req, res) => {
  try {
    const result = await hardDeleteUserLocallyService({
      uuid: req.params?.uuid,
      actorUserUuid: req.user?.uuid || null,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getUserByEmail = async (req, res) => {
  try {
    const result = await getUserByEmailService({
      email: req.body?.email,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteUserByEmail = async (req, res) => {
  try {
    const result = await deleteUserByEmailService({
      email: req.body?.email,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const refreshToken = async (req, res) => {
  try {
    const result = await refreshTokenService({
      refreshToken: req.cookies.refreshToken,
    });

    res.cookie("accessToken", result.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 24,
    });

    return res.status(200).json({ message: result.message });
  } catch (err) {
    return handleError(res, err);
  }
};

export const generateResetLink = async (req, res) => {
  try {
    const result = await generateResetLinkService({
      email: req.body?.email,
    });

    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const result = await requestPasswordResetService({
      email: req.body?.email,
    });

    return res.json(result);
  } catch (err) {
    return handleError(res, err, "Server error");
  }
};

export const resetPassword = async (req, res) => {
  try {
    const result = await resetPasswordService({
      token: req.body?.token,
      newPassword: req.body?.newPassword,
    });

    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const checkCookiesExists = async (req, res) => {
  try {
    const result = await checkCookiesExistsService({
      accessToken: req.cookies.accessToken,
      refreshToken: req.cookies.refreshToken,
    });

    return res.status(result.status).json({ loggedIn: result.loggedIn });
  } catch (err) {
    return handleError(res, err);
  }
};

export const createUserEmptyEmployee = async (req, res) => {
  try {
    const result = await createUserEmptyEmployeeService(req.body);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err, "Internal server error");
  }
};

export const getUserByAuthUserId = async (req, res) => {
  try {
    const result = await getUserByAuthUserIdService({
      authUserId: req.params?.authUserId,
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};