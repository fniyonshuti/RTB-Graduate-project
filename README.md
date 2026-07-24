# Competra - Skills Gap Analysis Tool

Competra is a full-stack capstone project for assessing ICT TVET graduate competency readiness in Kicukiro District, Rwanda. The system helps learners, organizations, and administrators compare demonstrated ICT skills against RTB-aligned competency benchmarks, calculate skills gaps, generate recommendations, notify users, and produce downloadable reports.

The project was built as a practical skills assessment system. It does not depend only on self-reported skills. Competra uses GitHub repository evidence, admin-defined repository review checklists, theory questions, benchmark comparison, and Gemini-powered guidance to support more objective skills gap analysis.

## Live Application

| Item | URL |
| ---- | --- |
| Frontend | https://rtb-graduate-project.vercel.app/ |
| Backend API | https://rtb-graduate-project.onrender.com/api |
| API health check | https://rtb-graduate-project.onrender.com/api/health |
| Demo video | https://docs.google.com/document/d/1c0gMfJDdh6FZgHur0QYa_gu9NMmWGgFYGAZr0C8HBaY/edit?tab=t.0 |

## Technology Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, Recharts, Lucide React |
| Backend | Node.js, Express.js, ES Modules |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JWT, Google OAuth, email verification code |
| Email | Brevo transactional email API |
| Repository review | GitHub API, admin-defined checklists, E2B isolated sandbox |
| AI recommendation | Google Gemini API |
| Deployment | Vercel frontend, Render backend |

## Main Users and Roles

| Role | Main access |
| ---- | ----------- |
| `normal_user` | Public learner account. Can register, verify email, complete profile, take assessments, view results, recommendations, reports, and notifications. |
| `organization_user` | Learner account linked to an organization. Can take assessments and view own assessment outputs. |
| `org_admin` | Organization administrator. Can manage organization users and view organization-scoped data. |
| `admin` | System administrator. Can manage organizations, users, competencies, benchmarks, checklists, assessments, recommendations, notifications, and reports. |
| `super_admin` | Highest platform role used for initial platform administration. |

`assessor` exists only for legacy compatibility in old data. New operational accounts should use the roles above.

## Core System Workflow

1. A user creates an account, accepts Terms and Privacy Policy, and verifies email using a code sent through Brevo.
2. The user completes a profile with only system-relevant data: name, email, phone, organization, district, sector, program, graduation year, and specialization.
3. The user selects an RTB-aligned ICT competency.
4. The user submits GitHub practical evidence and theory answers.
5. The system reviews the GitHub repository using the selected practical task, admin-created checklist, GitHub metadata, source evidence, and E2B sandbox execution when configured.
6. The system scores theory answers from competency theory questions.
7. The system calculates the final competency score.
8. The system compares the final score with the RTB benchmark score.
9. The system calculates the skill gap and classifies the gap level.
10. Gemini generates performance-based recommendations with action items and learning resources.
11. The system notifies the user and generates a learner-owned report.

## Scoring and Gap Logic

Competra currently uses two evidence sources for the final graduate competency score.

```text
Final Score = (GitHub Practical Task Score x 0.70) + (Theory Score x 0.30)
```

```text
Skill Gap = RTB Benchmark Score - Final Graduate Score
```

If the calculated skill gap is negative, the system stores the gap as `0`.

| Skill gap value | Gap level |
| --------------- | --------- |
| 0 | No Gap |
| 1-5 | Very Low Gap |
| 6-15 | Low Gap |
| 16-25 | Moderate Gap |
| Above 25 | High Gap |

## Repository Review Accuracy

Repository review is based on evidence, not fake scores. The system can:

- Verify repository URL format and accessibility.
- Fetch GitHub repository metadata through the GitHub API.
- Read repository documentation and supported source files.
- Detect project type and technologies.
- Use admin-created checklist requirements as the scoring guide.
- Run repository analysis in an E2B isolated sandbox when execution is configured.
- Check build/test signals where available.
- Record passed and failed checklist items.
- Calculate a practical score from checklist weights.
- Store repository review data in MongoDB.
- Mark requirements that still require human validation when automatic evidence is insufficient.

Important limitation: automatic analysis can verify observable evidence and configured execution outputs, but it cannot perfectly prove every possible implementation style. For high-stakes assessment, admin/assessor validation should still review the automatic result.

