# 🇪🇹 Ethiopian Payroll System

A comprehensive payroll management system designed specifically for Ethiopian private sector companies, fully compliant with Ethiopian labor laws and tax regulations.

## Features

### ✅ Legal Compliance
- **Ethiopian Tax Brackets**: Implements the official progressive income tax rates
- **POESSA Integration**: Automatic calculation of Private Organization Employees' Social Security Agency contributions
- **Overtime Regulations**: Compliant with Ethiopian labor law overtime multipliers
- **Tax-Exempt Allowances**: Proper handling of transportation and per diem allowances

### 💰 Payroll Calculations

#### Gross Earnings Calculation
- Basic Monthly Salary
- Taxable Allowances (Housing, Hardship)
- Tax-Exempt Allowances (Transportation, Per Diem)
- Overtime Pay with legal multipliers:
  - Weekday Overtime: **×1.25** (6am-10pm beyond regular hours)
  - Night Overtime: **×1.5** (10pm-6am)
  - Weekly Rest Day Overtime: **×2.0**
  - Public Holiday Overtime: **×2.5**

#### Mandatory Deductions
1. **POESSA Contribution**: 7% of basic salary (capped at ETB 15,000)
2. **Employment Income Tax**: Progressive tax brackets
3. **Other Deductions**: Loans, union dues, etc.

#### Ethiopian Tax Brackets (2024)
| Income Range (ETB/Month) | Tax Rate | Deductible Amount |
|-------------------------|----------|-------------------|
| ≤ 600                   | 0%       | 0.00             |
| 601 - 1,650            | 10%      | 60.00            |
| 1,651 - 3,200          | 15%      | 142.50           |
| 3,201 - 5,250          | 20%      | 302.50           |
| 5,251 - 7,800          | 25%      | 565.00           |
| 7,801 - 10,900         | 30%      | 955.00           |
| ≥ 10,901               | 35%      | 1,500.00         |

## System Architecture

### Input Data Fields
- **Employee ID**: Unique identifier
- **Employee Name**: Full name
- **Basic Monthly Salary**: Fixed base pay in ETB
- **Allowances (Taxable)**: Housing, hardship allowances
- **Allowances (Tax-Exempt)**: Transportation, per diem
- **Overtime Hours**: Categorized by type and time
- **Other Deductions**: Voluntary deductions

### Calculation Logic
1. **Hourly Rate**: Basic Salary ÷ 208 hours (48 hours/week × 52 weeks ÷ 12 months)
2. **Overtime Pay**: Hours × Hourly Rate × Multiplier
3. **Gross Earnings**: Basic + Allowances + Overtime
4. **POESSA**: Min(Basic Salary, 15,000) × 7%
5. **Taxable Income**: Gross - Tax-Exempt Allowances - POESSA
6. **Income Tax**: Progressive calculation based on brackets
7. **Net Pay**: Gross - (POESSA + Income Tax + Other Deductions)

## Usage Instructions

### 1. Access the System
- Open `payroll.html` in your web browser
- The system loads employee data from `data.json`

### 2. Process Payroll
1. Select the payroll month and year
2. Click "Process Payroll" to calculate all employees
3. Review the payroll summary cards

### 3. Edit Individual Payroll
1. Click the edit button (✏️) for any employee
2. Enter allowances and overtime hours
3. View real-time calculations
4. Save changes

### 4. Generate Payslips
1. Click the receipt button (🧾) for any employee
2. Review the detailed payslip
3. Print or save as needed

### 5. Generate Reports
- Click "Generate Report" to download a CSV file
- Contains complete payroll data for all employees
- Includes summary totals for remittances

## Sample Employees

The system includes 5 sample Ethiopian employees:

1. **Abebe Kebede** (ETH-001) - General Manager - ETB 18,000
2. **Almaz Tesfaye** (ETH-002) - HR Manager - ETB 12,000
3. **Dawit Haile** (ETH-003) - Software Developer - ETB 8,000
4. **Hanan Mohammed** (ETH-004) - Accountant - ETB 6,500
5. **Yohannes Girma** (ETH-005) - Marketing Specialist - ETB 4,500

## Payslip Features

### Professional Ethiopian Payslip
- Ethiopian flag branding
- Company and employee information
- Detailed earnings breakdown
- Overtime calculations with multipliers
- Tax bracket information
- POESSA contributions
- Net pay calculation
- Print-ready format

### Payroll Register
- Monthly summary for all employees
- Total gross earnings
- Total employee POESSA contributions
- Total employer POESSA contributions (11%)
- Total income tax withheld (for ERCA remittance)
- Total net pay

## Technical Features

- **Responsive Design**: Works on desktop and mobile
- **Real-time Calculations**: Instant updates as you type
- **Data Persistence**: Saves payroll data locally
- **Export Functionality**: CSV reports for accounting
- **Print Support**: Professional payslip printing
- **Bootstrap UI**: Modern, professional interface

## Legal Notes

### POESSA (Private Organization Employees' Social Security Agency)
- **Employee Rate**: 7% of basic salary
- **Employer Rate**: 11% of basic salary (tracked but not deducted from employee)
- **Cap**: ETB 15,000 maximum insurable earnings

### Employment Income Tax (EIT/PAYE)
- Progressive tax system
- Based on taxable income after POESSA and tax-exempt allowances
- Rates updated for 2024 tax year

### Overtime Regulations
- Standard work week: 48 hours (8 hours/day, 6 days/week)
- Monthly standard hours: 208 hours
- Overtime multipliers as per Ethiopian Labor Proclamation

## Installation

1. Ensure you have a web server running (use `simple-server.js` or `START_SERVER.bat`)
2. Place all files in the web server directory
3. Access `payroll.html` through your web browser
4. The system will automatically load employee data

## File Structure

```
├── payroll.html              # Main payroll system interface
├── data.json                 # Employee and payroll data
├── assets/
│   ├── css/dashboard.css     # Styling
│   └── js/
├── simple-server.js          # Local web server
└── ETHIOPIAN_PAYROLL_README.md
```

## Compliance & Updates

This system is designed to comply with Ethiopian labor laws and tax regulations as of 2024. Tax brackets and rates should be updated annually or as regulations change. Always consult with local tax authorities and legal experts for the most current requirements.

## Support

For questions about Ethiopian payroll regulations, consult:
- Ethiopian Revenues and Customs Authority (ERCA)
- Private Organization Employees' Social Security Agency (POESSA)
- Ministry of Labour and Social Affairs

---

**Note**: This system is for educational and demonstration purposes. Always verify calculations with current Ethiopian tax laws and consult with qualified professionals for production use.