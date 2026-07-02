# Production Readiness Checklist

## Backend Environment

Required production values:

```env
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
MONGO_URI=mongodb+srv://...
JWT_SECRET=<at-least-32-random-characters>
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGINS=https://your-frontend-domain.com
EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE=false
EMAIL_PROVIDER=resend
EMAIL_API_KEY=<email-api-key>
EMAIL_FROM=no-reply@your-verified-domain.com
GITHUB_TOKEN=<github-token>
GEMINI_API_KEY=<gemini-api-key>
```

## Frontend Environment

```env
VITE_API_URL=https://your-backend-domain.com/api
```

## Security Controls Implemented

- Express `x-powered-by` header disabled.
- CORS is restricted to configured origins.
- Security headers are applied on every response.
- Request IDs are attached to responses and error logs.
- Global API rate limiting is enabled.
- Authentication and password endpoints have stricter rate limits.
- Production startup validates required secrets and unsafe settings.
- Production errors do not expose stack traces.
- MongoDB auto-indexing is disabled in production.
- Password reset tokens are hashed in the database.
- Password reset links are sent through the configured email API.
- Temporary passwords force first-login password change.

## Deployment Notes

- Use HTTPS in production.
- Keep `JWT_SECRET`, `GITHUB_TOKEN`, `GEMINI_API_KEY`, and MongoDB credentials
  outside source control.
- Add the backend server IP address to the MongoDB Atlas network access list.
- Start Docker on the deployment server if repository execution assessment is
  enabled.
- Keep `ENABLE_UNSAFE_LOCAL_REPOSITORY_EXECUTION=false` unless the server is a
  disposable sandbox.
- Configure email delivery before production password reset is opened to public
  users. Supported values are `EMAIL_PROVIDER=resend`, `EMAIL_PROVIDER=brevo`,
  or `EMAIL_PROVIDER=generic` with `EMAIL_API_URL`.
- If using Resend, verify a domain in the Resend dashboard and set
  `EMAIL_FROM` to an address on that verified domain. The Resend test sender can
  only deliver to the Resend account owner's email address.
- Local development can expose reset links in API responses, but production
  must not.
