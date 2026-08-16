# 크롤링·정규화 모듈 크레딧

| 개발자 | 최초 담당 구현 | canonical 패키지 |
| --- | --- | --- |
| **박준우** | Cloudflare Blog 크롤링 및 기사 정규화 | `src/tech_articles_ingestion` |
| **윤태완** | InfoQ 크롤링 및 기사 정규화 | `src/technical_news_pipeline` |
| **김재민** | SD Times 크롤링 및 기사 정규화 | `src/sdtimes_crawler` |

세 패키지는 각 개발자의 원본 구현을 기반으로 하며, 소스별 수집·파싱·정규화 책임을 그대로 구분합니다. 공통 `CrawlRequested → CrawlBatch` 계약, 메모리 저장 방식, source-neutral adapter와 registry 연결은 서비스 통합 과정에서 추가·조정되었습니다.

자세한 기여 범위는 각 canonical 패키지의 `CREDITS.md`와 파이프라인 최상위 `CREDITS.md`를 참고하세요.
