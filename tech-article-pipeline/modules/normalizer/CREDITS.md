# 정규화 모듈 크레딧

공통 정규화 경계는 아래 세 개발자의 소스별 크롤링·정규화 구현을 파이프라인 계약으로 연결합니다.

| 개발자 | 정규화 대상 | 실제 구현 위치 |
| --- | --- | --- |
| **박준우** | Cloudflare Blog 기사 | `../crawler/src/tech_articles_ingestion` |
| **윤태완** | InfoQ 기사 | `../crawler/src/technical_news_pipeline` |
| **김재민** | SD Times 기사 | `../crawler/src/sdtimes_crawler` |

HTML 구조, canonical URL 규칙 및 발행 메타데이터가 소스마다 다르므로 실제 정규화 코드는 각 crawler 패키지에 함께 있습니다. 이 디렉터리의 공통 계약과 코어 검증 연결은 세 구현을 통합하기 위해 추가된 영역입니다.
