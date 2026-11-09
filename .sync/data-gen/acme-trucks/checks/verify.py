"""ACME Trucks synthetic twin: independent checks of the generated Parquet files.

Usage:  python checks/verify.py [--data <dataset folder>] [--no-rerun]     (default: the folder above checks/)
Reads   <data>/parquet/*.parquet + manifest.json.  Writes <data>/checks/control_totals.csv.  Exit 1 on any failure.

Imports nothing from generator/. The KPI engine below re-implements the Trucks model's DAX (dim_loader filters, the two
category bridges, Linear / Weighted share measures, truck-loading hours, performance and mass) with pandas group-bys.
On the live extract (pbi-report/ACME Trucks/data) the same engine reproduces the model's pinned values of
tests/page-parity.dax (week 10) and tests/baseline-live.csv (week 9 and all data) to 15 significant digits.
Checks:
  TV-01 files and manifest        TV-02 schemas = contract       TV-03 row counts, sizes, sha256
  TV-04 calendar                  TV-05 reference dims           TV-06 loader dim and code domains
  TV-07 work types (model rule)   TV-08 referential integrity    TV-09 fact and plan code domains
  TV-10 unique keys               TV-11 date spans               TV-12 ПФ КРВ identities
  TV-13 plan identities           TV-14 ПФ объемы vs plans       TV-15 КРВ АС identities
  TV-16 KPIs at the tested grain  TV-17 contractor sensitivity   TV-18 control totals written
  TV-19 byte-identical rerun of generator/generate.py (skip with --no-rerun)
"""
import argparse, filecmp, hashlib, io, json, subprocess, sys, tempfile, time
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

sys.stdout.reconfigure(encoding='utf-8')
t0 = time.time()
ap = argparse.ArgumentParser()
ap.add_argument('--data', default=str(Path(__file__).resolve().parent.parent))
ap.add_argument('--no-rerun', action='store_true')
args = ap.parse_args()
DATA = Path(args.data)
PQ = DATA / 'parquet'
GEN = Path(__file__).resolve().parent.parent / 'generator' / 'generate.py'
fails = []


def check(name, ok, detail=''):
    print(f'{"PASS" if ok else "FAIL"}  {name}' + (f'  ({detail})' if detail and not ok else ''))
    if not ok:
        fails.append(name)


# ------------------------------------------------------------------ contract (independent copy, = live extract)
S, I, F, T, B = 'string', 'int64', 'double', 'timestamp[us]', 'bool'
V_COLS = ['Объем добычи план', 'Объем добычи факт', 'Объем ГМ план', 'Объем ГМ факт', 'Объем ГМ на авто план',
          'Объем ГМ на авто факт', 'Добыча план', 'Вскрыша авто план', 'Вскрыша авто факт', 'Навалы авто план',
          'Навалы авто факт', 'ПГР авто план', 'ПГР авто факт', 'Вскрыша б/т план', 'Вскрыша б/т факт',
          'Переэкскавация план', 'Переэкскавация факт', 'ПГР план', 'ПГР факт']
V_MON = ['Объем добычи план месяц', 'Объем ГМ план месяц', 'Объем ГМ на авто план месяц', 'Добыча план месяц',
         'Вскрыша авто план месяц', 'Навалы авто план месяц', 'ПГР авто план месяц', 'Вскрыша б/т план месяц',
         'Переэкскавация план месяц', 'ПГР план месяц']
CONTRACT = {  # file: (columns with Arrow types, live-extract rows, allowed row range)
    'AREA_DIM': ([('_area', S), ('enterprise_id', I)], 13, (13, 13)),
    'Calendar': ([('_weekStartBiz', T), ('_weekEndBiz', T), ('_weekNumBiz', I), ('Date', T), ('Год', I), ('Месяц', I),
                  ('Число', I), ('День недели', S), ('Номер дня недели', I), ('Номер недели', I), ('День_Месяц', S),
                  ('Начало_недели', T), ('Конец_недели', T), ('Номер_диапазон', S), ('curPeriod', S), ('_weekDayNum', I),
                  ('_dateSpanBiz', S), ('_sortSpan', I), ('_dateBiz', S)], 156, (156, 156)),
    'FIELD_DIM': ([('_field_id', S), ('dir_for_plan', S), ('enterprise_name', S), ('enterprise_id', I), ('area', S),
                   ('block', S)], 21, (21, 21)),
    'OFFICE_DIM': ([('_id', I), ('_longName', S), ('_shortName', S)], 6, (6, 6)),
    'intervals': ([('interval_id', I), ('vehicle_export_code', I), ('vehicle_group_code', I), ('reserve_l', B),
                   ('start_dat', T), ('end_dat', T)], 891, (600, 1100)),
    'Интервалы': ([('interval_pf_id', I), ('vehicle_export_code', I), ('vehicle_group_code', I), ('start_dat', T),
                   ('end_dat', T), ('suser_name', S), ('modi_date', T), ('area', S), ('block', S)], 136, (100, 170)),
    'КРВ АС': ([('enterprise_id', I), ('dat', T), ('vehicle_export_code', I), ('vehicle_name', S),
                ('idle_name_for_op', S), ('duration', I), ('kfv', I), ('ktg', F), ('kio', F), ('kio_adv', F),
                ('vehicle_model_name', S)], 804526, (640000, 970000)),
    'ПФ КРВ': ([('vehicle_export_code', I), ('vehicle_name', S), ('dat', T), ('idle_name_for_op', S), ('duration', F),
                ('ent_id', I), ('_active', I), ('area', S), ('block', S), ('_id', S)], 203867, (160000, 250000)),
    'ПФ Отчет о рейсах': ([('Дата', T), ('Экскаватор', S), ('Разрез', S), ('Грузооборот факт', F),
                           ('Техническая скорость', F), ('Машиносмены', F), ('Плечо_добыча', F), ('Плечо_Ва_На', F),
                           ('Экспортный код', I), ('Машиносмены_исходные', F)], 18677, (14000, 23000)),
    'ПФ объемы': ([('Дата', T), ('Разрез', S), ('КФВ', I)] + [(c, F) for c in V_COLS] + [('Экспортный код', I)]
                  + [(c, F) for c in V_MON], 18684, (15000, 23000)),
    'План_2': ([('enterprise_id', I), ('dat', T), ('vehicle_export_code', I), ('vehicle_name', S), ('indicator_name', S),
                ('measure_name', S), ('indicator_amount', F), ('Сортировка', S), ('_active', I), ('area', S),
                ('block', S), ('_id', S)], 394056, (315000, 475000)),
    'План_2_МЕС': ([('enterprise_id', I), ('dat', T), ('vehicle_export_code', I), ('vehicle_name', S),
                    ('indicator_name', S), ('measure_name', S), ('indicator_amount', F), ('period_id', I), ('_active', I),
                    ('area', S), ('block', S), ('_id', S)], 249080, (200000, 300000)),
    'Справочник ЭКС': ([('Филиал', S), ('Название ЭКС в АСД КРВ', S), ('Название ЭКС в ГД', S), ('objrem_id', I),
                        ('name', S), ('номер', S), ('Комментарий', S), ('Объем ковша', I), ('Учитывать', S),
                        ('Название ЭКС в АСД Рейсы', S), ('Поле', S), ('Подрядчик', S)], 168, (168, 168)),
    'Справочник разрезов': ([('enterprise_id', I), ('enterprise_name_short', S)], 7, (7, 7)),
}
# The model's code domains (Trucks.SemanticModel): dim_loader.office_name and loader_name SWITCH lists, the two bridges
OFFICE_CODES = {'Кедровский': 'K1', 'Моховский': 'M2', 'Бачатский': 'B1', 'Калтанский': 'K2', 'Талдинский': 'T1',
                'Краснобродский': 'K3'}
