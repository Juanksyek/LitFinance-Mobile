const {
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');

const fs = require('fs');
const path = require('path');

const MAIN_ACTIVITY_NAME = '.MainActivity';
const ALIAS_LIGHT = '.MainActivityLauncherLight';
const ALIAS_DARK = '.MainActivityLauncherDark';

function removeLauncherIntentFilter(activity) {
  const intentFilters = activity['intent-filter'];
  if (!intentFilters) return;

  const remaining = intentFilters.filter((filter) => {
    const actions = filter.action ?? [];
    const categories = filter.category ?? [];

    const hasMain = actions.some((a) => a.$?.['android:name'] === 'android.intent.action.MAIN');
    const hasLauncher = categories.some(
      (c) => c.$?.['android:name'] === 'android.intent.category.LAUNCHER'
    );

    return !(hasMain && hasLauncher);
  });

  activity['intent-filter'] = remaining;
}

function ensureActivityAliases(application) {
  const existing = application['activity-alias'] ?? [];

  const makeAlias = ({ name, icon, enabled }) => ({
    $: {
      'android:name': name,
      'android:enabled': enabled ? 'true' : 'false',
      'android:exported': 'true',
      'android:icon': icon,
      'android:roundIcon': icon,
      'android:targetActivity': MAIN_ACTIVITY_NAME,
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      },
    ],
  });

  const upsert = (alias) => {
    const idx = existing.findIndex((a) => a.$?.['android:name'] === alias.$['android:name']);
    if (idx >= 0) {
      existing[idx] = alias;
    } else {
      existing.push(alias);
    }
  };

  upsert(makeAlias({ name: ALIAS_LIGHT, icon: '@mipmap/ic_launcher_light', enabled: true }));
  upsert(makeAlias({ name: ALIAS_DARK, icon: '@mipmap/ic_launcher_dark', enabled: false }));

  application['activity-alias'] = existing;
}

function ensureAndroidAlternateIconAssets(projectRoot) {
  const androidRes = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
  const mipmapDirs = [
    'mipmap-mdpi',
    'mipmap-hdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi',
  ];

  const lightSrc = path.join(projectRoot, 'assets', 'litfinance-app-icon-white-1024.png');
  const darkSrc = path.join(projectRoot, 'assets', 'litfinance-app-icon-black-1024.png');

  if (!fs.existsSync(lightSrc) || !fs.existsSync(darkSrc)) {
    throw new Error(
      '[withAndroidAlternateLauncherIcons] Missing icon assets. Expected assets/litfinance-app-icon-white-1024.png and assets/litfinance-app-icon-black-1024.png'
    );
  }

  for (const dir of mipmapDirs) {
    const targetDir = path.join(androidRes, dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    fs.copyFileSync(lightSrc, path.join(targetDir, 'ic_launcher_light.png'));
    fs.copyFileSync(darkSrc, path.join(targetDir, 'ic_launcher_dark.png'));
  }
}

module.exports = function withAndroidAlternateLauncherIcons(config) {
  // 1) Ensure resources exist for aliases (Android only)
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      ensureAndroidAlternateIconAssets(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);

  // 2) Patch AndroidManifest with activity-alias launcher entries
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return cfg;

    const activities = app.activity ?? [];
    const mainActivity = activities.find((a) => a.$?.['android:name'] === MAIN_ACTIVITY_NAME);
    if (mainActivity) {
      removeLauncherIntentFilter(mainActivity);
    }

    ensureActivityAliases(app);

    return cfg;
  });

  return config;
};
