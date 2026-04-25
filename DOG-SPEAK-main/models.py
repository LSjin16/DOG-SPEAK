from pydantic import BaseModel
from typing import List, Optional, Any

# Exam Models
class Question(BaseModel):
    id: int
    subject: int
    subject_name: str
    question: str
    options: Optional[List[str]] = None
    type: str = "multiple_choice"
    explanation: str
    audio_url: Optional[str] = None
    image_url: Optional[str] = None

class Exam(BaseModel):
    exam_id: str
    year: int
    round: int
    title: str
    questions: List[Question]

class AnswerSubmission(BaseModel):
    question_id: int
    user_answer: Any

class ExamSubmission(BaseModel):
    user_id: str
    exam_id: str
    username: str
    answers: List[AnswerSubmission]

class ScoreResult(BaseModel):
    total_score: float
    correct_count: int
    total_count: int
    feedback: str
    wrong_questions: List[int]
    level: int
    license_id: Optional[str] = None

# License Model (New)
class LicenseData(BaseModel):
    license_id: str
    username: str
    issue_date: str
    level: int
    description: str
    rank: str # 예: 천재견, 우수견, 노력견

# Community Models
class CommunityPost(BaseModel):
    id: str
    user_id: str
    username: str
    content: str
    score_result: Optional[ScoreResult] = None
    audio_url: Optional[str] = None
    votes: int = 0
    created_at: str
