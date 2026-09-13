from sqlalchemy import text
from database import engine

def list_students(keyword: str | None, page: int, page_size: int):
    conditions=[]; params={'offset':(page-1)*page_size,'limit':page_size}
    if keyword:
        conditions.append('(s.name LIKE :keyword OR s.phone LIKE :keyword)'); params['keyword']=f'%{keyword}%'
    where=' WHERE '+ ' AND '.join(conditions) if conditions else ''
    with engine.connect() as conn:
        total=conn.execute(text(f'SELECT COUNT(*) FROM students s{where}'),params).scalar_one()
        rows=conn.execute(text(f'''SELECT s.id,s.name,s.gender,s.age,s.phone,s.class_time,s.tuition_fee,s.paid_amount,s.payment_time,s.status,s.remark,c.name course_name,t.name teacher_name FROM students s LEFT JOIN courses c ON s.course_id=c.id LEFT JOIN teachers t ON s.teacher_id=t.id{where} ORDER BY s.id DESC LIMIT :limit OFFSET :offset'''),params).mappings().all()
    return total,[dict(row) for row in rows]

def list_options():
    with engine.connect() as conn:
        courses=[dict(x) for x in conn.execute(text('SELECT id,name FROM courses WHERE status=1 ORDER BY id')).mappings()]
        teachers=[dict(x) for x in conn.execute(text('SELECT id,name FROM teachers WHERE status=1 ORDER BY id')).mappings()]
    return courses,teachers
from sqlalchemy import text
from database import engine

def _check_ref(conn, table, value):
    if value is None: return
    if conn.execute(text(f'SELECT COUNT(*) FROM {table} WHERE id=:id AND status=1'), {'id':value}).scalar_one() == 0:
        raise ValueError(f'{table} 不存在或已停用')

def create_student(data):
    keys = ['name','gender','age','phone','emergency_contact','emergency_phone','course_id','teacher_id','class_time','tuition_fee','paid_amount','payment_time','payment_method','duration','status','remark']
    data = {k: data.get(k) for k in keys}
    with engine.begin() as conn:
        _check_ref(conn,'courses',data.get('course_id')); _check_ref(conn,'teachers',data.get('teacher_id'))
        result=conn.execute(text('''INSERT INTO students (name,gender,age,phone,emergency_contact,emergency_phone,course_id,teacher_id,class_time,tuition_fee,paid_amount,payment_time,payment_method,duration,status,remark) VALUES (:name,:gender,:age,:phone,:emergency_contact,:emergency_phone,:course_id,:teacher_id,:class_time,:tuition_fee,:paid_amount,:payment_time,:payment_method,:duration,:status,:remark)'''),data)
        return result.lastrowid

def delete_student(student_id):
    with engine.begin() as conn:
        return conn.execute(text('DELETE FROM students WHERE id=:id'),{'id':student_id}).rowcount > 0

def get_student(student_id):
    with engine.connect() as conn:
        row=conn.execute(text('''SELECT s.*,c.name course_name,t.name teacher_name FROM students s LEFT JOIN courses c ON s.course_id=c.id LEFT JOIN teachers t ON s.teacher_id=t.id WHERE s.id=:id'''),{'id':student_id}).mappings().first()
        return dict(row) if row else None

def update_student(student_id,data):
    with engine.begin() as conn:
        _check_ref(conn,'courses',data.get('course_id')); _check_ref(conn,'teachers',data.get('teacher_id'))
        fields=', '.join(f'{k}=:{k}' for k in data)
        params={**data,'id':student_id}
        result=conn.execute(text(f'UPDATE students SET {fields} WHERE id=:id'),params)
        return result.rowcount > 0

