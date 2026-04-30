---
name: new-web
description: Add a new website
argument-hint: "[description of the new website]"
---

The current repository is a collection repository for websites. Each website is stored as a submodule in the repository, and the submodule repositories are all hosted on GitHub as private repositories.  

I now want to add a new website. It should be based on `basesite` and retain the interfaces from `basesite`.  

You should use english.

The steps you may need to take are as follows:  

1. First, copy the files of `basesite` (excluding Git-related files), rename the copy, initialize it as a repository, and publish it using `gh` (assuming `gh` is already logged in). Then, add the repository as a submodule.  
2. On the basis of `basesite`, implement the target website. Retain the framework, language, and api interfaces of `basesite`. `basesite/constitution.md` should be followed to ensure that the implementation of the new website is consistent with the constitution.  
3. Edit web-compose.yml to fit the new website.
4. Use Playwright to operate the browser and verify the functionality. 
5. Run `npm run build` to check if the website can be built successfully. If there are any build errors, fix them until the website can be built successfully.
6. Provide a URL for the user to verify the new website and ask for feedback. If the user confirms that the website is working as expected, proceed to the next step. If not, investigate further and make necessary adjustments until the website is working as expected.
7. Finally, /push-to-github.  

You can use AskUserQuestions to ask me questions if you need more information or clarification.