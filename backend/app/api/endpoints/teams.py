from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.db.models.team import Team
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.team_schema import TeamCreate, TeamResponse, TeamUpdate

router = APIRouter()


def format_team(team: Team) -> dict:
    return {
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "employee_count": len(team.employees)
    }


@router.get("/", response_model=list[TeamResponse])
def get_teams(db: Session = Depends(get_db)):
    return [format_team(team) for team in db.query(Team).order_by(Team.name).all()]


@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if db.query(Team).filter(Team.name == payload.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A team with this name already exists")
    team = Team(name=payload.name, description=payload.description)
    db.add(team)
    db.commit()
    db.refresh(team)
    return format_team(team)


@router.put("/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    payload: TeamUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    duplicate = db.query(Team).filter(Team.name == payload.name, Team.id != team_id).first()
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A team with this name already exists")
    team.name = payload.name
    team.description = payload.description
    db.commit()
    db.refresh(team)
    return format_team(team)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if db.query(User.id).filter(User.team_id == team_id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Move employees to another team before deleting this team"
        )
    db.delete(team)
    db.commit()
