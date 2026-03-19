---
name: fix-web
description: Fix the website
argument-hint: "[website-name] [issue-description]"
---

Fix the issue with the website.

Test the website locally to ensure the issue is resolved.

Use playwright to run end-to-end tests on the website to verify that the issue is fixed and that no new issues have been introduced.

Provide a url for user to verify the fix. Ask the user to verify the fix and provide feedback. If the user confirms that the issue is resolved, proceed to the next step. If not, investigate further and make necessary adjustments until the issue is resolved.

Clean up any temporary files and services used during the testing process.

Finally, /push-to-github 
