"""ACME Cash Flow synthetic QBO company - configuration (ADR-0019 defaults, generator spec section 3).

One configuration fully determines a dataset: same values + same seed + same engine version = byte-identical files.
All names are invented and plainly fictional.
"""
import datetime as dt

ENGINE_VERSION = '1.0.0'
SEED = 42
PRESET = 'typical'
PROFILE = 'services'
SIZE = 'S'
HOME_CURRENCY = 'USD'
FISCAL_YEAR_START_MONTH = 1
START = dt.date(2024, 1, 1)
END = dt.date(2026, 10, 31)
OPENING_DATE = dt.date(2023, 12, 31)          # established company: opening-balance JE the day before the start
PRESPAN_START = dt.date(2023, 11, 1)          # open invoices / bills of Nov-Dec 2023 behind the opening A/R and A/P
AS_OF = dt.datetime(2026, 11, 5, 9, 0, 0)     # "now" for MetaData and report headers (end date + 5 days)
FEATURES = dict(classes=True, locations=False, account_numbers=False)

REVENUE_Y1 = 1_200_000.0                      # size S
GROWTH = 0.12
SEASON = [0.90, 0.93, 1.03, 1.00, 1.03, 0.99, 0.92, 0.91, 1.05, 1.10, 1.08, 1.06]   # services profile, Jan..Dec
NOISE = 0.08
STREAM_SHARE = dict(consulting=0.52, training=0.09)   # managed-services retainers take the rest (fixed fees)
SALES_TAX_RATE = 0.0825                       # training is the only taxable stream
UF_SHARE = 0.40                               # share of customer payments routed through Undeposited Funds
CARD_SHARE = 0.30                             # share of non-payroll expenses paid by card (target, approximate)
TERMS_MIX = [('Net 15', 15, 0.20), ('Net 30', 30, 0.50), ('Net 45', 45, 0.20), ('Net 60', 60, 0.10)]
LATE_MEDIAN_DAYS = 6
CHRONIC_SHARE = 0.05
WRITE_OFF_SHARE = 0.005
NEW_CUSTOMERS_PER_YEAR = 0.15
LOST_CUSTOMERS_PER_YEAR = 0.10
BLANK_MEMO_SHARE = 0.15
EDITED_SHARE = 0.06
LAG_MEDIAN_DAYS = 2

# Cash constraint (process rule 4, invariant I11)
CASH_FLOOR = {'BANK_OP': 15_000.00, 'BANK_PR': 0.0, 'BANK_SV': 0.0}
LOC_LIMIT = 150_000.00
LOC_DRAW_BELOW = 25_000.00                    # draw when operating checking ends a day below this
LOC_DRAW_TO = 45_000.00
LOC_REPAY_ABOVE = 95_000.00
LOC_REPAY_KEEP = 70_000.00
LOC_RATE = 0.085
SAVINGS_SWEEP_ABOVE = 105_000.00              # quarter-end sweep of excess cash to savings (only when the LoC is clear)
SAVINGS_SWEEP_KEEP = 55_000.00
SAVINGS_RATE = 0.0325

TERM_LOAN = dict(principal=90_000.00, rate=0.0725, months=60, start=dt.date(2024, 3, 15), first_payment=dt.date(2024, 4, 15))
OWNER_CONTRIBUTION = dict(date=dt.date(2024, 1, 3), amount=25_000.00)
OWNER_DRAW_QUARTERLY = {2024: 38_000.00, 2025: 44_000.00, 2026: 50_000.00}
# capex: two purchases and one disposal; S02 adds an asset bought on finance (non-cash)
CAPEX_BILL = dict(date=dt.date(2024, 6, 10), equipment=46_800.00, support=1_850.00)          # S13
CAPEX_CHECK = dict(date=dt.date(2026, 2, 18), amount=28_400.00)                              # laptop refresh, paid by cheque
FINANCED_VEHICLE = dict(date=dt.date(2025, 5, 12), amount=41_500.00, rate=0.069, months=48)   # S02
DISPOSAL = dict(date=dt.date(2025, 5, 20), proceeds=13_500.00)                               # old van

