"""High School activities API with simple auth and role-based access control."""

from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os
from pathlib import Path

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")


class LoginRequest(BaseModel):
    username: str
    password: str


# In-memory users for MVP auth.
users = {
    "teacher": {
        "password": "teach123",
        "role": "admin",
        "email": "teacher@mergington.edu"
    },
    "alex": {
        "password": "student123",
        "role": "student",
        "email": "alex@mergington.edu"
    },
    "jamie": {
        "password": "student456",
        "role": "student",
        "email": "jamie@mergington.edu"
    }
}

# Maps active auth token -> username.
active_sessions = {}


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    token = authorization.replace("Bearer ", "", 1).strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


def get_current_user(authorization: Optional[str]) -> dict:
    token = _extract_bearer_token(authorization)
    username = active_sessions.get(token)
    if not username:
        raise HTTPException(status_code=401, detail="Session expired or invalid token")
    user = users.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    return {
        "username": username,
        "email": user["email"],
        "role": user["role"],
        "token": token,
    }


def require_admin(user: dict) -> None:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.post("/auth/login")
def login(payload: LoginRequest):
    user = users.get(payload.username)
    if not user or user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = str(uuid4())
    active_sessions[token] = payload.username

    return {
        "token": token,
        "user": {
            "username": payload.username,
            "email": user["email"],
            "role": user["role"],
        }
    }


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    user = get_current_user(authorization)
    active_sessions.pop(user["token"], None)
    return {"message": "Logged out successfully"}


@app.get("/auth/me")
def auth_me(authorization: Optional[str] = Header(default=None)):
    user = get_current_user(authorization)
    return {
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
    }


@app.get("/activities")
def get_activities(authorization: Optional[str] = Header(default=None)):
    get_current_user(authorization)
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    email: str,
    authorization: Optional[str] = Header(default=None)
):
    """Sign up a student for an activity"""
    user = get_current_user(authorization)

    if user["role"] == "student" and user["email"] != email:
        raise HTTPException(
            status_code=403,
            detail="Students may only sign up with their own email"
        )

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: str,
    authorization: Optional[str] = Header(default=None)
):
    """Unregister a student from an activity"""
    user = get_current_user(authorization)
    require_admin(user)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
