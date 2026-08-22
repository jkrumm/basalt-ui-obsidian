/**
 * `iosStatusBarFix` — rewrites the `apple-mobile-web-app-status-bar-style` meta tag that
 * `basaltAppPlugin` injects into `index.html` from `default` to `black-translucent`.
 *
 * Checked first: `basaltAppPlugin` (re-verified against basalt-ui@1.21.0's `dist/vite.js`) hardcodes
 * this tag unconditionally — `BasaltAppOptions` still has no `statusBarStyle` (or equivalent), so
 * there is no in-source way to ask basalt-ui for `black-translucent` instead. `basalt-ui` itself is
 * out of scope for this change (a separate package), so this rewrites the emitted tag rather than
 * patching the source that emits it.
 *
 * This app runs `viewport-fit=cover` (basaltAppPlugin injects that meta too, when absent) over a
 * dark UI (`theme-color: #27272a`). `default` renders a light iOS status bar, which sits wrong over
 * dark chrome on the installed home-screen app; `black-translucent` lets the app draw under the
 * status bar with light content, matching the dark theme.
 *
 * Deliberately a find-and-replace on the existing tag, not a second injected
 * `<meta name="apple-mobile-web-app-status-bar-style">` — two conflicting tags with the same `name`
 * is worse than one wrong one (which one a browser honors is unspecified and inconsistent). `order:
 * 'post'` guarantees this runs after basaltAppPlugin's own `transformIndexHtml` hook regardless of
 * plugin array position, so the tag already exists in `html` by the time this handler sees it.
 */
import type { Plugin } from 'vite'

const STATUS_BAR_META =
  /<meta\s+name="apple-mobile-web-app-status-bar-style"\s+content="default"\s*\/?>/

const CORRECTED_TAG =
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'

export function iosStatusBarFix(): Plugin {
  return {
    name: 'basalt-ui-obsidian-demo:ios-status-bar-fix',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!STATUS_BAR_META.test(html)) {
          // basalt-ui changed how (or whether) it emits this tag — fail loudly rather than silently
          // ship the wrong status bar. Fix: re-check `dist/vite.js`'s `apple-mobile-web-app-status-
          // bar-style` output and update STATUS_BAR_META here to match.
          throw new Error(
            'iosStatusBarFix: expected basaltAppPlugin to emit ' +
              '<meta name="apple-mobile-web-app-status-bar-style" content="default"> in index.html, ' +
              'but it was not found — basalt-ui likely changed its head-tag output.',
          )
        }
        return html.replace(STATUS_BAR_META, CORRECTED_TAG)
      },
    },
  }
}
