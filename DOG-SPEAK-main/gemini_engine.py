import os
import time
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(override=True)
# .env 로딩 실패를 대비해 여기에 직접 키를 입력할 수 있도록 합니다.
api_key = os.getenv("GEMINI_API_KEY") or "AIzaSyA-UR-CcIG1q4-0DxbeGDWGjGM7ccU1IvE"

if api_key and not api_key.startswith("여기에"):
    print(f"DEBUG: Gemini API Key initialized. Prefix: {api_key[:4]}****")
else:
    print("CRITICAL: Gemini API Key IS STILL MISSING!")

genai.configure(api_key=api_key)

def evaluate_with_gemini(audio_path, part_id, technical_score, part_info):
    """
    사용 가능한 모델을 직접 조회하여 평가를 진행합니다.
    """
    # 1. 사용 가능한 모델 탐색 (404 방지)
    model_name = "gemini-1.5-flash" # 기본값
    try:
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        if available_models:
            # 1.5 flash가 있으면 우선 사용, 없으면 첫 번째 모델 사용
            flash_models = [m for m in available_models if "1.5-flash" in m]
            model_name = flash_models[0] if flash_models else available_models[0]
            print(f"DEBUG: Selected available model: {model_name}")
    except Exception as e:
        print(f"DEBUG: Model listing failed, using default - {e}")

    # 2. 오디오 데이터 로드
    try:
        with open(audio_path, "rb") as f:
            audio_data = f.read()
    except Exception as e:
        print(f"File Read Error: {e}")
        raise e

    # 3. 정밀 분석 프롬프트 구성 (인간 언어 vs 개소리 판별 기준 강화)
    prompt = f"""
    당신은 '대한견공표준어제정위원회'의 수석 채점관이자 음성학 박사입니다. 
    인간이 견공의 언어를 모사하는 '견토익(Dog-TOEIC)' 시험을 채점하세요.
    
    [채점 가이드라인 - 매우 중요]
    1. 인간 방언(Human Dialect) 판정 기준:
       - '아, 오, 멍, 왈' 등 인간 특유의 명확한 모음 구조(Formants)가 느껴지는가?
       - 입술이나 혀를 사용하는 조음(Articulation) 흔적이 있는가?
       - 발성 중간에 주춤하거나 '어..' 같은 인간 특유의 망설임이 있는가?
       - 주파수가 너무 일정하게 유지되는 '가창' 형태인가?
    
    2. 진짜 견공 발성(Canine Signature) 판정 기준:
       - 성대뿐만 아니라 흉강에서 터져 나오는 폭발적인 에너지(Explosive Attack)가 있는가?
       - 거칠고 불규칙한 배음(Harmonics) 구조를 가지고 있는가?
       - 인간이 흉내 내기 힘든 긁는 듯한 후두음이 포함되어 있는가?

    [시험 데이터]
    - 기술 분석 점수: {technical_score}/100
    - 파트 정보: {part_info['title']}

    [출력 요구사항]
    - 아주 깐깐하고 신경질적인 '꼰대 채점관' 말투를 유지하세요.
    - 위 '판정 기준'에 근거하여 왜 인간 목소리 같은지, 혹은 왜 훌륭한 짖음인지 10문장 이상 아주 상세히 비판하세요.
    - 결과는 반드시 아래 JSON 형식으로만 응답하세요.
    
    {{
        "level": 등급(1-8),
        "feedback": "전문적인 음성학적 비판 내용을 여기에 작성",
        "human_dialect_detected": true/false,
        "advice": ["매우 구체적인 훈련법 1", "훈련법 2", "훈련법 3"]
    }}
    """

    # 4. 분석 실행
    model = genai.GenerativeModel(model_name)
    response = model.generate_content([
        prompt,
        {
            "mime_type": "audio/webm",
            "data": audio_data
        }
    ])
    
    # 5. 결과 반환
    try:
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(raw_text)
    except:
        # 텍스트 응답이 JSON이 아닐 경우를 대비한 파싱 로직
        import re
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        raise ValueError("AI response format error")

def generate_new_exam_questions(part_id, count=5):
    """
    Gemini를 사용하여 새로운 견토익 문제를 생성합니다.
    """
    model = genai.GenerativeModel('gemini-1.5-pro')
    
    prompt = f"""
    당신은 '대한견공표준어제정위원회'의 문제 출제 위원입니다.
    인간이 강아지와 소통하는 능력을 평가하는 '견토익(Dog-TOEIC)' Part {part_id} 문제를 {count}개 출제하세요.
    
    [파트 정보]
    - Part 1: 듣기 (강아지 소리를 듣고 해석하기)
    - Part 2: 말하기 (상황에 맞춰 사람이 강아지 언어로 말하기)
    - Part 3: 사진 상황 (강아지 행동 보고 심리 맞추기)
    - Part 4: 반려견 법률 (한국 반려동물 법규 상식)
    
    [출력 형식] 반드시 아래 JSON 배열 형식으로만 답변하세요.
    [{{
        "subject": {part_id},
        "subject_name": "파트이름",
        "question": "문제 내용",
        "target_script": "Part 2일 경우에만 필요, 나머지는 빈 문자열",
        "options": ["보기1", "보기2", "보기3", "보기4"],
        "answer": 정답인덱스(0-3),
        "explanation": "해설 내용"
    }}]
    """
    
    try:
        response = model.generate_content(prompt)
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(raw_text)
    except Exception as e:
        print(f"Question Generation Error: {e}")
        return []
