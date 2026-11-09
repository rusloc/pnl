"""ACME Trucks synthetic twin: deterministic data generator (seed 20261104).

Writes  <out>/parquet/<file>.parquet (the 14 files the Trucks PBIP reads from its DataFolder, same file names, column
names and Arrow types as the live extract) + <out>/parquet/manifest.json.
Usage:  python generate.py [--out <dataset folder>]      (default: the folder above generator/)

Every row is synthetic. Code domains the model's DAX and slicers switch on (branch names, loader dispatch names, idle and
indicator codes, plan types, inclusion flag, contractor flag, interval group codes) are kept, so the model works unchanged.
Fact time, plan hours and volumes are simulated per loader-day and then scaled by a few global factors so that the tested
grain (week "10 (4.3-10.3)" · Month plan · Weighted · Trucks + On spot) lands on the targets in KPI_TARGETS.
The data contract is ../README.md. checks/verify.py recomputes everything from the files with its own code.
"""
import argparse, hashlib, json, re, sys, time
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

SEED = 20261104
GENERATOR_VERSION = '1.0.0'

CAL_START, CAL_END = pd.Timestamp('2022-10-29'), pd.Timestamp('2023-04-02')     # Calendar span (= live extract)
CUR_PERIOD_LAST = pd.Timestamp('2023-03-27')                                    # curPeriod = "текущий период" up to here
FACT_START, FACT_END = pd.Timestamp('2022-11-01'), pd.Timestamp('2023-03-26')   # ПФ КРВ, КРВ АС, ПФ Отчет о рейсах
WPLAN_START, WPLAN_END = pd.Timestamp('2022-11-01'), pd.Timestamp('2023-03-31')  # План_2 (week plan)
MPLAN_START, MPLAN_END = pd.Timestamp('2023-01-01'), pd.Timestamp('2023-03-31')  # План_2_МЕС (month plan)
VOL_START, VOL_END = pd.Timestamp('2022-10-29'), pd.Timestamp('2023-03-31')      # ПФ объемы
S1_START, S1_END = pd.Timestamp('2023-03-04'), pd.Timestamp('2023-03-10')        # tested grain: business week 10 (Sat-Fri)

# Tested grain targets (week 10 · Month · Weighted · Trucks + On spot). Shares are fractions, volumes thousand m3.
# Close to the live extract's magnitudes (plan / fact: 42.9 / 45.3 %, 53.7 / 51.6 %, 847 / 762 m3/h, 7,156 / 7,029),
# deliberately not equal to them. Performance per truck is not pinned: it follows from mass and truck-loading hours.
KPI_TARGETS = {
    'truck_loading_plan': 0.4300, 'truck_loading_fact': 0.4500,
    'effective_work_plan': 0.5400, 'effective_work_fact': 0.5150,
    'mass_plan': 7300.0, 'mass_fact': 7100.0,
}
COAL_DENSITY = 1.38       # t per m3: Объем добычи (thousand t) = Добыча (thousand m3) x 1.38

# ------------------------------------------------------------------ code domains (kept from the source model)
# Branches: Филиал (dim_loader.office_name switches on it) -> enterprise_id, long and short names
BRANCHES = [  # (enterprise_id, Филиал, long name, short name, loader count)
    (1, 'Кедровский', 'Кедровский угольный разрез', 'Кедровский УР', 18),
    (2, 'Моховский', 'Моховский угольный разрез', 'Моховский УР', 36),
    (3, 'Бачатский', 'Бачатский угольный разрез', 'Бачатский УР', 23),
    (4, 'Краснобродский', 'Краснобродский угольный разрез', 'Краснобродский УР', 39),
    (5, 'Талдинский', 'Талдинский угольный разрез', 'Талдинский УР', 34),
    (6, 'Калтанский', 'Калтанский угольный разрез', 'Калтанский УР', 18),
]
AREAS = [  # (_area, enterprise_id)
    ('Кедровское', 1), ('Караканское', 2), ('Моховское', 2), ('Сартакинское', 2), ('Бачатское', 3), ('Вахрушевское', 4),
    ('Краснобродское', 4), ('Новосергеевское', 4), ('Ерунаковское', 5), ('Таёжное', 5), ('Талдинское', 5),
    ('Калтанское', 6), ('Осинниковское', 6),
]
FIELDS = [  # (block, area); _field_id = block-area
    ('1', 'Вахрушевское'), ('1', 'Ерунаковское'), ('1', 'Калтанское'), ('1', 'Кедровское'), ('1', 'Моховское'),
    ('1', 'Таёжное'), ('1', 'Талдинское'), ('2', 'Кедровское'), ('2', 'Осинниковское'), ('2', 'Сартакинское'),
    ('2', 'Таёжное'), ('2', 'Талдинское'), ('3', 'Краснобродское'), ('3', 'Талдинское'), ('4', 'Новосергеевское'),
    ('5', 'Сартакинское'), ('ГУ №12', 'Бачатское'), ('ГУ №1-9', 'Бачатское'), ('Дунаевский', 'Караканское'),
    ('Еловский', 'Моховское'), ('Караканский', 'Караканское'),
]

# Loader dispatch names (dim_loader.loader_name switches on them; every synthetic loader carries one of these)
DISPATCH_NAMES = [
    "ЭКГ-12 №09", "ЭКГ-12 №12", "ЭКГ-15 №49", "ЭКГ-18М №02", "ЭКГ-18 №21", "ЭКГ-35 №02", "Р&Н-2800 №28152",
    "Р&Н-2800 №ES 28195", "LIEBHERR R9200 №40044", "КОМАТSU РС 1250SР-7 №30688", "EX 3600 №001393", "ЭШ-10/70 №62",
    "R-984С №18281", "ЭШ-10/70 №449", "ЭКГ-8у№7", "ЭКГ-10№9", "ЭКГ-18 №29", "HITACHI ЕХ1200-7 №7265", "ЭШ-10/70 №28",
    "ЭШ-10/70 №381", "ЭШ-11/70 №7", "ЭКГ-10№90", "ЭКГ-10№140", "ЭКГ-11№14", "КОМАТSU РС 1250SР-7 №20761",
    "Hitachi EX-1200 №7268", "САТ-390 №10057", "ЭКГ-15 №401", "Р&Н-2800 №28149", "Р&Н-2800 №28155", "CAT-395 №00293",
    "Р&Н-4100ХРС №41214", "ЭКГ-18М №03", "ЭКГ-18М №04", "НIТАСНI ЕХ-1200-6 (ВЕ) №1249", "LIEBHERR R9100 №36098", "ЭШ-11/70 №15",
    "ЭШ13/50 №37", "WК-35  №08010802", "ЭКГ-15 №55", "WК-35  №08018908", "WК-35  №08011802А", "ЭКГ-18 №05", "ЭКГ-18М №01",
    "HITACHI ЕХ1900-6ВН №HCM18K00A00001281", "LIEBHERR R9250 №192", "ЭКГ-35 №01", "ЭКГ-32Р №01", "ЭШ-11/70 №53",
    "ЭШ13/50 №21/56", "ЭШ13/50 №12/28", "САТ-390 №GAY10082", "Р&Н-2800 №28190", "ЭКГ-35 №03", "WК-35  №08011801", "ЭКГ-32Р №02",
    "WK-20 №08017902", "ЭКГ-15 №03", "ЭКГ-18 №01", "ЭКГ-12 №10", "ЭШ13/50 №55", "HITACHI ЕХ1200-7 №7152", "САТ-390 №GAY20145",
    "CAT-395 №САТ00395JSGD00295", "ЭКГ-18Р №04", "ЭКГ-10 №4", "ЭКГ-10 №139", "ЭШ-11/70 №46", "ЭКГ-10 №132",
    "LIEBHERR R9100 №36092", "WК-35  №08011800", "R-9350 №17250", "EX 3600 №1307", "ЭКГ-18Р №02", "WК-35  №08018904",
    "Р&Н-2800 №194", "EX 3600 №1323", "ЭКГ-18 №27", "WК-35  №08011802В", "Р&Н-4100ХРС №184", "EX 3600 №1343", "ЭКГ-18Р №01",
    "ЭКГ-18 №23", "HITACHI ЕХ1900-6ВН №1320", "ЭШ13/50 №04", "HITACHI ЕХ1900-6ВН №1289", "ЭКГ-18 №00014", "R-984С №15534",
    "ЭКГ-10 №111", "ЭКГ-18Р №5_", "ЭКГ-10 №294", "ЭКГ-10 №353", "ЭКГ-12 №11", "ЭКГ-18 №№7", "ЭКГ-18 №20", "ЭКГ-18 №32",
    "LIEBHERR R9100 №WLHZ1132PZE036050", "HITACHI ЕХ1200-7 №HCMKAA9060007156", "ЭКГ-10 №5", "ЭКГ-10 №72", "ЭКГ-10 №293",
    "ЭКГ-10 №300", "ЭКГ-18Р №№3", "ЭКГ-18М №___5", "HITACHI ЕХ1200-6ВН №HCM18J00L00001826",
    "HITACHI ЕХ1900-6ВН №HCM18K00J00001342", "HITACHI ЕХ1200-6ВН №25", "HITACHI ЕХ1200-7 №7262",
    "LIEBHERR R9250 №WLHZ0437LZE041192", "HITACHI ЕХ1900-6ВН №001343", "HITACHI EX 1200-7 №7261", "EX 2600-7 BE №7058",
    "KOMATSU PС 2000-8 №20535", "CAT-395 №00259", "ЭШ-10/70 №24", "ЭШ-10/70 №419", "ЭШ-10/70 №23", "ЭШ-10/70 №332",
    "ЭШ-11/70 №48", "ЭШ-11/70 №16", "R-984С №18280", "ЭКГ-10 №303", "HITACHI EX-1200-5DBH №HCM18F00A00003121",
    "CAT-395 №00395TSGD00342", "ЭШ-10/70 №299", "ЭШ 15/90 №139", "ЭШ-20/90 №20", "ЭШ-20/90 №14", "ЭКГ-12 №13", "ЭШ-10/70 №430",
    "ЭШ-11/70 №13\\13", "ЭШ-11/70 №17", "ЭКГ-15 №38", "ЭКГ-10 №159", "CAT-395 №00395TSGD0042", "CAT-395 №10090",
    "CAT-395 №САТ00395НSGD10090", "CAT-395 №САТ042", "EX 3600 №1391", "EX 3600 №HCM18M00L00001391", "Hitachi EX 1200 №2781",
    "Hitachi EX-1200 №7265", "Hitachi EX-1200 №7282", "HITACHI ЕХ1200-7 №7268", "HITACHI ЕХ1200-7 №7281",
    "HITACHI ЕХ1200-7 №7282", "HITACHI ЕХ1900-6ВН №1339", "HITACHI ЕХ1900-6ВН №1346", "ПОГРУЗЧИК CAT 992 №3",
    "ПОГРУЗЧИК CAT 992К №200170", "ПОГРУЗЧИК CAT 992К №CAT0992KCRM500184", "ПОГРУЗЧИК WА-700-3 №51084",
    "ПОГРУЗЧИК WА-900-3 №50098", "ПОГРУЗЧИК WА-900-3 №50115", "ПОГРУЗЧИК САТ-992 №200170", "ЭКГ-10 №09", "ЭКГ-10 №10",
    "ЭКГ-10 №140", "ЭКГ-10 №90", "ЭКГ-12 №14", "ЭКГ-8У №100", "ЭКГ-8У №2", "ЭШ 10/70 № 175", "ЭШ-11/70 №16/16", "ЭШ-11/70 №7/7",
    "ЭКГ-10 №67", "ЭКГ-10 №328", "ЭКГ-15 №43",
]
# Bucket volume (m3) by model family, first match wins
BUCKET_RULES = [
    (r'ПОГРУЗЧИК.*992', 11), (r'ПОГРУЗЧИК.*700', 7), (r'ПОГРУЗЧИК.*900', 13),
    (r'ЭКГ.?-?\s*8', 8), (r'ЭКГ-?\s*(\d+)', None), (r'ЭШ\s*-?\s*(\d+)/', None),
    (r'Р&Н-4100', 56), (r'Р&Н-2800', 33), (r'W[КK]-35', 35), (r'W[КK]-20', 20),
    (r'R9100', 7), (r'R9200', 13), (r'R9250', 15), (r'R-9350', 18), (r'R-984', 7),
    (r'(?i)(EX|ЕХ)\s*-?\s*1200', 7), (r'(?i)(EX|ЕХ)\s*-?\s*1900', 12), (r'EX 2600', 17), (r'EX 3600', 22),
    (r'(?i)1250', 7), (r'2000-8', 12), (r'(?i)(САТ|CAT)-39', 4),
]

