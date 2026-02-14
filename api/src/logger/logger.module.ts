import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

/**
 * Custom TCP Transport for Logstash
 * Winston의 기본 Transport를 확장하여 Logstash로 로그 전송
 */
class LogstashTcpTransport extends winston.transports.Stream {
    private socket: ReturnType<typeof import('net').Socket.prototype.connect> | null = null;
    private host: string;
    private port: number;
    private reconnectInterval: number = 5000;
    private isConnecting: boolean = false;

    constructor(opts: { host: string; port: number }) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const net = require('net');
        const socket = new net.Socket();
        super({ stream: socket });

        this.host = opts.host;
        this.port = opts.port;
        this.socket = socket;

        // 테스트 환경에서는 Logstash 연결 비활성화
        if (process.env.NODE_ENV !== 'test') {
            this.connect();
        }
    }

    private connect() {
        if (this.isConnecting || !this.socket) return;
        this.isConnecting = true;

        // 연결 및 쓰기 타임아웃 설정 (5초)
        this.socket.setTimeout(5000);
        // TCP KeepAlive 활성화
        this.socket.setKeepAlive(true, 10000);

        this.socket.connect(this.port, this.host, () => {
            this.isConnecting = false;
            console.log(`[Logger] Connected to Logstash at ${this.host}:${this.port}`);
        });

        // 타임아웃 발생 시 소켓 재연결
        this.socket.on('timeout', () => {
            console.error('[Logger] Logstash socket timeout');
            this.socket?.destroy();
            this.isConnecting = false;
        });

        this.socket.on('error', (err: Error) => {
            console.error(`[Logger] Logstash connection error: ${err.message}`);
            this.socket?.destroy();
            this.isConnecting = false;
        });

        this.socket.on('close', () => {
            console.log('[Logger] Logstash connection closed. Reconnecting...');
            this.isConnecting = false;
            setTimeout(() => this.connect(), this.reconnectInterval);
        });
    }

    log(info: winston.Logform.TransformableInfo, callback: () => void) {
        setImmediate(() => this.emit('logged', info));

        // 소켓이 쓰기 가능하고 연결 대기 중이 아닐 때만 로그 전송
        if (this.socket && this.socket.writable && !this.socket.pending) {
            try {
                const logEntry = JSON.stringify({
                    ...info,
                    timestamp: new Date().toISOString(),
                }) + '\n';
                
                // 논블로킹 방식으로 쓰기 - 에러 발생 시 무시 (앱 크래시 방지)
                // 백프레셔(버퍼 가득 참) 시 false 반환되지만 앱은 계속 실행
                const success = this.socket.write(logEntry, (err) => {
                    if (err) {
                        // 로그 전송 실패는 심각하지 않으므로 콘솔에만 출력
                        console.error('[Logger] Failed to write to Logstash:', err.message);
                    }
                });
                
                // 버퍼가 가득 차면 경고만 출력하고 계속 진행
                if (!success) {
                    console.warn('[Logger] Logstash buffer full, log may be dropped');
                }
            } catch (error) {
                // JSON 직렬화 또는 쓰기 에러를 무시 (앱 크래시 방지)
                console.error('[Logger] Error writing to Logstash:', error);
            }
        }

        // 항상 callback을 즉시 호출하여 winston이 블로킹되지 않도록 보장
        callback();
    }
}

@Module({
    imports: [
        WinstonModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const logstashHost = configService.get<string>('LOGSTASH_HOST') || 'localhost';
                const logstashPort = configService.get<number>('LOGSTASH_PORT') || 5000;
                const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
                const isProduction = nodeEnv === 'production';

                const transports: winston.transport[] = [
                    // Console transport (개발 환경에서 항상 출력)
                    new winston.transports.Console({
                        format: winston.format.combine(
                            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                            winston.format.colorize({ all: true }),
                            winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                                const contextStr = context ? `[${context}]` : '';
                                const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                                return `${timestamp} ${level} ${contextStr} ${message}${metaStr}`;
                            }),
                        ),
                    }),
                ];

                // Logstash transport (production 또는 LOGSTASH_HOST가 설정된 경우)
                if (isProduction || configService.get<string>('LOGSTASH_HOST')) {
                    transports.push(
                        new LogstashTcpTransport({
                            host: logstashHost,
                            port: logstashPort,
                        }),
                    );
                }

                // File transport (로그 파일 저장)
                // File transport (로그 파일 저장)
                let logDir = isProduction ? '/var/app/logs' : 'logs';

                // Ensure log directory exists and is writable (Development/Local Production safety check)
                try {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const fs = require('fs');
                    if (!fs.existsSync(logDir)) {
                        fs.mkdirSync(logDir, { recursive: true });
                    }
                    fs.accessSync(logDir, fs.constants.W_OK);
                } catch (error) {
                    console.warn(`[LoggerModule] Cannot write to ${logDir}, falling back to local 'logs' directory.`);
                    logDir = 'logs';
                }

                // 에러 로그: logs/error.log
                transports.push(
                    new winston.transports.File({
                        filename: `${logDir}/error.log`,
                        level: 'error',
                        format: winston.format.combine(
                            winston.format.timestamp(),
                            winston.format.json(),
                        ),
                        maxsize: 10 * 1024 * 1024, // 10MB
                        maxFiles: 5, // 최대 5개 파일 로테이션
                    }),
                );

                // 전체 로그: logs/combined.log
                transports.push(
                    new winston.transports.File({
                        filename: `${logDir}/combined.log`,
                        format: winston.format.combine(
                            winston.format.timestamp(),
                            winston.format.json(),
                        ),
                        maxsize: 10 * 1024 * 1024, // 10MB
                        maxFiles: 10, // 최대 10개 파일 로테이션
                    }),
                );

                return {
                    level: isProduction ? 'info' : 'debug',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.errors({ stack: true }),
                        winston.format.json(),
                    ),
                    defaultMeta: {
                        service: 'tcp-website-api',
                        environment: nodeEnv,
                    },
                    transports,
                };
            },
        }),
    ],
    exports: [WinstonModule],
})
export class LoggerModule { }
