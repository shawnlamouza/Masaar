# Publish Masaar to GitHub

The repository is initialized on branch `main`, all intended files are staged, legacy documents/temp files are ignored, and `git diff --cached --check` passes. A remote repository was not created because no GitHub CLI/account connection or Git author identity is available on this machine.

After supplying the correct identity, run:

```powershell
git config user.name "YOUR NAME"
git config user.email "YOUR VERIFIED GITHUB EMAIL"
git commit -m "Build Masaar competition platform"
git remote add origin https://github.com/YOUR-ACCOUNT/masaar.git
git push -u origin main
```

Create the empty GitHub repository without a generated README, `.gitignore`, or license so it does not conflict with the prepared local history. Add repository secrets required by `.github/workflows/deploy-staging.yml`, protect `main`, require the CI checks, and never commit `.env` or database/provider credentials.
