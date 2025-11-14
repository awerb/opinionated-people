"""FastAPI endpoints for managing invitations."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from backend.analytics.invitations import invitation_analytics
from backend.services.game_admin import game_admin, Invitation

router = APIRouter(prefix="/invitations", tags=["invitations"])


class SendInvitationRequest(BaseModel):
    inviter_id: str
    invitee_email: EmailStr


class SendInvitationResponse(BaseModel):
    token: str
    status: str
    inviter_id: str


class AcceptInvitationRequest(BaseModel):
    token: str
    player_id: str
    display_name: str


class AcceptInvitationResponse(BaseModel):
    player_id: str
    display_name: str
    invited_by: str


@router.post("/send", response_model=SendInvitationResponse)
def send_invitation(payload: SendInvitationRequest) -> SendInvitationResponse:
    """Send an invitation from the inviter to the given email."""

    try:
        invitation: Invitation = game_admin.send_invitation(
            inviter_id=payload.inviter_id, invitee_email=payload.invitee_email
        )
    except ValueError as exc:  # surface validation issues to the client
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    chain = game_admin.get_invitation_chain(invitation.inviter_id)
    invitation_analytics.record_invite_sent(
        inviter_id=invitation.inviter_id,
        invitee_email=invitation.invitee_email,
        mode=game_admin.invite_mode,
        chain=chain,
    )

    return SendInvitationResponse(token=invitation.token, status=invitation.status, inviter_id=invitation.inviter_id)


@router.post("/accept", response_model=AcceptInvitationResponse)
def accept_invitation(payload: AcceptInvitationRequest) -> AcceptInvitationResponse:
    """Accept an invitation token and register a player."""

    try:
        player = game_admin.accept_invitation(
            token=payload.token, player_id=payload.player_id, display_name=payload.display_name
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    chain = game_admin.get_invitation_chain(player.player_id)
    invitation_analytics.record_invite_accepted(player_id=player.player_id, chain=chain)

    return AcceptInvitationResponse(
        player_id=player.player_id,
        display_name=player.display_name,
        invited_by=player.invited_by or "",
    )


@router.get("/tree")
def invitation_tree() -> dict:
    """Returns the current invitation tree for visualization."""

    tree = game_admin.get_invite_tree()
    return {"tree": tree}