## Recommendation Logic

Gemini recommendations are generated from real assessment context:

- selected competency
- benchmark score
- GitHub practical score
- theory score
- final score
- skill gap and gap level
- failed checklist requirements
- repository summary
- weak areas and strengths

Recommendations include:

- summary feedback
- weak areas
- strengths
- action items
- learning resources such as courses, documentation, videos, tools, or search links

Resource links are generated from Gemini output and/or configured resource search settings.

## Authentication and Account Security

Competra includes:

- JWT authentication.
- Google OAuth sign-in/sign-up.
- Google profile picture support when the Google account provides a photo.
- Strong password validation on frontend and backend.
- Password show/hide controls.
- Email verification code before normal email/password login.
- Password reset through Brevo email.
- Terms and Privacy Policy acceptance stored on registration.
- Role-based access control for protected data.
- Learner reports restricted to the assessed learner.

Password rules:

- at least 8 characters
- at least one uppercase letter
- at least one lowercase letter
- at least one number
- at least one special character
- no spaces

## Project Structure

```text
RTB-Graduate-project/
  backend/
    src/
      app.js
      server.js
      config/
      constants/
      controllers/
      middleware/
      models/
      routes/
      scripts/
      services/
    tests/
    package.json
    .env.example

  my-project/
    public/
    src/
      api/
      assets/
      components/
      constants/
      context/
      pages/
      utils/
      App.tsx
      main.tsx
      types.ts
    package.json
    .env.example

  docs/
  render.yaml
  vercel.json
  README.md
```

## Important Files

| File | Purpose |
| ---- | ------- |
| `backend/src/server.js` | Starts the API server and connects to MongoDB. |
| `backend/src/app.js` | Configures Express middleware, API routes, CORS, rate limiting, and error handling. |
| `backend/src/config/db.js` | Handles MongoDB connection. |
| `backend/src/models/*.js` | Mongoose models for users, organizations, competencies, checklists, benchmarks, assessments, recommendations, reports, and notifications. |
| `backend/src/routes/*.js` | API route definitions. |
| `backend/src/controllers/*.js` | HTTP request and response handlers. |
| `backend/src/services/*.js` | Business logic for auth, GitHub analysis, assessments, recommendations, email, reports, dashboards, and notifications. |
| `my-project/src/api/client.ts` | Frontend API client. |
| `my-project/src/context/AuthContext.tsx` | Authentication state management. |
| `my-project/src/pages/AuthPages.tsx` | Homepage, login, register, verification, forgot password, and reset password UI. |
| `my-project/src/pages/MainPages.tsx` | Role-based dashboards and main system pages. |
| `my-project/src/components/layout.tsx` | Sidebar, header, profile menu, and role navigation. |
| `my-project/src/components/common.tsx` | Reusable UI controls, cards, tables, charts, alerts, modals, and form components. |

## Prerequisites

- Node.js 20 or newer recommended.
- npm.
- MongoDB Atlas database.
- Brevo account and verified sender email for transactional email.
- Google OAuth Client ID for Google sign-in/sign-up.
- Gemini API key for recommendations.
- GitHub token recommended for higher API limits or private repositories.
- E2B API key for isolated repository execution.

## Backend Environment Variables

Create `backend/.env` from `backend/.env.example`.

