# ACME Salary Management — Requirements (v1)

## Goal
Replace the spreadsheets ACME's HR team uses for the salaries of ~10,000 employees in several countries.
The new tool is a web app where the **HR Manager** can (1) keep salary records accurate and (2) answer
questions about **how the org pays people** without building pivot tables by hand.

## Persona & key jobs-to-be-done
**HR Manager** (single persona, desktop browser, uses the tool every day).
- "Find an employee quickly and update their details or salary."
- "Hire or exit someone and keep the records correct."
- "When did this person's salary change, and why?"
- "What do we pay in India compared to Germany? What is the range for a Software Engineer in the US?"
- "Which departments cost the most? How are salaries spread across the org?"
- "Give me this list as a spreadsheet." (Excel will still be used for one-off analysis.)

## Scope & features (v1)
| # | Feature | Notes |
|---|---------|-------|
| 1 | **Employee directory** | Paging, sorting and search (name / email / employee code) all run on the server, so the table stays fast at 10k rows. Filter by country, department and job title. |
| 2 | **Employee CRUD** | Create, view, edit and delete. Validation: required fields, unique email, salary > 0, supported country, and a currency that follows from the country. |
| 3 | **Salary history** | Each salary change is saved with the old and new amount, the effective date and a reason. Excel never kept this audit trail. |
| 4 | **Pay insights** | Org overview (headcount, countries, total payroll in USD, median salary in USD). Per country: headcount and min / max / avg / median in local currency. Per job title within a country: min / max / avg. Per department: headcount and average salary in USD. A histogram of salaries in USD. |
| 5 | **CSV export** | Exports the directory with the current filters applied. |
| 6 | **Seed data** | A repeatable script that creates 10,000 realistic employees. |

**Non-functional requirements:** list and insight endpoints respond in under 300 ms on 10k rows. Salaries are stored as
whole integers, never floats. Tests are fast and deterministic. The app deploys as one service.

## Deliberately left out (and why)
| Left out | Reasoning |
|----------|-----------|
| **Authentication / roles** | There is one persona and the data is synthetic. Adding auth would take time away from the core workflows. It is the first item for production, most likely SSO in front of the app. |
| **Payroll, tax, payslips, benefits** | That is a different product (payroll). This tool is about *managing and understanding* pay. |
| **Live exchange rates** | A static table of USD rates keeps insights deterministic and testable. Its "as-of" date is documented. A rates feed could replace it later. |
| **Bulk Excel/CSV import** | Valuable for migration, but column mapping, partial failures and dedupe make it a large feature on its own. Planned for v2. |
| **Approval workflows, notifications, multi-tenancy** | Not needed by a single HR manager in one org. They add complexity without answering the core questions. |
| **Postgres** | SQLite handles 10k rows comfortably and keeps deployment to one container. All access goes through SQLAlchemy, so moving to Postgres is a config change. |

## Success criteria
- HR can find any employee and update a salary in under 30 seconds. The change shows up in history immediately.
- Each of the "how do we pay" questions above can be answered in one or two clicks.
- The deployed app has 10,000 seeded employees, and the test suite is green in CI.
