# Canine-AI Neural Link (Human Exclusion Protocol)

AI 연동 전 단계에서 백엔드/프론트/배포를 먼저 맞춰볼 수 있는 목업 구현입니다.

## 포함 기능

- `POST /api/v1/sync` (multipart/form-data)
  - 오디오 파일 업로드
  - 세션 생성 + 질문 반환
- `POST /api/v1/verify` (application/json)
  - 사용자 답변 검증
  - 더미 멀티 에이전트 토론 결과 반환
- `GET /`
  - 프론트 데모 페이지 제공

## 로컬 실행

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

- API 문서: `http://localhost:8000/docs`
- 프론트 데모: `http://localhost:8000/`

## Docker 실행

```bash
docker compose up --build
```

## AI 연동 포인트

`main.py`의 아래 함수들만 실제 AI/신호처리 구현으로 교체하면 됩니다.

- `_build_entropy_features(raw: bytes)`
- `_mock_debate(user_answer: str)`

현재는 명세 검증과 FE 연동 테스트를 위해 deterministic mock 로직으로 구성되어 있습니다.