```env
PORT=5000
HOST=0.0.0.0
API_PUBLIC_URL=http://localhost:5000/api
NODE_ENV=development
APP_NAME=Competra
LOCAL_DEVELOPMENT_HOSTS=localhost,127.0.0.1

MONGO_URI=mongodb+srv://<db_username>:<db_password>@<cluster-host>/rtb_skills_gap?retryWrites=true&w=majority
MONGO_DIRECT_URI=
DB_CONNECT_TIMEOUT_MS=8000

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN_SECONDS=86400

PBKDF2_ITERATIONS=120000
PBKDF2_KEY_LENGTH=64
PBKDF2_DIGEST=sha512

FRONTEND_URL=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=300
AUTH_RATE_LIMIT_MAX_REQUESTS=20

PASSWORD_RESET_TOKEN_EXPIRES_MINUTES=15
EMAIL_VERIFICATION_TOKEN_EXPIRES_MINUTES=30
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=60
TEMPORARY_PASSWORD_EXPIRES_HOURS=72
EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE=true

SUPER_ADMIN_NAME=System Admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=replace_with_a_strong_temporary_password
SUPER_ADMIN_INSTITUTION=RTB
SUPER_ADMIN_RESET_PASSWORD=false
SUPER_ADMIN_PROMOTE_EXISTING=false

EMAIL_PROVIDER=brevo
EMAIL_API_KEY=your_brevo_api_key
EMAIL_API_URL=
EMAIL_BREVO_API_URL=https://api.brevo.com/v3/smtp/email
EMAIL_REQUEST_TIMEOUT_MS=15000
EMAIL_FROM=no-reply@your-verified-domain.com
EMAIL_FROM_NAME=Competra
EMAIL_REPLY_TO=
EMAIL_TEST_TO=
TEST_EMAIL_TO=

GITHUB_TOKEN=
GITHUB_WEB_BASE_URL=https://github.com
GITHUB_API_URL=https://api.github.com
GITHUB_API_BASE_URL=https://api.github.com
GITHUB_RAW_BASE_URL=https://raw.githubusercontent.com
GITHUB_API_VERSION=2022-11-28
GITHUB_REQUEST_TIMEOUT_MS=10000
GITHUB_MAX_SAMPLED_FILES=6

REPOSITORY_ANALYSIS_TIMEOUT_MS=120000
TEMP_REPOSITORY_DIR=tmp/repositories
E2B_API_KEY=your_e2b_api_key
E2B_SANDBOX_TIMEOUT_MS=300000

GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/models
GEMINI_RECOMMENDATION_MODEL=gemini-2.5-flash
GEMINI_RECOMMENDATION_API_URL=

RESOURCE_SEARCH_URL=https://www.google.com/search?q=
LEARNING_RESOURCE_URLS_JSON={}

GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

Production notes:

- Set `NODE_ENV=production`.
- Set `FRONTEND_URL` to the deployed frontend URL.
- Set `API_PUBLIC_URL` to the deployed API URL.
- Set `EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE=false` in production.
- Use a strong `JWT_SECRET`.
- Use a verified Brevo sender. A custom domain gives better deliverability, but a verified sender can work for testing.

## Frontend Environment Variables

Create `my-project/.env` from `my-project/.env.example`.

```env
VITE_API_URL=http://localhost:5000/api
VITE_GITHUB_INDIVIDUAL_PROJECT_PLACEHOLDER=https://github.com/username/project
VITE_GITHUB_ORGANIZATION_REPO_PLACEHOLDER=https://github.com/owner/repository
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_IDENTITY_SCRIPT_URL=https://accounts.google.com/gsi/client
VITE_RESOURCE_SEARCH_URL=https://www.google.com/search?q=
```

For the deployed frontend, Vercel should use:

```env
VITE_API_URL=https://rtb-graduate-project.onrender.com/api
```

## Installation and Local Running

Install and run backend:

```powershell
cd backend
npm install
npm run dev
```

Backend local API:

```text
http://localhost:5000/api
```

Install and run frontend:

```powershell
cd my-project
npm install
npm run dev
```

Frontend local URL:

```text
http://localhost:5173
```

## First-Time Setup Order

1. Create a MongoDB Atlas cluster and database user.
2. Add your IP address in Atlas Network Access.
3. Create `backend/.env` from `backend/.env.example`.
4. Set `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, and `API_PUBLIC_URL`.
5. Add Brevo email settings if email verification and password reset should send emails.
6. Add `GOOGLE_CLIENT_ID` for Google OAuth.
7. Add `GEMINI_API_KEY` for recommendations.
8. Add `GITHUB_TOKEN` if needed.
9. Add `E2B_API_KEY` for sandbox execution.
10. Run backend `npm install`.
11. Run `npm run seed:admin` to create the first admin.
12. Run backend `npm run dev`.
13. Create `my-project/.env` with the frontend variables.
14. Run frontend `npm install` and `npm run dev`.
15. Sign in as admin, create organizations, competencies, checklists, and benchmarks.

## Useful Scripts

Backend:

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Start backend with nodemon. |
| `npm start` | Start backend with Node.js. |
| `npm run build` | Run backend syntax check. |
| `npm run check` | Check backend server syntax. |
| `npm run lint` | Run backend ESLint. |
| `npm test` | Run backend tests. |
| `npm run seed:admin` | Create or update the first super admin from `.env`. |
| `npm run seed:competency` | Seed sample competency and benchmark data. |
| `npm run seed:database-api` | Seed database/API competency data. |
| `npm run test:brevo -- recipient@example.com` | Send a Brevo test email. |