OPENING = dict(BANK_OP=48_250.00, BANK_PR=2_400.00, BANK_SV=60_000.00, PREPAID=0.0, OA_DEP=13_000.00,
               FA_EQ_COST=24_000.00, FA_EQ_AD=-9_600.00, FA_VH_COST=32_000.00, FA_VH_AD=-19_200.00,
               CC=-4_870.35, PL_FED=-6_120.40, PL_ST=-1_084.10, STP=-1_390.55, EQ_INV=-50_000.00)

SCENARIOS = ['S01', 'S02', 'S03', 'S04', 'S06', 'S07', 'S08', 'S13', 'S18']
UF_STALE_DAYS = 30
DUP_WINDOW_DAYS = 3

# ---- chart of accounts (services template, two levels of sub-accounts) -----------------------------------------------
#   code          name                                   AccountType                  AccountSubType                    parent
COA = [
    ('BANK_OP',    'Operating Checking',                  'Bank',                      'Checking',                       None),
    ('BANK_PR',    'Payroll Checking',                    'Bank',                      'Checking',                       None),
    ('BANK_SV',    'Business Savings',                    'Bank',                      'Savings',                        None),
    ('AR',         'Accounts Receivable (A/R)',           'Accounts Receivable',       'AccountsReceivable',             None),
    ('UF',         'Undeposited Funds',                   'Other Current Asset',       'UndepositedFunds',               None),
    ('PREPAID',    'Prepaid Expenses',                    'Other Current Asset',       'PrepaidExpenses',                None),
    ('FA_EQ',      'Office Equipment',                    'Fixed Asset',               'MachineryAndEquipment',          None),
    ('FA_EQ_COST', 'Original Cost',                       'Fixed Asset',               'MachineryAndEquipment',          'FA_EQ'),
    ('FA_EQ_AD',   'Accumulated Depreciation',            'Fixed Asset',               'AccumulatedDepreciation',        'FA_EQ'),
    ('FA_VH',      'Vehicles',                            'Fixed Asset',               'Vehicles',                       None),
    ('FA_VH_COST', 'Original Cost',                       'Fixed Asset',               'Vehicles',                       'FA_VH'),
    ('FA_VH_AD',   'Accumulated Depreciation',            'Fixed Asset',               'AccumulatedDepreciation',        'FA_VH'),
    ('OA_DEP',     'Security Deposits',                   'Other Asset',               'SecurityDeposits',               None),
    ('AP',         'Accounts Payable (A/P)',              'Accounts Payable',          'AccountsPayable',                None),
    ('CC',         'Harborline Visa Business',            'Credit Card',               'CreditCard',                     None),
    ('PL',         'Payroll Liabilities',                 'Other Current Liability',   'PayrollTaxPayable',              None),
    ('PL_FED',     'Federal Payroll Taxes',               'Other Current Liability',   'PayrollTaxPayable',              'PL'),
    ('PL_ST',      'State Payroll Taxes',                 'Other Current Liability',   'PayrollTaxPayable',              'PL'),
    ('STP',        'Sales Tax Payable',                   'Other Current Liability',   'SalesTaxPayable',                None),
    ('LOC',        'Line of Credit - Larkspur Bank',      'Other Current Liability',   'LineOfCredit',                   None),
    ('ACCR',       'Accrued Liabilities',                 'Other Current Liability',   'AccruedLiabilities',             None),
    ('LTL_TERM',   'Term Loan - Larkspur Bank',           'Long Term Liability',       'NotesPayable',                   None),
    ('LTL_VEH',    'Vehicle Loan - Crestline Auto Finance', 'Long Term Liability',     'NotesPayable',                   None),
    ('EQ_OBE',     'Opening Balance Equity',              'Equity',                    'OpeningBalanceEquity',           None),
    ('EQ_OWN',     "Owner's Equity",                      'Equity',                    'OwnersEquity',                   None),
    ('EQ_INV',     'Owner Investments',                   'Equity',                    'OwnersEquity',                   'EQ_OWN'),
    ('EQ_DRAW',    'Owner Draws',                         'Equity',                    'PartnerDistributions',           'EQ_OWN'),
    ('EQ_RE',      'Retained Earnings',                   'Equity',                    'RetainedEarnings',               None),
    ('INC',        'Service Revenue',                     'Income',                    'ServiceFeeIncome',               None),
    ('INC_CONS',   'Consulting',                          'Income',                    'ServiceFeeIncome',               'INC'),
    ('INC_MS',     'Managed Services',                    'Income',                    'ServiceFeeIncome',               'INC'),
    ('INC_TRN',    'Training & Workshops',                'Income',                    'ServiceFeeIncome',               'INC'),
    ('OI_INT',     'Interest Earned',                     'Other Income',              'InterestEarned',                 None),
    ('OI_GAIN',    'Gain on Sale of Assets',              'Other Income',              'OtherMiscellaneousIncome',       None),
    ('COGS',       'Cost of Services',                    'Cost of Goods Sold',        'CostOfLaborCos',                 None),
    ('COGS_SUB',   'Subcontractors',                      'Cost of Goods Sold',        'CostOfLaborCos',                 'COGS'),
    ('COGS_SW',    'Delivery Software & Hosting',         'Cost of Goods Sold',        'SuppliesMaterialsCogs',          'COGS'),
    ('EX_PAY',     'Payroll Expenses',                    'Expense',                   'PayrollExpenses',                None),
    ('EX_WAGES',   'Wages',                               'Expense',                   'PayrollExpenses',                'EX_PAY'),
    ('EX_PTAX',    'Employer Payroll Taxes',              'Expense',                   'PayrollExpenses',                'EX_PAY'),
    ('EX_PFEE',    'Payroll Service Fees',                'Expense',                   'PayrollExpenses',                'EX_PAY'),
    ('EX_RENT',    'Rent',                                'Expense',                   'RentOrLeaseOfBuildings',         None),
    ('EX_UTIL',    'Utilities',                           'Expense',                   'Utilities',                      None),
    ('EX_UTIL_EL', 'Electricity',                         'Expense',                   'Utilities',                      'EX_UTIL'),
    ('EX_UTIL_PH', 'Phone & Internet',                    'Expense',                   'Utilities',                      'EX_UTIL'),
    ('EX_SW',      'Software & Subscriptions',            'Expense',                   'OfficeGeneralAdministrativeExpenses', None),
    ('EX_ITS',     'IT Support',                          'Expense',                   'OfficeGeneralAdministrativeExpenses', None),
    ('EX_OFF',     'Office Supplies',                     'Expense',                   'SuppliesMaterials',              None),
    ('EX_MKT',     'Advertising & Marketing',             'Expense',                   'AdvertisingPromotional',         None),
    ('EX_TRV',     'Travel',                              'Expense',                   'Travel',                         None),
    ('EX_MEAL',    'Meals',                               'Expense',                   'EntertainmentMeals',             None),
    ('EX_INS',     'Insurance',                           'Expense',                   'Insurance',                      None),
    ('EX_PRO',     'Legal & Professional Fees',           'Expense',                   'LegalProfessionalFees',          None),
    ('EX_BANK',    'Bank Charges & Fees',                 'Expense',                   'BankCharges',                    None),
    ('EX_VEH',     'Vehicle Expenses',                    'Expense',                   'Auto',                           None),
    ('EX_RM',      'Repairs & Maintenance',               'Expense',                   'RepairMaintenance',              None),
    ('EX_TAXLIC',  'Taxes & Licenses',                    'Expense',                   'TaxesPaid',                      None),
    ('EX_BADDEBT', 'Bad Debts',                           'Expense',                   'BadDebts',                       None),
    ('EX_INT',     'Interest Expense',                    'Expense',                   'InterestPaid',                   None),
    ('OX_DEPR',    'Depreciation',                        'Other Expense',             'Depreciation',                   None),
]
CLASSIFICATION = {'Bank': 'Asset', 'Accounts Receivable': 'Asset', 'Other Current Asset': 'Asset', 'Fixed Asset': 'Asset',
                  'Other Asset': 'Asset', 'Accounts Payable': 'Liability', 'Credit Card': 'Liability',
                  'Other Current Liability': 'Liability', 'Long Term Liability': 'Liability', 'Equity': 'Equity',
                  'Income': 'Revenue', 'Other Income': 'Revenue', 'Cost of Goods Sold': 'Expense', 'Expense': 'Expense',
                  'Other Expense': 'Expense'}
