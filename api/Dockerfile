FROM node:24-alpine AS builder

RUN mkdir -p /var/app
WORKDIR /var/app

# 의존성 설치
COPY package.json package-lock.json ./
# clean install
RUN npm ci  

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# 포트 설정
EXPOSE 3000

# 실행 명령어
CMD ["node", "dist/main.js"]