# Loader roles: (role, count, Комментарий, Учитывать, Подрядчик, interval group, has facts, week plan, month plan)
ROLES = [
    ('truck', 103, 'автосхема', 'да', None, 2, True, True, True),
    ('truck_nocomment', 9, None, 'да', None, 2, True, True, True),
    ('truck_repair', 2, 'КР', 'да', None, 2, True, True, True),
    ('truck_noparts', 1, 'отс. з/част.', 'да', None, 2, True, True, True),
    ('onspot_bt', 5, 'бестранспортная', 'да', None, 1, True, True, True),
    ('onspot_rehandle', 5, 'перевалка', 'да', None, 1, True, True, True),
    ('onspot_rail', 4, 'ЖД схема', 'да', None, 1, True, True, False),
    ('contractor_undefined', 1, 'автосхема', 'да', 'да', None, True, True, False),
    ('truck_no_interval', 2, 'автосхема', 'да', None, None, False, False, False),
    ('truck_excluded', 3, 'автосхема', 'нет', None, 2, True, False, False),
    ('truck_excluded_idle', 3, 'автосхема', 'нет', None, None, False, False, False),
    ('onspot_excluded', 1, 'перевалка', 'нет', None, 1, False, False, False),
    ('contract', 2, 'подряд', 'нет', None, None, False, False, False),
    ('write_off', 5, 'списание', 'нет', None, None, False, False, False),
    ('legacy', 20, None, 'нет', None, None, False, False, False),
    ('legacy_contractor', 2, None, 'да', 'да', None, False, False, False),
]
ONSPOT_ROLES = {'onspot_bt', 'onspot_rehandle', 'onspot_rail', 'onspot_excluded'}

# Fact idle codes in ПФ КРВ (idle_name_for_op, as the model's bridge reads them)
F_REPAIR = ['ТО, ППР', 'КР', 'Авар. Прост.', 'Ожид з/ч']          # КТГ = КФВ minus these
F_PARTIAL = [  # (code, presence per normal loader-day, mean seconds when present)
    ('Авар. Прост.', 0.37, 13000), ('Без классификации', 0.72, 3900), ('Взрывные работы', 0.15, 6800),
    ('Заправка', 0.23, 1500), ('Личные нужды', 0.24, 950), ('Обед', 0.79, 2900), ('Ожидание а/с', 0.76, 9000),
    ('Перегоны', 0.42, 6000), ('Пересменка', 0.89, 4100), ('Прочие простои', 0.75, 10200), ('ТО, ППР', 0.12, 26000),
    ('Консервация/резерв', 0.012, 30000),
]
F_SPELLS = [  # full-day states: (code, entry probability per day, min days, max days)
    ('КР', 0.0036, 8, 40), ('Ожид з/ч', 0.0018, 3, 15), ('Консервация/резерв', 0.0012, 5, 25),
    ('ТО, ППР', 0.02, 1, 1), ('Авар. Прост.', 0.012, 1, 2),
]
F_WORK = ['Основная работа', 'Вспомогательная работа', 'Погрузка самосвалов']

# Plan indicators (week plan sort code; None = no Сортировка)
P_TIME_SORT = {
    'ТО, ППР': '1', 'КР': '2', 'Авар. прост.': '3', 'Ожид з/ч': '4', 'Пересменок': '6', 'Обед': '7', 'Личные нужды': '8',
    'Заправка': '9', 'Взрывные работы': '10', 'Перегоны': '11', 'Переключение': '12', 'Ожидание АС': '13',
    'Консервация/Резерв': '14', 'Отсутствие экипажа': '15', 'Работа на другом поле': '16', 'Прочие простои': '20',
    'КИО': '23', 'Вспомогательная работа': '24', 'Основная работа': '25', 'Погрузка самосвалов': '26',
    'Орошение забоя': None,
}
P_FIXED = [('Пересменок', [1.0, 1.2, 1.33]), ('Обед', [0.5, 1.0]), ('Личные нужды', [0.25, 0.5])]
P_SCALABLE = [  # (indicator, presence per loader-period, low, high, on-spot allowed)
    ('Авар. прост.', 0.85, 0.5, 2.0, True), ('Ожидание АС', 0.90, 0.8, 3.0, False),
    ('Прочие простои', 0.50, 0.5, 2.5, True), ('Перегоны', 0.30, 0.5, 3.0, True),
    ('Взрывные работы', 0.18, 1.0, 3.0, True), ('Заправка', 0.27, 0.3, 0.5, True),
    ('Переключение', 0.14, 0.5, 1.5, True), ('Орошение забоя', 0.02, 1.0, 3.0, False),
]
P_EVENTS = [  # full-day plan events, one calendar per loader shared by both plans:
    # (indicator, start probability per day, min days, max days)
    ('КР', 0.0048, 7, 31), ('Ожид з/ч', 0.0012, 5, 20), ('Консервация/Резерв', 0.0029, 5, 20),
    ('Работа на другом поле', 0.0005, 2, 6), ('Отсутствие экипажа', 0.0014, 2, 8),
]
MEASURE = {
    'Проверка': 'Проверка', 'Проверка КТГ': 'Проверка КТГ', 'КИО': 'ч', 'КТГ план': '%', 'КИО без ожид. АС': '%',
    'Орг. простои план': 'ч.', 'ТО, ППР и КР': 'ч.',
    'Объем ГМ план': 'тыс. м3', 'Объем ГМ на авто план': 'тыс. м3', 'Вскрыша авто': 'тыс. м3', 'Навалы авто': 'тыс. м3',
    'ПГР авто': 'тыс. м3', 'Добыча': 'тыс. м3', 'Вскрыша б/т': 'тыс. м3', 'ПГР': 'тыс. м3', 'Переэкскавация': 'тыс. м3',
    'Объем добычи план': 'тыс. т', 'Объемный вес': 'т/м3', 'Плечо план': 'км', 'Плечо порода': 'км', 'Плечо добыча': 'км',
    'Техническая скорость план пород.': 'км/ч', 'Техническая скорость план углев.': 'км/ч',
    'Час. пр-ть ед. АС пород.': 'км/ч', 'Час. пр-ть ед. АС углев.': 'км/ч', 'Производительность': 'м3/ч',
    'Грузооборот': 'тыс. ткм', 'АС: Кол-во МС породов.': 'МС', 'АС: Кол-во МС углев.': 'МС',
}
for _k in P_TIME_SORT:
    MEASURE.setdefault(_k, 'ч.')

