import type { Translate, UiLang } from '../i18n';
import type { Settings, ThemeMode } from '../lib/settings';
import { IconMonitor, IconMoon, IconShield, IconSun } from './icons';
import { Button, Modal, Toggle } from './ui';
import { cx } from '../lib/classNames';

export interface SettingsDialogProps {
  t: Translate;
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  uiLang: UiLang;
  onUiLangChange: (lang: UiLang) => void;
  onClearModels: () => void;
  onClearHistory: () => void;
  historyCount: number;
  storageKind: 'indexeddb' | 'memory';
}

const THEME_OPTIONS: { value: ThemeMode; icon: typeof IconSun; labelKey: 'nav.themeLight' | 'nav.themeDark' | 'nav.themeSystem' }[] = [
  { value: 'light', icon: IconSun, labelKey: 'nav.themeLight' },
  { value: 'dark', icon: IconMoon, labelKey: 'nav.themeDark' },
  { value: 'system', icon: IconMonitor, labelKey: 'nav.themeSystem' },
];

export function SettingsDialog({
  t,
  open,
  onClose,
  settings,
  onChange,
  uiLang,
  onUiLangChange,
  onClearModels,
  onClearHistory,
  historyCount,
  storageKind,
}: SettingsDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={t('settings.title')} testId="settings-dialog">
      <div className="space-y-2">
        <p className="label">{t('settings.language')}</p>
        <div className="seg">
          <button
            type="button"
            className={cx('seg-item px-4 py-1.5', uiLang === 'zh' && 'seg-item-active')}
            onClick={() => onUiLangChange('zh')}
          >
            中文
          </button>
          <button
            type="button"
            className={cx('seg-item px-4 py-1.5', uiLang === 'en' && 'seg-item-active')}
            onClick={() => onUiLangChange('en')}
          >
            English
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="label">{t('settings.theme')}</p>
        <div className="seg">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                className={cx(
                  'seg-item inline-flex items-center gap-1.5 px-3 py-1.5',
                  settings.theme === option.value && 'seg-item-active',
                )}
                onClick={() => onChange({ theme: option.value })}
              >
                <Icon size={13} />
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-ink-200/70 pt-3 dark:border-ink-800">
        <Toggle
          id="setting-save-history"
          checked={settings.saveHistory}
          onChange={(saveHistory) => onChange({ saveHistory })}
          label={t('history.save')}
          description={t('history.saveHint')}
        />

        <div>
          <p className="label mb-1">{t('settings.concurrency')}</p>
          <div className="seg">
            {[1, 2].map((value) => (
              <button
                key={value}
                type="button"
                className={cx('seg-item px-4 py-1.5', settings.concurrency === value && 'seg-item-active')}
                onClick={() => onChange({ concurrency: value })}
                data-testid={`concurrency-${value}`}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">{t('settings.concurrencyHint')}</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-ink-200/70 pt-3 dark:border-ink-800">
        <p className="label">{t('settings.storage')}</p>
        <p className="text-xs text-ink-600 dark:text-ink-300">
          {storageKind === 'indexeddb' ? t('history.count', { count: historyCount }) : t('history.memoryOnly')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onClearModels} data-testid="clear-models">
            {t('settings.clearModels')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={onClearHistory}
            disabled={historyCount === 0}
            data-testid="clear-history-settings"
          >
            {t('history.clear')}
          </Button>
        </div>
      </div>

      <div className="flex justify-end border-t border-ink-200/70 pt-3 dark:border-ink-800">
        <Button variant="primary" onClick={onClose}>
          {t('settings.close')}
        </Button>
      </div>
    </Modal>
  );
}

export interface PrivacyDialogProps {
  t: Translate;
  open: boolean;
  onClose: () => void;
}

export function PrivacyDialog({ t, open, onClose }: PrivacyDialogProps) {
  const points = [
    t('privacy.p1'),
    t('privacy.p2'),
    t('privacy.p3'),
    t('privacy.p4'),
    t('privacy.p5'),
    t('privacy.p6'),
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('privacy.title')}
      testId="privacy-dialog"
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('privacy.gotIt')}
        </Button>
      }
    >
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
        <IconShield size={16} />
        <span>{t('app.privacyPill')}</span>
      </div>
      <ul className="space-y-2">
        {points.map((point) => (
          <li key={point} className="flex gap-2 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
            <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-500" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
