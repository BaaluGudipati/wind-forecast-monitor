# Deployment and submission steps

## 1. Push the code to a public GitHub repo

1. Sign in at <https://github.com> and click **New repository**.
2. Name: a random string, for example `kjhwr7q`. Set it to **Public**. Do **not** add a README, .gitignore or licence (the repo already has them).
3. In a terminal, in the project folder:

```bash
git init
git add .
git commit -m "Wind Forecast Monitor pilot"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

4. On GitHub, open the **Actions** tab and check that CI passes (green tick).

## 2. Deploy on Vercel

1. Sign in at <https://vercel.com> with your GitHub account.
2. **Add New → Project →** import the repo.
3. Leave **Framework Preset** as *Other* and **Root Directory** as `./`. `vercel.json` already sets the build command, output folder and API routing.
4. Click **Deploy**. After about a minute you get a URL such as `https://<name>.vercel.app`.
5. Check that `https://<name>.vercel.app/api/health` returns `{"status":"ok"}` and that the dashboard loads.
6. Put the URL in `README.md` (replace `<ADD YOUR VERCEL URL HERE>`), commit and push. Vercel redeploys automatically.

## 3. Video

1. Record using `docs/VIDEO_SCRIPT.md` (10 minutes or less).
2. Upload to YouTube and set **Visibility: Unlisted**.

## 4. Before submitting the form

Open each link in an **incognito window** and check that it works without signing in:
- [ ] YouTube video (unlisted, plays)
- [ ] GitHub repo (public, README shows)
- [ ] Vercel app (loads, charts show data)

Then fill in the submission form.
