import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

/**
 * HTTP 요청/응답 로깅 미들웨어
 * 모든 API 요청을 자동으로 로깅하여 ELK로 전송
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) { }

    use(req: Request, res: Response, next: NextFunction) {
        const { method, originalUrl, ip } = req;
        const userAgent = req.get('user-agent') || '';
        const startTime = Date.now();

        // 응답 완료 시 로깅
        res.on('finish', () => {
            const { statusCode } = res;
            const contentLength = res.get('content-length') || 0;
            const duration = Date.now() - startTime;

            const logData = {
                type: 'http',
                method,
                url: originalUrl,
                statusCode,
                contentLength,
                duration: `${duration}ms`,
                ip,
                userAgent,
            };

            // 상태 코드에 따라 로그 레벨 결정
            if (statusCode >= 500) {
                this.logger.error('HTTP Request', logData);
            } else if (statusCode >= 400) {
                this.logger.warn('HTTP Request', logData);
            } else {
                this.logger.info('HTTP Request', logData);
            }
        });

        next();
    }
}
