"""
Auth helper — single point of truth for the current student identity.

For the hackathon demo, returns a hardcoded demo student.
To enable real Cognito auth, swap this with a JWT token decode.
"""


def get_student_id(event: dict) -> str:
    """
    Extract student ID from the request event.

    Priority:
    1. Header 'X-Student-Id' (set by frontend)
    2. Cognito authorizer claims (when real auth is wired)
    3. Fallback to demo student
    """
    # Check header
    headers = event.get("headers", {}) or {}
    student_id = headers.get("x-student-id") or headers.get("X-Student-Id")
    if student_id:
        return student_id

    # Check Cognito authorizer (future)
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer", {})
    claims = authorizer.get("claims", {})
    if claims.get("sub"):
        return claims["sub"]

    # Hardcoded demo fallback
    return "aarav-demo"
