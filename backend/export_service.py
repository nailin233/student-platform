from io import BytesIO
from openpyxl import Workbook
from sqlalchemy import text
from database import engine

def students_xlsx():
    with engine.connect() as conn:
        rows = conn.execute(text('SELECT s.name,s.gender,s.age,s.phone,c.name course_name,t.name teacher_name,s.class_time,s.emergency_contact,s.emergency_phone,s.payment_time,s.payment_method,s.tuition_fee,s.paid_amount,s.duration,s.remark FROM students s LEFT JOIN courses c ON s.course_id=c.id LEFT JOIN teachers t ON s.teacher_id=t.id ORDER BY s.id DESC')).mappings().all()
    wb=Workbook(); ws=wb.active; ws.title='学员信息'; ws.append(['姓名','性别','年龄','联系电话','所选课程','任课老师','上课时间','紧急联系人','紧急联系电话','缴费时间','缴费方式','应缴金额','已缴金额','学制','备注'])
    for row in rows: ws.append(list(row.values()))
    out=BytesIO(); wb.save(out); out.seek(0); return out

def payments_xlsx():
    with engine.connect() as conn:
        rows=conn.execute(text('SELECT s.name,s.phone,p.amount,p.payment_method,p.payment_time,p.remark FROM payments p JOIN students s ON s.id=p.student_id ORDER BY p.payment_time DESC')).mappings().all()
    wb=Workbook(); ws=wb.active; ws.title='缴费信息'; ws.append(['学员姓名','联系电话','缴费金额','缴费方式','缴费时间','备注'])
    for row in rows: ws.append(list(row.values()))
    out=BytesIO(); wb.save(out); out.seek(0); return out