LOADER_DISPATCH = {
    'ЭКГ-12 №09', 'ЭКГ-12 №12', 'ЭКГ-15 №49', 'ЭКГ-18М №02', 'ЭКГ-18 №21', 'ЭКГ-35 №02', 'Р&Н-2800 №28152',
    'Р&Н-2800 №ES 28195', 'LIEBHERR R9200 №40044', 'КОМАТSU РС 1250SР-7 №30688', 'EX 3600 №001393', 'ЭШ-10/70 №62',
    'R-984С №18281', 'ЭШ-10/70 №449', 'ЭКГ-8у№7', 'ЭКГ-10№9', 'ЭКГ-18 №29', 'HITACHI ЕХ1200-7 №7265', 'ЭШ-10/70 №28',
    'ЭШ-10/70 №381', 'ЭШ-11/70 №7', 'ЭКГ-10№90', 'ЭКГ-10№140', 'ЭКГ-11№14', 'КОМАТSU РС 1250SР-7 №20761',
    'Hitachi EX-1200 №7268', 'САТ-390 №10057', 'ЭКГ-15 №401', 'Р&Н-2800 №28149', 'Р&Н-2800 №28155', 'CAT-395 №00293',
    'Р&Н-4100ХРС №41214', 'ЭКГ-18М №03', 'ЭКГ-18М №04', 'НIТАСНI ЕХ-1200-6 (ВЕ) №1249', 'LIEBHERR R9100 №36098',
    'ЭШ-11/70 №15', 'ЭШ13/50 №37', 'WК-35  №08010802', 'ЭКГ-15 №55', 'WК-35  №08018908', 'WК-35  №08011802А',
    'ЭКГ-18 №05', 'ЭКГ-18М №01', 'HITACHI ЕХ1900-6ВН №HCM18K00A00001281', 'LIEBHERR R9250 №192', 'ЭКГ-35 №01',
    'ЭКГ-32Р №01', 'ЭШ-11/70 №53', 'ЭШ13/50 №21/56', 'ЭШ13/50 №12/28', 'САТ-390 №GAY10082', 'Р&Н-2800 №28190',
    'ЭКГ-35 №03', 'WК-35  №08011801', 'ЭКГ-32Р №02', 'WK-20 №08017902', 'ЭКГ-15 №03', 'ЭКГ-18 №01', 'ЭКГ-12 №10',
    'ЭШ13/50 №55', 'HITACHI ЕХ1200-7 №7152', 'САТ-390 №GAY20145', 'CAT-395 №САТ00395JSGD00295', 'ЭКГ-18Р №04',
    'ЭКГ-10 №4', 'ЭКГ-10 №139', 'ЭШ-11/70 №46', 'ЭКГ-10 №132', 'LIEBHERR R9100 №36092', 'WК-35  №08011800',
    'R-9350 №17250', 'EX 3600 №1307', 'ЭКГ-18Р №02', 'WК-35  №08018904', 'Р&Н-2800 №194', 'EX 3600 №1323', 'ЭКГ-18 №27',
    'WК-35  №08011802В', 'Р&Н-4100ХРС №184', 'EX 3600 №1343', 'ЭКГ-18Р №01', 'ЭКГ-18 №23', 'HITACHI ЕХ1900-6ВН №1320',
    'ЭШ13/50 №04', 'HITACHI ЕХ1900-6ВН №1289', 'ЭКГ-18 №00014', 'R-984С №15534', 'ЭКГ-10 №111', 'ЭКГ-18Р №5_',
    'ЭКГ-10 №294', 'ЭКГ-10 №353', 'ЭКГ-12 №11', 'ЭКГ-18 №№7', 'ЭКГ-18 №20', 'ЭКГ-18 №32',
    'LIEBHERR R9100 №WLHZ1132PZE036050', 'HITACHI ЕХ1200-7 №HCMKAA9060007156', 'ЭКГ-10 №5', 'ЭКГ-10 №72', 'ЭКГ-10 №293',
    'ЭКГ-10 №300', 'ЭКГ-18Р №№3', 'ЭКГ-18М №___5', 'HITACHI ЕХ1200-6ВН №HCM18J00L00001826',
    'HITACHI ЕХ1900-6ВН №HCM18K00J00001342', 'HITACHI ЕХ1200-6ВН №25', 'HITACHI ЕХ1200-7 №7262',
    'LIEBHERR R9250 №WLHZ0437LZE041192', 'HITACHI ЕХ1900-6ВН №001343', 'HITACHI EX 1200-7 №7261', 'EX 2600-7 BE №7058',
    'KOMATSU PС 2000-8 №20535', 'CAT-395 №00259', 'ЭШ-10/70 №24', 'ЭШ-10/70 №419', 'ЭШ-10/70 №23', 'ЭШ-10/70 №332',
    'ЭШ-11/70 №48', 'ЭШ-11/70 №16', 'R-984С №18280', 'ЭКГ-10 №303', 'HITACHI EX-1200-5DBH №HCM18F00A00003121',
    'CAT-395 №00395TSGD00342', 'ЭШ-10/70 №299', 'ЭШ 15/90 №139', 'ЭШ-20/90 №20', 'ЭШ-20/90 №14', 'ЭКГ-12 №13',
    'ЭШ-10/70 №430', 'ЭШ-11/70 №13\\13', 'ЭШ-11/70 №17', 'ЭКГ-15 №38', 'ЭКГ-10 №159', 'CAT-395 №00395TSGD0042',
    'CAT-395 №10090', 'CAT-395 №САТ00395НSGD10090', 'CAT-395 №САТ042', 'EX 3600 №1391', 'EX 3600 №HCM18M00L00001391',
    'Hitachi EX 1200 №2781', 'Hitachi EX-1200 №7265', 'Hitachi EX-1200 №7282', 'HITACHI ЕХ1200-7 №7268',
    'HITACHI ЕХ1200-7 №7281', 'HITACHI ЕХ1200-7 №7282', 'HITACHI ЕХ1900-6ВН №1339', 'HITACHI ЕХ1900-6ВН №1346',
    'ПОГРУЗЧИК CAT 992 №3', 'ПОГРУЗЧИК CAT 992К №200170', 'ПОГРУЗЧИК CAT 992К №CAT0992KCRM500184',
    'ПОГРУЗЧИК WА-700-3 №51084', 'ПОГРУЗЧИК WА-900-3 №50098', 'ПОГРУЗЧИК WА-900-3 №50115', 'ПОГРУЗЧИК САТ-992 №200170',
    'ЭКГ-10 №09', 'ЭКГ-10 №10', 'ЭКГ-10 №140', 'ЭКГ-10 №90', 'ЭКГ-12 №14', 'ЭКГ-8У №100', 'ЭКГ-8У №2',
    'ЭШ 10/70 № 175', 'ЭШ-11/70 №16/16', 'ЭШ-11/70 №7/7', 'ЭКГ-10 №67', 'ЭКГ-10 №328', 'ЭКГ-15 №43',
}
FACT_BRIDGE = {  # bridge_fact_time_category after fact_time_actual[idle_name_for_op_2]
    'ТО, ППР': 'ТО, ППР', 'КР': 'КР', 'Авар. Прост.': 'Авар. Прост.', 'Ожид з/ч': 'Ожид з/ч', 'КТГ': 'КТГ',
    'Пересменок': 'Пересменок', 'Обед': 'Обед', 'Личные нужды': 'Личные нужды', 'Заправка': 'Заправка',
    'Взрывные работы': 'Взрывные работы', 'Перегоны': 'Перегоны', 'Ожидание АС': 'Ожидание АС',
    'Консервация/резерв': 'Консервация/резерв', 'Прочие простои': 'Прочие простои',
    'Без классификации': 'Без классификации', 'КИО': 'КИО', 'Основная работа': 'Погрузка самосвалов',
    'Вспомогательная работа': 'Вспомогательная работа', 'Погрузка самосвалов': 'Погрузка самосвалов', 'КФВ': 'КФВ',
    'kio_adv': 'Не учитывать', 'NULL': 'Не учитывать'}
