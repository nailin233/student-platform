from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from student_repository import list_students, list_options, create_student, get_student, update_student, delete_student
from database import check_database
from export_service import students_xlsx, payments_xlsx
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name('.env'))
app=FastAPI(title=os.getenv('APP_NAME','Student Platform Demo API'),version='0.1.0')
app.add_middleware(CORSMiddleware,allow_origins=['http://localhost:5173'],allow_credentials=True,allow_methods=['*'],allow_headers=['*'])
@app.get('/api/health')
def health(): return {'status':'ok','message':'student platform backend is running'}
@app.get('/api/database/health')
def database_health(): return {'status':'ok' if check_database() else 'unavailable'}
@app.get('/api/students')
def get_students(keyword: Optional[str]=Query(None,max_length=50),page:int=Query(1,ge=1),page_size:int=Query(10,ge=1,le=100)):
    total,items=list_students(keyword,page,page_size)
    return {'items':items,'total':total,'page':page,'page_size':page_size}
@app.get('/api/options')
def get_options():
    courses,teachers=list_options(); return {'courses':courses,'teachers':teachers}
from fastapi import HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
class StudentInput(BaseModel):
    name: str = Field(min_length=1,max_length=50)
    gender: str | None = None
    age: int | None = Field(default=None,ge=0,le=120)
    phone: str = Field(min_length=5,max_length=30)
    emergency_contact: str | None = None
    emergency_phone: str | None = None
    course_id: int | None = None
    teacher_id: int | None = None
    class_time: str | None = None
    tuition_fee: float = Field(default=0,ge=0)
    paid_amount: float = Field(default=0,ge=0)
    payment_time: datetime | None = None
    payment_method: str | None = None
    duration: str | None = None
    status: str = '在读'
    remark: str | None = None

@app.post('/api/students', status_code=201)
def post_student(payload: StudentInput):
    try: return {'id': create_student(payload.model_dump())}
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))

@app.get('/api/students/{student_id}')
def student_detail(student_id: int):
    item=get_student(student_id)
    if not item: raise HTTPException(status_code=404, detail='学员不存在')
    return item

@app.put('/api/students/{student_id}')
def put_student(student_id: int, payload: StudentInput):
    try:
        if not update_student(student_id,payload.model_dump()): raise HTTPException(status_code=404, detail='学员不存在')
        return {'message':'学员信息已更新'}
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))

@app.delete('/api/students/{student_id}')
def remove_student(student_id: int):
    if not delete_student(student_id): raise HTTPException(status_code=404, detail='学员不存在')
    return {'message':'学员已删除'}




class CourseInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    duration: str | None = None
    price: float = Field(default=0, ge=0)
    class_time: str | None = None

class TeacherInput(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    phone: str | None = None
    specialty: str | None = None
    introduction: str | None = None

@app.get('/api/courses')
def get_courses():
    from sqlalchemy import text
    from database import engine
    with engine.connect() as conn: return [dict(x) for x in conn.execute(text('SELECT id,name,description,duration,price,class_time,status FROM courses ORDER BY id DESC')).mappings()]


@app.post('/api/courses', status_code=201)
def post_course(payload: CourseInput):
    from sqlalchemy import text
    from database import engine
    with engine.begin() as conn:
        r=conn.execute(text('INSERT INTO courses (name,description,duration,price,class_time) VALUES (:name,:description,:duration,:price,:class_time)'),payload.model_dump())
        return {'id':r.lastrowid}


@app.get('/api/dashboard/stats')
def dashboard_stats():
    from sqlalchemy import text
    from database import engine
    with engine.connect() as conn:
        students=conn.execute(text('SELECT COUNT(*) FROM students')).scalar_one()
        courses=conn.execute(text('SELECT COUNT(*) FROM courses WHERE status=1')).scalar_one()
        teachers=conn.execute(text('SELECT COUNT(*) FROM teachers WHERE status=1')).scalar_one()
        unpaid=conn.execute(text('SELECT COALESCE(SUM(tuition_fee-paid_amount),0) FROM students')).scalar_one()
    return {'students':students,'courses':courses,'teachers':teachers,'unpaid_amount':float(unpaid)}


@app.put('/api/courses/{course_id}')
def put_course(course_id: int, payload: CourseInput):
    from sqlalchemy import text
    from database import engine
    with engine.begin() as conn:
        r=conn.execute(text('UPDATE courses SET name=:name,description=:description,duration=:duration,price=:price,class_time=:class_time WHERE id=:id'),{**payload.model_dump(),'id':course_id})
        if r.rowcount==0: raise HTTPException(status_code=404,detail='课程不存在')
    return {'message':'课程已更新'}

@app.delete('/api/courses/{course_id}')
def delete_course(course_id: int):
    from sqlalchemy import text
    from database import engine
    with engine.begin() as conn:
        r = conn.execute(text('DELETE FROM courses WHERE id=:id'), {'id': course_id})
        if r.rowcount == 0: raise HTTPException(status_code=404, detail='课程不存在')
    return {'message': '课程已删除'}

@app.get('/api/teachers')
def get_teachers():
    from sqlalchemy import text
    from database import engine
    with engine.connect() as conn:
        return [dict(x) for x in conn.execute(text('SELECT id,name,phone,specialty,introduction,status FROM teachers ORDER BY id DESC')).mappings()]

@app.post('/api/teachers', status_code=201)
def post_teacher(payload: TeacherInput):
    from sqlalchemy import text
    from database import engine
    with engine.begin() as conn:
        r=conn.execute(text('INSERT INTO teachers (name,phone,specialty,introduction) VALUES (:name,:phone,:specialty,:introduction)'),payload.model_dump())
        return {'id':r.lastrowid}

@app.put('/api/teachers/{teacher_id}')
def put_teacher(teacher_id: int, payload: TeacherInput):
    from sqlalchemy import text
    from database import engine
    with engine.begin() as conn:
        r=conn.execute(text('UPDATE teachers SET name=:name,phone=:phone,specialty=:specialty,introduction=:introduction WHERE id=:id'),{**payload.model_dump(),'id':teacher_id})
        if r.rowcount==0: raise HTTPException(status_code=404,detail='老师不存在')
    return {'message':'老师已更新'}

@app.delete('/api/teachers/{teacher_id}')
def delete_teacher(teacher_id: int):
    from sqlalchemy import text
    from database import engine
    with engine.begin() as conn:
        r = conn.execute(text('DELETE FROM teachers WHERE id=:id'), {'id': teacher_id})
        if r.rowcount == 0: raise HTTPException(status_code=404, detail='老师不存在')
    return {'message': '老师已删除'}



@app.get("/api/export/students")
def export_students():
    return StreamingResponse(students_xlsx(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=students.xlsx"})

@app.get("/api/export/payments")
def export_payments():
    return StreamingResponse(payments_xlsx(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=payments.xlsx"})
