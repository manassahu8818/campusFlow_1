/**
 * Auth helper — single point of truth for the current student identity.
 *
 * For the hackathon demo, this returns a hardcoded demo student.
 * To enable real Cognito auth, replace the implementation here with
 * a token decode from the Cognito session.
 */

export function getStudentId(): string {
  return 'aarav-demo'
}

export function getAuthToken(): string {
  // Placeholder — swap with real Cognito ID token when ready
  return 'demo-token'
}