FACT_OP2 = {'ktg': 'КТГ', 'kio': 'КИО', 'Пересменка': 'Пересменок', 'Ожидание а/с': 'Ожидание АС', 'kfv': 'КФВ'}
PLAN_BRIDGE = {  # bridge_plan_time_category after fact_time_plan_*[indicator_name_2]
    'КФВ': 'КФВ', 'ТО, ППР': 'ТО, ППР', 'КР': 'КР', 'Авар. прост.': 'Авар. прост.', 'Ожид з/ч': 'Ожид з/ч', 'КТГ': 'КТГ',
    'Пересменок': 'Пересменок', 'Обед': 'Обед', 'Личные нужды': 'Личные нужды', 'Заправка': 'Заправка',
    'Взрывные работы': 'Взрывные работы', 'Перегоны': 'Перегоны', 'Переключение': 'Прочие простои',
    'Ожидание АС': 'Ожидание АС', 'Консервация/Резерв': 'Консервация/Резерв', 'Работа на другом поле': 'Прочие простои',
    'Прочие простои': 'Прочие простои', 'КИО': 'КИО', 'Вспомогательная работа': 'Вспомогательная работа',
    'Основная работа': 'Вспомогательная работа', 'Погрузка самосвалов': 'Погрузка самосвалов',
    'КИО без ожид. АС': 'Не учитывать', 'Орг. простои план': 'Не учитывать', 'ТО, ППР и КР': 'Не учитывать',
    'Орошение забоя': 'Прочие простои'}
PLAN_OP2 = {'КТГ план': 'КТГ', 'Проверка': 'КФВ'}
DIM_CATEGORY = ['КФВ', 'ТО, ППР', 'КР', 'Авар. прост.', 'Ожид з/ч', 'КТГ', 'Пересменок', 'Обед', 'Личные нужды',
                'Заправка', 'Взрывные работы', 'Перегоны', 'Переключение', 'Ожидание АС', 'Консервация/Резерв',
                'Отсутствие экипажа', 'Работа на другом поле', 'Зачистка подъезда', 'Ожидание погрузки',
                'Отсутствие фронта', 'Прочие простои', 'Без классификации', 'Отсутствие телеметрии', 'КИО',
                'Вспомогательная работа', 'Основная работа', 'Погрузка самосвалов', 'КИО (движ. груженым)',
                'КИО (движ. порожним)', 'КИО (погрузка)', 'КИО (разгрузка)']
LOSS = ['ТО, ППР', 'КР', 'Авар. прост.', 'Ожид з/ч', 'Пересменок', 'Обед', 'Личные нужды', 'Заправка',
        'Взрывные работы', 'Перегоны', 'Ожидание АС', 'Консервация/Резерв', 'Прочие простои', 'Без классификации']
BREAK_SET = {'КИО': LOSS, 'Погрузка самосвалов': LOSS + ['Основная работа', 'Вспомогательная работа']}
PLAN_TIME = ['ТО, ППР', 'КР', 'Авар. прост.', 'Ожид з/ч', 'Пересменок', 'Обед', 'Личные нужды', 'Заправка',
             'Взрывные работы', 'Перегоны', 'Переключение', 'Ожидание АС', 'Консервация/Резерв', 'Отсутствие экипажа',
             'Работа на другом поле', 'Прочие простои', 'Основная работа', 'Вспомогательная работа',
             'Погрузка самосвалов', 'Орошение забоя']
PLAN_OTHER = ['Проверка', 'Проверка КТГ', 'КТГ план', 'КИО', 'КИО без ожид. АС', 'Орг. простои план', 'ТО, ППР и КР',
              'Объем ГМ план', 'Объем ГМ на авто план', 'Вскрыша авто', 'Навалы авто', 'ПГР авто', 'Добыча',
              'Вскрыша б/т', 'ПГР', 'Переэкскавация', 'Объем добычи план', 'Объемный вес', 'Плечо план', 'Плечо порода',
              'Плечо добыча', 'Техническая скорость план пород.', 'Техническая скорость план углев.',
              'Час. пр-ть ед. АС пород.', 'Час. пр-ть ед. АС углев.', 'Производительность', 'Грузооборот',
              'АС: Кол-во МС породов.', 'АС: Кол-во МС углев.']
