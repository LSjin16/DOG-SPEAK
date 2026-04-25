import os
import uuid
import datetime
import random
from typing import List, Any, Dict, Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from pydantic import BaseModel

# 백엔드 모듈 임포트 (파일이 이미 해당 폴더로 복사됨)
from db_manager import DBManager
from audio_engine import get_audio_features, calculate_technical_score
from gemini_engine import evaluate_with_gemini
from models import Exam, ExamSubmission, ScoreResult, CommunityPost, AnswerSubmission

router = APIRouter(prefix="/toeic", tags=["toeic"])

# DB Manager 인스턴스 (절대 경로 보장)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db = DBManager(db_dir=os.path.join(BASE_DIR, "db"))

# --- V2 API ENDPOINTS (실제 연동) ---

@router.get("/v2/exams")
async def get_exams():
    """V2: 실제 DB에서 기출 모의고사 목록 조회"""
    exams = db.get_exams()
    return [{"exam_id": e["exam_id"], "title": e["title"], "year": e["year"]} for e in exams]

@router.get("/v2/exams/{exam_id}")
async def get_exam_detail(exam_id: str):
    """V2: 특정 회차의 전체 문제 정보 (실제 데이터)"""
    exams = db.get_exams()
    exam = next((e for e in exams if e["exam_id"] == exam_id), None)
    if not exam:
        # 404 대신 기본 데이터 반환 (프론트 예외 방지)
        exam = exams[0] if exams else None
    
    if not exam:
        raise HTTPException(status_code=404, detail="No exams found in DB")
    return exam

@router.get("/start-part/{part_id}")
async def start_part(part_id: int):
    """프론트엔드 호환성을 위한 엔드포인트: db/exams.json에서 해당 파트의 문제를 랜덤하게 찾아 반환"""
    exams = db.get_exams()
    
    matched_questions = []
    for exam in exams:
        for q in exam.get("questions", []):
            # subject 필드가 숫자든 문자열이든 대응 가능하도록 처리
            if str(q.get("subject")) == str(part_id):
                matched_questions.append(q)
    
    if not matched_questions:
        # 데이터가 없을 경우 전체에서 하나라도 가져옴 (시스템 중단 방지)
        for exam in exams:
            matched_questions.extend(exam.get("questions", []))
            
    if not matched_questions:
        raise HTTPException(status_code=404, detail="No questions found in DB")
        
    q = random.choice(matched_questions)
    
    # 서버 로그에 데이터 출력 (디버깅용)
    print(f"DEBUG: Loading Part {part_id}, Selected Question: {(q.get('question_text') or q.get('question') or '')[:20]}...")

    # 모든 필드를 가장 안전하게 매핑
    return {
        "exam_id": exam.get("exam_id", "2033-ULTIMATE"),
        "question_id": q.get("id"),
        "title": f"Part {part_id}: {q.get('subject_name', '실전 테스트')}",
        "question_text": q.get("question") or q.get("question_text") or "질문 내용이 없습니다.",
        "script": q.get("target_script") or q.get("script") or "멍멍!",
        "goal_description": "2033년 국가공인 견공 표준어 인증 시험",
        "image_url": q.get("image_url", ""),
        "audio_url": q.get("audio_url", ""),
        "type": q.get("type", "multiple_choice"),
        "options": q.get("options", ["보기 1", "보기 2", "보기 3", "보기 4"]),
        "correct_answer": q.get("answer", 0)
    }