PL_TYPES = ('Income', 'Other Income', 'Cost of Goods Sold', 'Expense', 'Other Expense')
TYPE_ORDER = ['Bank', 'Accounts Receivable', 'Other Current Asset', 'Fixed Asset', 'Other Asset', 'Accounts Payable', 'Credit Card',
              'Other Current Liability', 'Long Term Liability', 'Equity', 'Income', 'Cost of Goods Sold', 'Expense', 'Other Income',
              'Other Expense']
CASH_SET = ('BANK_OP', 'BANK_PR', 'BANK_SV', 'UF')   # QBO cash = Bank + Undeposited Funds (report spec 7.1)

CLASSES = [('CL_CONS', 'Consulting'), ('CL_MS', 'Managed Services'), ('CL_TRN', 'Training'), ('CL_OH', 'Overhead')]
ITEMS = [  # code, name, income account, taxable, class
    ('IT_HOURS', 'Consulting - Hourly', 'INC_CONS', False, 'CL_CONS'),
    ('IT_MILE', 'Project Milestone', 'INC_CONS', False, 'CL_CONS'),
    ('IT_RET', 'Managed Services Retainer', 'INC_MS', False, 'CL_MS'),
    ('IT_SEAT', 'Workshop Seat', 'INC_TRN', True, 'CL_TRN'),
    ('IT_MAT', 'Training Materials', 'INC_TRN', True, 'CL_TRN'),
    ('IT_BAD', 'Bad Debt Write-off', 'EX_BADDEBT', False, 'CL_OH'),
]
PAYMENT_METHODS = [('PM_CHECK', 'Check', 'NON_CREDIT_CARD'), ('PM_ACH', 'ACH', 'NON_CREDIT_CARD'), ('PM_CARD', 'Credit Card', 'CREDIT_CARD'),
                   ('PM_WIRE', 'Wire', 'NON_CREDIT_CARD'), ('PM_CASH', 'Cash', 'NON_CREDIT_CARD')]