MEASURES = {'Проверка КТГ', 'Проверка', 'ч.', 'ч', '%', 'тыс. м3', 'МС', 'тыс. ткм', 'т/м3', 'км', 'км/ч', 'м3/ч', 'тыс. т'}
SORT_CODE = {'ТО, ППР': '1', 'КР': '2', 'Авар. прост.': '3', 'Ожид з/ч': '4', 'Пересменок': '6', 'Обед': '7',
             'Личные нужды': '8', 'Заправка': '9', 'Взрывные работы': '10', 'Перегоны': '11', 'Переключение': '12',
             'Ожидание АС': '13', 'Консервация/Резерв': '14', 'Отсутствие экипажа': '15', 'Работа на другом поле': '16',
             'Прочие простои': '20', 'КИО': '23', 'Вспомогательная работа': '24', 'Основная работа': '25',
             'Погрузка самосвалов': '26'}
TRUCK_CODES = {'Пересменка', 'Обед', 'Заправка', 'Без классификации', 'Прочие простои', 'Авар. Прост.', 'ТО, ППР',
               'Ожидание погрузки', 'Личные нужды', 'Взрывные работы', 'Консервация/резерв', 'КР', 'Ожид з/ч',
               'Движение груженым', 'Движение порожним', 'Погрузка', 'Разгрузка', 'Вспомогательная работа',
               'Погрузка самосвалов'}
COMMENTS = {None, 'автосхема', 'подряд', 'перевалка', 'КР', 'бестранспортная', 'списание', 'отс. з/част.', 'ЖД схема'}
TARGETS = {'truck_loading_plan': 0.4300, 'truck_loading_fact': 0.4500, 'effective_work_plan': 0.5400,
           'effective_work_fact': 0.5150, 'mass_plan': 7300.0, 'mass_fact': 7100.0}
S1_WEEK = '10 (4.3-10.3)'

# ------------------------------------------------------------------ TV-01 .. TV-03 files, schemas, counts
man_path = PQ / 'manifest.json'
check('TV-01 manifest.json present', man_path.exists())
if not man_path.exists():
    sys.exit(1)
man = json.loads(man_path.read_text(encoding='utf-8'))
files = sorted(p.stem for p in PQ.glob('*.parquet'))
check('TV-01 exactly the 14 contract files, no extra Parquet', files == sorted(CONTRACT), f'{files}')
mt = {t['file']: t for t in man['tables']}
check('TV-01 manifest lists the 14 files', sorted(mt) == sorted(f'{n}.parquet' for n in CONTRACT))
tables = {}
for name, (cols, live_rows, (lo, hi)) in CONTRACT.items():
    p = PQ / f'{name}.parquet'
    if not p.exists():
        continue
    sch = pq.read_schema(p)
    got = [(f.name, str(f.type)) for f in sch]
    check(f'TV-02 {name}: columns and Arrow types = contract', got == cols,
          f'{[c for c in got if c not in cols]} vs {[c for c in cols if c not in got]}')
    check(f'TV-02 {name}: no pandas / schema metadata', not sch.metadata)
    tables[name] = pq.read_table(p).to_pandas()
    n = len(tables[name])
    data = p.read_bytes()
    m = mt.get(f'{name}.parquet', {})
    check(f'TV-03 {name}: rows {n:,} = manifest, in contract range {lo:,}..{hi:,} (live extract {live_rows:,})',
          m.get('rows') == n and lo <= n <= hi)
    check(f'TV-03 {name}: sha256 and bytes = manifest', m.get('sha256') == hashlib.sha256(data).hexdigest()
          and m.get('bytes') == len(data))
if len(tables) != len(CONTRACT):
    print('missing files, stopping')
    sys.exit(1)
cal, L, A, W, M = tables['Calendar'], tables['Справочник ЭКС'], tables['ПФ КРВ'], tables['План_2'], tables['План_2_МЕС']
V, IV, IP, K, R = tables['ПФ объемы'], tables['intervals'], tables['Интервалы'], tables['КРВ АС'], tables['ПФ Отчет о рейсах']
OF, MI, AR, FI = tables['OFFICE_DIM'], tables['Справочник разрезов'], tables['AREA_DIM'], tables['FIELD_DIM']

# ------------------------------------------------------------------ TV-04 calendar
span = pd.date_range('2022-10-29', '2023-04-02')
check('TV-04 Calendar: one row per day 2022-10-29 .. 2023-04-02', sorted(cal.Date) == list(span))
c = cal.set_index('Date').sort_index()
sat = c.index - pd.to_timedelta((c.index.weekday - 5) % 7, unit='D')
check('TV-04 business week starts Saturday, ends Friday, _weekDayNum Sat = 1',
      (c._weekStartBiz == sat).all() and (c._weekEndBiz == sat + pd.Timedelta(6, unit='D')).all()
      and (c._weekDayNum == (c.index.weekday - 5) % 7 + 1).all())
check('TV-04 _sortSpan = Excel serial of _weekStartBiz',
      (c._sortSpan == (c._weekStartBiz - pd.Timestamp('1899-12-30')).dt.days).all())
check('TV-04 week label of 2023-03-04 .. 2023-03-10 is "10 (4.3-10.3)"',
      set(c.loc['2023-03-04':'2023-03-10', '_dateSpanBiz']) == {S1_WEEK})
check('TV-04 Monday week (Номер недели, Начало / Конец_недели) and Год / Месяц / Число consistent',
      (c['Начало_недели'] == c.index - pd.to_timedelta(c.index.weekday, unit='D')).all()
      and (c['Год'] == c.index.year).all() and (c['Месяц'] == c.index.month).all() and (c['Число'] == c.index.day).all()
      and (c['Номер дня недели'] == c.index.weekday + 1).all())

# ------------------------------------------------------------------ TV-05 reference dims
check('TV-05 OFFICE_DIM: ids 1..6, long names "<branch> угольный разрез"',
      sorted(OF._id) == list(range(1, 7)) and all(n.endswith('угольный разрез') for n in OF._longName))
check('TV-05 Справочник разрезов: 1..6 + 999, short names = office codes + КРУ',
      sorted(MI.enterprise_id) == [1, 2, 3, 4, 5, 6, 999]
      and set(MI.enterprise_name_short) == set(OFFICE_CODES) | {'КРУ'})
