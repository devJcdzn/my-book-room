import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

export const REVENUECAT_ENTITLEMENT_ID = 'mybookroom_pro';

type SupportedPlatform = 'ios' | 'android';

let configurationPromise: Promise<boolean> | null = null;

const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;

const getApiKey = (platform: SupportedPlatform) => (
  platform === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim()
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim()
);

const logConfigurationError = (message: string, error?: unknown) => {
  if (isDevelopment) console.warn(`[RevenueCat] ${message}`, error);
};

/**
 * Configures RevenueCat once for the current native platform.
 * The SDK creates and persists an anonymous App User ID until the app adds its own login.
 */
export const initializeRevenueCat = (): Promise<boolean> => {
  if (configurationPromise) return configurationPromise;

  configurationPromise = (async () => {
    const platform = Platform.OS;
    if (platform !== 'ios' && platform !== 'android') return false;

    try {
      if (await Purchases.isConfigured()) return true;

      const apiKey = getApiKey(platform);
      if (!apiKey) {
        logConfigurationError(`Chave da plataforma ${platform} não configurada.`);
        return false;
      }

      if (isDevelopment) {
        await Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
      }

      Purchases.configure({ apiKey });
      return true;
    } catch (error) {
      logConfigurationError('Não foi possível inicializar a SDK.', error);
      return false;
    }
  })();

  return configurationPromise;
};

export const hasProEntitlement = async (): Promise<boolean> => {
  if (!await initializeRevenueCat()) return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return Boolean(customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);
  } catch (error) {
    logConfigurationError('Não foi possível consultar o entitlement.', error);
    return false;
  }
};

export const presentProPaywall = async (): Promise<boolean> => {
  if (!await initializeRevenueCat()) return false;

  try {
    const result = await RevenueCatUI.presentPaywall();
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  } catch (error) {
    logConfigurationError('Não foi possível abrir o paywall.', error);
    return false;
  }
};

export const restoreProPurchases = async (): Promise<boolean> => {
  if (!await initializeRevenueCat()) return false;

  try {
    const customerInfo = await Purchases.restorePurchases();
    return Boolean(customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);
  } catch (error) {
    logConfigurationError('Não foi possível restaurar as compras.', error);
    return false;
  }
};
