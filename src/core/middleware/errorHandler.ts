import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
}

/**
 * Global error handler
 */
const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction): void => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

export default errorHandler;