check('TV-05 AREA_DIM: 13 unique areas, enterprise 1..6', AR._area.is_unique and set(AR.enterprise_id) <= set(range(1, 7)))
check('TV-05 FIELD_DIM: _field_id = block-area, unique, area in AREA_DIM, enterprise matches',
      FI._field_id.is_unique and (FI._field_id == FI.block + '-' + FI.area).all() and FI.area.isin(AR._area).all()
      and (FI.area.map(dict(zip(AR._area, AR.enterprise_id))) == FI.enterprise_id).all())

# ------------------------------------------------------------------ TV-06 loader dim
check('TV-06 objrem_id unique, dispatch name unique', L.objrem_id.is_unique and L['Название ЭКС в ГД'].is_unique)
check('TV-06 every dispatch name is in the model\'s loader_name SWITCH (no blank loader_name)',
      L['Название ЭКС в ГД'].isin(LOADER_DISPATCH).all())
check('TV-06 every Филиал is in the model\'s office_name SWITCH (no blank office)', L['Филиал'].isin(OFFICE_CODES).all())
check('TV-06 Учитывать in {да, нет}, Подрядчик in {blank, да}, Комментарий in its domain',
      L['Учитывать'].isin(['да', 'нет']).all() and set(L['Подрядчик'].dropna()) <= {'да'}
      and set(L['Комментарий'].where(L['Комментарий'].notna(), None)) <= COMMENTS)
check('TV-06 АСД КРВ and АСД Рейсы names unique, bucket volume >= 0',
      L['Название ЭКС в АСД КРВ'].is_unique and L['Название ЭКС в АСД Рейсы'].is_unique and (L['Объем ковша'] >= 0).all())

# ------------------------------------------------------------------ TV-07 work type, the model's rule
grp = IV.groupby('vehicle_export_code').vehicle_group_code.max()
L['wt'] = L.objrem_id.map(lambda i: 'Undefined' if i not in grp.index else {1: 'On spot', 2: 'Trucks'}.get(int(grp[i])))
scope0 = (L['Учитывать'] == 'да') & L['Подрядчик'].isna()
wt_counts = L.loc[scope0, 'wt'].value_counts(dropna=False).to_dict()
check('TV-07 in scope (да, no contractor): >= 100 Trucks and >= 10 On spot loaders',
      wt_counts.get('Trucks', 0) >= 100 and wt_counts.get('On spot', 0) >= 10, f'{wt_counts}')
check('TV-07 in-scope loaders have bucket volume > 0 (weights of the Weighted calculation)',
      (L.loc[scope0 & L.wt.isin(['Trucks', 'On spot']), 'Объем ковша'] > 0).all())
check('TV-07 a contractor loader with fact rows and work type Undefined exists (S3 case)',
      L[(L['Подрядчик'] == 'да') & (L.wt == 'Undefined')].objrem_id.isin(A.vehicle_export_code).any())

# ------------------------------------------------------------------ TV-08 referential integrity
ids = set(L.objrem_id)
for nm, df, col in (('ПФ КРВ', A, 'vehicle_export_code'), ('План_2', W, 'vehicle_export_code'),
                    ('План_2_МЕС', M, 'vehicle_export_code'), ('ПФ объемы', V, 'Экспортный код'),
                    ('intervals', IV, 'vehicle_export_code'), ('Интервалы', IP, 'vehicle_export_code'),
                    ('ПФ Отчет о рейсах', R, 'Экспортный код')):
    miss = set(df[col].dropna().astype('int64')) - ids
    check(f'TV-08 {nm}.{col} in Справочник ЭКС.objrem_id', not miss, f'{len(miss)} orphan codes')
check('TV-08 КРВ АС truck codes are not loader codes', not (set(K.vehicle_export_code) & ids))
days = set(cal.Date)
for nm, df, col in (('ПФ КРВ', A, 'dat'), ('План_2', W, 'dat'), ('План_2_МЕС', M, 'dat'), ('ПФ объемы', V, 'Дата'),
                    ('КРВ АС', K, 'dat'), ('ПФ Отчет о рейсах', R, 'Дата')):
    check(f'TV-08 {nm}.{col} in Calendar.Date', df[col].isin(days).all())
ents = set(MI.enterprise_id)
check('TV-08 enterprise ids (ПФ КРВ.ent_id, plans, КРВ АС) in Справочник разрезов',
      A.ent_id.isin(ents).all() and W.enterprise_id.isin(ents).all() and M.enterprise_id.isin(ents).all()
      and K.enterprise_id.isin(ents).all())
fid = set(FI._field_id)
check('TV-08 area / block / _id of ПФ КРВ and plans = a FIELD_DIM row',
      all(((df._id == df.block + '-' + df.area) & df._id.isin(fid)).all() for df in (A, W, M)))
loader_ent = dict(zip(L.objrem_id, L['Филиал'].map(dict(zip(MI.enterprise_name_short, MI.enterprise_id)))))
check('TV-08 ПФ КРВ.ent_id and plan enterprise_id = the loader\'s branch',
      (A.ent_id == A.vehicle_export_code.map(loader_ent)).all()
      and (W.enterprise_id == W.vehicle_export_code.map(loader_ent)).all())
check('TV-08 ПФ объемы / ПФ Отчет о рейсах Разрез in OFFICE_DIM long names',
      V['Разрез'].isin(OF._longName).all() and R['Разрез'].isin(OF._longName).all())
check('TV-08 ПФ Отчет о рейсах Экскаватор = АСД Рейсы name of its code, or "Прочие" with a blank code',
      ((R['Экскаватор'] == R['Экспортный код'].map(dict(zip(L.objrem_id, L['Название ЭКС в АСД Рейсы']))))
       | ((R['Экскаватор'] == 'Прочие') & R['Экспортный код'].isna())).all())


# ------------------------------------------------------------------ TV-09 code domains through the model's bridges
def ci(m):
    return {k.casefold(): v for k, v in m.items()}


DIM_CF = {d.casefold(): d for d in DIM_CATEGORY}
FB, PB = ci(FACT_BRIDGE), ci(PLAN_BRIDGE)


def fact_category(code):
    x = FACT_OP2.get(code, code)
    chart = FB.get(x.casefold())
    return None if chart is None else DIM_CF.get(chart.casefold(), 'Не учитывать')


def plan_category(name):
    x = PLAN_OP2.get(name, name)
    chart = PB.get(x.casefold())
    return None if chart is None else DIM_CF.get(chart.casefold(), 'Не учитывать')


