# Backend (NestJS + MongoDB)

NestJS API for the LED modules app. It uses MongoDB via Mongoose and JWT-based authentication (access + refresh tokens).

## Tech stack

- NestJS
- MongoDB via `@nestjs/mongoose` and `mongoose`
- `@nestjs/config` for environment variables
- JWT auth with `@nestjs/jwt` and `passport-jwt`
- `bcrypt` for password hashing
- `class-validator` / `class-transformer` for DTO validation

## Getting started

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

Env variables:

- `MONGODB_URI` – MongoDB connection string (default: `mongodb://localhost:27017/led-modules`)
- `PORT` – API port (default: `4000`)
- `JWT_ACCESS_SECRET` – secret for access tokens
- `JWT_REFRESH_SECRET` – secret for refresh tokens
- `JWT_ACCESS_EXPIRES_IN` – access token TTL (e.g. `15m`)
- `JWT_REFRESH_EXPIRES_IN` – refresh token TTL (e.g. `7d`)
- `CORS_ORIGIN` – allowed frontend origin (default: `http://localhost:3000`)

### 3. Run the server

```bash
npm run start:dev
```

The API will be available at `http://localhost:4000/api`.

## Main endpoints

All routes are prefixed with `/api`.

### Auth

- `POST /api/auth/signup`

  Request body:

  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "displayName": "User Name"
  }
  ```

  Response:

  ```json
  {
    "user": { "id": "...", "email": "...", "displayName": "...", "role": "user" },
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token"
  }
  ```

- `POST /api/auth/login`

  Request body:

  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

  Response shape is the same as `signup`.

- `POST /api/auth/refresh`

  Request body:

  ```json
  {
    "refreshToken": "jwt-refresh-token"
  }
  ```

  Response:

  ```json
  {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token"
  }
  ```

### Users

- `GET /api/users/me`

  - Requires `Authorization: Bearer <accessToken>` header.
  - Returns the current authenticated user payload from the access token.

### Projects (placeholder domain)

- `GET /api/projects`

  - Requires `Authorization: Bearer <accessToken>` header.
  - Currently returns an empty array `[]`. This is where LED design-related endpoints can be added later.

## Quick manual test flow

1. **Sign up**

   ```bash
   curl -X POST http://localhost:4000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123","displayName":"Test User"}'
   ```

2. **Login**

   ```bash
   curl -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

3. **Use access token**

   ```bash
   curl http://localhost:4000/api/users/me \
     -H "Authorization: Bearer <ACCESS_TOKEN_FROM_LOGIN>"

   curl http://localhost:4000/api/projects \
     -H "Authorization: Bearer <ACCESS_TOKEN_FROM_LOGIN>"
   ```

4. **Refresh tokens**

   ```bash
   curl -X POST http://localhost:4000/api/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken":"<REFRESH_TOKEN_FROM_LOGIN_OR_SIGNUP>"}'
   ```

