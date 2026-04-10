import { Response } from 'express';

export function success(res: Response, data: any, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function error(res: Response, message: string, statusCode = 400) {
  return res.status(statusCode).json({ success: false, error: message });
}
