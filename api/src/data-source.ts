import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 로컬 개발 환경에서만 .env 파일 직접 로드
// 컨테이너 환경에서는 docker-compose의 env_file로 이미 주입됨
const envPath = path.join(__dirname, '../../envs/api.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'mydb',
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: true,
});