# Haul trucks (КРВ АС): model names and weights, idle codes
TRUCK_MODELS = [
    ('БелАЗ-75306', 324), ('БелАЗ-75306НБ', 130), ('БелАЗ-75131', 113), ('БелАЗ-75138', 83), ('БЕЛАЗ-75131-04', 26),
    ('БелАЗ-75605', 15), ('БЕЛАЗ-7555D', 11), ('БелАЗ-7555Д', 7), ('БелАЗ-75603', 7), ('БЕЛАЗ-75583', 7),
    ('БелАЗ-75320', 4), ('БелАЗ-7547', 4), ('БелАЗ-75131НБ', 4), ('БелАЗ-75131ув', 3), ('БелАЗ-7513D', 3),
    ('БелАЗ-7513Dув', 2), ('БЕЛАЗ-7555B', 1), ('БелАЗ-7555В', 1), ('БелАЗ-75600', 1), ('БелАЗ-75473', 1),
]
TRUCKS_PER_ENTERPRISE = {1: 77, 2: 43, 3: 159, 4: 152, 5: 126, 6: 64}
T_LOSS = [  # (code, presence per normal truck-day, mean seconds)
    ('Пересменка', 0.99, 3900), ('Обед', 0.78, 2700), ('Заправка', 0.85, 1750), ('Без классификации', 0.97, 13800),
    ('Прочие простои', 0.86, 8400), ('Авар. Прост.', 0.38, 22000), ('ТО, ППР', 0.25, 8700),
    ('Ожидание погрузки', 0.85, 8600), ('Личные нужды', 0.11, 630), ('Взрывные работы', 0.12, 2800),
    ('Консервация/резерв', 0.07, 24000),
]
T_WORK = [('Движение груженым', 0.43), ('Движение порожним', 0.36), ('Погрузка', 0.15), ('Разгрузка', 0.06)]

# ------------------------------------------------------------------ output schemas (= live extract, checked by verify)
S, I64, F64, TS, B = pa.string(), pa.int64(), pa.float64(), pa.timestamp('us'), pa.bool_()
V_PLAN_FACT = ['Объем добычи план', 'Объем добычи факт', 'Объем ГМ план', 'Объем ГМ факт', 'Объем ГМ на авто план',
               'Объем ГМ на авто факт', 'Добыча план', 'Вскрыша авто план', 'Вскрыша авто факт', 'Навалы авто план',
               'Навалы авто факт', 'ПГР авто план', 'ПГР авто факт', 'Вскрыша б/т план', 'Вскрыша б/т факт',
               'Переэкскавация план', 'Переэкскавация факт', 'ПГР план', 'ПГР факт']
V_MONTH = ['Объем добычи план месяц', 'Объем ГМ план месяц', 'Объем ГМ на авто план месяц', 'Добыча план месяц',
           'Вскрыша авто план месяц', 'Навалы авто план месяц', 'ПГР авто план месяц', 'Вскрыша б/т план месяц',
           'Переэкскавация план месяц', 'ПГР план месяц']
SCHEMAS = {
    'AREA_DIM': [('_area', S), ('enterprise_id', I64)],
    'Calendar': [('_weekStartBiz', TS), ('_weekEndBiz', TS), ('_weekNumBiz', I64), ('Date', TS), ('Год', I64),
                 ('Месяц', I64), ('Число', I64), ('День недели', S), ('Номер дня недели', I64), ('Номер недели', I64),
                 ('День_Месяц', S), ('Начало_недели', TS), ('Конец_недели', TS), ('Номер_диапазон', S),
                 ('curPeriod', S), ('_weekDayNum', I64), ('_dateSpanBiz', S), ('_sortSpan', I64), ('_dateBiz', S)],
    'FIELD_DIM': [('_field_id', S), ('dir_for_plan', S), ('enterprise_name', S), ('enterprise_id', I64), ('area', S),
                  ('block', S)],
    'OFFICE_DIM': [('_id', I64), ('_longName', S), ('_shortName', S)],
    'intervals': [('interval_id', I64), ('vehicle_export_code', I64), ('vehicle_group_code', I64), ('reserve_l', B),
                  ('start_dat', TS), ('end_dat', TS)],
    'Интервалы': [('interval_pf_id', I64), ('vehicle_export_code', I64), ('vehicle_group_code', I64), ('start_dat', TS),
                  ('end_dat', TS), ('suser_name', S), ('modi_date', TS), ('area', S), ('block', S)],
    'КРВ АС': [('enterprise_id', I64), ('dat', TS), ('vehicle_export_code', I64), ('vehicle_name', S),
               ('idle_name_for_op', S), ('duration', I64), ('kfv', I64), ('ktg', F64), ('kio', F64), ('kio_adv', F64),
               ('vehicle_model_name', S)],
    'ПФ КРВ': [('vehicle_export_code', I64), ('vehicle_name', S), ('dat', TS), ('idle_name_for_op', S), ('duration', F64),
               ('ent_id', I64), ('_active', I64), ('area', S), ('block', S), ('_id', S)],
    'ПФ Отчет о рейсах': [('Дата', TS), ('Экскаватор', S), ('Разрез', S), ('Грузооборот факт', F64),
                          ('Техническая скорость', F64), ('Машиносмены', F64), ('Плечо_добыча', F64),
                          ('Плечо_Ва_На', F64), ('Экспортный код', I64), ('Машиносмены_исходные', F64)],
    'ПФ объемы': ([('Дата', TS), ('Разрез', S), ('КФВ', I64)] + [(c, F64) for c in V_PLAN_FACT]
                 + [('Экспортный код', I64)] + [(c, F64) for c in V_MONTH]),
    'План_2': [('enterprise_id', I64), ('dat', TS), ('vehicle_export_code', I64), ('vehicle_name', S),
               ('indicator_name', S), ('measure_name', S), ('indicator_amount', F64), ('Сортировка', S),
               ('_active', I64), ('area', S), ('block', S), ('_id', S)],
    'План_2_МЕС': [('enterprise_id', I64), ('dat', TS), ('vehicle_export_code', I64), ('vehicle_name', S),
                   ('indicator_name', S), ('measure_name', S), ('indicator_amount', F64), ('period_id', I64),
                   ('_active', I64), ('area', S), ('block', S), ('_id', S)],
    'Справочник ЭКС': [('Филиал', S), ('Название ЭКС в АСД КРВ', S), ('Название ЭКС в ГД', S), ('objrem_id', I64),
                       ('name', S), ('номер', S), ('Комментарий', S), ('Объем ковша', I64), ('Учитывать', S),
                       ('Название ЭКС в АСД Рейсы', S), ('Поле', S), ('Подрядчик', S)],
    'Справочник разрезов': [('enterprise_id', I64), ('enterprise_name_short', S)],
}
WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
MONTHS = {1: 'янв', 2: 'фев', 3: 'мар', 4: 'апр', 5: 'май', 6: 'июн', 7: 'июл', 8: 'авг', 9: 'сен', 10: 'окт',
          11: 'ноя', 12: 'дек'}
EXCEL_EPOCH = pd.Timestamp('1899-12-30')


def td_days(n):
    return pd.Timedelta(int(n), unit="D")


def rng_for(*key):
    """One independent random stream per component, so a change in one part leaves the others' draws as they were."""
    return np.random.default_rng([SEED, *key])


def unique_ints(rng, n, lo, hi, taken=()):
    out, seen = [], set(taken)
    while len(out) < n:
        for v in rng.integers(lo, hi, size=2 * n):
            v = int(v)
            if v not in seen:
                seen.add(v)
                out.append(v)
                if len(out) == n:
                    break
    return out


# ------------------------------------------------------------------ calendar
def biz_week(d):
    """Business week Saturday-Friday, numbered within the year of its Friday (week 1 ends on the first Friday)."""
    start = d - td_days((d.weekday() - 5) % 7)
    end = start + td_days(6)
    jan1 = pd.Timestamp(year=end.year, month=1, day=1)
    first_fri = jan1 + td_days((4 - jan1.weekday()) % 7)
    return start, end, (end - first_fri).days // 7 + 1


