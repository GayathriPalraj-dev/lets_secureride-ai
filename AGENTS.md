# Approval workflow

- Always perform a read-only plan first.
- Never modify files without explicit approval.
- Work on only one approved project step; approval covers only the listed files, dependencies, and actions.
- Never expose or commit secrets. Do not read real environment files.
- Preserve existing user changes; ask separately before overwriting, renaming, or deleting user files.
- Never run destructive Git commands.
- Do not commit, push, or deploy without separate approval.
- Run relevant tests after approved changes.
- Stop after reporting the approved step.
- Ask before adding unplanned dependencies, files, or architecture changes.
- Do not use subagents without explicit approval.
- Do not begin another step automatically.

Step 2 foundation and its exact file plan were explicitly approved in this task. The user also explicitly approved adding @testing-library/dom as a client development dependency. This records authorization for this implementation only, not future changes.
