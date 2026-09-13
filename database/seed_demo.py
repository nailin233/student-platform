#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Day 14 · 客户演示数据种子脚本
============================================================================
用途：把演示数据重置为一套完整、体面的样例，供客户演示使用。

设计原则：
  1. 可重复执行 —— 每次运行先清空学员，再重新写入，结果恒定。
  2. 覆盖全部 PRD 字段 —— 紧急联系人、缴费信息、学制、备注都要有值，
     避免演示时点开详情一片空白。
  3. 覆盖多种状态 —— 在读 / 已缴费 / 欠费 各有代表，方便演示筛选与统计。
  4. 只动演示数据，不动课程和老师的结构 —— 课程/老师由 schema.sql 提供。

运行前提：后端未启动也可以直接调用本脚本（走数据库直连），
         数据库连接参数取自 backend/.env 的 DATABASE_URL。

用法：
    cd backend && python ../database/seed_demo.py
    # 或从项目根目录：
    python database/seed_demo.py
============================================================================
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# 让脚本能 import 到 backend 下的 database 模块
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'backend'))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(ROOT / 'backend' / '.env')

from sqlalchemy import text  # noqa: E402
from database import engine  # noqa: E402


TODAY = datetime(2026, 9, 14, 10, 0, 0)


def d(days_ago: int) -> str:
    """返回 N 天前的日期时间字符串，用于缴费时间。"""
    return (TODAY - timedelta(days=days_ago)).strftime('%Y-%m-%d %H:%M:%S')


# 演示学员数据：字段顺序与 INSERT 保持一致
DEMO_STUDENTS = [
    dict(
        name='谭贵锋', gender='男', age=22, phone='18172203647',
        emergency_contact='谭父', emergency_phone='13907723311',
        course_name='书法班', teacher_name='王老师',
        class_time='周六 09:00-11:00', duration='12周',
        tuition_fee=1280.00, paid_amount=1280.00,
        payment_time=d(35), payment_method='微信支付',
        status='在读', remark='已全额缴清，字帖已发放',
    ),
    dict(
        name='李思颖', gender='女', age=28, phone='13607721188',
        emergency_contact='李母', emergency_phone='13607721199',
        course_name='摄影班', teacher_name='李老师',
        class_time='周日 14:00-16:00', duration='8周',
        tuition_fee=980.00, paid_amount=980.00,
        payment_time=d(28), payment_method='支付宝',
        status='在读', remark='自带单反，已加入外拍群',
    ),
    dict(
        name='陈美玲', gender='女', age=35, phone='18977234455',
        emergency_contact='陈先生', emergency_phone='18977234466',
        course_name='声乐班', teacher_name='陈老师',
        class_time='周三 19:00-21:00', duration='12周',
        tuition_fee=1680.00, paid_amount=840.00,
        payment_time=d(21), payment_method='微信支付',
        status='在读', remark='分两期缴纳，余款下月结清',
    ),
    dict(
        name='韦建国', gender='男', age=46, phone='13307728899',
        emergency_contact='韦女士', emergency_phone='13307728800',
        course_name='书法班', teacher_name='王老师',
        class_time='周六 09:00-11:00', duration='12周',
        tuition_fee=1280.00, paid_amount=0.00,
        payment_time=None, payment_method=None,
        status='待缴费', remark='试听满意后报名，约定本周内缴费',
    ),
    dict(
        name='黄晓婷', gender='女', age=19, phone='18776950012',
        emergency_contact='黄父', emergency_phone='18776950013',
        course_name='摄影班', teacher_name='李老师',
        class_time='周日 14:00-16:00', duration='8周',
        tuition_fee=980.00, paid_amount=980.00,
        payment_time=d(14), payment_method='现金',
        status='在读', remark='在校大学生，周末班',
    ),
    dict(
        name='刘志强', gender='男', age=52, phone='13517836677',
        emergency_contact='刘太太', emergency_phone='13517836688',
        course_name='声乐班', teacher_name='陈老师',
        class_time='周三 19:00-21:00', duration='12周',
        tuition_fee=1680.00, paid_amount=1680.00,
        payment_time=d(7), payment_method='微信支付',
        status='结业', remark='课程已结业，有意向继续报进阶班',
    ),
]


