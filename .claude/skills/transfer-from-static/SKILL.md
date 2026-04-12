---
name: transfer-from-static
description: Create a new website by transferring from a static website
argument-hint: "[path-to-static-website]"
---

The current repository is a collection repository for websites. Each website is stored as a submodule in the repository, and the submodule repositories are all hosted on GitHub as private repositories.  

I now want to add a new website. This website should reference the site located at `<path-to-static-website>` to ensure consistency in appearance and functionality. At the same time, it should be based on `basesite` and retain the interfaces from `basesite`.  

In simple terms, the task is to transform a purely front-end website into a front-end and back-end website based on `basesite`. Note that all user operations leading to state changes should be immediately synchronized with the back-end state in real time.  

The steps you may need to take are as follows:  

1. First, copy the files of `basesite` (excluding Git-related files), rename the copy, initialize it as a repository, and publish it using `gh` (assuming `gh` is already logged in). Then, add the repository as a submodule.  
2. On the basis of `basesite`, implement the target website so that it looks and functions the same as the original. Retain the framework, language, and interfaces of `basesite`. The final result should match the target website.  
3. Some features of the current website may be incomplete or not yet implemented. You should implement all visible and interactive features on the page during this step. Use Playwright to operate the browser and verify the functionality. Finally, push the changes to GitHub using `gh`.  

Start the task.