def build_calendar():
    rows = []
    for d in pd.date_range(CAL_START, CAL_END):
        bs, be, bn = biz_week(d)
        jan1 = pd.Timestamp(year=d.year, month=1, day=1)
        wn = (d.dayofyear - 1 + jan1.weekday()) // 7 + 1          # Excel WEEKNUM(d, 2): Monday start
        ws = d - td_days(d.weekday())
        we = ws + td_days(6)
        rows.append({
            '_weekStartBiz': bs, '_weekEndBiz': be, '_weekNumBiz': bn, 'Date': d, 'Год': d.year, 'Месяц': d.month,
            'Число': d.day, 'День недели': WEEKDAYS[d.weekday()], 'Номер дня недели': d.weekday() + 1,
            'Номер недели': wn, 'День_Месяц': f'{d.day}-{MONTHS[d.month]}', 'Начало_недели': ws, 'Конец_недели': we,
            'Номер_диапазон': f'{wn} ({ws.day}.{ws.month}-{we.day}.{we.month})',
            'curPeriod': 'текущий период' if d <= CUR_PERIOD_LAST else None,
            '_weekDayNum': (d.weekday() - 5) % 7 + 1, '_dateSpanBiz': f'{bn} ({bs.day}.{bs.month}-{be.day}.{be.month})',
            '_sortSpan': (bs - EXCEL_EPOCH).days, '_dateBiz': f'{WD_SHORT[d.weekday()]}-{d:%d.%m.%y}',
        })
    return pd.DataFrame(rows)


# ------------------------------------------------------------------ reference dims
def build_reference():
    ent = {b[0]: b for b in BRANCHES}
    area_ent = dict(AREAS)
    office = pd.DataFrame({'_id': [b[0] for b in BRANCHES], '_longName': [b[2] for b in BRANCHES],
                           '_shortName': [b[3] for b in BRANCHES]})
    mines = pd.DataFrame({'enterprise_id': [b[0] for b in BRANCHES] + [999],
                          'enterprise_name_short': [b[1] for b in BRANCHES] + ['КРУ']})
    areas = pd.DataFrame({'_area': [a for a, _ in AREAS], 'enterprise_id': [e for _, e in AREAS]})
    fields = pd.DataFrame([{
        '_field_id': f'{blk}-{area}', 'dir_for_plan': f'{area_ent[area]}. {ent[area_ent[area]][3]}',
        'enterprise_name': ent[area_ent[area]][2], 'enterprise_id': area_ent[area], 'area': area, 'block': blk,
    } for blk, area in FIELDS])
    return office, mines, areas, fields


# ------------------------------------------------------------------ loaders (Справочник ЭКС)
def bucket_for(name):
    for pat, vol in BUCKET_RULES:
        m = re.search(pat, name)
        if m:
            return int(m.group(1)) if vol is None else vol
    return 10


def split_name(name):
    fam, _, num = name.partition('№')
    fam, num = fam.strip(), num.strip().lstrip('0') or '0'
    return fam, num


def build_loaders(fields):
    rng = rng_for(1)
    names = list(DISPATCH_NAMES)
    order = rng.permutation(len(names))
    pool = [names[i] for i in order]
    drag = [n for n in pool if n.startswith('ЭШ')]
    wheel = [n for n in pool if n.startswith('ПОГРУЗЧИК')]
    ekg_small = [n for n in pool if re.match(r'ЭКГ-?\s*(8|10)', n)]
    taken = set()

    def take(prefer):
        for n in prefer + pool:
            if n not in taken:
                taken.add(n)
                return n

    assign = []
    for role, cnt, *_ in ROLES:
        prefer = {'onspot_bt': drag, 'onspot_rehandle': drag, 'onspot_excluded': drag, 'onspot_rail': ekg_small,
                  'legacy': wheel}.get(role, [])
        for _ in range(cnt):
            assign.append((role, take(prefer)))
    assert len(assign) == len(names) == len(taken)
    branch_list = np.repeat([b[1] for b in BRANCHES], [b[4] for b in BRANCHES])
    branch_list = branch_list[rng.permutation(len(branch_list))]
    ent_of = {b[1]: b[0] for b in BRANCHES}
    area_ent = dict(AREAS)
    ids = unique_ints(rng, len(assign), 1_000, 24_000_000)
    role_of = {r[0]: r for r in ROLES}
    krv_seen, trip_seen, rows, legacy_no = set(), set(), [], 0
    for k, (role, disp) in enumerate(assign):
        _, _, comment, incl, contr, group, facts, wplan, mplan = role_of[role]
        branch = str(branch_list[k])
        ent = ent_of[branch]
        cand = [f for f in fields.to_dict('records') if area_ent[f['area']] == ent]
        fld = cand[int(rng.integers(len(cand)))]
        fam, num = split_name(disp)
        legacy = role in ('legacy', 'legacy_contractor')
        vol = bucket_for(disp)
        if legacy and rng.random() < 0.75:
            vol = 0
        if legacy:
            legacy_no += 1
            krv, trip, name, nomer = str(legacy_no), str(legacy_no + 15), None, None
        else:
            krv, trip, name, nomer = f'{fam} ({num})', f'{fam} №{num}', fam, num
        while krv in krv_seen:
            krv += '_1'
        while trip in trip_seen:
            trip += ' (2)'
        krv_seen.add(krv)
        trip_seen.add(trip)
        rows.append({
            'Филиал': branch, 'Название ЭКС в АСД КРВ': krv, 'Название ЭКС в ГД': disp, 'objrem_id': ids[k],
            'name': name, 'номер': nomer, 'Комментарий': comment, 'Объем ковша': vol, 'Учитывать': incl,
            'Название ЭКС в АСД Рейсы': trip, 'Поле': fld['area'] if incl == 'да' and not legacy else 'na',
            'Подрядчик': contr,
            # generator-only attributes (not written)
            'x_role': role, 'x_group': group, 'x_facts': facts, 'x_wplan': wplan, 'x_mplan': mplan, 'x_ent': ent,
            'x_area': fld['area'], 'x_block': fld['block'], 'x_field': fld['_field_id'],
        })
    return pd.DataFrame(rows)


# ------------------------------------------------------------------ fact time per loader-day (ПФ КРВ)
def loader_windows(L, rng):
    """Activity window per fleet loader: most cover the whole fact span, about 12 % start late or stop early."""
    n_days = (FACT_END - FACT_START).days + 1
    win = {}
    for r in L[L.x_facts].itertuples():
        a, b = 0, n_days - 1
        u = rng.random()
        if u < 0.06:
            a = int(rng.integers(10, 110))
        elif u < 0.12:
            b = int(rng.integers(30, 120))
        win[r.objrem_id] = (a, b)
    return win


def simulate_fact(L, win):
    """Raw (uncalibrated) components per loader-day: total time, full-day state, partial losses, aux propensity."""
    rng = rng_for(2)
    days = pd.date_range(FACT_START, FACT_END)
    n_days = len(days)
    week_of = {d: biz_week(d)[0] for d in days}
    weeks = sorted(set(week_of.values()))
    widx = np.array([weeks.index(week_of[d]) for d in days])
    fleet = L[L.x_facts].reset_index(drop=True)
    n = len(fleet)
    ents = sorted({b[0] for b in BRANCHES})
    week_eff = {e: np.exp(rng.normal(0, 0.10, len(weeks))) for e in ents}
    kfv = np.full((n, n_days), 86400.0)
    u = rng.random((n, n_days))
    kfv[u < 0.011] = 86400 - rng.integers(1, 14, size=int((u < 0.011).sum()))
    kfv[u < 0.001] = 43200
    burn = 60                                             # spells run in from 60 days before the span starts
    state = np.full((n, n_days + burn), '', dtype=object)
    for i in range(n):
        d = 0
        while d < n_days + burn:
            hit = None
            for code, p, lo, hi in F_SPELLS:
                if rng.random() < p:
                    hit = (code, int(rng.integers(lo, hi + 1)))
                    break
            if hit:
                state[i, d:d + hit[1]] = hit[0]
                d += hit[1]
            else:
                d += 1
    state = state[:, burn:]
    pres = np.stack([rng.random((n, n_days)) < p for _, p, _ in F_PARTIAL], axis=2)
    sig = 0.6
    dur = np.stack([m * np.exp(rng.normal(-sig * sig / 2, sig, (n, n_days))) for _, _, m in F_PARTIAL], axis=2)
    loader_eff = np.exp(rng.normal(0, 0.15, n))
    ent = fleet.x_ent.to_numpy()
    wf = np.stack([week_eff[e][widx] for e in ent])
    B = np.where(pres, np.minimum(dur, 0.5 * kfv[..., None]), 0.0) * (loader_eff[:, None] * wf)[..., None]
    tot = B.sum(axis=2)
    cap = 0.6 * kfv
    B = np.where((tot > cap)[..., None], B * (cap / np.maximum(tot, 1))[..., None], B)
    full = state != ''
    B[full] = 0.0
    beta = (rng.gamma(4.0, 0.25, (n, n_days)) * np.exp(rng.normal(0, 0.3, n))[:, None]
            * (rng.random((n, n_days)) < 0.70))           # aux work on about 70 % of loader-days
    mu = np.where(fleet.x_role.isin(ONSPOT_ROLES), 1.0, rng.beta(2, 5, n) * (rng.random(n) < 0.8))
    in_win = np.zeros((n, n_days), bool)
    for i, r in enumerate(fleet.itertuples()):
        a, b = win[r.objrem_id]
        in_win[i, a:b + 1] = True
    return dict(fleet=fleet, days=days, kfv=kfv, state=state, B=B, beta=beta, mu=mu, in_win=in_win)


