from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from pathlib import Path
from dotenv import load_dotenv
import os
load_dotenv(Path(__file__).with_name('.env'))
DATABASE_URL=os.getenv('DATABASE_URL','mysql+pymysql://root:root@127.0.0.1:3307/student_platform?charset=utf8mb4')
engine=create_engine(DATABASE_URL,pool_pre_ping=True)
def check_database():
    try:
        with engine.connect() as conn: conn.execute(text('SELECT 1'))
        return True
    except SQLAlchemyError: return False
