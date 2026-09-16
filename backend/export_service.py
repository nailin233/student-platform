from io import BytesIO
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter
from sqlalchemy import text
from database import engine

# 日期时间列的显示格式。
# 必须显式设置单元格的 number_format：openpyxl 把 datetime 存成 Excel 序列号，
# 若单元格格式是默认的 General，Excel 打开时会显示成 46272.41666666666，
# 而不是 2026-09-07 10:00:00。
DATE_FMT = 'yyyy-mm-dd hh:mm:ss'


def _format_datetime_column(ws, col_index):
    """把指定列（1 起）里的 datetime 单元格套上日期格式。"""
    for row in ws.iter_rows(min_row=2, min_col=col_index, max_col=col_index):
        for cell in row:
            if isinstance(cell.value, datetime):
                cell.number_format = DATE_FMT


def _polish(ws):
    """表头加粗、冻结首行、按内容自适应列宽（中文按 2 个字符宽度计）。"""
    for cell in ws[1]:
        cell.font = Font(bold=True)
    ws.freeze_panes = 'A2'
    for col in ws.columns:
        widest = 0
        for cell in col:
            if cell.value is None:
                continue
            # 中日韩字符在 Excel 里约占 2 个字符宽
            widest = max(widest, sum(2 if ord(ch) > 127 else 1 for ch in str(cell.value)))
        letter = get_column_letter(col[0].column)
        ws.column_dimensions[letter].width = min(max(widest + 3, 8), 42)


def students_xlsx():
    with engine.connect() as conn:
        rows = conn.execute(text('SELECT s.name,s.gender,s.age,s.phone,c.name course_name,t.name teacher_name,s.class_time,s.emergency_contact,s.emergency_phone,s.payment_time,s.payment_method,s.tuition_fee,s.paid_amount,s.duration,s.remark FROM students s LEFT JOIN courses c ON s.course_id=c.id LEFT JOIN teachers t ON s.teacher_id=t.id ORDER BY s.id DESC')).mappings().all()
    wb = Workbook()
    ws = wb.active
    ws.title = '学员信息'
    ws.append(['姓名', '性别', '年龄', '联系电话', '所选课程', '任课老师', '上课时间', '紧急联系人', '紧急联系电话', '缴费时间', '缴费方式', '应缴金额', '已缴金额', '学制', '备注'])
    for row in rows:
        ws.append(list(row.values()))
    _format_datetime_column(ws, 10)  # 缴费时间
    _polish(ws)
    out = BytesIO()
    wb.save(out)
    out.seek(0)
    return out


def payments_xlsx():
    with engine.connect() as conn:
        rows = conn.execute(text('SELECT s.name,s.phone,p.amount,p.payment_method,p.payment_time,p.remark FROM payments p JOIN students s ON s.id=p.student_id ORDER BY p.payment_time DESC')).mappings().all()
    wb = Workbook()
    ws = wb.active
    ws.title = '缴费信息'
    ws.append(['学员姓名', '联系电话', '缴费金额', '缴费方式', '缴费时间', '备注'])
    for row in rows:
        ws.append(list(row.values()))
    _format_datetime_column(ws, 5)  # 缴费时间
    _polish(ws)
    out = BytesIO()
    wb.save(out)
    out.seek(0)
    return out