def in_scope(df):
    return (df['Учитывать'] == 'да') & df['Подрядчик'].isna() & df.x_group.isin([1, 2])


def calibrate_fact(sim):
    """Solve the loss factor k and aux factor a so that week 10 (Weighted, in scope) hits the fact targets."""
    fl, days = sim['fleet'], sim['days']
    m = in_scope(fl).to_numpy()
    dsel = (days >= S1_START) & (days <= S1_END)
    act = sim['in_win'][:, dsel].any(axis=1) & m
    w = fl['Объем ковша'].to_numpy().astype(float) * act
    T = (sim['kfv'] * sim['in_win'])[:, dsel].sum(axis=1)
    full = (sim['state'] != '') & sim['in_win']
    F = (sim['kfv'] * full)[:, dsel].sum(axis=1)
    Bs = (sim['B'].sum(axis=2) * sim['in_win'])[:, dsel].sum(axis=1)
    sw = w.sum()
    Tn = np.where(T > 0, T, 1)
    k = ((1 - KPI_TARGETS['effective_work_fact']) * sw - (w * F / Tn).sum()) / (w * Bs / Tn).sum()
    assert 0.6 < k < 1.6, f'fact loss factor out of range: {k}'
    L = sim['B'].sum(axis=2) * k
    W = np.where(full, 0.0, sim['kfv'] - L)
    ew = 1 - (w * (F + (L * sim['in_win'])[:, dsel].sum(axis=1)) / Tn).sum() / sw
    X = (sim['beta'] * W * sim['in_win'])[:, dsel].sum(axis=1)
    a = (ew - KPI_TARGETS['truck_loading_fact']) * sw / (w * X / Tn).sum()
    assert 0.02 < a < 0.6, f'fact aux factor out of range: {a}'
    return k, a


def fact_rows(sim, k, a):
    """Integer seconds per category; categories sum exactly to КФВ; КТГ / КИО / kio_adv rows derived."""
    fl, days, kfv, state = sim['fleet'], sim['days'], sim['kfv'], sim['state']
    codes = [c for c, _, _ in F_PARTIAL]
    out, comp = [], {}
    n, n_days = kfv.shape
    for i in range(n):
        r = fl.iloc[i]
        for d in range(n_days):
            if not sim['in_win'][i, d]:
                continue
            T = int(kfv[i, d])
            cats = {}
            if state[i, d]:
                cats[state[i, d]] = T
                work = 0
            else:
                for j, c in enumerate(codes):
                    v = int(round(sim['B'][i, d, j] * k))
                    if v > 0:
                        cats[c] = cats.get(c, 0) + v
                work = T - sum(cats.values())
                aux = min(int(round(a * sim['beta'][i, d] * work)), int(0.8 * work))
                main = int(round(sim['mu'][i] * (work - aux)))
                load = work - aux - main
                for c, v in (('Вспомогательная работа', aux), ('Основная работа', main), ('Погрузка самосвалов', load)):
                    if v > 0:
                        cats[c] = v
            rep = sum(cats.get(c, 0) for c in F_REPAIR)
            kio = sum(cats.get(c, 0) for c in F_WORK)
            kio_adv = max(kio - cats.get('Ожидание а/с', 0), 0)
            comp[(r.objrem_id, days[d])] = cats
            for c, v in [('kfv', T), ('ktg', T - rep), ('kio', kio), ('kio_adv', kio_adv)] + sorted(cats.items()):
                out.append((r.objrem_id, r['Название ЭКС в АСД Рейсы'], days[d], c, float(v), r.x_ent, 1, r.x_area,
                            r.x_block, r.x_field))
    df = pd.DataFrame(out, columns=[c for c, _ in SCHEMAS['ПФ КРВ']])
    return df, comp


# ------------------------------------------------------------------ plans (План_2 week, План_2_МЕС month)
def plan_period_draws(rng, fl, keys):
    """Per loader and plan period: fixed norms, scalable losses, events, aux propensity."""
    draws = {}
    for r in fl.itertuples():
        onspot = r.x_role in ONSPOT_ROLES
        for key, n_days in keys:
            fixed = {c: float(rng.choice(vals)) for c, vals in P_FIXED if rng.random() < 0.95}
            scal = {c: float(rng.uniform(lo, hi)) for c, p, lo, hi, ok in P_SCALABLE
                    if (ok or not onspot) and rng.random() < p}
            to = {int(d): (12.0 if rng.random() < 0.4 else 24.0) for d in np.flatnonzero(rng.random(n_days) < 0.07)}
            aux = float(rng.uniform(0.15, 0.6)) if rng.random() < 0.35 else 0.0
            main = float(rng.uniform(0.03, 0.15)) if rng.random() < 0.6 else 0.0
            draws[(r.objrem_id, key)] = dict(fixed=fixed, scal=scal, to=to, aux=aux, main=main)
    return draws


def plan_events(fl):
    """Planned full-day events (capital repair, waiting for parts, ...) per loader and day, known to both plans."""
    rng = rng_for(4, 3)
    days = pd.date_range(WPLAN_START, WPLAN_END)
    ev = {}
    for r in fl.itertuples():
        cal, d = {}, 0
        while d < len(days):
            hit = None
            for code, p, lo, hi in P_EVENTS:
                if rng.random() < p:
                    hit = (code, int(rng.integers(lo, hi + 1)))
                    break
            if hit:
                for j in range(d, min(d + hit[1], len(days))):
                    cal[days[j]] = hit[0]
                d += hit[1]
            else:
                d += 1
        ev[r.objrem_id] = cal
    return ev


def plan_day(dr, d_in_period, ev, k, a, onspot):
    """Hours per time indicator for one plan day (2 dp); Погрузка самосвалов is the remainder, so the sum is 24."""
    h = {}
    if ev:
        h[ev] = 24.0
    else:
        frac = 1.0
        if d_in_period in dr['to']:
            h['ТО, ППР'] = dr['to'][d_in_period]
            frac = (24.0 - h['ТО, ППР']) / 24.0
        if frac > 0:
            for c, v in dr['fixed'].items():
                h[c] = round(v * frac, 2)
            room = max(20.0 * frac - sum(round(v * frac, 2) for v in dr['fixed'].values()), 0.0)   # losses <= 20 of 24 h
            scal = sum(dr['scal'].values()) * k * frac
            cut = min(1.0, room / scal) if scal > 0 else 1.0
            for c, v in dr['scal'].items():
                h[c] = round(v * k * frac * cut, 2)
            work = round(24.0 - sum(h.values()), 2)
            if onspot:
                aux = round(0.15 * work, 2)
                h['Вспомогательная работа'] = aux
                h['Основная работа'] = round(work - aux, 2)
            else:
                cut = min(1.0, 0.8 / (a * (dr['aux'] + dr['main']))) if dr['aux'] + dr['main'] > 0 else 1.0
                main = round(a * dr['main'] * cut * work, 2)
                aux = round(a * dr['aux'] * cut * work, 2)
                h['Основная работа'] = main
                h['Вспомогательная работа'] = aux
                h['Погрузка самосвалов'] = round(work - aux - main, 2)
    return {c: v for c, v in h.items() if v > 0}


PLAN_LOSS = ['ТО, ППР', 'КР', 'Авар. прост.', 'Ожид з/ч', 'Пересменок', 'Обед', 'Личные нужды', 'Заправка',
             'Взрывные работы', 'Перегоны', 'Переключение', 'Ожидание АС', 'Консервация/Резерв', 'Работа на другом поле',
             'Прочие простои', 'Орошение забоя']   # the model's КИО set after its plan bridge (Переключение etc. -> Прочие)


def plan_calendar(kind):
    if kind == 'week':
        days = pd.date_range(WPLAN_START, WPLAN_END)
        key = [biz_week(d)[0] for d in days]
    else:
        days = pd.date_range(MPLAN_START, MPLAN_END)
        key = [pd.Timestamp(year=d.year, month=d.month, day=1) for d in days]
    pos, counts = [], {}
    for kk in key:
        pos.append(counts.get(kk, 0))
        counts[kk] = counts.get(kk, 0) + 1
    return days, key, pos, sorted(counts.items())


def plan_window(win, oid):
    a, b = win[oid]
    lo = FACT_START + td_days(a)
    hi = FACT_START + td_days(b)
    return lo, (WPLAN_END if hi == FACT_END else hi)


