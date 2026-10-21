export function getPlatform() {
  if (typeof window === 'undefined') return undefined;
  const { userAgent, platform } = window.navigator;

  const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  if (
    iosPlatforms.indexOf(platform) !== -1
    // For new IPads with M1 chip and IPadOS platform returns "MacIntel"
    || (platform === 'MacIntel' && ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 2))
  ) return 'iOS';

  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  if (macosPlatforms.indexOf(platform) !== -1) return 'macOS';

  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  if (windowsPlatforms.indexOf(platform) !== -1) return 'Windows';

  if (/Android/.test(userAgent)) return 'Android';

  if (/Linux/.test(platform)) return 'Linux';

  return undefined;
}

export const PLATFORM_ENV = getPlatform();
export const IS_MAC_OS = PLATFORM_ENV === 'macOS';
export const IS_WINDOWS = PLATFORM_ENV === 'Windows';
export const IS_LINUX = PLATFORM_ENV === 'Linux';
export const IS_IOS = PLATFORM_ENV === 'iOS';
export const IS_ANDROID = PLATFORM_ENV === 'Android';
export const IS_MOBILE = IS_IOS || IS_ANDROID;
export const IS_SAFARI = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const IS_YA_BROWSER = typeof window !== 'undefined' && navigator.userAgent.includes('YaBrowser');
export const IS_FIREFOX = typeof window !== 'undefined' && (
  navigator.userAgent.toLowerCase().includes('firefox')
  || navigator.userAgent.toLowerCase().includes('iceweasel')
  || navigator.userAgent.toLowerCase().includes('icecat')
);

export const IS_PWA = typeof window !== 'undefined' && (
  window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as any).standalone
  || document.referrer.includes('android-app://')
);

export const IS_SERVICE_WORKER_SUPPORTED = typeof window !== 'undefined' && 'serviceWorker' in navigator;

function isLastEmojiVersionSupported() {
  if (typeof window === 'undefined') return false;
  const ALLOWABLE_CALCULATION_ERROR_SIZE = 5;
  const inlineEl = document.createElement('span');
  inlineEl.classList.add('emoji-test-element');
  document.body.appendChild(inlineEl);

  inlineEl.innerText = '🇨🇶'; // Emoji from 16.0 version
  const newEmojiWidth = inlineEl.offsetWidth;
  inlineEl.innerText = '❤️'; // Emoji from 1.0 version
  const legacyEmojiWidth = inlineEl.offsetWidth;

  document.body.removeChild(inlineEl);

  return Math.abs(newEmojiWidth - legacyEmojiWidth) < ALLOWABLE_CALCULATION_ERROR_SIZE;
}

export const IS_EMOJI_SUPPORTED = typeof window !== 'undefined' && PLATFORM_ENV && (IS_MAC_OS || IS_IOS) && isLastEmojiVersionSupported();

export const SERVICE_NOTIFICATIONS_USER_ID = '777000';
