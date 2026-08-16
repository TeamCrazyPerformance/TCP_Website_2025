from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, Request, status


def require_service_token(
    request: Request, authorization: str | None = Header(default=None)
) -> None:
    expected = request.app.state.settings.service_token
    scheme, _, supplied = (authorization or "").partition(" ")
    valid = scheme.lower() == "bearer" and bool(supplied) and hmac.compare_digest(
        supplied.encode("utf-8"), expected.encode("utf-8")
    )
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "A valid service token is required."},
            headers={"WWW-Authenticate": "Bearer"},
        )
