# 크레딧

- 최초 구현자: **박준우**
- 모듈: 기술 아티클 중복 검사 및 원자적 기사 저장(admission)
- 원본 파편: `articleDedup+articleUpsert v1 - 박준우`

이 canonical 모듈은 박준우 개발자의 SHA-256, Unicode 5-gram, MinHash 128, LSH 16×8, exact Jaccard 기반 중복 판정과 MySQL 원자적 저장·멱등 처리·관리자 resolution 구현을 기반으로 합니다.

공용 MySQL pool, 코어 저장소 연결 및 파이프라인 포트 적용은 서비스 통합 과정에서 추가되었습니다.
