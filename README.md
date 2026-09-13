# 学员管理平台 Demo V1.0

## Day 1 启动

### 后端
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
访问 http://127.0.0.1:8000/docs

### 前端
```powershell
cd frontend
npm install
npm run dev
```
访问 http://localhost:5173