def calibrate_plan(fl, win, draws, events, cal_days, cal_key, cal_pos):
    """Month plan factors k (scalable losses) and a (aux + main work) for the week-10 targets, solved on the S1 days."""
    vol = dict(zip(fl.objrem_id, fl['Объем ковша']))
    m = in_scope(fl) & fl.x_mplan
    sel = [i for i, d in enumerate(cal_days) if S1_START <= d <= S1_END]
    rows = []
    for r in fl[m].itertuples():
        lo, hi = plan_window(win, r.objrem_id)
        idx = [i for i in sel if lo <= cal_days[i] <= hi]
        if not idx:
            continue
        rows.append((r, idx))

    def shares(k, a):
        sw = ew_num = tl_num = 0.0
        for r, idx in rows:
            onspot = r.x_role in ONSPOT_ROLES
            loss = auxm = 0.0
            for i in idx:
                h = plan_day(draws[(r.objrem_id, cal_key[i])], cal_pos[i], events[r.objrem_id].get(cal_days[i], ''),
                             k, a, onspot)
                loss += sum(v for c, v in h.items() if c in PLAN_LOSS)
                auxm += h.get('Вспомогательная работа', 0) + h.get('Основная работа', 0)
            T = 24.0 * len(idx)
            w = float(vol[r.objrem_id])
            sw += w
            ew_num += w * (1 - loss / T)
            tl_num += w * (1 - (loss + auxm) / T)
        return ew_num / sw, tl_num / sw

    k = 1.0
    for _ in range(30):                                   # secant on k (EW), then on a (TL); both monotone
        e0 = shares(k, 1.0)[0] - KPI_TARGETS['effective_work_plan']
        e1 = shares(k * 1.01, 1.0)[0] - KPI_TARGETS['effective_work_plan']
        if abs(e0) < 1e-6:
            break
        k = k - e0 * (0.01 * k) / (e1 - e0)
    a = 1.0
    for _ in range(30):
        t0 = shares(k, a)[1] - KPI_TARGETS['truck_loading_plan']
        t1 = shares(k, a * 1.01)[1] - KPI_TARGETS['truck_loading_plan']
        if abs(t0) < 1e-6:
            break
        a = a - t0 * (0.01 * a) / (t1 - t0)
    assert 0.5 < k < 2.0 and 0.2 < a < 3.0, f'plan factors out of range: k={k} a={a}'
    return k, a


def plan_rows(kind, fl, win, draws, events, cal, k, a):
    days, key, pos, _ = cal
    hours = {}
    for r in fl.itertuples():
        if not (r.x_wplan if kind == 'week' else r.x_mplan):
            continue
        lo, hi = plan_window(win, r.objrem_id)
        onspot = r.x_role in ONSPOT_ROLES
        for i, d in enumerate(days):
            if not lo <= d <= hi:
                continue
            h = plan_day(draws[(r.objrem_id, key[i])], pos[i], events[r.objrem_id].get(d, ''), k, a, onspot)
            hours[(r.objrem_id, d)] = h
    return hours


def plan_indicators(h, vol):
    """All indicators of one plan loader-day from its hours and volumes (dict name -> amount, 2 dp)."""
    rep = sum(h.get(c, 0) for c in ('ТО, ППР', 'КР', 'Авар. прост.', 'Ожид з/ч'))
    work = sum(h.get(c, 0) for c in ('Основная работа', 'Вспомогательная работа', 'Погрузка самосвалов'))
    org = sum(h.get(c, 0) for c in ('Пересменок', 'Обед', 'Личные нужды', 'Заправка', 'Взрывные работы', 'Перегоны',
                                    'Переключение', 'Ожидание АС', 'Прочие простои', 'Авар. прост.'))
    ind = dict(h)
    ind['Проверка'] = round(sum(h.values()), 2)
    ind['Проверка КТГ'] = 24.0
    ind['КТГ план'] = round(24.0 - rep, 2)
    if rep and (h.get('ТО, ППР', 0) or h.get('КР', 0)):
        ind['ТО, ППР и КР'] = round(rep, 2)
    if work:
        ind['КИО'] = round(work, 2)
        ind['КИО без ожид. АС'] = round(work + h.get('Ожидание АС', 0), 2)
    if org:
        ind['Орг. простои план'] = round(org, 2)
    ind.update({c: v for c, v in vol.items() if v != 0})
    return {c: v for c, v in ind.items() if v != 0 or c in ('Проверка', 'Проверка КТГ', 'КТГ план')}


# ------------------------------------------------------------------ volumes
def loader_mix(fl):
    rng = rng_for(5)
    mix, vol = {}, dict(zip(fl.objrem_id, fl['Объем ковша']))
    for r in fl.itertuples():
        onspot = r.x_role in ONSPOT_ROLES
        coal = (not onspot) and rng.random() < 0.15
        mix[r.objrem_id] = dict(
            rate=(0.45 if onspot else 1.0) * 95.0 * max(int(vol[r.objrem_id]), 4) ** 0.85
            * float(np.exp(rng.normal(0, 0.15))),
            coal=float(rng.uniform(0.3, 0.8)) if coal else 0.0,
            pgr=float(rng.uniform(0.1, 0.3)) if rng.random() < 0.25 else 0.0,
            stock=float(rng.uniform(0.2, 0.6)) if rng.random() < 0.10 else 0.0,
            prep=float(rng.uniform(0.05, 0.3)) if rng.random() < 0.10 else 0.0,
            onspot=onspot, rehandle=r.x_role == 'onspot_rehandle', pgr_bt=rng.random() < 0.3,
            density=float(rng.uniform(2.35, 2.55)), arm_rock=float(rng.uniform(2.0, 7.0)),
            arm_coal=float(rng.uniform(4.0, 12.0)) if coal else 0.0, speed=float(rng.uniform(18.0, 24.0)),
            shift_cap=float(rng.uniform(0.8, 1.4)),
        )
    return mix


def split_volume(total, mx, noise):
    """Split the loader-day mass (thousand m3) into the model's volume columns."""
    if mx['onspot']:
        bt = 0.0 if mx['rehandle'] else total
        reh = total if mx['rehandle'] else 0.0
        pgr = round(total * 0.1, 2) if mx['pgr_bt'] else 0.0
        return {'auto': 0.0, 'over': 0.0, 'stock': 0.0, 'prep_auto': 0.0, 'coal': 0.0, 'bt': round(bt, 2),
                'reh': round(reh, 2), 'pgr': pgr}
    coal = round(total * mx['coal'] * noise[0], 2) if mx['coal'] else 0.0
    rest = max(total - coal, 0.0)
    stock = round(rest * mx['stock'] * noise[1], 2) if mx['stock'] else 0.0
    prep = round(rest * mx['prep'] * noise[2], 2) if mx['prep'] else 0.0
    over = round(max(rest - stock - prep, 0.0), 2)
    return {'auto': round(over + stock + prep + coal, 2), 'over': over, 'stock': stock, 'prep_auto': prep, 'coal': coal,
            'bt': 0.0, 'reh': 0.0, 'pgr': round(total * mx['pgr'] * noise[2], 2) if mx['pgr'] else 0.0}


def plan_volume_indicators(v, mx, hours):
    out = {}
    if mx['onspot']:
        gm = round(v['bt'] + v['reh'] + v['pgr'], 2)
        out.update({'Вскрыша б/т': v['bt'], 'Переэкскавация': v['reh'], 'ПГР': v['pgr'], 'Объем ГМ план': gm})
        if gm and hours.get('Основная работа'):
            out['Производительность'] = round(gm / hours['Основная работа'] * 1000, 2)
        out['Объемный вес'] = round(mx['density'], 2)
        return out
    out.update({'Вскрыша авто': v['over'], 'Навалы авто': v['stock'], 'ПГР авто': v['prep_auto'], 'Добыча': v['coal'],
                'Объем ГМ на авто план': v['auto'], 'Объем ГМ план': round(v['auto'] + v['pgr'], 2), 'ПГР': v['pgr'],
                'Объем добычи план': round(v['coal'] * COAL_DENSITY, 2), 'Объемный вес': round(mx['density'], 2)})
    if v['auto'] and hours.get('Погрузка самосвалов'):
        out['Производительность'] = round(v['auto'] / hours['Погрузка самосвалов'] * 1000, 2)
        rock = v['auto'] - v['coal']
        arm = (rock * mx['arm_rock'] + v['coal'] * mx['arm_coal']) / v['auto']
        out['Плечо план'] = round(arm, 2)
        out['Плечо порода'] = round(mx['arm_rock'], 2)
        out['Грузооборот'] = round(v['auto'] * mx['density'] * arm, 2)
        out['Техническая скорость план пород.'] = round(mx['speed'], 2)
        out['Час. пр-ть ед. АС пород.'] = round(mx['speed'] * 10.2, 2)
        out['АС: Кол-во МС породов.'] = round(rock / mx['shift_cap'], 2)
        if v['coal']:
            out['Плечо добыча'] = round(mx['arm_coal'], 2)
            out['Техническая скорость план углев.'] = round(mx['speed'] + 1.0, 2)
            out['Час. пр-ть ед. АС углев.'] = round((mx['speed'] + 1.0) * 14.5, 2)
            out['АС: Кол-во МС углев.'] = round(v['coal'] / mx['shift_cap'], 2)
    return out


# ------------------------------------------------------------------ writing
def to_table(name, df):
    cols = SCHEMAS[name]
    arrays = []
    for c, t in cols:
        s = df[c]
        if t == TS:
            arrays.append(pa.array(pd.to_datetime(s).astype('datetime64[us]'), type=TS))
        elif t == I64:
            arrays.append(pa.array([None if pd.isna(x) else int(x) for x in s], type=I64))
        elif t == F64:
            arrays.append(pa.array([None if pd.isna(x) else float(x) for x in s], type=F64))
        elif t == B:
            arrays.append(pa.array([bool(x) for x in s], type=B))
        else:
            arrays.append(pa.array([None if (x is None or (isinstance(x, float) and np.isnan(x))) else str(x) for x in s],
                                   type=S))
    return pa.Table.from_arrays(arrays, schema=pa.schema([pa.field(c, t) for c, t in cols]))


