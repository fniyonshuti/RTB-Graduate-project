# Account Creation Workflow

## Purpose

The system separates public account registration from privileged account
creation so that assessment data, organization data, and review permissions are
protected.

## Roles

### Platform Admin

- Created by the system owner during setup.
- Creates and manages organizations.
- Creates platform admins, organization admins, assessors, and graduates.
- Can view platform-wide system data.

### Organization Admin

- Created by a platform admin or another organization admin from the same
  organization.
- Belongs to one organization.
- Creates organization admins, assessors, and graduates for that organization
  only.
- Cannot create platform admins.
- Cannot manage users from another organization.

### Assessor

- Created by a platform admin or organization admin.
- Belongs to one organization.
- Reviews graduate assessments submitted under that organization.
- Approves final assessment recommendations.

### Graduate

- Can register publicly from the homepage.
- Must select an active organization during registration.
- Can submit assessments, view results, receive recommendations, download
  reports, and receive notifications.

## Account Creation Rules

| Account Type | Created By | Public Registration | Organization Required |
| --- | --- | --- | --- |
| Graduate | Self, Platform Admin, Organization Admin | Yes | Yes |
| Assessor | Platform Admin, Organization Admin | No | Yes |
| Organization Admin | Platform Admin, Organization Admin | No | Yes |
| Platform Admin | Platform Admin or setup process | No | No |

## Backend Rules

- `POST /api/auth/register` always creates a `graduate` account.
- Public registration requires `name`, `email`, `password`, and
  `organizationId`.
- `POST /api/users` is protected and can only be used by `admin` or
  `org_admin`.
- Platform admins can create all account types.
- Organization admins can create only `graduate`, `assessor`, and `org_admin`
  accounts within their own organization.
- Organization admins cannot create or manage platform admin accounts.

## Recommended Setup Order

1. Create the first platform admin through a protected setup process or seed
   script.
2. Platform admin creates TVET organizations.
3. Platform admin creates the first organization admin for each organization.
4. Organization admin creates assessors and additional organization users.
5. Graduates register publicly and select their organization.

## Password Recovery and Temporary Passwords

### Temporary Password Flow

When a platform admin or organization admin creates a user from the dashboard,
the account is marked with `mustChangePassword`.

1. Admin creates the account with a temporary password.
2. The user signs in using the temporary password.
3. The system blocks normal dashboard access until the user creates a personal
   password.
4. After the password is changed, `mustChangePassword` becomes `false`.

Admins can also reset a user's temporary password from user management. The
generated temporary password is displayed once and should be shared securely
with the user.

### Forgot Password Flow

Any active user can request a password reset.

1. User clicks **Forgot password** on the login window.
2. User enters their email address.
3. The system creates a secure random reset token.
4. The database stores only a SHA-256 hash of the token.
5. The token expires based on `PASSWORD_RESET_TOKEN_EXPIRES_MINUTES`.
6. The user enters a new password using the reset token.
7. The token is invalidated after successful reset.

### Environment Variables

```env
FRONTEND_URL=http://localhost:5173
PASSWORD_RESET_TOKEN_EXPIRES_MINUTES=15
TEMPORARY_PASSWORD_EXPIRES_HOURS=72
```

In production, the reset link is sent using the configured email API. During
local development, the API response can include the reset link when
`EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE=true` so it can be tested in Postman and
the browser without email infrastructure.

Supported email providers:

```env
EMAIL_PROVIDER=resend
EMAIL_API_KEY=<resend-api-key>
EMAIL_FROM=no-reply@your-verified-domain.com
```

For Resend, the sender domain must be verified in the Resend dashboard before
emails can be delivered to any recipient. The default Resend testing sender can
only send to the email address that owns the Resend account.

```env
EMAIL_PROVIDER=brevo
EMAIL_API_KEY=<brevo-api-key>
EMAIL_FROM=no-reply@your-domain.com
```

```env
EMAIL_PROVIDER=generic
EMAIL_API_URL=https://your-email-api.example.com/send
EMAIL_API_KEY=<api-key>
EMAIL_FROM=no-reply@your-domain.com
```