A['cat'] = A.idle_name_for_op.map({c: fact_category(c) for c in A.idle_name_for_op.unique()})
check('TV-09 every ПФ КРВ idle code maps through bridge_fact_time_category', A.cat.notna().all(),
      f'{sorted(A.loc[A.cat.isna(), "idle_name_for_op"].unique())}')
for nm, P in (('План_2', W), ('План_2_МЕС', M)):
    P['cat'] = P.indicator_name.map({c: plan_category(c) for c in P.indicator_name.unique()})
    check(f'TV-09 {nm}: indicators in the contract list, time indicators map through bridge_plan_time_category '
          '(Отсутствие экипажа has no bridge row, as in the model)', P.indicator_name.isin(PLAN_TIME + PLAN_OTHER).all()
          and P.loc[P.indicator_name.isin([t_ for t_ in PLAN_TIME if t_ != 'Отсутствие экипажа']), 'cat'].notna().all())
    check(f'TV-09 {nm}: measure_name in the 13 units, _active = 1', P.measure_name.isin(MEASURES).all()
          and (P._active == 1).all())
check('TV-09 План_2.Сортировка = sort code of the time indicator, blank otherwise',
      (W['Сортировка'].fillna('') == W.indicator_name.map(SORT_CODE).fillna('')).all())
check('TV-09 План_2_МЕС.period_id = 2', (M.period_id == 2).all())
check('TV-09 ПФ КРВ._active = 1; intervals group in {0, 1, 2}', (A._active == 1).all()
      and IV.vehicle_group_code.isin([0, 1, 2]).all() and IP.vehicle_group_code.isin([1, 2]).all())
check('TV-09 КРВ АС idle codes in the truck domain', K.idle_name_for_op.isin(TRUCK_CODES).all())

# ------------------------------------------------------------------ TV-10 keys, TV-11 spans
for nm, df, key in (('ПФ КРВ', A, ['vehicle_export_code', 'dat', 'idle_name_for_op']),
                    ('План_2', W, ['vehicle_export_code', 'dat', 'indicator_name']),
                    ('План_2_МЕС', M, ['vehicle_export_code', 'dat', 'indicator_name']),
                    ('ПФ объемы', V, ['Экспортный код', 'Дата']), ('intervals', IV, ['interval_id']),
                    ('Интервалы', IP, ['interval_pf_id']), ('КРВ АС', K, ['vehicle_export_code', 'dat', 'idle_name_for_op']),
                    ('ПФ Отчет о рейсах', R, ['Дата', 'Экскаватор', 'Разрез'])):
    check(f'TV-10 {nm}: {" x ".join(key)} unique', not df.duplicated(key).any())
for nm, df, col, lo, hi in (('ПФ КРВ', A, 'dat', '2022-11-01', '2023-03-26'), ('КРВ АС', K, 'dat', '2022-11-01', '2023-03-26'),
                            ('ПФ Отчет о рейсах', R, 'Дата', '2022-11-01', '2023-03-26'),
                            ('План_2', W, 'dat', '2022-11-01', '2023-03-31'), ('План_2_МЕС', M, 'dat', '2023-01-01', '2023-03-31'),
                            ('ПФ объемы', V, 'Дата', '2022-10-29', '2023-03-31')):
    check(f'TV-11 {nm}: {col} spans {lo} .. {hi}', df[col].min() == pd.Timestamp(lo) and df[col].max() == pd.Timestamp(hi))

# ------------------------------------------------------------------ TV-12 ПФ КРВ identities
x = A.pivot_table(index=['vehicle_export_code', 'dat'], columns='idle_name_for_op', values='duration', aggfunc='sum')
cats = [cc for cc in x.columns if cc not in ('kfv', 'ktg', 'kio', 'kio_adv')]
rep = x.reindex(columns=['ТО, ППР', 'КР', 'Авар. Прост.', 'Ожид з/ч']).sum(axis=1)
work = x.reindex(columns=['Основная работа', 'Вспомогательная работа', 'Погрузка самосвалов']).sum(axis=1)
check('TV-12 every loader-day has kfv, ktg, kio and kio_adv rows', x[['kfv', 'ktg', 'kio', 'kio_adv']].notna().all().all())
check('TV-12 idle categories sum to kfv per loader-day (exact seconds)', (x[cats].sum(axis=1) == x.kfv).all())
check('TV-12 ktg = kfv - (ТО ППР + КР + Авар + Ожид з/ч); kio = work; kio_adv = max(kio - ожидание а/с, 0)',
      (x.ktg == x.kfv - rep).all() and (x.kio == work).all()
      and (x.kio_adv == np.maximum(x.kio - x.get('Ожидание а/с', 0).fillna(0), 0)).all())
check('TV-12 kfv in {43200, 86387 .. 86400}', x.kfv.isin([43200] + list(range(86387, 86401))).all())

# ------------------------------------------------------------------ TV-13 plan identities
for nm, P in (('План_2', W), ('План_2_МЕС', M)):
    y = P.pivot_table(index=['vehicle_export_code', 'dat'], columns='indicator_name', values='indicator_amount',
                      aggfunc='sum')
    tsum = y.reindex(columns=PLAN_TIME).sum(axis=1)
    prep = y.reindex(columns=['ТО, ППР', 'КР', 'Авар. прост.', 'Ожид з/ч']).sum(axis=1)
    pwork = y.reindex(columns=['Основная работа', 'Вспомогательная работа', 'Погрузка самосвалов']).sum(axis=1)
    check(f'TV-13 {nm}: Проверка = 24 = sum of the time indicators on every loader-day',
          (y['Проверка'] == 24).all() and ((tsum - 24).abs() < 0.005).all())
    check(f'TV-13 {nm}: КТГ план = 24 - repairs; КИО = work hours', ((y['КТГ план'] - (24 - prep)).abs() < 0.006).all()
          and ((y['КИО'].fillna(0) - pwork).abs() < 0.006).all())
    pr = y.dropna(subset=['Производительность', 'Объем ГМ на авто план', 'Погрузка самосвалов'])
    check(f'TV-13 {nm}: Производительность = ГМ на авто / Погрузка x 1000 (truck loaders, 0.5 %)',
          len(pr) > 0 and ((pr['Производительность'] - pr['Объем ГМ на авто план'] / pr['Погрузка самосвалов'] * 1000).abs()
                           <= 0.005 * pr['Производительность'] + 0.01).all())
    parts = y.reindex(columns=['Вскрыша авто', 'Навалы авто', 'ПГР авто', 'Добыча']).sum(axis=1)
    check(f'TV-13 {nm}: Объем ГМ на авто план = Вскрыша авто + Навалы авто + ПГР авто + Добыча',
          ((y['Объем ГМ на авто план'].fillna(0) - parts).abs() < 0.015).all())

