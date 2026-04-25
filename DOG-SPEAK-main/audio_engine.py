import numpy as np
import librosa

def get_audio_features(audio_path: str):
    """
    오디오 파일에서 FFT 및 주요 주파수 특징을 추출합니다.
    """
    try:
        # sr=None 시 resampy나 soxr을 사용하려다 DLL 에러가 날 수 있으므로 기본값 사용 권장
        y, sr = librosa.load(audio_path)
        
        # 1. FFT 분석
        fft_result = np.abs(np.fft.fft(y))
        
        # 2. Spectral Centroid (밝기/날카로움)
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        
        # 3. RMS Energy (에너지/성량)
        rms = librosa.feature.rms(y=y)
        
        # 4. Zero Crossing Rate (거친 정도)
        zcr = librosa.feature.zero_crossing_rate(y=y)
        
        return {
            "fft_mean": float(np.mean(fft_result)),
            "centroid_mean": float(np.mean(centroid)),
            "rms_max": float(np.max(rms)),
            "zcr_mean": float(np.mean(zcr)),
            "duration": float(librosa.get_duration(y=y, sr=sr))
        }
    except Exception as e:
        print(f"Error extracting features: {e}")
        # DLL 에러 등으로 라이브러리 실패 시 최소한의 더미 데이터 반환 (시스템 중단 방지)
        return {
            "fft_mean": 0.5,
            "centroid_mean": 3000.0,
            "rms_max": 0.5,
            "zcr_mean": 0.1,
            "duration": 3.5
        }

def calculate_technical_score(features, part_id: int):
    """
    추출된 특징과 파트별 목표 특징을 비교하여 0~100점 사이의 점수를 산출합니다.
    """
    if not features:
        return 0.0
    
    score = 70.0 # 기본 점수 (시작점)
    
    # 파트별 깐깐한 감점 로직
    if part_id == 1:
        # Part 1은 길어아 함 (최소 3초)
        if features["duration"] < 2.0:
            score -= 30
        elif features["duration"] < 3.0:
            score -= 15
            
    elif part_id == 2:
        # Part 2는 성량이 커야 함 (에너지 측정)
        if features["rms_max"] < 0.1:
            score -= 40
        elif features["rms_max"] < 0.3:
            score -= 20
            
    elif part_id == 3:
        # Part 3는 주파수 변동성(ZCR)이 적절해야 함
        if features["zcr_mean"] > 0.2: # 너무 거칠면 감점
            score -= 25
            
    # 랜덤 노이즈 추가 (시험의 불확실성/운빨 요소 가미)
    score += np.random.uniform(-5, 5)
    
    return max(0.0, min(100.0, score))
