## 1 User Authentication
Email/password or social auth
User roles: Free / Paid (optional for later).
## 2 Script Recording
Users click "Record Script"
Launches a sandbox browser (via browserless.io or internal)
Records click/type actions
Translates into editable Playwright script
## 3 Script Editor
View/edit raw Playwright code
Add metadata (script name, notes, schedule)
## 4 Script Execution
Run script on demand or scheduled
Execution occurs in isolated Docker container
Return:
Console logs
Screenshots
Scraped data (optional: structured JSON output)
## 5 Job Scheduling
User sets cron schedule or triggers manual run
Queued jobs executed via job runner
## 6 Result Viewing
UI shows run history per script
Output: status, logs, screenshots