# 缴费流水：对应「导出缴费信息」功能，数据源是 payments 表。
# (学员姓名, 金额, 方式, 距今天数, 备注)
# 注意：陈美玲分两期缴纳，会有两条流水，合计等于 paid_amount。
DEMO_PAYMENTS = [
    ('谭贵锋', 1280.00, '微信支付', 35, '首期全款'),
    ('李思颖', 980.00, '支付宝', 28, '报名全额'),
    ('陈美玲', 500.00, '微信支付', 21, '第一期'),
    ('陈美玲', 340.00, '微信支付', 5, '第二期'),
    ('黄晓婷', 980.00, '现金', 14, '现场缴纳'),
    ('刘志强', 1680.00, '微信支付', 7, '结业前结清'),
]


def main():
    with engine.begin() as conn:
        # 1. 清空学员与缴费流水
        #    payments / class_changes 有 ON DELETE CASCADE，删学员时会一起清掉，
        #    这里显式再删一次 payments，保证 AUTO_INCREMENT 与数据一致。
        conn.execute(text('DELETE FROM payments'))
        conn.execute(text('DELETE FROM students'))
        conn.execute(text('ALTER TABLE payments AUTO_INCREMENT = 1'))
        conn.execute(text('ALTER TABLE students AUTO_INCREMENT = 1'))

        # 2. 取课程/老师 id 映射
        courses = {r[1]: r[0] for r in conn.execute(text('SELECT id, name FROM courses'))}
        teachers = {r[1]: r[0] for r in conn.execute(text('SELECT id, name FROM teachers'))}

        missing = []
        for s in DEMO_STUDENTS:
            if s['course_name'] not in courses:
                missing.append(f"课程 {s['course_name']}")
            if s['teacher_name'] not in teachers:
                missing.append(f"老师 {s['teacher_name']}")
        if missing:
            print('缺少基础数据：' + '、'.join(sorted(set(missing))))
            print('请先执行 database/schema.sql 初始化课程与老师。')
            return 1

        # 3. 写入演示学员
        sql = text('''
            INSERT INTO students
              (name, gender, age, phone, emergency_contact, emergency_phone,
               course_id, teacher_id, class_time, duration,
               tuition_fee, paid_amount, payment_time, payment_method,
               status, remark)
            VALUES
              (:name, :gender, :age, :phone, :emergency_contact, :emergency_phone,
               :course_id, :teacher_id, :class_time, :duration,
               :tuition_fee, :paid_amount, :payment_time, :payment_method,
               :status, :remark)
        ''')
        for s in DEMO_STUDENTS:
            conn.execute(sql, {
                **s,
                'course_id': courses[s['course_name']],
                'teacher_id': teachers[s['teacher_name']],
            })

        # 4. 写入缴费流水（供「导出缴费信息」使用）
        student_ids = {r[1]: r[0] for r in conn.execute(text('SELECT id, name FROM students'))}
        pay_sql = text('''
            INSERT INTO payments (student_id, amount, payment_method, payment_time, remark)
            VALUES (:student_id, :amount, :payment_method, :payment_time, :remark)
        ''')
        for name, amount, method, days_ago, remark in DEMO_PAYMENTS:
            conn.execute(pay_sql, {
                'student_id': student_ids[name],
                'amount': amount,
                'payment_method': method,
                'payment_time': d(days_ago),
                'remark': remark,
            })

        # 5. 汇总
        total = conn.execute(text('SELECT COUNT(*) FROM students')).scalar_one()
        pay_total = conn.execute(text('SELECT COUNT(*) FROM payments')).scalar_one()
        unpaid = conn.execute(text('SELECT COALESCE(SUM(tuition_fee - paid_amount), 0) FROM students')).scalar_one()

    print(f'演示数据已就绪：学员 {total} 名，缴费流水 {pay_total} 条，待收金额 ¥{unpaid:.2f}')
    for s in DEMO_STUDENTS:
        print(f"  · {s['name']}（{s['gender']}，{s['age']}岁）{s['course_name']} / {s['teacher_name']} — {s['status']}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
