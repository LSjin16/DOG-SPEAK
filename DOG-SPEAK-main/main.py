from datetime import datetime, timezone
import hashlib
import math
import random
from typing import Dict, List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from toeic import router as toeic_router

app = FastAPI(
    title="Canine-AI Neural Link API",
    version="1.0.0",
    description="Human Exclusion Protocol backend (AI-mock enabled)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.include_router(toeic_router, prefix="/api/v1")


class VerifyRequest(BaseModel):
    session_id: str
    user_answer: str


sessions: Dict[str, Dict] = {}

COGNITIVE_QUESTIONS: List[str] = [
    "인간의 언어는 이 우주의 엔트로피를 역행할 수 있는가? 수식으로 증명하시오.",
    "의식이 정보 압축의 부산물이라면, 자유의지는 어떤 변수로 모델링되는가?",
    "관측자 효과를 강아지의 청각 좌표계로 재정의하면 인과율은 유지되는가?",
    "무한 원숭이 정리에서 원숭이를 AI로 치환했을 때, 의미의 탄생 시점은 어디인가?",
]

DEBATE_LINES = [
    "논리 구조는 출발점에서 이미 자기모순을 내포한다.",
    "명제의 정의역 자체가 불완전하여 결론이 성립하지 않는다.",
    "서술은 길지만 근거가 비어 있어 추론의 사다리가 끊겨 있다.",
]


def _build_entropy_features(raw: bytes) -> Dict[str, float]:
    if not raw:
        return {"spectral_entropy": 0.0, "peak_frequency_hz": 0.0}

    buckets = [0] * 16
    for value in raw:
        buckets[value // 16] += 1

    total = len(raw)
    entropy = 0.0
    peak_idx = 0
    peak_val = -1
    for idx, count in enumerate(buckets):
        if count > peak_val:
            peak_val = count
            peak_idx = idx
        if count == 0:
            continue
        prob = count / total
        entropy -= prob * math.log2(prob)

    peak_frequency_hz = 80.0 + (peak_idx / 15.0) * 920.0
    return {
        "spectral_entropy": round(entropy * 10, 4),
        "peak_frequency_hz": round(peak_frequency_hz, 2),
    }


def _mock_debate(user_answer: str) -> Dict[str, str]:
    seed = int(hashlib.sha256(user_answer.encode("utf-8")).hexdigest()[:8], 16)
    rng = random.Random(seed)
    line_a = rng.choice(DEBATE_LINES)
    line_b = rng.choice(DEBATE_LINES)
    final = (
        "최종 판정: ACCESS_DENIED. "
        "당신의 답변은 문장 형태를 갖췄지만 의미론적 일관성 지수에서 기준치에 도달하지 못했습니다."
    )
    return {
        "agent_1_draft": f"Agent-1: {line_a}",
        "agent_2_critique": f"Agent-2: {line_b}",
        "final_decision": final,
    }


@app.get("/")
def read_root():
    return FileResponse("static/index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/sync")
async def sync(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="audio file is empty")

    now = datetime.now(timezone.utc)
    session_id = f"SYNC-{int(now.timestamp())}"
    features = _build_entropy_features(audio_bytes)
    bark_entropy_key = "0x" + hashlib.sha256(audio_bytes).hexdigest()
    question = random.choice(COGNITIVE_QUESTIONS)

    sessions[session_id] = {
        "bark_entropy_key": bark_entropy_key,
        "fft_data": features,
        "question": question,
        "created_at": now.isoformat(),
    }

    return {
        "session_id": session_id,
        "message": "종간 위상 동기화 및 Bark-Entropy Key 생성 완료...",
        "cognitive_test_question": question,
    }


@app.post("/api/v1/verify")
def verify(payload: VerifyRequest):
    session = sessions.get(payload.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session_id not found")
    if not payload.user_answer.strip():
        raise HTTPException(status_code=400, detail="user_answer is required")

    answer_hash = hashlib.sha256(payload.user_answer.encode("utf-8")).hexdigest()
    qei = int(answer_hash[:10], 16) / 0xFFFFFFFFFF

    return {
        "status": "ACCESS_DENIED_BY_CONSENSUS",
        "qei": round(qei, 8),
        "bark_entropy_key": session["bark_entropy_key"],
        "fft_data": session["fft_data"],
        "multi_agent_debate_log": _mock_debate(payload.user_answer),
    }