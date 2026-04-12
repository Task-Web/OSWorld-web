---
name: improve-web
description: Improve the website
argument-hint: "[website-name] [improvement-description]"
---

Improve the website.

When the improvement touch web state, make sure the state still works for already existing web states in state/ and the improvement is compatible with them. If not, make necessary adjustments to ensure compatibility.

Test the website locally to ensure the improvement is working as expected.

Use playwright to run end-to-end tests on the website to verify that the improvement is effective and that no new issues have been introduced.

Provide a url for user to verify the improvement. Ask the user to verify the improvement and provide feedback. If the user confirms that the improvement is satisfactory, proceed to the next step. If not, investigate further and make necessary adjustments until the improvement is satisfactory.

Clean up any temporary files and services used during the testing process.

Finally, /push-to-github 
