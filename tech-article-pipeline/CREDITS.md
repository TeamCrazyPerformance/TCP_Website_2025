# 기여자 및 모듈 크레딧

이 파이프라인은 세 개발자가 각각 제작한 기술 아티클 처리 모듈을 기반으로 통합되었습니다. 아래 크레딧은 최초 구현의 저작 범위와 이후 파이프라인 통합 작업을 구분해 기록합니다.

| 개발자 | 최초 담당 구현 | canonical 실행 위치 |
| --- | --- | --- |
| **박준우** | 기사 중복 검사·원자적 저장, Cloudflare Blog 크롤링·정규화 | `modules/admission`, `modules/crawler/src/tech_articles_ingestion` |
| **김재민** | 기사 품질 평가·필터링, SD Times 크롤링·정규화 | `modules/quality`, `modules/crawler/src/sdtimes_crawler` |
| **윤태완** | Gemini 기사 요약·메타데이터 생성, InfoQ 크롤링·정규화 | `modules/summarizer`, `modules/crawler/src/technical_news_pipeline` |

## 박준우

- SHA-256, Unicode 5-gram, MinHash 128, LSH 16×8 및 exact Jaccard 기반 중복 판정을 구현했습니다.
- 자동 `UNIQUE` 기사와 fingerprint·bucket의 MySQL 원자적 저장, 멱등 처리 및 관리자 중복 검토 흐름을 구현했습니다.
- Cloudflare Blog RSS 수집, 본문 추출, URL·본문 정규화, 변경 감지와 크롤링 안전장치를 구현했습니다.

## 김재민

- 관련성 45%, 최신성 30%, 메타데이터 신뢰도 25%의 품질 평가와 기준점 70점 판정 흐름을 구현했습니다.
- 관리자 검토 분기와 한국어·영어 기술어 기반 관련성 평가를 구현했습니다.
- SD Times 웹·RSS·WordPress API 수집, 메타데이터 추출, URL·본문·발행 시각 정규화를 구현했습니다.

## 윤태완

- Gemini Structured Output 기반 제목 현지화, 15개 기술 태그 분류, 한 줄·상세 요약 및 선택적 본문 번역을 구현했습니다.
- 프롬프트 인젝션 방어, 한 번의 결과 재생성, 토큰 집계와 오류별 재시도 가능 여부 계약을 구현했습니다.
- InfoQ RSS·웹 목록 수집, 기사 파싱, robots 정책, 안전한 HTTP 요청과 기사 정규화를 구현했습니다.

## 통합 작업과 원본 보존

공통 계약, FastAPI, 오케스트레이션, MySQL 작업 큐, 코어 저장소, migration, Docker 구성 및 통합 문서는 위 모듈들을 하나의 서비스로 연결하는 과정에서 추가·보완된 영역입니다. 이는 위 개발자들의 최초 구현 범위와 구분합니다.

각 원본 파편은 상위 디렉터리에 그대로 보존되어 있습니다. 원본에서 canonical 실행 소스로 옮기며 변경한 내용은 각 원본의 `INTEGRATION_CHANGES.md`에서 확인할 수 있습니다.
