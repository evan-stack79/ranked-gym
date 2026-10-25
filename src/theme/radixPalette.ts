/**
 * Palette Radix custom Ranked Gym — valeurs officielles (mode Dark).
 * https://www.radix-ui.com/colors/custom?accent-light=DD0600&accent-dark=FF0702&gray-dark=99A1A6&bg-dark=000000
 *
 * Source unique web + IPA.
 */

export const RADIX_DARK = {
  red: {
    1: '#000000',
    2: '#1a0d0b',
    3: '#3b0c07',
    4: '#560000',
    5: '#680301',
    6: '#7a160f',
    7: '#94281e',
    8: '#c03529',
    9: '#ff0702',
    10: '#ef0000',
    11: '#ff907f',
    12: '#ffcfc6',
    contrast: '#ffffff',
    surface: '#341a1680',
    track: '#ff0702',
  },
  gray: {
    1: '#000000',
    2: '#101214',
    3: '#1d1f20',
    4: '#25282a',
    5: '#2c3032',
    6: '#353a3d',
    7: '#42484c',
    8: '#596166',
    9: '#636f76',
    10: '#717c83',
    11: '#acb4ba',
    12: '#eceeef',
    contrast: '#ffffff',
    track: '#636f76',
  },
  redA: {
    1: '#00000000',
    2: '#ff806c1a',
    3: '#ff341f3b',
    4: '#ff000056',
    5: '#ff080368',
    6: '#ff2e207a',
    7: '#ff453494',
    8: '#ff4737c0',
    9: '#ff0702',
    10: '#ff0000ef',
    11: '#ff907f',
    12: '#ffcfc6',
  },
  grayA: {
    1: '#00000000',
    2: '#cce6ff14',
    3: '#e8f8ff20',
    4: '#e1f3ff2a',
    5: '#e1f5ff32',
    6: '#def3ff3d',
    7: '#def2ff4c',
    8: '#dff3ff66',
    9: '#d6f0ff76',
    10: '#dcf2ff83',
    11: '#ecf7ffba',
    12: '#fcfeffef',
  },
} as const

export const BRAND = RADIX_DARK.red[9]
export const BRAND_HOVER = RADIX_DARK.red[10]
export const BRAND_TEXT = RADIX_DARK.red[11]
export const APP_BG = RADIX_DARK.gray[1]
export const APP_SURFACE = RADIX_DARK.gray[3]
export const APP_INSET = RADIX_DARK.gray[4]
export const APP_MUTED = RADIX_DARK.gray[11]
export const APP_FG = RADIX_DARK.gray[12]
