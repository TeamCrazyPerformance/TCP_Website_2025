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

        this.socket.connect(this.port, this.host, () => {
            this.isConnecting = false;
            console.log(`[Logger] Connected to Logstash at ${this.host}:${this.port}`);
        });

        this.socket.on('error', (err: Error) => {
            console.error(`[Logger] Logstash connection error: ${err.message}`);
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

        if (this.socket && this.socket.writable) {
            const logEntry = JSON.stringify({
                ...info,
                timestamp: new Date().toISOString(),
            }) + '\n';
            this.socket.write(logEntry);
        }

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
