Deployment notes — quick guide

This file explains how to publish the project and run it on a production host (example: Render).

1) Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
# replace URL with your repo
git remote add origin https://github.com/YOURNAME/your-repo.git
git push -u origin main
```

2) Install dependencies on the host or locally before deployment

```bash
cd our-app
npm install
```

3) Optional: If you want to use S3 for storage
- Create an S3 bucket
- Set the following environment variables in your host:
  - `AWS_S3_BUCKET`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION` (optional)

4) Deploy on Render (example)
- Create a new Web Service on Render and link the GitHub repository
- Build command: `npm install`
- Start command: `node server.js`
- Add environment variables (if using S3)

5) Run locally (development)
```bash
# start backend
npm run api
# start frontend
npm run dev
```

Notes
- If you deploy with local FS storage (no S3), make sure your host provides persistent disk; otherwise files will be lost during deploys.
- For production, prefer S3 or provider-managed persistent storage.

If you'd like, I can prepare a GitHub Action or Render configuration file and help you push the repo and connect it to Render. I cannot push to your GitHub account without access — you'll need to provide a token or run the `git push` commands locally.
