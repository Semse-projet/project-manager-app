# OpenAPI / Swagger Documentation

## Base URL
```
https://api.example.com/v1
```

## Authentication
```
Authorization: Bearer {jwt_token}
```

## Main Endpoints

### Projects
- `GET /projects` — List all projects
- `POST /projects` — Create project
- `GET /projects/:id` — Get project details
- `PUT /projects/:id` — Update project

### Draws
- `GET /projects/:id/draws` — List draws
- `POST /projects/:id/draws` — Create draw
- `POST /projects/:id/draws/:drawId/submit` — Submit for approval
- `POST /projects/:id/draws/:drawId/approve` — Approve (lender)
- `POST /projects/:id/draws/:drawId/fund` — Mark funded

### Liens
- `GET /projects/:id/liens/calendar` — List lien calendars
- `GET /projects/:id/liens/waivers` — List waivers
- `POST /projects/:id/liens/waivers/:id/sign` — Sign waiver

### Photos
- `POST /projects/:id/evidence/photos` — Upload photo with EXIF
- `GET /projects/:id/evidence/photos` — List photos

### Analytics
- `GET /projects/:id/analytics/dashboard` — Get metrics
- `GET /projects/:id/analytics/charts` — Get chart data
- `GET /projects/:id/analytics/export` — Export report (PDF/CSV)

### Admin
- `GET /admin/users` — List all users
- `PUT /admin/users/:id/role` — Update user role
- `GET /admin/settings` — System settings
- `GET /admin/audit-log` — Audit trail

## Status Codes
- 200 OK
- 201 Created
- 400 Bad Request
- 401 Unauthorized
- 404 Not Found
- 500 Server Error

## Response Format
```json
{
  "success": true,
  "data": {},
  "error": null
}
```

---

**Full interactive documentation available at:** `/swagger`