# ------------------------------------------------------------------ TV-14 ПФ объемы vs plans
v = V.set_index(['Экспортный код', 'Дата'])
for nm, P, pairs in (('План_2', W, [('Объем ГМ на авто план', 'Объем ГМ на авто план'), ('Объем ГМ план', 'Объем ГМ план'),
                                    ('Вскрыша авто', 'Вскрыша авто план'), ('Добыча', 'Добыча план')]),
                     ('План_2_МЕС', M, [('Объем ГМ на авто план', 'Объем ГМ на авто план месяц'),
                                        ('Объем ГМ план', 'Объем ГМ план месяц'),
                                        ('Вскрыша авто', 'Вскрыша авто план месяц'), ('Добыча', 'Добыча план месяц')])):
    y = P.pivot_table(index=['vehicle_export_code', 'dat'], columns='indicator_name', values='indicator_amount',
                      aggfunc='sum')
    y.index.names = ['Экспортный код', 'Дата']
    j = v.join(y.add_prefix('p_'), how='left')
    ok = all(((j[vc] - j['p_' + pc].fillna(0)).abs() < 0.005).all() for pc, vc in pairs)
    check(f'TV-14 ПФ объемы plan columns = {nm} indicators (4 volume pairs)', ok)
check('TV-14 every plan loader-day with a truck-mass indicator has its ПФ объемы row',
      set(map(tuple, M.loc[M.indicator_name == 'Объем ГМ на авто план', ['vehicle_export_code', 'dat']].values))
      <= set(v.index))
check('TV-14 ПФ объемы: КФВ = 24; ГМ на авто факт = Вскрыша + Навалы + ПГР авто + Объем добычи / 1.38',
      (V['КФВ'] == 24).all() and ((V['Объем ГМ на авто факт'] - V['Вскрыша авто факт'] - V['Навалы авто факт']
                                    - V['ПГР авто факт'] - V['Объем добычи факт'] / 1.38).abs() < 0.02).all())
check('TV-14 ПФ объемы: month-plan columns are 0 before 2023-01-01, fact columns 0 after 2023-03-26',
      (V.loc[V['Дата'] < '2023-01-01', V_MON].abs().sum().sum() == 0)
      and (V.loc[V['Дата'] > '2023-03-26', [c_ for c_ in V_COLS if 'факт' in c_]].abs().sum().sum() == 0))

# ------------------------------------------------------------------ TV-15 КРВ АС identities
k = K.dropna(subset=['kfv'])
g = k.groupby(['vehicle_export_code', 'dat'])
kd = pd.DataFrame({'sum': g.duration.sum(), 'kfv': g.kfv.first(), 'kio': g.kio.first(), 'adv': g.kio_adv.first()})
wk_ = k[k.idle_name_for_op.isin(['Движение груженым', 'Движение порожним', 'Погрузка', 'Разгрузка'])]
kd['work'] = wk_.groupby(['vehicle_export_code', 'dat']).duration.sum()
check('TV-15 КРВ АС: durations sum to kfv per truck-day', (kd['sum'] == kd.kfv).all())
check('TV-15 КРВ АС: kio % = work / kfv x 100, kio_adv = kio, totals constant per truck-day',
      ((kd.kio - kd.work.fillna(0) / kd.kfv * 100).abs() < 0.006).all() and (kd.adv == kd.kio).all()
      and (g.kfv.nunique() == 1).all())
check('TV-15 КРВ АС: 3 - 8 % of rows without totals, 3 - 12 % without model name',
      0.03 <= K.kfv.isna().mean() <= 0.08 and 0.03 <= K.vehicle_model_name.isna().mean() <= 0.12)

# ------------------------------------------------------------------ KPI engine (the model's DAX, pandas)
DISP = dict(zip(L.objrem_id, L['Название ЭКС в ГД']))
VOL = L.groupby('Название ЭКС в ГД')['Объем ковша'].max()
week_of = dict(zip(cal.Date, cal._dateSpanBiz))
for df, col in ((A, 'dat'), (W, 'dat'), (M, 'dat')):
    df['d'] = df.vehicle_export_code.map(DISP)
    df['wk'] = df[col].map(week_of)
V['wk'] = V['Дата'].map(week_of)


def loaders(wts=('Trucks', 'On spot'), contractor_blank=True):
    s = (L['Учитывать'] == 'да') & L.wt.isin(wts)
    if contractor_blank:
        s &= L['Подрядчик'].isna()
    return L[s]


def share(df, val, calc, bp, vol, total_cat='КФВ'):
    """Time Share % at breakpoint bp (КИО = Effective work time, Погрузка самосвалов = Truck loading)."""
    act = df.groupby('d')._active.max()
    hrs = df[(df._active == 1) & df.cat.isin(BREAK_SET[bp])].groupby('d')[val].sum()
    tot = df[df.cat == total_cat].groupby('d')[val].sum()
    b = pd.DataFrame({'vol': vol}).join(act.rename('act')).join(hrs.rename('h')).join(tot.rename('t'))
    if calc == 'Weighted':
        q = b[b.act == 1]
        if q.empty:
            return 0.0
        pct = np.where(q.t.isna(), np.where(q.h.isna(), 1.0, -np.inf), 1 - q.h.fillna(0) / q.t)   # DAX blank rules
        return float((pct * q.vol).sum() / q.vol.sum())
    return 0.0 if not b.t.sum() else float(1 - b.h.sum() / b.t.sum())


def hours_at(df, val, calc, cat, vol, active_only):
    d = df[df._active == 1] if active_only else df
    h = d[d.cat == cat].groupby('d')[val].sum()
    b = pd.DataFrame({'vol': vol}).join(h.rename('h'))
    return float((b.vol * b.h.fillna(0)).sum() / b.vol.sum()) if calc == 'Weighted' else float(b.h.sum())