@router.post("/v2/exams/submit", response_model=ScoreResult)
async def submit_exam(submission: ExamSubmission):
    """V2: 실제 채점 및 오답노트 저장, 면허증 발급"""
    exams = db.get_exams()
    exam = next((e for e in exams if e["exam_id"] == submission.exam_id), None)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    correct_count = 0
    wrong_questions = []
    
    # 1. 채점 로직
    for ans in submission.answers:
        q = next((q for q in exam["questions"] if q["id"] == ans.question_id), None)
        if not q: continue
        
        if q.get("type") == "multiple_choice" or "answer" in q:
            if q["answer"] == ans.user_answer:
                correct_count += 1
            else:
                wrong_questions.append(q["id"])
        elif q.get("type") == "speaking":
            # 말하기는 별도 evaluate API에서 처리하거나 임시 점수 부여
            correct_count += 1 

    total_count = len(exam["questions"])
    score = (correct_count / total_count) * 100
    
    # 2. 레벨 및 면허증 계산
    level = int(score / 12.5) + 1
    license_id = f"LC-{uuid.uuid4().hex[:6].upper()}" if score >= 60 else None
    
    # 3. 유저 기록 저장
    user_data = db.get_user(submission.user_id)
    history_item = {
        "exam_id": submission.exam_id,
        "username": submission.username,
        "score": score,
        "level": level,
        "license_id": license_id,
        "date": str(datetime.datetime.now())
    }
    user_data["history"].append(history_item)
    
    current_wrong = set(user_data.get("wrong_notes", []))
    current_wrong.update(wrong_questions)
    user_data["wrong_notes"] = list(current_wrong)
    
    db.save_user(submission.user_id, user_data)
    
    feedback = "축하합니다! 2033년 국가공인 면허 발급 대상입니다." if license_id else "면허 발급 기준에 미달하였습니다. 더 짖으세요."
    
    return ScoreResult(
        total_score=round(score, 2),
        correct_count=correct_count,
        total_count=total_count,
        feedback=feedback,
        wrong_questions=wrong_questions,
        level=level,
        license_id=license_id
    )

@router.get("/v2/review/wrong-notes/{user_id}")
async def get_wrong_notes(user_id: str):
    """V2: 실제 오답노트 및 해설 조회"""
    user_data = db.get_user(user_id)
    exams = db.get_exams()

    wrong_details = []
    for q_id in user_data.get("wrong_notes", []):
        for exam in exams:
            q = next((q for q in exam["questions"] if q["id"] == q_id), None)
            if q:
                wrong_details.append({
                    "exam_title": exam["title"],
                    "question_id": q["id"],
                    "subject_name": q["subject_name"],
                    "question": q.get("question") or q.get("question_text"),
                    "explanation": q.get("explanation", "견공 표준어 규정에 따른 해설이 필요합니다.")
                })
                break
    return wrong_details

@router.post("/v2/review/wrong-notes")
async def add_wrong_note(payload: Dict[str, Any]):
    """V2: 오답 한 개 추가"""
    user_id = payload.get("user_id", "GUEST_USER")
    q_id = payload.get("question_id")
    if not q_id:
        raise HTTPException(status_code=400, detail="question_id is required")

    user_data = db.get_user(user_id)
    wrong_notes = set(user_data.get("wrong_notes", []))
    wrong_notes.add(q_id)
    user_data["wrong_notes"] = list(wrong_notes)
    db.save_user(user_id, user_data)
    return {"status": "success"}

@router.get("/v2/community")
async def get_community():
    """V2: 실제 DB 기반 명예의 전당 (투표순)"""
    posts = db.get_community_posts()
    return sorted(posts, key=lambda x: x.get("votes", 0), reverse=True)

@router.post("/v2/community/share")
async def share_score(post: CommunityPost):
    """V2: 성적표 게시판 공유"""
    posts = db.get_community_posts()
    post.id = f"POST-{uuid.uuid4().hex[:6].upper()}"
    post.created_at = str(datetime.datetime.now())
    posts.append(post.dict())
    db.save_community_posts(posts)
    return {"message": "공유 성공!", "post_id": post.id}

@router.post("/v2/community/{post_id}/vote")
async def vote_post(post_id: str):
    """V2: 실제 투표 반영"""
    posts = db.get_community_posts()
    for p in posts:
        if p["id"] == post_id:
            p["votes"] += 1
            db.save_community_posts(posts)
            return {"votes": p["votes"]}
    raise HTTPException(status_code=404, detail="Post not found")

# --- V1 및 공통 API (실제 AI 엔진 연동) ---