Frontend:

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Start Vite development server. |
| `npm run build` | Build production frontend. |
| `npm run preview` | Preview production build. |
| `npm run lint` | Run frontend ESLint. |
| `npm test` | Run frontend Vitest tests. |

## API Overview

Base URL locally:

```text
http://localhost:5000/api
```

Protected endpoints require:

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Health

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api` | Public |
| GET | `/api/health` | Public |

### Authentication

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/google` | Public help message only |
| POST | `/api/auth/google` | Public |
| POST | `/api/auth/forgot-password` | Public |
| POST | `/api/auth/verify-email` | Public |
| POST | `/api/auth/resend-verification` | Public |
| POST | `/api/auth/reset-password` | Public |
| GET | `/api/auth/me` | Authenticated |
| PATCH | `/api/auth/change-password` | Authenticated |

Register example:

```json
{
  "name": "Thierry Niyonshuti",
  "email": "thierry@example.com",
  "password": "StrongPass123!",
  "institution": "IPRC Kigali",
  "termsAccepted": true,
  "privacyPolicyAccepted": true
}
```

Email verification example:

```json
{
  "email": "thierry@example.com",
  "code": "123456"
}
```

Login example:

```json
{
  "email": "thierry@example.com",
  "password": "StrongPass123!"
}
```

Google sign-in example:

```json
{
  "credential": "GOOGLE_ID_TOKEN_FROM_FRONTEND",
  "termsAccepted": true,
  "privacyPolicyAccepted": true
}
```

Forgot password example:

```json
{
  "email": "thierry@example.com"
}
```

Reset password example:

```json
{
  "token": "PASSWORD_RESET_TOKEN",
  "newPassword": "NewStrongPass123!"
}
```

### Organizations

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/organizations/public` | Public |
| GET | `/api/organizations` | Admin, Organization Admin |
| POST | `/api/organizations` | Admin |
| GET | `/api/organizations/:id` | Admin, Organization Admin |
| PUT | `/api/organizations/:id` | Admin |
| DELETE | `/api/organizations/:id` | Admin |

### Users

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/users` | Admin, Organization Admin |
| POST | `/api/users` | Admin, Organization Admin |
| GET | `/api/users/:id` | Admin, Organization Admin |
| PUT | `/api/users/:id` | Admin, Organization Admin |
| DELETE | `/api/users/:id` | Admin, Organization Admin |
| PATCH | `/api/users/:id/deactivate` | Admin, Organization Admin |

### Graduate Profiles

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/graduates/me` | Learner |
| PUT | `/api/graduates/me` | Learner |
| DELETE | `/api/graduates/me` | Learner |
| GET | `/api/graduates` | Admin, Organization Admin |
| GET | `/api/graduates/:userId` | Admin, Organization Admin |
| DELETE | `/api/graduates/:userId` | Admin |

### Competencies

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/competencies` | Authenticated |
| POST | `/api/competencies` | Admin |
| GET | `/api/competencies/:id` | Authenticated |
| PUT | `/api/competencies/:id` | Admin |
| DELETE | `/api/competencies/:id` | Admin |

### Repository Review Checklists

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/checklists` | Admin |
| POST | `/api/checklists` | Admin |
| GET | `/api/checklists/:id` | Admin |
| PUT | `/api/checklists/:id` | Admin |
| DELETE | `/api/checklists/:id` | Admin |

Checklist item weights must total 100 for a selected competency/practical task.

### Benchmarks

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/benchmarks` | Authenticated |
| POST | `/api/benchmarks` | Admin |
| GET | `/api/benchmarks/:id` | Authenticated |
| PUT | `/api/benchmarks/:id` | Admin |
| DELETE | `/api/benchmarks/:id` | Admin |

Benchmark example:

```json
{
  "competency": "COMPETENCY_ID",
  "requiredScore": 80,
  "level": "intermediate",
  "description": "RTB-aligned minimum score for employable web application development competency.",
  "isActive": true
}
```

