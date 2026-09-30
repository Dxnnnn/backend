# Group2-FES

# Faculty Evaluation System — Backend

REST API for the Faculty Evaluation System built with **Node.js**, **Express**, and **MySQL**.

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|------------------------------------------------|
| Runtime     | Node.js 18+                                    |
| Framework   | Express 5                                      |
| Database    | MySQL 8 via `mysql2`                           |
| Auth        | JWT (`jsonwebtoken`) + `bcryptjs`              |
| File Upload | `multer` (memory storage) + Cloudinary SDK v2  |
| Environment | `dotenv`                                       |
| Dev tool    | `nodemon`                                      |

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── db.js                  # MySQL connection pool
│   │   └── cloudinary.js          # Cloudinary SDK v2 configuration
│   ├── controller/
│   │   ├── authController.js      # Admin login & registration
│   │   ├── evaluationController.js
│   │   ├── facultyController.js
│   │   ├── schoolHeadController.js
│   │   ├── semesterController.js
│   │   ├── studentController.js
│   │   ├── surveyQuestionController.js
│   │   └── uploadController.js    # Cloudinary signed image upload
│   ├── middleware/
│   │   ├── errorHandler.js        # Global error handler
│   │   └── verifyToken.js         # JWT auth middleware
│   ├── routes/
│   │   ├── auth.js
│   │   ├── evaluations.js
│   │   ├── faculty.js
│   │   ├── schoolHeads.js
│   │   ├── semesters.js
│   │   ├── students.js
│   │   ├── surveyQuestions.js
│   │   └── upload.js              # POST /api/upload/image
│   └── seed/
│       └── adminSeed.js           # Seeds the default admin account
├── mysql/
│   └── database.sql               # Full DB schema dump
├── .env                           # Environment variables (not committed)
├── server.js                      # App entry point
└── package.json
```

---

## Getting Started

### 1. Prerequisites

- Node.js 18+
- MySQL 8

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=faculty_evaluation
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=8h

# Cloudinary — used for faculty profile photo uploads (signed upload)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_PRESET=faculty_profiles
```

### 4. Set up the database

Import the schema into MySQL:

```bash
mysql -u root -p faculty_evaluation < mysql/database.sql
```

### 5. Seed the admin account

```bash
npm run seed
```

### 6. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server runs on the port defined in `.env` (default: `5000`).

---

## API Endpoints

All routes are prefixed with `/api`.

| Method | Endpoint                    | Description                        | Auth Required |
|--------|-----------------------------|------------------------------------|---------------|
| POST   | `/api/auth/login`           | Admin login                        | No            |
| POST   | `/api/auth/register-admin`  | Register a new admin               | No            |
| GET    | `/api/school-heads`         | List all school heads              | Yes           |
| POST   | `/api/school-heads`         | Create a school head account       | Yes           |
| PUT    | `/api/school-heads/:id`     | Update a school head               | Yes           |
| DELETE | `/api/school-heads/:id`     | Delete a school head               | Yes           |
| GET    | `/api/students`             | List all students                  | Yes           |
| POST   | `/api/students`             | Create a student account           | Yes           |
| PUT    | `/api/students/:id`         | Update a student                   | Yes           |
| DELETE | `/api/students/:id`         | Delete a student                   | Yes           |
| GET    | `/api/faculty`              | List all faculty                   | Yes           |
| POST   | `/api/faculty`              | Add a faculty member               | Yes           |
| PUT    | `/api/faculty/:id`          | Update a faculty member            | Yes           |
| DELETE | `/api/faculty/:id`          | Delete a faculty member            | Yes           |
| GET    | `/api/evaluations`          | List evaluation submissions        | Yes           |
| POST   | `/api/evaluations`          | Submit an evaluation               | No            |
| GET    | `/api/survey-questions`     | List survey questions              | Yes           |
| POST   | `/api/survey-questions`     | Create a survey question           | Yes           |
| PUT    | `/api/survey-questions/:id` | Update a survey question           | Yes           |
| DELETE | `/api/survey-questions/:id` | Delete a survey question           | Yes           |
| GET    | `/api/semesters`            | List semesters                     | Yes           |
| POST   | `/api/semesters`            | Create a semester                  | Yes           |
| PUT    | `/api/semesters/:id`        | Update a semester                  | Yes           |
| DELETE | `/api/semesters/:id`        | Delete a semester                  | Yes           |
| POST   | `/api/upload/image`         | Upload a faculty profile photo     | No            |

Protected routes require a `Bearer` token in the `Authorization` header.

---

## Image Uploads (Cloudinary)

Faculty profile photos are uploaded through the backend — the frontend never talks to Cloudinary directly, keeping the API credentials server-side only.

**Flow:**
1. Admin selects a photo in the "Add Faculty" form.
2. Frontend POSTs the file as `multipart/form-data` to `POST /api/upload/image`.
3. Backend receives the file via `multer` (memory storage), then streams the buffer to Cloudinary using a **signed upload** (`cloudinary.uploader.upload_stream`).
4. Cloudinary returns a `secure_url` which is stored in the `faculty.profile_image` column.
5. The photo is displayed in the admin faculty list, school head faculty list, and student evaluation table.

**Required env vars:**
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

> The `CLOUDINARY_UPLOAD_PRESET` env var is kept for reference but is **not sent** on signed uploads.

---

## Database Schema

Key tables in `faculty_evaluation`:

| Table                    | Description                                          |
|--------------------------|------------------------------------------------------|
| `admins`                 | Admin accounts                                       |
| `school_heads`           | School head / coordinator accounts                  |
| `students`               | Student accounts (elementary to college)             |
| `faculty`                | Faculty members available for evaluation (includes `profile_image` URL) |
| `semesters`              | School year terms and active subjects                |
| `survey_questions`       | Configurable evaluation questionnaire                |
| `evaluation_submissions` | Submitted evaluations from students and school heads |

---

## Git Workflow

```bash
# Create your feature branch
git checkout -b your-branch-name

# Stage and commit
git add .
git commit -m "your message"

# Push to remote
git push -u origin your-branch-name

# Pull latest changes
git pull origin main
```