TERMS = [('Due on receipt', 0), ('Net 15', 15), ('Net 30', 30), ('Net 45', 45), ('Net 60', 60)]

# ---- counterparties (invented) ------------------------------------------------------------------------------------------
CUST_A = ['Alderbrook', 'Bluefin', 'Copperleaf', 'Driftwood', 'Emberline', 'Fernhollow', 'Granitecrest', 'Hollowpine', 'Ironvale',
          'Juniper Row', 'Kestrel Point', 'Lanternfield', 'Mossgrove', 'Northwick', 'Oakhaven', 'Pebblebrook', 'Quillstone', 'Redfern',
          'Saltmarsh', 'Thistledown', 'Umberfield', 'Velvet Ridge', 'Willowmere', 'Yarrowby', 'Zephyr Bay', 'Amberwick', 'Briarcliff',
          'Cinderhill', 'Dovetail', 'Elmstead']
CUST_B = ['Dental Group', 'Logistics Co.', 'Builders', 'Family Clinic', 'Outfitters', 'Credit Union', 'Veterinary', 'Architects',
          'Property Mgmt', 'Coffee Roasters', 'Freight', 'Law Partners', 'Bakehouse', 'Orthodontics', 'Engineering', 'Realty',
          'Supply Co.', 'Academy', 'Brewing Co.', 'Home Health']
