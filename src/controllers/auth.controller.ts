import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { success, error } from '../utils/apiResponse';

export async function register(_req: Request, res: Response) {
  return error(res, 'التسجيل الذاتي غير متاح. يرجى التواصل مع المدير لإنشاء حساب.', 403);
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    return success(res, result);
  } catch (err: any) {
    return error(res, err.message, 401);
  }
}

export async function me(req: Request, res: Response) {
  try {
    const profile = await authService.getProfile(req.user!.userId);
    return success(res, profile);
  } catch (err: any) {
    return error(res, err.message, 404);
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return error(res, 'كلمة المرور الحالية والجديدة مطلوبتان', 400);
    }
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    return success(res, { message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) return error(res, 'البريد الإلكتروني مطلوب', 400);
    await authService.requestPasswordReset(email);
    return success(res, { message: 'تم إرسال طلبك. الرجاء التواصل مع المدير لتفعيله.' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}
