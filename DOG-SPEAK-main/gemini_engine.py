import os
import time
import json
import google.generativeai as genai
from dotenv import load_dotenv

# 현재 파일(gemini_engine.py)의 위치를 기준으로 .env 파일을 강제 로드합니다.
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, ".env")

def load_env_manually(path):
    if not os.path.exists(path): return {}
    env_data = {}
    for enc in ["utf-8-sig", "utf-8", "utf-16"]:
        try:
            with open(path, "r", encoding=enc) as f:
                content = f.read().replace('\ufeff', '')
                if "=" in content:
                    for line in content.splitlines():
                        line = line.strip()
                        if line and "=" in line and not line.startswith("#"):
                            k, v = line.split("=", 1)
                            env_data[k.strip()] = v.strip("'\" ")
                    if env_data: return env_data
        except:
            continue
    return env_data

load_dotenv(env_path, override=True)
manual_env = load_env_manually(env_path)
api_key = os.getenv("GEMINI_API_KEY") or manual_env.get("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

if api_key:
    genai.configure(api_key=api_key)
else:
    print("CRITICAL: GEMINI_API_KEY NOT FOUND!")

def evaluate_with_gemini(audio_path, part_id, technical_score, part_info):
    """
    보안이 강화된 Gemini 호출 로직 (에러 로그에서 API 키 노출 방지)
    """
    try:
        # 1. 모델 결정
        model_name = "gemini-2.5-flash"
        try:
            available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            flash25 = [m for m in available_models if "2.5-flash" in m]
            if flash25: model_name = flash25[0]
            elif available_models: model_name = available_models[0]
        except:
            pass

        # 2. 오디오 로드
        with open(audio_path, "rb") as f:
            audio_data = f.read()

        # 3. 프롬프트 구성 (공인 채점관 리포트 형식)
        prompt = f"""
        당신은 '대한견공표준어제정위원회'의 수석 채점관입니다. 
        견토익(Dog-TOEIC) 스피킹 시험 결과 리포트를 작성하세요.
        기술점수: {technical_score}/100.
        음성학적 관점에서 인간 언어 특성(모음 포먼트, 조음 습관)이 검출되었는지 정밀 분석하여 10문장 이상 전문적으로 기술하세요.
        출력 형식: {{"level": 1~8, "feedback": "전문평가", "human_dialect_detected": true/false, "advice": ["조언1", "조언2"]}}
        반드시 JSON으로만 답변하세요.
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
        
        # 5. 결과 파싱
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        try:
            return json.loads(raw_text)
        except:
            import re
            match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if match: return json.loads(match.group())
            raise ValueError("Invalid AI JSON format")

    except Exception:
        # [핵심 보안] 상세 에러를 절대 로그에 남기지 않습니다.
        print("DEBUG: Gemini API communication failed. (Error details suppressed for security)")
        raise ValueError("AI_ENGINE_OFFLINE")

def generate_new_exam_questions(part_id, count=5):
    model = genai.GenerativeModel('gemini-1.5-pro')
    prompt = f"견토익 Part {part_id} 문제를 {count}개 출제하고 JSON으로만 답변하세요."
    try:
        response = model.generate_content(prompt)
        return json.loads(response.text.replace("```json", "").replace("```", "").strip())
    except:
        return []
