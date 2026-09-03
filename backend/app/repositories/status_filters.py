"""
Shared ticket status predicates for reporting and filters.

Business rules:
- Active / open workload: status open + in-progress
- Resolved / closed workload: status closed + not-applicable
"""
from sqlalchemy import or_, and_
from app.db.models.status import Status


def status_is_open():
    """Open or in-progress tickets (active workload)."""
    return or_(
        Status.name == "open",
        Status.name == "in-progress",
        Status.name.ilike("in progress"),
    )


def status_is_in_progress():
    return or_(
        Status.name == "in-progress",
        Status.name.ilike("in progress"),
    )


def status_is_closed_only():
    """Closed tickets only (excludes not-applicable)."""
    return and_(
        or_(
            Status.name == "closed",
            Status.name.ilike("%close%"),
        ),
        ~status_is_not_applicable(),
    )


def status_is_not_applicable():
    return or_(
        Status.name == "not-applicable",
        Status.name.ilike("%not applicable%"),
    )


def status_is_closed_or_na():
    """Closed + not-applicable (resolved workload)."""
    return or_(
        status_is_closed_only(),
        status_is_not_applicable(),
    )