SUBCONTRACTORS = ['Quarrystone Data Labs', 'Brindle & Finch Consulting', 'Tidewater Dev Collective', 'Saffron Pixel Studio',
                  'Northgate Cloud Partners', 'Larchmont Analytics Group', 'Kettle Creek Contractors']
VENDORS = {  # code: (display name, terms days)
    'V_LANDLORD': ('Quarry Street Properties', 0), 'V_POWER': ('Valley Light & Power', 0), 'V_TELCO': ('Cirrus Fiber Telecom', 30),
    'V_ITS': ('Cobalt Ridge Systems', 30), 'V_CPA': ('Marlowe & Pratt CPAs', 30), 'V_INSURE': ('Keystone Mutual Insurance', 0),
    'V_BANK': ('Larkspur Bank', 0), 'V_VEHFIN': ('Crestline Auto Finance', 0), 'V_PAYROLL': ('Paystream Payroll Services', 0),
    'V_FEDTAX': ('Federal Payroll Tax Deposit', 0), 'V_STTAX': ('State Payroll Tax Agency', 0), 'V_SALESTAX': ('State Sales Tax Office', 0),
    'V_STATEFEE': ('Secretary of State Filings', 0), 'V_AUTO': ('Brightway Auto Exchange', 0), 'V_MKTG': ('Bramble Street Creative', 30),
    'V_OWNER': ('Jordan Avery (Owner)', 0), 'V_CARDISS': ('Harborline Card Services', 0),
}
CARD_MERCHANTS = {  # code: (name, account, monthly count, median amount)
    'M_SW1': ('Lumen Docs Suite', 'EX_SW', 1, 420.0), 'M_SW2': ('Paperkite CRM', 'EX_SW', 1, 310.0),
    'M_SW3': ('Fathom Design Cloud', 'EX_SW', 1, 165.0), 'M_HOST': ('Nimbus Stack Hosting', 'COGS_SW', 1, 1_450.0),
    'M_DSW': ('Gridline Dev Tools', 'COGS_SW', 1, 380.0), 'M_AIR': ('Skyhop Airlines', 'EX_TRV', 2, 410.0),
    'M_HOTEL': ('Lodgewell Hotels', 'EX_TRV', 2, 265.0), 'M_RIDE': ('Metro Ride Share', 'EX_TRV', 5, 32.0),
    'M_CAFE': ('Corner Kettle Cafe', 'EX_MEAL', 6, 46.0), 'M_BISTRO': ('Little Fig Bistro', 'EX_MEAL', 3, 118.0),
    'M_OFFICE': ('Paperclip Depot', 'EX_OFF', 3, 74.0), 'M_ADS': ('Signal Ads Network', 'EX_MKT', 2, 520.0),
    'M_FUEL': ('Roadstar Fuel', 'EX_VEH', 4, 61.0), 'M_FIX': ('Handyline Repairs', 'EX_RM', 0, 240.0),
}
FIRST_NAMES = ['Avery', 'Blake', 'Casey', 'Devon', 'Emerson', 'Finley', 'Harper', 'Jules', 'Kendall', 'Logan', 'Morgan', 'Parker',
               'Quinn', 'Reese', 'Rowan', 'Sawyer', 'Tatum']
LAST_NAMES = ['Ashdown', 'Brightwater', 'Calloway', 'Dunmore', 'Everly', 'Fairbrook', 'Greywood', 'Hollister', 'Ivers', 'Kinsley',
              'Lockridge', 'Merriweather', 'Northcott', 'Pendleton', 'Rainsford', 'Sterling', 'Thornbury']
COMPANY_NAME = 'ACME Advisory Services LLC'
