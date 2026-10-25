import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Development, preview and the store app install side by side: each variant gets its own bundle id, name and link
 * scheme. `APP_VARIANT` comes from the EAS environment (development / preview / production), so builds and
 * `eas update --environment …` resolve the same config and runtime version. Unset means the store app.
 */
const VARIANTS = {
  development: { id: 'com.eratas.rtap.dev', name: 'RTAP (D)', scheme: 'map-dev' },
  preview: { id: 'com.eratas.rtap.preview', name: 'RTAP (P)', scheme: 'map-preview' },
  production: { id: 'com.eratas.rtap', name: 'RTAP', scheme: 'map' },
} as const;

type Variant = keyof typeof VARIANTS;

function variant(): Variant {
  const v = process.env.APP_VARIANT;
  return v === 'development' || v === 'preview' ? v : 'production';
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const { id, name, scheme } = VARIANTS[variant()];
  return {
    ...config,
    name,
    slug: config.slug ?? 'map',
    scheme,
    ios: { ...config.ios, bundleIdentifier: id },
    android: { ...config.android, package: id },
  };
};
