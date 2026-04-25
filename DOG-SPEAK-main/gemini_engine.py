import os
import time
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(override=True)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def evaluate_with_gemini(audio_path, part_id, technical_score, part_info):
    """
    Gemini 1.5 Pro를 사용하여 사용자의 '짖는 소리'를 정성적으로 평가합니다.
    """
    model = genai.GenerativeModel('gemini-1.5-pro')
    
    # 1. 파일 업로드 및 대기
    gemini_file = genai.upload_file(path=audio_path)
    while gemini_file.state.name == "PROCESSING":
        time.sleep(1)
        gemini_file = genai.get_file(gemini_file.name)
        
    # 2. 꼰대 스타일 프롬프트 구성
    prompt = f"""
    당신은 '대한견공표준어제정위원회'의 수석 채점관입니다. 
    지금 인간이 강아지의 언어를 배우는 '견토익(Dog-TOEIC)' 스피킹 시험을 채점 중입니다.
    
    [시험 정보]
    - 파트: {part_info['title']}
    - 목표: {part_info['goal_description']}
    - 이과형 엔진 점수: {technical_score}/100
    
    [수행 과제]
    1. 오디오를 듣고 인간 특유의 '부끄러움', '망설임', '어색한 성대 떨림', 혹은 '단어 중간의 인간 방언(어.. 음..)'을 찾아내세요.
    2. 매우 깐깐하고 꼰대 같은 말투로 피드백을 작성하세요. (예: "견공 표준어 제3조 1항에 의거하여 탈락입니다.")
    3. 최종 등급(Level 1~8)을 매기세요. (1이 최저, 8이 만점)
    4. 인간 방언(Human Dialect)이 감지되었는지 여부를 결정하세요.
    
    [출력 형식] 반드시 JSON으로만 답변하세요.
    {{
        "level": 3,
        "feedback": "피드백 내용",
        "human_dialect_detected": true/false,
        "advice": ["조언1", "조언2"]
    }}
    """
    
    try:
        response = model.generate_content([prompt, gemini_file])
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        result = json.loads(raw_text)
    except Exception as e:
        print(f"Gemini Error: {e}")
        result = {
            "level": 1,
            "feedback": "성대 구조 자체가 인간이라 채점할 가치조차 느껴지지 않습니다. 재시험 보세요.",
            "human_dialect_detected": True,
            "advice": ["강아지 껌을 씹으며 성대를 단련하세요", "부끄러움을 버리세요"]
        }
    finally:
        genai.delete_file(gemini_file.name)
        
    return result

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
