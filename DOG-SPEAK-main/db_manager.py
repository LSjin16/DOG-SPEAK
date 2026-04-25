import json
import os

class DBManager:
    def __init__(self, db_dir="db"):
        self.db_dir = db_dir
        self.exams_path = os.path.join(db_dir, "exams.json")
        self.users_path = os.path.join(db_dir, "users.json")
        self.community_path = os.path.join(db_dir, "community.json")

    def _read_json(self, path):
        if not os.path.exists(path):
            return [] if "users" not in path else {}
        
        # 여러 인코딩 방식을 순차적으로 시도 (한글 깨짐 방지)
        encodings = ["utf-8-sig", "utf-8", "cp949"]
        for enc in encodings:
            try:
                with open(path, "r", encoding=enc) as f:
                    return json.load(f)
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
        
        return [] if "users" not in path else {}

    def _write_json(self, path, data):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    # Exam Management
    def get_exams(self):
        return self._read_json(self.exams_path)

    def save_exams(self, exams):
        self._write_json(self.exams_path, exams)

    # User Management (Score Records & Wrong Notes)
    def get_users(self):
        return self._read_json(self.users_path)

    def get_user(self, user_id):
        users = self.get_users()
        return users.get(user_id, {"history": [], "wrong_notes": []})

    def save_user(self, user_id, user_data):
        users = self.get_users()
        users[user_id] = user_data
        self._write_json(self.users_path, users)

    # Community Management
    def get_community_posts(self):
        return self._read_json(self.community_path)

    def save_community_posts(self, posts):
        self._write_json(self.community_path, posts)