### Assessments

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/assessments` | Authenticated |
| POST | `/api/assessments` | Learner |
| POST | `/api/assessments/repository-task-review` | Learner |
| GET | `/api/assessments/results/me` | Learner |
| GET | `/api/assessments/results/:id` | Learner |
| GET | `/api/assessments/:id` | Authenticated |
| PUT | `/api/assessments/:id` | Learner, Admin, Organization Admin |
| DELETE | `/api/assessments/:id` | Learner, Admin, Organization Admin |
| PUT | `/api/assessments/:id/review` | Admin |
| POST | `/api/assessments/:id/recommendation-preview` | Admin |

Repository task review example:

```json
{
  "competency": "COMPETENCY_ID",
  "practicalTaskId": "PRACTICAL_TASK_ID",
  "githubRepositoryUrl": "https://github.com/owner/repository"
}
```

Submit assessment example:

```json
{
  "competency": "COMPETENCY_ID",
  "practicalTaskId": "PRACTICAL_TASK_ID",
  "practicalSubmissionMode": "github_repository",
  "githubRepositoryUrl": "https://github.com/owner/repository",
  "theoryAnswers": [
    {
      "questionId": "QUESTION_ID_1",
      "answer": "PUT"
    },
    {
      "questionId": "QUESTION_ID_2",
      "answer": "Validation protects APIs from invalid data."
    }
  ]
}
```

### Repository Assessments

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/repository-assessments` | Authenticated |
| POST | `/api/repository-assessments` | Learner, Admin |
| GET | `/api/repository-assessments/:id` | Authenticated |
| PUT | `/api/repository-assessments/:id` | Admin |
| DELETE | `/api/repository-assessments/:id` | Authenticated |

### Recommendations

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/recommendations` | Learner, Organization Admin, Admin |
| GET | `/api/recommendations/:id` | Learner, Organization Admin, Admin |
| PUT | `/api/recommendations/:id` | Admin |
| DELETE | `/api/recommendations/:id` | Admin |

Recommendations are created during assessment review and recommendation preview flows.

### Reports

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/reports` | Learner |
| POST | `/api/reports` | Learner |
| GET | `/api/reports/:id` | Learner |
| PUT | `/api/reports/:id` | Learner |
| DELETE | `/api/reports/:id` | Learner |

Reports are learner-owned. A learner can access only their own report.

### Notifications

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/notifications` | Authenticated |
| POST | `/api/notifications` | Admin |
| GET | `/api/notifications/manage` | Admin |
| PATCH | `/api/notifications/read-all` | Authenticated |
| PATCH | `/api/notifications/:id/read` | Authenticated |
| GET | `/api/notifications/:id` | Authenticated |
| PUT | `/api/notifications/:id` | Admin |
| DELETE | `/api/notifications/:id` | Authenticated |

### Dashboard

| Method | Endpoint | Access |
| ------ | -------- | ------ |
| GET | `/api/dashboard` | Authenticated |

Dashboard charts use real database records such as users, assessments, reports, recommendations, competencies, benchmarks, and notifications.

## Database Models

| Model | Purpose |
| ----- | ------- |
| User | Account identity, role, email verification, Google profile photo, policy acceptance, password hash, reset tokens, and organization reference. |
| Organization | TVET institution or organization data. |
| GraduateProfile | Learner profile details used in assessments and reports. |
| Competency | RTB-aligned competency definitions, practical tasks, and theory questions. |
| Checklist | Admin-defined repository review requirements and weights for practical tasks. |
| Benchmark | Required competency score used for skill gap comparison. |
| Assessment | Submitted evidence, theory answers, scores, repository summary, final score, and gap result. |
| RepositoryAssessmentResult | Standalone repository assessment details and automated evidence. |
| Recommendation | Gemini-generated and approved improvement guidance with learning resources. |
| Report | Learner-owned assessment report summaries. |
| Notification | In-app user and system notifications. |

## Testing

Backend tests verify:

- Express app health and route behavior.
- CORS behavior.
- Google auth error handling.
- JWT signing and verification.
- Password policy validation.
- Email verification code/token validation.
- Brevo email payloads.
- GitHub API integration request construction.
- Gemini recommendation request and response parsing.
- Gap classification.
- Repository scoring weights.
- Input validation.
- Role management rules.

Run backend tests:

```powershell
cd backend
npm test
```

Run frontend build:

```powershell
cd my-project
npm run build
```

Run frontend tests:

```powershell
cd my-project
npm test
```

## Deployment

### Backend on Render

| Setting | Value |
| ------- | ----- |
| Root Directory | `backend` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |

Required production values include:

```env
NODE_ENV=production
HOST=0.0.0.0
API_PUBLIC_URL=https://rtb-graduate-project.onrender.com/api
FRONTEND_URL=https://rtb-graduate-project.vercel.app
MONGO_URI=your_mongodb_atlas_uri
JWT_SECRET=your_strong_secret
EMAIL_PROVIDER=brevo
EMAIL_API_KEY=your_brevo_api_key
EMAIL_BREVO_API_URL=https://api.brevo.com/v3/smtp/email
EMAIL_FROM=your_verified_sender
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GEMINI_API_KEY=your_gemini_key
E2B_API_KEY=your_e2b_api_key
EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE=false
```

### Frontend on Vercel

| Setting | Value |
| ------- | ----- |
| Root Directory | `my-project` |
| Build Command | `npm install && npm run build` |
| Output Directory | `dist` |

Required production values:

```env
VITE_API_URL=https://rtb-graduate-project.onrender.com/api
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_IDENTITY_SCRIPT_URL=https://accounts.google.com/gsi/client
```

## Troubleshooting

### MongoDB Atlas `querySrv ECONNREFUSED`

If Windows resolves Atlas but Node.js cannot resolve `mongodb+srv`, use `MONGO_DIRECT_URI` with the standard Atlas `mongodb://` connection string. Keep `MONGO_URI`, but set `MONGO_DIRECT_URI` as the fallback used by the backend.

