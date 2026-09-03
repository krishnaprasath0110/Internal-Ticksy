from typing import List, Optional
from pydantic import BaseModel

class TicketMetrics(BaseModel):
    total: int
    open: int
    closed: int
    not_applicable: int

class DepartmentMetrics(TicketMetrics):
    department_id: int
    department_name: str

class CategoryMetrics(TicketMetrics):
    category_id: int
    category_name: str
    department_name: str

class AgentMetrics(TicketMetrics):
    agent_id: int
    agent_name: str
    department_name: str

class ResolutionTimeMetrics(BaseModel):
    within_8_hours: int
    within_24_hours: int
    within_48_hours: int
    beyond_48_hours: int
    total_closed: int
    average_resolution_hours: Optional[float] = None

class OpenTicketAgeingMetrics(BaseModel):
    open: int
    in_progress: int
    total_active: int
    frt_low: int
    frt_medium: int
    frt_high: int
    frt_breached: int
    average_response_hours: Optional[float] = None

class PriorityMetrics(BaseModel):
    high: int
    medium: int
    low: int
    total: int

class AgentPriorityMetrics(BaseModel):
    agent_id: int
    agent_name: str
    departments: Optional[List[str]] = []
    high: int
    medium: int
    low: int
    total: int

class DashboardTicketCounts(BaseModel):
    total: int
    open: int
    in_progress: int
    closed: int
    not_applicable: int
    delayed: int
    delayed_open: int
    delayed_in_progress: int
    delayed_closed: int

class DashboardOverviewResponse(BaseModel):
    metrics: TicketMetrics
    departments: List[DepartmentMetrics]
    categories: List[CategoryMetrics]
    agents: List[AgentMetrics]
    resolution_time: Optional[ResolutionTimeMetrics] = None

class ClosureSlaBucketMetrics(BaseModel):
    low: int
    medium: int
    high: int
    breached: int
    total: int

class ClosureSlaMetrics(BaseModel):
    resolution_72h: ClosureSlaBucketMetrics
    academic_affairs_120h: ClosureSlaBucketMetrics
