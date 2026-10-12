# Result Admin Panel — Calculation Engine Integration

This version keeps the existing Admin Panel UI/data prototype but adds the user's verified calculation engines behind a new **Process Result** page.

## Enabled engines

### UG / BBA Semester 1
Uses the supplied calculation structure:
- subject-wise practical detection
- practical/non-practical mark weighting
- round calculated total before grace
- 8 grace marks maximum per student
- 5 grace marks maximum per subject
- grace priority: Major CP 1 → Major CP 2 → Minor → MDC/MDE → AEC → VAC
- grade + grade point + credit point
- SGPA

### PG 2025 Semester 1
Uses the supplied PG calculation script and supplied `pg2025Sem1Config`:
- department-specific paper configuration
- theory: midsem + final
- practical: final/practical mark as used by the supplied engine
- AB / M handling
- percentage-based grading
- credit point
- SGPA

## How to use

1. Start the Next.js app.
2. Open **Process Result**.
3. Select Program, Semester and Batch.
4. Paste the same raw JSON structure used by the existing calculation script, or upload a `.json` file.
5. Click **Calculate Result**.
6. Review the calculated result JSON and summary.

## Important

Only UG/BBA Semester 1 and PG 2025 Semester 1 are enabled in this phase. Other semesters should be added only after their verified calculation engine/config is supplied.

The old **Results (legacy)** screen is intentionally marked as legacy because it still uses the original generic sum/pass calculator. It must not be used for official publication.

## Next integration phase

- Connect Excel/mark-foil import directly to the raw JSON structure expected by each engine.
- Add result verification and approval.
- Persist calculation runs.
- Add publish/unpublish.
- Add Grade Sheet, Tabular Register and Result Statistics.
- Replace JSON persistence with the college MongoDB/backend when the API contract is ready.


## Excel mark-foil input

The Process Result page now accepts `.xlsx` and `.xls` mark-foil files directly. The admin user does not need to create or paste JSON. SheetJS reads the first worksheet into an internal JavaScript representation, which is then passed to the verified calculation engine.

The Process Result API now maps the college PG mark-foil layout into the internal `courses[]` structure expected by the supplied PG 2025 Semester 1 engine. For PG, the selected Department in the Admin Panel is used as the authoritative department. The mapper detects repeating columns such as `Paper 1.1`, `Midsem-Mark`, `Final-Mark`, `Paper 1.2`, `Midsem-Mark_1`, `Final-Mark_1`, etc.

Important: the exact Excel-to-engine field mapping must still be verified against the college's real mark-foil format before using Process Result for publication. Do not publish a result until that mapping has been tested against the existing calculation script output.