### Frontend cannot connect to backend

Check:

- backend health endpoint: `https://rtb-graduate-project.onrender.com/api/health`
- Vercel `VITE_API_URL`
- Render backend is running
- backend was redeployed after env changes
- browser console for the failing URL

### Brevo email accepted but not received

Check:

- Brevo transactional logs for `Sent`, `Delivered`, `Deferred`, `Blocked`, or `Invalid`.
- Spam, promotions, and updates folders.
- Whether `EMAIL_FROM` is verified in Brevo.
- Whether the recipient is blocked or suppressed in Brevo.
- For production reliability, authenticate a sender domain with SPF, DKIM, and DMARC.

### Google OAuth fails

Check:

- `VITE_GOOGLE_CLIENT_ID` in Vercel/frontend.
- `GOOGLE_CLIENT_ID` in Render/backend.
- Both values must be the same OAuth Client ID.
- Authorized JavaScript origins include frontend URLs.
- Backend was redeployed after env changes.

### Gemini recommendation fails

Check:

- `GEMINI_API_KEY` exists.
- `GEMINI_RECOMMENDATION_MODEL=gemini-2.5-flash`.
- API quota is available.
- Backend has network access.

### GitHub repository review fails

Check:

- Repository URL format is `https://github.com/owner/repository`.
- Repository is public or `GITHUB_TOKEN` has access.
- GitHub API quota is not exceeded.
- Competency has a practical task and checklist.
- E2B API key is configured when sandbox execution is required.

## Production Readiness Checklist

- Use strong secrets in Render and Vercel.
- Do not commit real `.env` files.
- Use a verified Brevo sender or domain.
- Disable reset-link exposure in production.
- Protect all sensitive data with JWT and role checks.
- Keep MongoDB credentials private.
- Use HTTPS endpoints only in production.
- Configure Google OAuth for both local and deployed frontend origins.
- Configure E2B before running untrusted repository code.
- Monitor GitHub, Gemini, Brevo, MongoDB, and Render usage limits.
- Run `npm test` in backend and `npm run build` in frontend before deployment.

## Known Limitations

- Repository review depends on accessible GitHub repositories.
- Automatic code verification is strongest when tasks have clear outputs and runnable commands.
- Gemini recommendations require external API availability and quota.
- Email delivery depends on Brevo sender verification and recipient mailbox filtering.
- The current system is a web application, not a PWA or mobile app.

## Future Improvements

- Direct integration with official RTB competency databases.
- More advanced hidden test authoring for multiple languages.
- Employer dashboard and employer feedback.
- Plagiarism and code similarity detection.
- Advanced learning roadmap generation.
- Mobile application version.
- Stronger analytics for organizations and administrators.
