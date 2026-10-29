# GitHub draft PR export

AccessFix can export one accepted component to a draft pull request from the **local developer workspace**. It never merges the PR. Shared hosted demos, including the Mac judge worker, disable repository writes.

## Configure the destination

1. Sign in locally with `gh auth login`, using an account with write access to the target repository.
2. Set `ACCESSFIX_GITHUB_REPO=owner/repository` in the local `.env` file. This is the only allowed destination; the browser cannot select another repository.
3. Alternatively, provide `ACCESSFIX_GITHUB_TOKEN` in the server process environment. A fine-grained token needs Contents and Pull requests read/write permission for the allowed repository. Credentials stay on the server and are never returned by the API.
4. Audit and verify the exact component source using a supported contract. For an external component, use the CLI and open its saved evidence in the local dashboard.

The repository must already contain the audited component on its default branch. This workflow does not create new files, branches from forks, or repository-wide changes.

## Review and export

Open an accepted run, expand **GitHub draft PR**, enter the repository-relative `.tsx` path, and select **Preview draft PR**. The preview reads the repository's default branch and verifies that the destination is a regular tracked file whose source hash exactly matches the baseline. Hidden directories, parent traversal, symlinks and submodules are rejected.

Review the repository, base revision, file and full diff. **Create draft PR on GitHub** creates an `accessfix/<run-id>` branch with one component replacement and a concise verification summary. Screenshots, local credentials and other files are not uploaded. The draft records whether the candidate came from live inference, recorded-candidate verification or a prepared exercise.

Only candidates accepted by the current verification gate can be exported. Replaying the recorded AI repair produces current evidence without another model request. An old saved verdict alone is insufficient.

## Failure and recovery

- If the default branch changes after preview, obtain a fresh preview before creating a new export.
- If its component differs from the audited source, audit the current component instead of overwriting it.
- A local ownership record is saved before any GitHub mutation. Repeating an interrupted export recovers its existing branch and draft rather than creating another commit or PR.
- Recovery preserves the originally reviewed base revision. If the default branch has advanced, GitHub may require conflict resolution and another review.
- An existing branch without an ownership record, or a recovery branch containing unexpected changes, is never overwritten.
- Keep `.accessfix/runs/<run-id>/github-export.json` until the export is resolved. Do not run several API processes against the same run-data directory.

The browser preview expires after 15 minutes. Close and reopen the export panel and preview again after a server restart. A recovered PR may already be closed or ready for review; check its current status on GitHub before further action.

Automated acceptance covers the selected isolated component contract. Review the patch, test it in the real application, and test with assistive technology before merging. API behavior follows GitHub's [contents](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents), [references](https://docs.github.com/en/rest/git/refs#create-a-reference) and [pull requests](https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request) endpoints.
