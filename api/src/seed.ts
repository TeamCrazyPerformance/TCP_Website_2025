import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { User } from './members/entities/user.entity';
import { UserRole } from './members/entities/enums/user-role.enum';
import { UserGender } from './members/entities/enums/user-gender.enum';
import { EducationStatus } from './members/entities/enums/education-status.enum';

// 환경에 따라 올바른 env 파일 로드
const isDev = process.env.NODE_ENV === 'development';
const envFileName = isDev ? 'db_dev.env' : 'db_prod.env';
const envPath = path.join(__dirname, '../../envs', envFileName);

console.log('🌍 Environment:', process.env.NODE_ENV || 'not set');
console.log('📁 Loading env from:', envPath);

const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error('❌ Error loading .env file:', result.error);
    console.log('⚠️  Using default values instead');
} else {
    console.log('✅ Loaded env variables:', Object.keys(result.parsed || {}).length);
}

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'mydb',
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: false,
});

async function seed() {
    console.log('🌱 Seeding database...');

    await AppDataSource.initialize();
    console.log('✅ Database connected');

    const userRepository = AppDataSource.getRepository(User);

    // 환경변수에서 어드민 정보 가져오기 (없으면 기본값 사용)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tcp.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234!';
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';

    console.log('🔑 Admin credentials from env:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Password: ${adminPassword ? '***' : 'NOT SET'}`);

    // 이미 존재하는지 확인
    const existingAdmin = await userRepository.findOne({
        where: { email: adminEmail },
    });

    if (existingAdmin) {
        console.log('⚠️  Admin user already exists, skipping...');
        await AppDataSource.destroy();
        return;
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // 어드민 계정 생성
    const admin = new User();
    admin.username = adminUsername;
    admin.password = hashedPassword;
    admin.name = '관리자';
    admin.student_number = '26000000';
    admin.phone_number = '010-1234-5678';
    admin.email = adminEmail;
    admin.major = '컴퓨터공학과';
    admin.join_year = new Date().getFullYear();
    admin.birth_date = new Date('2026-01-01');
    admin.gender = UserGender.Male;
    admin.role = UserRole.ADMIN;
    admin.education_status = EducationStatus.Enrolled;
    admin.self_description = 'System Administrator';

    await userRepository.save(admin);

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Username: ${adminUsername}`);

    await AppDataSource.destroy();
    console.log('🌱 Seeding completed!');
}

seed().catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
});
