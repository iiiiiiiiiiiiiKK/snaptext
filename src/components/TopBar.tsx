import type { Translate, UiLang } from '../i18n';
import type { ThemeMode } from '../lib/settings';
import { IconGithub, IconLogo, IconMonitor, IconMoon, IconSettings, IconShield, IconSun } from './icons';
import { IconButton } from './ui';
import { cx } from '../lib/classNames';

const AUTHOR_X_URL = 'https://x.com/0xkillcoin';
const REPO_URL = 'https://github.com/iiiiiiiiiiiiiKK/snaptext';

export interface TopBarProps {
  t: Translate;
  uiLang: UiLang;
  onUiLangChange: (lang: UiLang) => void;
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  onThemeChange: (theme: ThemeMode) => void;
  onOpenPrivacy: () => void;
  onOpenSettings: () => void;
}

export function TopBar({
  t,
  uiLang,
  onUiLangChange,
  theme,
  resolvedTheme,
  onThemeChange,
  onOpenPrivacy,
  onOpenSettings,
}: TopBarProps) {
  const themeIcon =
    theme === 'system' ? <IconMonitor size={16} /> : resolvedTheme === 'dark' ? <IconMoon size={16} /> : <IconSun size={16} />;
  const nextTheme: ThemeMode = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/85 backdrop-blur dark:border-ink-800/80 dark:bg-ink-950/85">
      <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-2 px-3 sm:px-4 lg:px-6">
        <a href="#main" className="flex min-w-0 items-center gap-2 rounded-lg" aria-label={t('app.name')}>
          <IconLogo size={28} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-tight text-ink-900 dark:text-white">
              SnapText
            </span>
            <span className="hidden text-[11px] leading-tight text-ink-500 dark:text-ink-400 sm:block">
              {t('app.taglineShort')}
            </span>
          </span>
        </a>

        <span className="chip ml-1 hidden shrink-0 md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {t('app.localBadge')}
        </span>

        <div className="ml-auto flex min-w-0 items-center gap-1">
          <a
            href={AUTHOR_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="author-x-link"
            title={`${t('nav.author')} · ${AUTHOR_X_URL}`}
            aria-label={t('nav.author')}
            className={cx(
              'group inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-200 px-2 text-ink-900 transition',
              'hover:border-ink-300 hover:bg-ink-100 dark:border-ink-700 dark:text-white dark:hover:border-ink-600 dark:hover:bg-ink-800',
            )}
          >
            <span aria-hidden className="text-[15px] leading-none">
              𝕏
            </span>
            <span className="hidden text-xs font-medium lg:inline">@0xkillcoin</span>
          </a>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('nav.github')}
            title={t('nav.github')}
            className="icon-btn hidden sm:inline-flex"
          >
            <IconGithub size={17} />
          </a>

          <div className="seg ml-1" role="group" aria-label={t('nav.language')}>
            <button
              type="button"
              className={cx('seg-item', uiLang === 'zh' && 'seg-item-active')}
              aria-pressed={uiLang === 'zh'}
              onClick={() => onUiLangChange('zh')}
            >
              中
            </button>
            <button
              type="button"
              className={cx('seg-item', uiLang === 'en' && 'seg-item-active')}
              aria-pressed={uiLang === 'en'}
              onClick={() => onUiLangChange('en')}
            >
              EN
            </button>
          </div>

          <IconButton
            label={`${t('nav.theme')}: ${t(
              theme === 'system' ? 'nav.themeSystem' : theme === 'dark' ? 'nav.themeDark' : 'nav.themeLight',
            )}`}
            onClick={() => onThemeChange(nextTheme)}
            data-testid="theme-toggle"
          >
            {themeIcon}
          </IconButton>

          <IconButton
            label={t('nav.privacy')}
            onClick={onOpenPrivacy}
            className="hidden sm:inline-flex"
            data-testid="open-privacy"
          >
            <IconShield size={17} />
          </IconButton>

          <IconButton label={t('nav.settings')} onClick={onOpenSettings} data-testid="open-settings">
            <IconSettings size={17} />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
