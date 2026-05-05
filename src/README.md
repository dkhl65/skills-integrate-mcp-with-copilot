# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Authentication with role support (`student`, `admin`)
- Session-based token login/logout
- Role-based access control for protected endpoints
- Sign up for activities (authenticated users)
- Admin-only unregister operation

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Run the application:

   ```
   python app.py
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| POST   | `/auth/login`                                                     | Authenticate and receive a bearer token                             |
| POST   | `/auth/logout`                                                    | Logout and invalidate current token                                 |
| GET    | `/auth/me`                                                        | Get current authenticated user details                              |
| GET    | `/activities`                                                     | Get all activities (authenticated users only)                       |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Sign up for an activity (students can only sign up themselves)      |
| DELETE | `/activities/{activity_name}/unregister?email=student@...`       | Unregister a student (admin only)                                   |

## Demo Credentials

- Admin: `teacher` / `teach123`
- Student: `alex` / `student123`
- Student: `jamie` / `student456`

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

All data is stored in memory, which means data will be reset when the server restarts.
