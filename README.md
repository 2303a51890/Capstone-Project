# College Placement Portal

A capstone web application for managing campus recruitment. Students can discover eligible jobs and follow their applications, while recruiters and the Training and Placement Office (TPO) manage hiring and placement activity.

## Features

| Role | What you can do |
| --- | --- |
| Student | Maintain your academic profile and resume, browse job openings, check eligibility, apply, and track application status. |
| Company HR | Publish job openings, review applicants, and update candidate status. |
| TPO administrator | Monitor placement activity, manage student and company records, and update applications in bulk. |

The portal also includes an ATS-style resume analysis, Gemini-powered job-match feedback, and external job listings.

## Tech stack

- **Frontend** — React, TypeScript, Vite, Tailwind CSS, React Router, and Recharts
- **Backend** — Firebase Authentication, Cloud Firestore, and Cloud Functions for Firebase
- **Hosting** — Firebase Hosting serves the Vite build from `dist/`

## Run locally

Use Node.js 24 and npm. The Functions package targets Node.js 24.

```sh
git clone https://github.com/2303a51890/Capstone-Project.git
cd Capstone-Project
npm ci
```

To connect your own backend, register a web app in your Firebase project, enable Google and Email/Password sign-in, and create a Cloud Firestore database. Register your local development host in Firebase Authentication's authorized domains if needed. Create a `.env.local` file at the repository root using values from your Firebase web app configuration.

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_STORAGE_BUCKET=
```

```sh
npm run dev
```

Open the local URL printed by Vite. The development server runs the frontend. Features that call Cloud Functions require the functions to be deployed to the Firebase project in `asia-south1`.

## Checks

| Command | Purpose |
| --- | --- |
| `npm test` | Run the ATS and job-data tests. |
| `npm run lint` | Check frontend code with Oxlint. |
| `npm run build` | Type-check the frontend and build it into `dist/`. |
| `npm run preview` | Preview the production build locally. |

## Deploy to Firebase

Sign in with the Firebase CLI and use the project ID for your backend. Configure `GEMINI_API_KEY` in the Functions environment for job-match analysis. Keep that key server-side and out of Git.

```sh
npm ci --prefix functions
npm run build
firebase deploy --only hosting,firestore,functions --project YOUR_PROJECT_ID
```

## Project structure

| Path | Contents |
| --- | --- |
| `src/` | Portal interface, Firebase client setup, resume analysis, and job data logic. |
| `functions/src/` | Cloud Functions for Gemini analysis and external job data. |
| `public/` | Static assets served by the frontend. |
| `tests/` | Automated tests for ATS scoring and job data. |
| `firebase.json` | Hosting, Firestore, and Functions deployment configuration. |
| `firestore.rules` and `firestore.indexes.json` | Database access rules and indexes. |
| [`DOCUMENTATION.md`](DOCUMENTATION.md) | Architecture, database design, and placement workflows. |
