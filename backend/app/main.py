
import hashlib
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import jwt
import secrets
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jwt.exceptions import PyJWTError
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine, settings
from app.models import User, Project, Portfolio, JobApplication, PortfolioVisit
from app.schemas import (
    UserCreate,
    UserLogin,
    GoogleTokenRequest,
    UserResponse,
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    PortfolioCreate,
    PortfolioResponse,
    JobApplicationCreate,
    JobApplicationUpdate,
    JobApplicationResponse,
    PublishRequest,
)


# --------------------------------------------------
# Application configuration
# --------------------------------------------------

password_hash = PasswordHash.recommended()

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

bearer_scheme = HTTPBearer(auto_error=False)


# --------------------------------------------------
# Database initialization
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Importing all models above registers their tables.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Portfolia API",
    lifespan=lifespan,
)


# --------------------------------------------------
# CORS configuration
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://portfolio-forge-nine.vercel.app",
        "https://portfolio-forge-7qwxdzslg-titan-drag.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# Database session dependency
# --------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------
# JWT authentication
# --------------------------------------------------

def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please log in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        subject = payload.get("sub")

        if subject is None:
            raise ValueError("Missing token subject.")

        user_id = int(subject)

    except (PyJWTError, ValueError, TypeError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )

    return user


# --------------------------------------------------
# General endpoints
# --------------------------------------------------

@app.get("/")
def home():
    return {"message": "Welcome to the Portfolia API"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# --------------------------------------------------
# Authentication: signup
# --------------------------------------------------

@app.post(
    "/api/auth/signup",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    email = str(user_data.email).lower()

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    new_user = User(
        full_name=user_data.full_name.strip(),
        email=email,
        hashed_password=password_hash.hash(
            user_data.password
        ),
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    except Exception as exc:
        db.rollback()
        print("SIGNUP ERROR:", repr(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create your account.",
        ) from exc

    return new_user


# --------------------------------------------------
# Authentication: login
# --------------------------------------------------

@app.post("/api/auth/login")
def login(
    user_data: UserLogin,
    db: Session = Depends(get_db),
):
    email = str(user_data.email).lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if not user or not password_hash.verify(
        user_data.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).model_dump(
            mode="json"
        ),
    }


# --------------------------------------------------
# Authentication: Google sign-in
# --------------------------------------------------

@app.post("/api/auth/google")
def google_login(
    token_data: GoogleTokenRequest,
    db: Session = Depends(get_db),
):
    """Verify a Google ID token, then create or sign in the matching user."""
    client_id = settings.GOOGLE_CLIENT_ID
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured on the server.",
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            token_data.credential,
            google_requests.Request(),
            client_id,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google sign-in token is invalid or expired.",
        )

    # Only accept Google's verified email claims.
    email = (claims.get("email") or "").strip().lower()
    if not email or claims.get("email_verified") is not True:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google did not provide a verified email address.",
        )

    google_subject = claims.get("sub")
    if not google_subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account information is incomplete.",
        )

    user = db.scalar(select(User).where(User.email == email))

    if user is None:
        display_name = (claims.get("name") or email.split("@")[0]).strip()
        display_name = display_name[:100] or "Google User"
        # The account uses Google for authentication. A random, unshared
        # password hash satisfies the existing non-null schema column.
        random_password_hash = password_hash.hash(secrets.token_urlsafe(48))
        user = User(
            full_name=display_name,
            email=email,
            hashed_password=random_password_hash,
        )
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception as exc:
            db.rollback()
            # A concurrent Google sign-up may have created the same email.
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                print("GOOGLE SIGNUP ERROR:", repr(exc))
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not create your Google account.",
                ) from exc

    access_token = create_access_token(user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).model_dump(mode="json"),
    }


# --------------------------------------------------
# Projects: list authenticated user's projects
# --------------------------------------------------

@app.get(
    "/api/projects",
    response_model=list[ProjectResponse],
)
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = db.scalars(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    ).all()

    return projects


# --------------------------------------------------
# Projects: create
# --------------------------------------------------