def main():
    t0 = time.time()
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent))
    out = Path(ap.parse_args().out)
    (out / 'parquet').mkdir(parents=True, exist_ok=True)

    cal = build_calendar()
    office, mines, areas, fields = build_reference()
    L = build_loaders(fields)
    win = loader_windows(L, rng_for(3))

    # fact time
    sim = simulate_fact(L, win)
    kf, af = calibrate_fact(sim)
    fact, comp = fact_rows(sim, kf, af)

    # plans: hours
    fl_plan = L[L.x_wplan | L.x_mplan].reset_index(drop=True)
    wcal = plan_calendar('week')
    mcal = plan_calendar('month')
    wdraws = plan_period_draws(rng_for(4, 1), fl_plan, wcal[3])
    mdraws = plan_period_draws(rng_for(4, 2), fl_plan, mcal[3])
    pev = plan_events(fl_plan)
    kp, ap_ = calibrate_plan(fl_plan, win, mdraws, pev, mcal[0], mcal[1], mcal[2])
    wh = plan_rows('week', fl_plan, win, wdraws, pev, wcal, kp, ap_)
    mh = plan_rows('month', fl_plan, win, mdraws, pev, mcal, kp, ap_)

    # volumes: fact mass from truck-loading (trucks) or main-work (on spot) hours, plan mass from plan hours
    mix = loader_mix(L[L.x_facts | L.x_wplan | L.x_mplan].reset_index(drop=True))
    rng = rng_for(6)
    scope_ids = set(L.loc[in_scope(L), 'objrem_id'])
    raw_f, raw_p = {}, {}
    for (oid, d), cats in sorted(comp.items()):
        mx = mix[oid]
        hrs = (cats.get('Основная работа', 0) if mx['onspot'] else cats.get('Погрузка самосвалов', 0)
               + cats.get('Основная работа', 0)) / 3600
        raw_f[(oid, d)] = mx['rate'] * hrs / 1000 * float(np.exp(rng.normal(-0.02, 0.2)))
    plan_eff = {oid: 1.06 * float(np.exp(rng.normal(0, 0.05))) for oid in sorted(mix)}
    for src, hh in (('week', wh), ('month', mh)):
        for (oid, d), h in sorted(hh.items()):
            mx = mix[oid]
            hrs = h.get('Основная работа', 0) if mx['onspot'] else h.get('Погрузка самосвалов', 0)
            raw_p[(src, oid, d)] = mx['rate'] * plan_eff[oid] * hrs / 1000
    s1 = lambda d: S1_START <= d <= S1_END
    f_raw = sum(v for (oid, d), v in raw_f.items() if oid in scope_ids and s1(d) and not mix[oid]['onspot'])
    p_raw = sum(v for (src, oid, d), v in raw_p.items() if src == 'month' and oid in scope_ids and s1(d)
                and not mix[oid]['onspot'])
    rf, rp = KPI_TARGETS['mass_fact'] / f_raw, KPI_TARGETS['mass_plan'] / p_raw
    noise3 = {key: tuple(float(x) for x in np.exp(rng.normal(0, 0.1, 3))) for key in sorted(raw_f)}
    vol_f = {key: split_volume(v * rf, mix[key[0]], noise3[key]) for key, v in sorted(raw_f.items())}
    vol_p = {key: split_volume(v * rp, mix[key[1]], (1.0, 1.0, 1.0)) for key, v in sorted(raw_p.items())}

    # plan rows
    attr = L.set_index('objrem_id')
    mplan_null_name = sorted(L.loc[L.x_mplan & (L.x_role == 'truck_nocomment'), 'objrem_id'])[:1]
    prow = {'week': [], 'month': []}
    for src, hh in (('week', wh), ('month', mh)):
        for (oid, d), h in sorted(hh.items()):
            r = attr.loc[oid]
            vi = plan_volume_indicators(vol_p[(src, oid, d)], mix[oid], h)
            ind = plan_indicators(h, vi)
            name = None if (src == 'month' and oid in mplan_null_name) else r['Название ЭКС в ГД']
            for c in sorted(ind):
                base = (r.x_ent, d, oid, name, c, MEASURE[c], float(ind[c]))
                tail = (1, r.x_area, r.x_block, r.x_field)
                prow[src].append(base + ((P_TIME_SORT.get(c),) if src == 'week' else (2,)) + tail)
    plan_w = pd.DataFrame(prow['week'], columns=[c for c, _ in SCHEMAS['План_2']])
    plan_m = pd.DataFrame(prow['month'], columns=[c for c, _ in SCHEMAS['План_2_МЕС']])

    # ПФ объемы: one row per loader-day of the volume span
    long_name = {b[0]: b[2] for b in BRANCHES}
    vrows = []
    vol_ids = sorted(set(k[0] for k in vol_f) | set(k[1] for k in vol_p))
    early = set(attr.loc[vol_ids][attr.loc[vol_ids].x_ent == 4].index)
    for oid in vol_ids:
        r = attr.loc[oid]
        lo, hi = plan_window(win, oid) if oid in win else (WPLAN_START, WPLAN_END)
        start = VOL_START if (oid in early and lo == FACT_START) else lo
        for d in pd.date_range(start, min(hi, VOL_END)):
            f = vol_f.get((oid, d), split_volume(0.0, mix[oid], (1, 1, 1)))
            w = vol_p.get(('week', oid, d), split_volume(0.0, mix[oid], (1, 1, 1)))
            m = vol_p.get(('month', oid, d), split_volume(0.0, mix[oid], (1, 1, 1)))
            gm = lambda v: round(v['auto'] + v['bt'] + v['pgr'] + v['reh'], 2)
            row = {'Дата': d, 'Разрез': long_name[r.x_ent], 'КФВ': 24, 'Экспортный код': oid,
                   'Объем добычи план': round(w['coal'] * COAL_DENSITY, 2), 'Объем добычи факт': round(f['coal'] * COAL_DENSITY, 2),
                   'Объем ГМ план': gm(w), 'Объем ГМ факт': gm(f), 'Объем ГМ на авто план': w['auto'],
                   'Объем ГМ на авто факт': f['auto'], 'Добыча план': w['coal'], 'Вскрыша авто план': w['over'],
                   'Вскрыша авто факт': f['over'], 'Навалы авто план': w['stock'], 'Навалы авто факт': f['stock'],
                   'ПГР авто план': w['prep_auto'], 'ПГР авто факт': f['prep_auto'], 'Вскрыша б/т план': w['bt'],
                   'Вскрыша б/т факт': f['bt'], 'Переэкскавация план': w['reh'], 'Переэкскавация факт': f['reh'],
                   'ПГР план': w['pgr'], 'ПГР факт': f['pgr'],
                   'Объем добычи план месяц': round(m['coal'] * COAL_DENSITY, 2), 'Объем ГМ план месяц': gm(m),
                   'Объем ГМ на авто план месяц': m['auto'], 'Добыча план месяц': m['coal'],
                   'Вскрыша авто план месяц': m['over'], 'Навалы авто план месяц': m['stock'],
                   'ПГР авто план месяц': m['prep_auto'], 'Вскрыша б/т план месяц': m['bt'],
                   'Переэкскавация план месяц': m['reh'], 'ПГР план месяц': m['pgr']}
            vrows.append(row)
    vol = pd.DataFrame(vrows)

    # intervals (fact_interval): one row per loader with a work scheme and month, Oct 2022 - Mar 2023
    rng = rng_for(7)
    irows, months = [], pd.date_range('2022-10-01', '2023-03-01', freq='MS')
    for r in L[L.x_group.notna()].sort_values('objrem_id').itertuples():
        lo, hi = plan_window(win, r.objrem_id) if r.objrem_id in win else (FACT_START, WPLAN_END)
        for ms in months:
            me = ms + pd.offsets.MonthEnd(0)
            if me < lo - td_days(31) or ms > hi:
                continue
            g = int(r.x_group)
            if irows and irows[-1][0] == r.objrem_id and rng.random() < 0.03:
                g = 0                                     # a month off the scheme, never the loader's first row
            irows.append((r.objrem_id, g, bool(g == 2 and rng.random() < 0.03), ms, me))
    irows = [(i + 1,) + t for i, t in enumerate(irows)]
    intervals = pd.DataFrame(irows, columns=[c for c, _ in SCHEMAS['intervals']])

    # Интервалы (work-scheme intervals as maintained by dispatch; not read by the model)
    rng = rng_for(8)
    prow2 = []
    for r in L[L.x_facts & in_scope(L)].sort_values('objrem_id').itertuples():
        lo, _ = plan_window(win, r.objrem_id)
        start = lo if lo > FACT_START else (FACT_START - td_days(int(rng.integers(0, 90)))
                                             if rng.random() < 0.05 else FACT_START)
        u = rng.random()
        end = pd.Timestamp('2024-12-31') if u < 0.75 else pd.Timestamp('2023-12-31') if u < 0.9 else \
            (start + pd.offsets.MonthEnd(int(rng.integers(1, 4))))
        modi = pd.Timestamp('2023-03-24 15:40:00') if rng.random() < 0.01 else pd.Timestamp('2023-03-01 06:15:00')
        prow2.append((int(r.x_group), r.objrem_id, start, end, 'dispatcher', modi, r.x_area, r.x_block))
    intervals_pf = pd.DataFrame([(i + 1, oid, g, s_, e_, u_, m_, a_, b_)
                                 for i, (g, oid, s_, e_, u_, m_, a_, b_) in enumerate(prow2)],
                                columns=[c for c, _ in SCHEMAS['Интервалы']])

    # ПФ Отчет о рейсах (trip report per excavator and day; not read by the model)
    rng = rng_for(9)
    trows = []
    for (oid, d), f in sorted(vol_f.items()):
        mx = mix[oid]
        if mx['onspot']:
            continue
        r = attr.loc[oid]
        auto = f['auto']
        if auto > 0:
            rock = auto - f['coal']
            arm_r = mx['arm_rock'] * float(np.exp(rng.normal(0, 0.1))) if rock > 0 else 0.0
            arm_c = mx['arm_coal'] * float(np.exp(rng.normal(0, 0.1))) if f['coal'] > 0 else 0.0
            ms_ = auto / mx['shift_cap'] * float(np.exp(rng.normal(0, 0.08)))
            turn = (rock * arm_r + f['coal'] * arm_c) * mx['density'] / 1000
            trows.append((d, r['Название ЭКС в АСД Рейсы'], long_name[r.x_ent], round(turn, 8),
                          round(float(np.clip(rng.normal(mx['speed'], 2.0), 8, 37)), 6), ms_, round(arm_c, 6),
                          round(arm_r, 6), oid, round(ms_, 1)))
        else:
            trows.append((d, r['Название ЭКС в АСД Рейсы'], long_name[r.x_ent], 0.0, 0.0, 0.0, 0.0, 0.0, oid, 0.0))
    for e in sorted(long_name):
        for d in sorted(rng.choice(pd.date_range(FACT_START, FACT_END), size=6, replace=False)):
            ms_ = float(rng.uniform(0.1, 1.5))
            trows.append((pd.Timestamp(d), 'Прочие', long_name[e], round(ms_ * 0.03, 8),
                          round(float(rng.uniform(15, 25)), 6), ms_, 0.0, round(float(rng.uniform(1, 5)), 6), None,
                          round(ms_, 1)))
    trips = pd.DataFrame(trows, columns=[c for c, _ in SCHEMAS['ПФ Отчет о рейсах']])

    # КРВ АС (haul trucks' time per idle code and day; not read by the model)
    rng = rng_for(10)
    t_ent = np.repeat(sorted(TRUCKS_PER_ENTERPRISE), [TRUCKS_PER_ENTERPRISE[e] for e in sorted(TRUCKS_PER_ENTERPRISE)])
    n_t = len(t_ent)
    t_ids = unique_ints(rng, n_t, 30_000_000, 230_000_000, taken=set(L.objrem_id))
    t_names = [f'Б-{x}' for x in rng.choice(np.arange(1000, 2000), size=n_t, replace=False)]
    mw = np.array([w for _, w in TRUCK_MODELS], float)
    t_model = [TRUCK_MODELS[i][0] for i in rng.choice(len(TRUCK_MODELS), size=n_t, p=mw / mw.sum())]
    t_model = [None if rng.random() < 0.07 else m for m in t_model]
    tdays = pd.date_range(FACT_START, FACT_END)
    present = rng.random((n_t, len(tdays))) < 0.887
    tcols = {c: [] for c, _ in SCHEMAS['КРВ АС']}
    loss_codes = [c for c, _, _ in T_LOSS]
    for di, d in enumerate(tdays):
        idx = np.flatnonzero(present[:, di])
        m_ = len(idx)
        T = np.where(rng.random(m_) < 0.002, 43200, 86400)
        full = rng.random(m_)
        P = np.stack([rng.random(m_) < p for _, p, _ in T_LOSS], 1)
        Dd = np.stack([mm * np.exp(rng.normal(-0.18, 0.6, m_)) for _, _, mm in T_LOSS], 1) * P
        Dd = np.minimum(Dd, 0.45 * T[:, None])
        tot = Dd.sum(1)
        cap = 0.75 * T
        Dd = np.where((tot > cap)[:, None], Dd * (cap / np.maximum(tot, 1))[:, None], Dd)
        Dd = np.rint(Dd).astype(np.int64)
        work = T - Dd.sum(1)
        shares = np.array([s for _, s in T_WORK]) * np.exp(rng.normal(0, 0.1, (m_, len(T_WORK))))
        shares /= shares.sum(1, keepdims=True)
        Wk = np.rint(shares * work[:, None]).astype(np.int64)
        Wk[:, 0] += work - Wk.sum(1)
        nulltot = rng.random(m_) < 0.05
        for j in range(m_):
            ti = idx[j]
            if full[j] < 0.006:
                cats = [('КР', int(T[j]))]
            elif full[j] < 0.0075:
                cats = [('Ожид з/ч', int(T[j]))]
            else:
                cats = [(loss_codes[c], int(Dd[j, c])) for c in range(len(loss_codes)) if Dd[j, c] > 0]
                cats += [(T_WORK[c][0], int(Wk[j, c])) for c in range(len(T_WORK)) if Wk[j, c] > 0]
            rep = sum(v for c, v in cats if c in ('ТО, ППР', 'КР', 'Авар. Прост.', 'Ожид з/ч'))
            wrk = sum(v for c, v in cats if c in [w for w, _ in T_WORK])
            ktg = round((T[j] - rep) / T[j] * 100, 2)
            kio = round(wrk / T[j] * 100, 2)
            for c, v in cats:
                tcols['enterprise_id'].append(int(t_ent[ti]))
                tcols['dat'].append(d)
                tcols['vehicle_export_code'].append(t_ids[ti])
                tcols['vehicle_name'].append(t_names[ti])
                tcols['idle_name_for_op'].append(c)
                tcols['duration'].append(v)
                tcols['kfv'].append(None if nulltot[j] else int(T[j]))
                tcols['ktg'].append(None if nulltot[j] else ktg)
                tcols['kio'].append(None if nulltot[j] else kio)
                tcols['kio_adv'].append(None if nulltot[j] else kio)
                tcols['vehicle_model_name'].append(t_model[ti])
    trucks = pd.DataFrame(tcols)

    tables = {
        'AREA_DIM': areas, 'Calendar': cal, 'FIELD_DIM': fields, 'OFFICE_DIM': office, 'intervals': intervals,
        'Интервалы': intervals_pf, 'КРВ АС': trucks, 'ПФ КРВ': fact, 'ПФ Отчет о рейсах': trips, 'ПФ объемы': vol,
        'План_2': plan_w, 'План_2_МЕС': plan_m, 'Справочник ЭКС': L, 'Справочник разрезов': mines,
    }
    sort_keys = {
        'КРВ АС': ['dat', 'vehicle_export_code', 'idle_name_for_op'], 'ПФ КРВ': ['vehicle_export_code', 'dat', 'idle_name_for_op'],
        'ПФ Отчет о рейсах': ['Дата', 'Экскаватор'], 'ПФ объемы': ['Экспортный код', 'Дата'],
        'План_2': ['vehicle_export_code', 'dat', 'indicator_name'], 'План_2_МЕС': ['vehicle_export_code', 'dat', 'indicator_name'],
        'Справочник ЭКС': ['Филиал', 'Название ЭКС в ГД'],
    }
    manifest_tables = []
    for name in sorted(tables):
        df = tables[name]
        if name in sort_keys:
            df = df.sort_values(sort_keys[name], kind='mergesort').reset_index(drop=True)
        t = to_table(name, df)
        p = out / 'parquet' / f'{name}.parquet'
        pq.write_table(t, p, compression='zstd')
        data = p.read_bytes()
        manifest_tables.append({'file': f'{name}.parquet', 'rows': t.num_rows, 'bytes': len(data),
                                'sha256': hashlib.sha256(data).hexdigest(),
                                'columns': [[f.name, str(f.type)] for f in t.schema]})
    (out / 'parquet' / 'manifest.json').write_text(json.dumps({
        'dataset': 'ACME Trucks synthetic twin', 'seed': SEED, 'generator_version': GENERATOR_VERSION,
        'calendar_span': [str(CAL_START.date()), str(CAL_END.date())],
        'fact_span': [str(FACT_START.date()), str(FACT_END.date())],
        'tested_grain': 'week "10 (4.3-10.3)" (2023-03-04 .. 2023-03-10), Month plan, Weighted, Trucks + On spot, '
                        'is_included = "да", contractor blank',
        'kpi_targets': KPI_TARGETS,
        'calibration': {'fact_loss_factor': round(kf, 6), 'fact_aux_factor': round(af, 6),
                        'plan_loss_factor': round(kp, 6), 'plan_aux_factor': round(ap_, 6),
                        'fact_mass_factor': round(rf, 6), 'plan_mass_factor': round(rp, 6)},
        'tables': manifest_tables,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    rows = sum(t['rows'] for t in manifest_tables)
    size = sum(t['bytes'] for t in manifest_tables)
    print(f'14 files, {rows:,} rows, {size / 1e6:.1f} MB written to {out / "parquet"} in {time.time() - t0:.1f} s')
    return 0


if __name__ == '__main__':
    sys.exit(main())
