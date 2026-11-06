export const USER_IDENTITY_STORAGE_KEY = 'telegenie_user_identity_v1';

export function getUserMdTemplate(userName?: string): string {
  const nameLine = userName?.trim() ? `- **Name:** ${userName.trim()}` : '- **Name:** ';
  return `# USER.md — Human Profile

${nameLine}
- **Role / Occupation:** 
- **Timezone / Location:** 

## Communication Preferences
- **Tone:** Concise, direct, and technical
- **Formatting:** Structured bullet points, code blocks where appropriate
- **Avoid:** Fluff, unnecessary pleasantries, and redundant explanations

## Background & Working Style
- Focus on practical, actionable solutions
- Keep my stated preferences and priorities in mind
`;
}

export function getUserIdentity(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(USER_IDENTITY_STORAGE_KEY) ?? '';
  } catch (e) {
    console.warn('Failed to read user identity from localStorage:', e);
    return '';
  }
}

export function saveUserIdentity(identity: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_IDENTITY_STORAGE_KEY, identity);
  } catch (e) {
    console.warn('Failed to save user identity to localStorage:', e);
  }
}