@app.post(
    "/api/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project_values = project_data.model_dump(mode="json")

    project = Project(
        **project_values,
        user_id=current_user.id,
    )

    try:
        db.add(project)
        db.commit()
        db.refresh(project)

    except Exception as exc:
        db.rollback()
        print("PROJECT SAVE ERROR:", repr(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save the project.",
        ) from exc

    return project


# --------------------------------------------------
# Projects: update
# --------------------------------------------------

@app.put(
    "/api/projects/{project_id}",
    response_model=ProjectResponse,
)
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    project_values = project_data.model_dump(mode="json")

    for field, value in project_values.items():
        setattr(project, field, value)

    try:
        db.commit()
        db.refresh(project)

    except Exception as exc:
        db.rollback()
        print("PROJECT UPDATE ERROR:", repr(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update the project.",
        ) from exc

    return project


# --------------------------------------------------
# Projects: delete
# --------------------------------------------------

@app.delete(
    "/api/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    try:
        db.delete(project)
        db.commit()

    except Exception as exc:
        db.rollback()
        print("PROJECT DELETE ERROR:", repr(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not delete the project.",
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------
# Dashboard: calculate progress from saved database data
# --------------------------------------------------

@app.get("/api/dashboard/progress")
def get_dashboard_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return dashboard completion based on the logged-in user's saved data."""
    portfolio = db.scalar(
        select(Portfolio).where(Portfolio.user_id == current_user.id)
    )
    data = portfolio.portfolio_data if portfolio and isinstance(portfolio.portfolio_data, dict) else {}

    def first_value(*keys):
        for key in keys:
            value = data.get(key)
            if value is not None and value != "" and value != [] and value != {}:
                return value
        return None

    def has_content(value):
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip())
        if isinstance(value, dict):
            return any(has_content(v) for v in value.values())
        if isinstance(value, (list, tuple, set)):
            return any(has_content(v) for v in value)
        return bool(value)

    def list_count(value):
        if not isinstance(value, list):
            return 0
        return sum(1 for item in value if has_content(item))

    # Projects are saved through /api/projects in the separate Project table.
    # Use those database rows as the authoritative count, with portfolio JSON
    # as a fallback for projects stored by older portfolio-editor versions.
    saved_projects = db.scalars(
        select(Project).where(Project.user_id == current_user.id)
    ).all()
    portfolio_projects = first_value("projects", "project", "portfolio_projects")
    projects_count = len(saved_projects) if saved_projects else list_count(portfolio_projects)

    education_count = list_count(first_value("education", "educations", "academic"))
    experience_count = list_count(first_value("experience", "experiences", "work_experience", "employment"))
    skills_value = first_value("skills", "skill", "technical_skills")
    skills_count = list_count(skills_value) if isinstance(skills_value, list) else (1 if has_content(skills_value) else 0)

    personal_complete = all(
        has_content(first_value(*keys))
        for keys in (
            ("name", "full_name", "fullName", "fullNameValue"),
            ("role", "title", "job_title", "profession", "headline"),
            ("about", "bio", "summary", "description", "about_me"),
        )
    )

    sections = {
        "personal": personal_complete,
        "projects": projects_count > 0,
        "education": education_count > 0,
        "experience": experience_count > 0,
        "skills": skills_count > 0,
    }
    completed_sections = sum(1 for complete in sections.values() if complete)

    return {
        "sections": sections,
        "completed_sections": completed_sections,
        "total_sections": len(sections),
        "progress_percent": round(completed_sections / len(sections) * 100),
        "counts": {
            "projects": projects_count,
            "education": education_count,
            "experience": experience_count,
            "skills": skills_count,
        },
    }


# --------------------------------------------------
# Multi-portfolio management (maximum three per user)
# --------------------------------------------------

MAX_PORTFOLIOS_PER_USER = 3


def _owned_portfolio(db: Session, user_id: int, portfolio_id: int) -> Portfolio:
    portfolio = db.scalar(select(Portfolio).where(
        Portfolio.id == portfolio_id, Portfolio.user_id == user_id
    ))
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found.")
    return portfolio


@app.get("/api/portfolios")
def list_my_portfolios(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    items = db.scalars(select(Portfolio).where(Portfolio.user_id == current_user.id).order_by(Portfolio.created_at.asc(), Portfolio.id.asc())).all()
    return [{"id": p.id, "template": p.template, "portfolio_data": p.portfolio_data,
             "slug": p.slug, "is_published": p.is_published,
             "created_at": p.created_at, "updated_at": p.updated_at} for p in items]


@app.post("/api/portfolios", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
def create_portfolio(payload: PortfolioCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Lock the owning user row so simultaneous create requests cannot exceed the limit.
    db.execute(select(User).where(User.id == current_user.id).with_for_update())
    count = db.scalar(select(func.count(Portfolio.id)).where(Portfolio.user_id == current_user.id)) or 0
    if count >= MAX_PORTFOLIOS_PER_USER:
        raise HTTPException(status_code=409, detail="You can create a maximum of 3 portfolios.")
    portfolio = Portfolio(user_id=current_user.id, template=payload.template, portfolio_data=payload.portfolio_data)
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    return portfolio


@app.get("/api/portfolios/{portfolio_id}", response_model=PortfolioResponse)
def get_portfolio_by_id(portfolio_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _owned_portfolio(db, current_user.id, portfolio_id)


@app.put("/api/portfolios/{portfolio_id}", response_model=PortfolioResponse)
def update_portfolio_by_id(portfolio_id: int, payload: PortfolioCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = _owned_portfolio(db, current_user.id, portfolio_id)
    portfolio.template = payload.template
    portfolio.portfolio_data = payload.portfolio_data
    db.commit()
    db.refresh(portfolio)
    return portfolio


@app.delete("/api/portfolios/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_portfolio(portfolio_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = _owned_portfolio(db, current_user.id, portfolio_id)
    db.delete(portfolio)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/portfolios/{portfolio_id}/publish")
def publish_portfolio_by_id(portfolio_id: int, publish_data: PublishRequest, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    slug = publish_data.slug.strip().lower()
    if not slug or len(slug) > 80:
        raise HTTPException(status_code=422, detail="URL slug must contain 1 to 80 characters.")
    portfolio = _owned_portfolio(db, current_user.id, portfolio_id)
    existing = db.scalar(select(Portfolio).where(Portfolio.slug == slug, Portfolio.id != portfolio.id))
    if existing:
        raise HTTPException(status_code=409, detail="This portfolio URL is already taken.")
    portfolio.slug = slug
    portfolio.is_published = True
    db.commit()
    db.refresh(portfolio)
    return {"id": portfolio.id, "slug": slug, "is_published": True, "public_url": _public_portfolio_url(request, slug)}


@app.delete("/api/portfolios/{portfolio_id}/publish")
def unpublish_portfolio_by_id(portfolio_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = _owned_portfolio(db, current_user.id, portfolio_id)
    portfolio.is_published = False
    db.commit()
    return {"id": portfolio.id, "is_published": False, "slug": portfolio.slug}


# --------------------------------------------------
# Portfolio: retrieve logged-in user's portfolio
# --------------------------------------------------

@app.get(
    "/api/portfolio/me",
    response_model=PortfolioResponse,
)
def get_my_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    portfolio = db.scalar(
        select(Portfolio).where(
            Portfolio.user_id == current_user.id
        ).order_by(Portfolio.id.asc())
    )

    if portfolio is not None:
        return portfolio

    # Return a default portfolio without creating a database row.
    return {
        "template": "minimal",
        "portfolio_data": {
            "name": current_user.full_name,
            "role": "",
            "about": "",
            "projects": [],
            "education": [],
            "experience": [],
            "skills": [],
        },
    }


# --------------------------------------------------
# Portfolio: create or update logged-in user's portfolio
# --------------------------------------------------

@app.put(
    "/api/portfolio/me",
    response_model=PortfolioResponse,
)
def save_my_portfolio(
    portfolio_input: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    portfolio = db.scalar(
        select(Portfolio).where(
            Portfolio.user_id == current_user.id
        ).order_by(Portfolio.id.asc())
    )

    if portfolio is None:
        portfolio = Portfolio(
            user_id=current_user.id,
            template=portfolio_input.template,
            portfolio_data=portfolio_input.portfolio_data,
        )
        db.add(portfolio)
    else:
        portfolio.template = portfolio_input.template
        portfolio.portfolio_data = portfolio_input.portfolio_data

    try:
        db.commit()
        db.refresh(portfolio)

    except Exception as exc:
        db.rollback()
        print("PORTFOLIO SAVE ERROR:", repr(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save your portfolio.",
        ) from exc

    return portfolio


# --------------------------------------------------
# Job application tracker: authenticated CRUD
# --------------------------------------------------

@app.get("/api/job-applications", response_model=list[JobApplicationResponse])
def list_job_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.scalars(
        select(JobApplication)
        .where(JobApplication.user_id == current_user.id)
        .order_by(JobApplication.updated_at.desc())
    ).all()


@app.post(
    "/api/job-applications",
    response_model=JobApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_job_application(
    application_data: JobApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = JobApplication(
        **application_data.model_dump(),
        user_id=current_user.id,
    )
    try:
        db.add(application)
        db.commit()
        db.refresh(application)
    except Exception as exc:
        db.rollback()
        print("JOB APPLICATION CREATE ERROR:", repr(exc))
        raise HTTPException(status_code=500, detail="Could not save the job application.") from exc
    return application


@app.put("/api/job-applications/{application_id}", response_model=JobApplicationResponse)
def update_job_application(
    application_id: int,
    application_data: JobApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = db.scalar(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == current_user.id,
        )
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Job application not found.")
    for field, value in application_data.model_dump().items():
        setattr(application, field, value)
    try:
        db.commit()
        db.refresh(application)
    except Exception as exc:
        db.rollback()
        print("JOB APPLICATION UPDATE ERROR:", repr(exc))
        raise HTTPException(status_code=500, detail="Could not update the job application.") from exc
    return application


@app.delete("/api/job-applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = db.scalar(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == current_user.id,
        )
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Job application not found.")
    try:
        db.delete(application)
        db.commit()
    except Exception as exc:
        db.rollback()
        print("JOB APPLICATION DELETE ERROR:", repr(exc))
        raise HTTPException(status_code=500, detail="Could not delete the job application.") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------
# Portfolio publishing: authenticated publish/unpublish
# --------------------------------------------------

def _public_portfolio_url(request, slug: str) -> str:
    configured_frontend = getattr(settings, "PUBLIC_FRONTEND_URL", None)
    base_url = (configured_frontend or request.headers.get("origin") or str(request.base_url).rstrip("/")).rstrip("/")
    return f"{base_url}/u/{slug}"


@app.get("/api/portfolio/publish/status")
def get_publish_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    portfolio = db.scalar(select(Portfolio).where(Portfolio.user_id == current_user.id).order_by(Portfolio.id.asc()))
    return {
        "is_published": bool(portfolio and portfolio.is_published),
        "slug": portfolio.slug if portfolio else None,
    }


@app.post("/api/portfolio/publish")
def publish_my_portfolio(
    publish_data: PublishRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slug = publish_data.slug.strip().lower()
    portfolio = db.scalar(select(Portfolio).where(Portfolio.user_id == current_user.id).order_by(Portfolio.id.asc()))
    if portfolio is None:
        raise HTTPException(status_code=400, detail="Save your portfolio before publishing it.")
    existing = db.scalar(select(Portfolio).where(Portfolio.slug == slug))
    if existing is not None and existing.user_id != current_user.id:
        raise HTTPException(status_code=409, detail="This portfolio URL is already taken.")
    portfolio.slug = slug
    portfolio.is_published = True
    try:
        db.commit()
        db.refresh(portfolio)
    except Exception as exc:
        db.rollback()
        print("PORTFOLIO PUBLISH ERROR:", repr(exc))
        raise HTTPException(status_code=500, detail="Could not publish your portfolio.") from exc
    return {
        "slug": portfolio.slug,
        "is_published": portfolio.is_published,
        "public_url": _public_portfolio_url(request, slug),
    }


@app.delete("/api/portfolio/publish", status_code=status.HTTP_200_OK)
def unpublish_my_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    portfolio = db.scalar(select(Portfolio).where(Portfolio.user_id == current_user.id).order_by(Portfolio.id.asc()))
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found.")
    portfolio.is_published = False
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not unpublish your portfolio.") from exc
    return {"is_published": False, "slug": portfolio.slug}


@app.get("/api/portfolio/public/{slug}")
def get_public_portfolio(slug: str, db: Session = Depends(get_db)):
    portfolio = db.scalar(
        select(Portfolio).where(
            Portfolio.slug == slug.lower(),
            Portfolio.is_published.is_(True),
        )
    )
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Published portfolio not found.")
    return {
        "slug": portfolio.slug,
        "template": portfolio.template,
        "portfolio_data": portfolio.portfolio_data,
    }


# --------------------------------------------------
# Portfolio analytics
# --------------------------------------------------

from pydantic import BaseModel, Field
from fastapi import Request
from sqlalchemy import func

class AnalyticsTrackRequest(BaseModel):
    slug: str = Field(min_length=3, max_length=80)
    event_type: str = Field(default="portfolio_view", pattern="^(portfolio_view|project_view)$")
    project_title: str | None = Field(default=None, max_length=150)

@app.post("/api/analytics/track", status_code=status.HTTP_202_ACCEPTED)
def track_portfolio_visit(
    payload: AnalyticsTrackRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    portfolio = db.query(Portfolio).filter(
        Portfolio.slug == payload.slug,
        Portfolio.is_published.is_(True),
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Published portfolio not found.")

    # Store only a one-way anonymous key; never persist the visitor IP address.
    raw_identity = f"{request.client.host if request.client else 'unknown'}|{request.headers.get('user-agent', '')}"
    visitor_key = hashlib.sha256(raw_identity.encode("utf-8")).hexdigest()
    event = PortfolioVisit(
        portfolio_id=portfolio.id,
        event_type=payload.event_type,
        project_title=payload.project_title.strip() if payload.project_title else None,
        visitor_key=visitor_key,
    )
    db.add(event)
    db.commit()
    return {"tracked": True}


@app.get("/api/analytics/overview")
def get_portfolio_analytics(
    range: str = "7d",
    portfolio_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if range not in {"7d", "30d"}:
        raise HTTPException(status_code=400, detail="Range must be 7d or 30d.")

    portfolio = (db.query(Portfolio).filter(Portfolio.user_id == current_user.id, Portfolio.id == portfolio_id).first()
                 if portfolio_id is not None else db.query(Portfolio).filter(Portfolio.user_id == current_user.id).order_by(Portfolio.id.asc()).first())
    if portfolio_id is not None and portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found.")
    if not portfolio or not portfolio.is_published:
        return {
            "total_visitors": 0,
            "daily_visits_total": 0,
            "weekly_visits_total": 0,
            "daily_visits": [],
            "top_projects": [],
        }

    now = datetime.now(timezone.utc)
    start_day = now.date() - timedelta(days=(6 if range == "7d" else 29))
    start_dt = datetime.combine(start_day, datetime.min.time(), tzinfo=timezone.utc)

    base = db.query(PortfolioVisit).filter(PortfolioVisit.portfolio_id == portfolio.id)
    total_visitors = base.filter(
        PortfolioVisit.event_type == "portfolio_view"
    ).with_entities(func.count(func.distinct(PortfolioVisit.visitor_key))).scalar() or 0

    today_start = datetime.combine(now.date(), datetime.min.time(), tzinfo=timezone.utc)
    daily_total = base.filter(
        PortfolioVisit.event_type == "portfolio_view",
        PortfolioVisit.created_at >= today_start,
    ).count()
    week_start = now - timedelta(days=7)
    weekly_total = base.filter(
        PortfolioVisit.event_type == "portfolio_view",
        PortfolioVisit.created_at >= week_start,
    ).count()

    rows = db.query(
        func.date(PortfolioVisit.created_at).label("visit_date"),
        func.count(PortfolioVisit.id).label("visits"),
    ).filter(
        PortfolioVisit.portfolio_id == portfolio.id,
        PortfolioVisit.event_type == "portfolio_view",
        PortfolioVisit.created_at >= start_dt,
    ).group_by(func.date(PortfolioVisit.created_at)).all()
    counts = {str(row.visit_date): int(row.visits) for row in rows}
    days = 7 if range == "7d" else 30
    daily_visits = []
    for offset in range(days):
        day = start_day + timedelta(days=offset)
        daily_visits.append({
            "date": day.isoformat(),
            "label": day.strftime("%b %d"),
            "visits": counts.get(day.isoformat(), 0),
        })

    top_rows = db.query(
        PortfolioVisit.project_title,
        func.count(PortfolioVisit.id).label("views"),
    ).filter(
        PortfolioVisit.portfolio_id == portfolio.id,
        PortfolioVisit.event_type == "project_view",
        PortfolioVisit.project_title.isnot(None),
        PortfolioVisit.created_at >= start_dt,
    ).group_by(PortfolioVisit.project_title).order_by(
        func.count(PortfolioVisit.id).desc()
    ).limit(10).all()

    return {
        "total_visitors": int(total_visitors),
        "daily_visits_total": int(daily_total),
        "weekly_visits_total": int(weekly_total),
        "daily_visits": daily_visits,
        "top_projects": [
            {"title": row.project_title, "views": int(row.views)}
            for row in top_rows
        ],
    }