def kpis(week=None, plan='Month', calc='Weighted', wts=('Trucks', 'On spot'), contractor_blank=True):
    s = loaders(wts, contractor_blank)
    idset, vol = set(s.objrem_id), VOL[VOL.index.isin(s['Название ЭКС в ГД'])]
    sel = lambda df: df[df.vehicle_export_code.isin(idset) & ((df.wk == week) if week else True)]
    a, p = sel(A), sel(M if plan == 'Month' else W)
    a = a.assign(hrs=a.duration / 3600)
    out = {}
    for key, bp in (('truck_loading', 'Погрузка самосвалов'), ('effective_work', 'КИО')):
        out[f'{key}_plan'] = share(p, 'indicator_amount', calc, bp, vol) if len(p) else None
        out[f'{key}_fact'] = share(a, 'hrs', calc, bp, vol)
    v_ = V[V['Экспортный код'].isin(idset) & ((V.wk == week) if week else True)]
    out['mass_plan'] = float(v_['Объем ГМ на авто план месяц' if plan == 'Month' else 'Объем ГМ на авто план'].sum())
    out['mass_fact'] = float(v_['Объем ГМ на авто факт'].sum())
    tl_p = (hours_at(p, 'indicator_amount', calc, 'Погрузка самосвалов', vol, False)
            / hours_at(p, 'indicator_amount', calc, 'КФВ', vol, False)) if len(p) else None
    tl_f = (hours_at(a, 'hrs', calc, 'Погрузка самосвалов', vol, calc == 'Weighted')
            / hours_at(a, 'hrs', calc, 'КФВ', vol, calc == 'Weighted'))
    tot_p = float(p.loc[p.indicator_name == 'Проверка', 'indicator_amount'].sum())
    tot_f = float(a.loc[a.cat == 'КФВ', 'hrs'].sum())
    out['performance_plan'] = out['mass_plan'] / (tot_p * tl_p) * 1000 if tl_p else None
    out['performance_fact'] = out['mass_fact'] / (tot_f * tl_f) * 1000 if tl_f else None
    if not len(p):
        out['mass_plan'] = None
    return out


# ------------------------------------------------------------------ TV-16 tested grain
s1 = kpis(S1_WEEK, 'Month', 'Weighted')
print('      tested grain week 10 / Month / Weighted / Trucks + On spot:  ' + '  '.join(
    f'{k_}={v_:.4f}' if v_ < 10 else f'{k_}={v_:,.2f}' for k_, v_ in s1.items()))
for k_ in ('truck_loading', 'effective_work'):
    for side in ('plan', 'fact'):
        check(f'TV-16 {k_} {side} {s1[f"{k_}_{side}"]:.4%} = target {TARGETS[f"{k_}_{side}"]:.2%} +/- 0.05 pp',
              abs(s1[f'{k_}_{side}'] - TARGETS[f'{k_}_{side}']) <= 0.0005)
for side in ('plan', 'fact'):
    check(f'TV-16 mass {side} {s1[f"mass_{side}"]:,.2f} = target {TARGETS[f"mass_{side}"]:,.0f} +/- 0.1 %',
          abs(s1[f'mass_{side}'] / TARGETS[f'mass_{side}'] - 1) <= 0.001)
check('TV-16 performance per truck plan and fact in 700 .. 950 m3/h, plan above fact',
      700 <= s1['performance_fact'] < s1['performance_plan'] <= 950)
check('TV-16 believable gaps: truck loading fact - plan +0.5 .. +5 pp, effective work fact - plan -5 .. -0.5 pp',
      0.005 <= s1['truck_loading_fact'] - s1['truck_loading_plan'] <= 0.05
      and -0.05 <= s1['effective_work_fact'] - s1['effective_work_plan'] <= -0.005)

# ------------------------------------------------------------------ TV-17 contractor filter matters with Undefined
with_c = kpis(S1_WEEK, 'Month', 'Weighted', ('Trucks', 'On spot', 'Undefined'), contractor_blank=False)
without_c = kpis(S1_WEEK, 'Month', 'Weighted', ('Trucks', 'On spot', 'Undefined'), contractor_blank=True)
check('TV-17 with work type Undefined ticked, the contractor = blank filter changes the fact KPIs',
      abs(with_c['effective_work_fact'] - without_c['effective_work_fact']) > 1e-6
      and abs(with_c['mass_fact'] - without_c['mass_fact']) > 1e-6)

# ------------------------------------------------------------------ TV-18 control totals
fact_weeks = [w_ for w_ in cal.sort_values('Date')._dateSpanBiz.unique() if w_ in set(A.wk)]
rows = []
for name in sorted(CONTRACT):
    df = tables[name][[c_ for c_, _ in CONTRACT[name][0]]]
    srt = df.astype(str).sort_values(list(df.columns), kind='mergesort').index
    buf = io.StringIO()
    df.loc[srt].to_csv(buf, index=False, lineterminator='\n')
    rows.append(('rows', name, '', '', '', 'rows', str(len(df))))
    rows.append(('checksum', name, '', '', '', 'content_sha256', hashlib.sha256(buf.getvalue().encode('utf-8')).hexdigest()))
for wk in fact_weeks + ['ALL']:
    for plan in ('Week', 'Month'):
        if plan == 'Month' and wk != 'ALL' and not (M.wk == wk).any():
            continue
        for calc in ('Linear', 'Weighted'):
            res = kpis(None if wk == 'ALL' else wk, plan, calc)
            for metric, val in res.items():
                rows.append(('kpi', wk, plan, calc, 'Trucks+On spot', metric, '' if val is None else f'{val:.10g}'))
ct = pd.DataFrame(rows, columns=['section', 'scope', 'plan_type', 'calculation', 'work_types', 'metric', 'value'])
(DATA / 'checks').mkdir(parents=True, exist_ok=True)
ct_path = DATA / 'checks' / 'control_totals.csv'
new = ct.to_csv(index=False, lineterminator='\n').encode('utf-8')
old = ct_path.read_bytes() if ct_path.exists() else None
ct_path.write_bytes(new)
n_kpi = int((ct.section == 'kpi').sum())
check(f'TV-18 control totals written: {len(ct):,} rows ({n_kpi} KPI values over {len(fact_weeks)} weeks + ALL)',
      n_kpi > 0 and ct.value.ne('').any())
print(f'      control_totals.csv {"unchanged" if old == new else "new" if old is None else "CHANGED (see git diff)"}')

# ------------------------------------------------------------------ TV-19 byte-identical rerun
if not args.no_rerun:
    with tempfile.TemporaryDirectory() as tmp:
        r = subprocess.run([sys.executable, '-I', str(GEN), '--out', tmp], capture_output=True, text=True)
        names = [f'{n}.parquet' for n in CONTRACT] + ['manifest.json']
        same = r.returncode == 0 and all(filecmp.cmp(PQ / n_, Path(tmp) / 'parquet' / n_, shallow=False) for n_ in names)
        check(f'TV-19 rerun of generator/generate.py (seed {man["seed"]}) is byte-identical ({len(names)} files)', same,
              r.stderr[-400:])

print(f'{"ALL CHECKS GREEN" if not fails else f"{len(fails)} CHECK(S) FAILED"}  ({time.time() - t0:.0f} s)')
sys.exit(1 if fails else 0)
