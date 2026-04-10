import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { success, error } from '../utils/apiResponse';

export async function register(req: Request, res: Response) {
  try {
    const result = await authService.registerUser(req.body);
    return success(res, result, 201);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
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
