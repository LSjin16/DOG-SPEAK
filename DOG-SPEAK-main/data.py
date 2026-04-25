TOEIC_PARTS = {
    1: {
        "title": "Part 1: 지문 읽기 (Read a text aloud)",
        "instruction": "주어진 견공 대본을 정확한 발음과 억양으로 짖어보세요. 성조(Pitch)의 변화가 중요합니다.",
        "script": "멍-멍(상승조)-크르릉-아우우우(하강조)",
        "goal_description": "기본적인 의사소통 발음 및 성조 변화 측정",
        "target_features": {
            "pitch_pattern": "rising-falling",
            "min_duration": 3.0
        }
    },
    2: {
        "title": "Part 2: 상황 묘사 (Describe a situation)",
        "instruction": "낯선 배달원이 문을 두드리고 있습니다. 당신의 영역을 지키기 위한 강한 경고성 발언을 하세요.",
        "situation": "이미지: 현관문 앞에 서 있는 택배 기사님",
        "goal_description": "상황에 맞는 성량(Amplitude) 및 주파수 대역폭(Bandwidth) 측정",
        "target_features": {
            "min_amplitude": 0.5,
            "spectral_centroid_range": [2000, 5000]
        }
    },
    3: {
        "title": "Part 3: 롤플레이 (Respond to questions)",
        "instruction": "친구 강아지가 놀아달라고 조르고 있습니다. 단호하지만 상처받지 않게 거절하세요.",
        "situation": "오디오: 낑낑거리는 강아지 소리 (놀아줘!)",
        "goal_description": "복합적인 감정 표현 및 인간성(망설임) 배제 여부 측정",
        "target_features": {
            "smoothness": 0.8,
            "no_human_filler": True
        }
    }
}