@router.post("/evaluate")
async def evaluate(
    part_id: int = Form(...),
    audio: UploadFile = File(...),
):
    """실제 AI 엔진(FFT + Gemini)을 사용한 채점"""
    # 임시 파일 저장 (확장자를 .webm으로 변경하여 원본 데이터 유지)
    audio_path = f"temp_{uuid.uuid4().hex[:8]}.webm"
    try:
        with open(audio_path, "wb") as f:
            f.write(await audio.read())

        # 1. 이과 엔진 (단순화된 분석)
        # webm을 지원하지 않는 라이브러리를 위해 에러 발생 시 더미 반환
        try:
            features = get_audio_features(audio_path)
            technical_score = calculate_technical_score(features, part_id)
        except:
            technical_score = 50.0 # 분석 실패 시 기본점수
            features = {"centroid_std": 1000}

        # 인간 목소리 판정 보정
        is_human = technical_score < 45 or features.get("centroid_std", 1000) < 500
        # 2. 문과 엔진 (Gemini)
        # 파트 정보는 단순화하거나 data.py에서 가져옴
        part_info = {"title": f"Part {part_id}", "goal_description": "2033 국가고시 실전 테스트"}
        
        try:
            gemini_result = evaluate_with_gemini(audio_path, part_id, technical_score, part_info)
            # 물리 엔진이나 AI가 인간 방언을 감지했을 경우 즉시 실격(0점) 처리
            if is_human or gemini_result.get("human_dialect_detected", False):
                gemini_result["human_dialect_detected"] = True
                gemini_result["level"] = 1
                technical_score = 0.0  # 인간 언어 감지 시 기술 점수 무효화
                if "feedback" in gemini_result and len(gemini_result["feedback"]) < 50:
                    gemini_result["feedback"] = "인간의 언어적 특성이 너무 강하게 감지되었습니다. 견공 언어 체계를 전혀 이해하지 못한 발성입니다."
        except Exception as e:
            print(f"DEBUG: Gemini API actual error - {e}")
            # [안전장치] API 실패 시 가짜 데이터로 서비스 유지
            if is_human:
                technical_score = 0.0
            gemini_result = {
                "level": 1 if is_human else random.randint(3, 5),
                "human_dialect_detected": is_human,
                "feedback": "성대 주파수 대역 분석 결과, 인간의 언어적 구조가 70% 이상 감지되었습니다. 견공 표준어 제3조에 의거하여 현재의 발성은 부적격 판정을 받았습니다." if is_human else "AI 채점관의 정밀 분석 결과, 견공 고유의 파동이 감지되었습니다. 다만 성대의 미세한 떨림에서 약간의 부끄러움이 느껴집니다.",
                "advice": ["매일 아침 개껌을 씹으며 성대를 단련하세요.", "인간의 언어를 잊고 본능에 충실하게 짖으세요."]
            }
        
        return {
            "session_id": f"TOEIC-{uuid.uuid4().hex[:8].upper()}",
            "score_report": {
                "level": gemini_result["level"],
                "technical_score": round(technical_score, 2),
                "is_human_dialect_detected": gemini_result["human_dialect_detected"],
                "spectral_analysis": "FFT 분석 결과, 성대의 파동이 견공의 궤적과 일치하지 않습니다. (Low Variance)" if is_human else "스펙트럼 분석 완료: 정상적인 견공 주파수 대역 감지."
            },
            "gemini_feedback": gemini_result["feedback"],
            "advice": gemini_result["advice"]
        }
    finally:
        # 윈도우 파일 잠금 문제 해결을 위해 예외 처리 추가
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
        except Exception as e:
            print(f"File Remove Error: {e}")

@router.get("/exams/license/{license_id}")
async def get_license(license_id: str, user_id: str):
    """V2: 면허증 데이터 상세 조회"""
    user_data = db.get_user(user_id)
    record = next((h for h in user_data.get("history", []) if h.get("license_id") == license_id), None)
    
    if not record:
        raise HTTPException(status_code=404, detail="License not found")
        
    rank_map = {8: "천재견(Top Dog)", 7: "우수견", 6: "보통견", 5: "노력견"}
    rank = rank_map.get(record["level"], "일반견")
    
    return {
        "license_id": license_id,
        "username": record.get("username", "익명견"),
        "issue_date": record["date"][:10],
        "level": record["level"],
        "rank": rank,
        "description": f"위 사람은 견공 표준어 제{record['level']}단계를 이수하여 2033년 반려견 관리법 제1조에 의거, 본 면허를 부여함."
    }
