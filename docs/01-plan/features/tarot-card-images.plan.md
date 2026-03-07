# Plan: tarot-card-images

## Feature Summary
타로 배틀 화면에서 텍스트 기반 카드 표시를 실제 타로 카드 이미지로 교체

## Background
현재 타로 패널에서 카드 이름/방향만 텍스트로 표시되고 있어 시각적 몰입감이 부족함.
Rider-Waite-Smith(RWS) 타로 덱이 퍼블릭 도메인(CC0)으로 사용 가능.

## Image Source
- **소스**: Wikimedia Commons - Rider-Waite tarot deck
- **라이선스**: Public Domain (US copyright expired)
- **Major Arcana**: `RWS Tarot 00 Fool.jpg` ~ `RWS Tarot 21 World.jpg` (22장)
- **Minor Arcana**: `Cups01-14.jpg`, `Pents01-14.jpg`, `Swords01-14.jpg`, `Wands01-14.jpg` (56장)
- **총 78장**

## Scope
- 78장 타로 이미지 다운로드 및 최적화 (웹용 리사이징)
- `images/tarot/` 디렉토리에 `image_key` 기반 파일명으로 저장
- `renderTarotCards()` 함수 수정: 텍스트 → 이미지 + 텍스트 혼합 표시
- 역방향 카드 CSS 처리 (180도 회전)
- 카드 뒤집기 애니메이션 유지

## Out of Scope
- 카드 뒷면 이미지 (현재 미사용)
- 커스텀 타로 덱 디자인
- 이미지 lazy loading (11장만 사용하므로 불필요)

## Technical Notes
- 데이터에 이미 `image_key` 필드 존재 (major_00_fool, minor_wands_ace 등)
- 이미지 경로: `images/tarot/{image_key}.jpg`
- 원본 해상도 → 웹용 150px 너비로 리사이징 (macOS sips 사용)
- 역방향 카드: CSS `transform: rotate(180deg)` 적용

## Success Criteria
- 78장 이미지 모두 정상 로드
- R1(3장) + R2(3장) + R3(5장) = 11장 카드 이미지 배틀 화면에 표시
- 역방향 카드 시각적 구분 가능
- 모바일 반응형 유지
