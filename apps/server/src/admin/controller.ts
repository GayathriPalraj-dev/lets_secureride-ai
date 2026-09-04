import type { RequestHandler } from 'express';
import type { AdminAccessResponse } from '@lets-secureride-ai/contracts';

export const adminAccess: RequestHandler = (req, res) => {
  const body: AdminAccessResponse = {
    success: true,
    data: { authorized: true },
    requestId: req.requestId,
  };
  res.status(200).json(body);
};
