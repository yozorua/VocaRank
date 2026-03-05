from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from .auth import get_current_user_from_token
from .official_lives import get_admin_user

router = APIRouter(redirect_slashes=False)


def _optional_user(
    authorization: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    """Returns the current user if a valid token is present, else None."""
    return None


def _ts(dt: datetime) -> str:
    return dt.isoformat() if dt else ""


def _build_report_out(
    report: models.Report,
    current_user_id: Optional[int],
) -> schemas.ReportOut:
    upvote_count = len(report.upvotes)
    user_upvoted = any(u.user_id == current_user_id for u in report.upvotes) if current_user_id else False
    return schemas.ReportOut(
        id=report.id,
        report_type=report.report_type,
        title=report.title,
        description=report.description,
        status=report.status,
        created_at=_ts(report.created_at),
        upvote_count=upvote_count,
        user_upvoted=user_upvoted,
        user=schemas.ReportUserOut(
            id=report.user.id,
            name=report.user.name,
            picture_url=report.user.picture_url,
        ),
    )


# ── Founder ───────────────────────────────────────────────────────────────────

def _founder_dict(u: models.User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "picture_url": u.picture_url,
        "contact_email": u.contact_email,
        "social_x": u.social_x,
        "social_instagram": u.social_instagram,
        "social_facebook": u.social_facebook,
        "social_discord": u.social_discord,
        "about_title": u.about_title,
        "paypal_url": u.paypal_url,
    }


@router.get("/founder")
def get_founder(db: Session = Depends(get_db)):
    founder = db.query(models.User).filter(models.User.id == 1).first()
    if not founder:
        raise HTTPException(status_code=404, detail="Founder not found")
    return _founder_dict(founder)


@router.patch("/founder")
def update_founder_links(
    data: schemas.FounderUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    founder = db.query(models.User).filter(models.User.id == 1).first()
    if not founder:
        raise HTTPException(status_code=404, detail="Founder not found")
    founder.contact_email    = data.contact_email    or None
    founder.social_x         = data.social_x         or None
    founder.social_instagram = data.social_instagram  or None
    founder.social_facebook  = data.social_facebook   or None
    founder.social_discord   = data.social_discord    or None
    if data.about_title is not None:
        founder.about_title = data.about_title or None
    if data.paypal_url is not None:
        founder.paypal_url = data.paypal_url or None
    db.commit()
    db.refresh(founder)
    return _founder_dict(founder)


# ── Announcements ─────────────────────────────────────────────────────────────

@router.get("/announcements", response_model=list[schemas.AnnouncementOut])
def list_announcements(db: Session = Depends(get_db)):
    items = (
        db.query(models.Announcement)
        .order_by(
            models.Announcement.pinned.desc(),
            models.Announcement.created_at.desc(),
        )
        .all()
    )
    return [
        schemas.AnnouncementOut(
            id=a.id,
            title=a.title,
            content=a.content,
            pinned=a.pinned,
            created_at=_ts(a.created_at),
            updated_at=_ts(a.updated_at),
        )
        for a in items
    ]


@router.post("/announcements", response_model=schemas.AnnouncementOut, status_code=201)
def create_announcement(
    data: schemas.AnnouncementCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    now = datetime.utcnow()
    ann = models.Announcement(
        title=data.title,
        content=data.content,
        pinned=data.pinned,
        created_at=now,
        updated_at=now,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return schemas.AnnouncementOut(
        id=ann.id, title=ann.title, content=ann.content,
        pinned=ann.pinned, created_at=_ts(ann.created_at), updated_at=_ts(ann.updated_at),
    )


@router.patch("/announcements/{ann_id}", response_model=schemas.AnnouncementOut)
def update_announcement(
    ann_id: int,
    data: schemas.AnnouncementUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    ann = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    if data.title is not None:
        ann.title = data.title
    if data.content is not None:
        ann.content = data.content
    if data.pinned is not None:
        ann.pinned = data.pinned
    ann.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ann)
    return schemas.AnnouncementOut(
        id=ann.id, title=ann.title, content=ann.content,
        pinned=ann.pinned, created_at=_ts(ann.created_at), updated_at=_ts(ann.updated_at),
    )


@router.delete("/announcements/{ann_id}", status_code=204)
def delete_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    ann = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(ann)
    db.commit()


# ── Roadmap ───────────────────────────────────────────────────────────────────

@router.get("/roadmap", response_model=list[schemas.RoadmapItemOut])
def list_roadmap(db: Session = Depends(get_db)):
    items = db.query(models.RoadmapItem).all()
    # Sort: items with event_date ascending (oldest first), then items without date at end
    def sort_key(i):
        return (0, i.event_date) if i.event_date else (1, _ts(i.created_at))
    items = sorted(items, key=sort_key)
    return [
        schemas.RoadmapItemOut(
            id=i.id, title=i.title, description=i.description,
            status=i.status, display_order=i.display_order,
            event_date=i.event_date, created_at=_ts(i.created_at),
            title_zh_tw=i.title_zh_tw, title_ja=i.title_ja,
            description_zh_tw=i.description_zh_tw, description_ja=i.description_ja,
        )
        for i in items
    ]


@router.post("/roadmap", response_model=schemas.RoadmapItemOut, status_code=201)
def create_roadmap_item(
    data: schemas.RoadmapItemCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    item = models.RoadmapItem(
        title=data.title,
        description=data.description,
        status=data.status,
        display_order=data.display_order,
        event_date=data.event_date or None,
        created_at=datetime.utcnow(),
        title_zh_tw=data.title_zh_tw or None,
        title_ja=data.title_ja or None,
        description_zh_tw=data.description_zh_tw or None,
        description_ja=data.description_ja or None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return schemas.RoadmapItemOut(
        id=item.id, title=item.title, description=item.description,
        status=item.status, display_order=item.display_order,
        event_date=item.event_date, created_at=_ts(item.created_at),
        title_zh_tw=item.title_zh_tw, title_ja=item.title_ja,
        description_zh_tw=item.description_zh_tw, description_ja=item.description_ja,
    )


@router.patch("/roadmap/{item_id}", response_model=schemas.RoadmapItemOut)
def update_roadmap_item(
    item_id: int,
    data: schemas.RoadmapItemUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    item = db.query(models.RoadmapItem).filter(models.RoadmapItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    if data.title is not None:
        item.title = data.title
    if data.description is not None:
        item.description = data.description or None
    if data.status is not None:
        item.status = data.status
    if data.display_order is not None:
        item.display_order = data.display_order
    if data.event_date is not None:
        item.event_date = data.event_date or None
    if data.title_zh_tw is not None:
        item.title_zh_tw = data.title_zh_tw or None
    if data.title_ja is not None:
        item.title_ja = data.title_ja or None
    if data.description_zh_tw is not None:
        item.description_zh_tw = data.description_zh_tw or None
    if data.description_ja is not None:
        item.description_ja = data.description_ja or None
    db.commit()
    db.refresh(item)
    return schemas.RoadmapItemOut(
        id=item.id, title=item.title, description=item.description,
        status=item.status, display_order=item.display_order,
        event_date=item.event_date, created_at=_ts(item.created_at),
        title_zh_tw=item.title_zh_tw, title_ja=item.title_ja,
        description_zh_tw=item.description_zh_tw, description_ja=item.description_ja,
    )


@router.delete("/roadmap/{item_id}", status_code=204)
def delete_roadmap_item(
    item_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    item = db.query(models.RoadmapItem).filter(models.RoadmapItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    db.delete(item)
    db.commit()


# ── Reports ───────────────────────────────────────────────────────────────────

@router.get("/reports")
def list_reports(
    report_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    # current_user_id requires auth; public endpoint, so we can't use Depends here.
    # The client sends the JWT; we try to decode it optionally.
    q = db.query(models.Report)
    if report_type in ("bug", "feature"):
        q = q.filter(models.Report.report_type == report_type)
    reports = q.order_by(models.Report.created_at.desc()).all()
    # Return without user_upvoted (requires auth); client will update after login
    return [
        {
            "id": r.id,
            "report_type": r.report_type,
            "title": r.title,
            "description": r.description,
            "status": r.status,
            "created_at": _ts(r.created_at),
            "upvote_count": len(r.upvotes),
            "user_upvoted": False,
            "user": {
                "id": r.user.id,
                "name": r.user.name,
                "picture_url": r.user.picture_url,
            },
        }
        for r in reports
    ]


@router.get("/reports/me")
def list_my_upvotes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    """Returns IDs of reports the current user has upvoted."""
    upvotes = (
        db.query(models.ReportUpvote.report_id)
        .filter(models.ReportUpvote.user_id == current_user.id)
        .all()
    )
    return {"upvoted_ids": [u.report_id for u in upvotes]}


@router.post("/reports", status_code=201)
def create_report(
    data: schemas.ReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    if data.report_type not in ("bug", "feature"):
        raise HTTPException(status_code=400, detail="report_type must be 'bug' or 'feature'")
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    report = models.Report(
        user_id=current_user.id,
        report_type=data.report_type,
        title=data.title.strip(),
        description=data.description,
        status="open",
        created_at=datetime.utcnow(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _build_report_out(report, current_user.id)


@router.post("/reports/{report_id}/upvote", status_code=200)
def toggle_upvote(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    existing = db.query(models.ReportUpvote).filter(
        models.ReportUpvote.report_id == report_id,
        models.ReportUpvote.user_id == current_user.id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        db.refresh(report)
        return {"upvote_count": len(report.upvotes), "user_upvoted": False}
    else:
        upvote = models.ReportUpvote(
            report_id=report_id,
            user_id=current_user.id,
            created_at=datetime.utcnow(),
        )
        db.add(upvote)
        db.commit()
        db.refresh(report)
        return {"upvote_count": len(report.upvotes), "user_upvoted": True}


@router.patch("/reports/{report_id}/status", status_code=200)
def update_report_status(
    report_id: int,
    data: schemas.ReportStatusUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    if data.status not in ("open", "resolved", "closed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = data.status
    db.commit()
    return {"id": report.id, "status": report.status}


@router.delete("/reports/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()


# ── Contributors ───────────────────────────────────────────────────────────────

def _contrib_dict(c: models.Contributor) -> dict:
    return {
        "id": c.id,
        "user_id": c.user_id,
        "name": c.user.name,
        "picture_url": c.user.picture_url,
        "role": c.role,
        "display_order": c.display_order,
    }


@router.get("/contributors")
def list_contributors(db: Session = Depends(get_db)):
    contribs = (
        db.query(models.Contributor)
        .order_by(models.Contributor.display_order, models.Contributor.id)
        .all()
    )
    return [_contrib_dict(c) for c in contribs]


@router.post("/contributors", status_code=201)
def create_contributor(
    data: schemas.ContributorCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(models.Contributor).filter(models.Contributor.user_id == data.user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a contributor")
    c = models.Contributor(
        user_id=data.user_id,
        role=data.role or None,
        display_order=data.display_order,
        created_at=datetime.utcnow(),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _contrib_dict(c)


@router.patch("/contributors/{contrib_id}", status_code=200)
def update_contributor(
    contrib_id: int,
    data: schemas.ContributorUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    c = db.query(models.Contributor).filter(models.Contributor.id == contrib_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contributor not found")
    if data.role is not None:
        c.role = data.role or None
    if data.display_order is not None:
        c.display_order = data.display_order
    db.commit()
    db.refresh(c)
    return _contrib_dict(c)


@router.delete("/contributors/{contrib_id}", status_code=204)
def delete_contributor(
    contrib_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    c = db.query(models.Contributor).filter(models.Contributor.id == contrib_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contributor not found")
    db.delete(c)
    db.commit()
