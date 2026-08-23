# TCP_Wetsite_2025
2025 TCP 웹 프로젝트

> 🚀 **운영 및 배포 가이드:** [CICDtools/README.md](CICDtools/README.md)를 참고하세요.
> (서버 구축, 배포, 백업, 복구 등 모든 운영 스크립트 포함)

> 📰 **테크 아티클 파이프라인:** [운영 가이드](docs/TECH_ARTICLE_PIPELINE_OPERATIONS.md)와
> [파이프라인 README](tech-article-pipeline/README.md)를 참고하세요.
> 외부 API는 [기술 아티클 API v1](api/src/tech-articles/API.md), 프론트엔드 연동 현황은
> [v9 통합 완료 현황](docs/TECH_ARTICLE_V9_API_GAPS.md)을 기준으로 합니다.

운영 전체 배포는 `bash CICDtools/update_all.sh` 한 번으로 프론트 선행 빌드, 파이프라인
MySQL migration/readiness, NestJS migration/health, 프론트 활성화, 공개 경로 헬스체크까지
수행합니다. 최초 구축·통합 백업/복구·시크릿 회전 절차는 CICDtools 가이드에 있습니다.
