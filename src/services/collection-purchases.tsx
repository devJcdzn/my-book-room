import { showAlert } from '@/src/components/app-dialog';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import type { CustomerInfo } from 'react-native-purchases';
import { useAuth } from '@/src/providers/auth-provider';
import { IAP_ENABLED } from '@/src/config/features';
import { CollectionUnlock } from '@/src/components/room/collection-unlock';
import { PAID_COLLECTIONS, newlyUnlockedCollections, ownedCollections, useCollectionPurchases, type PaidCollection } from './collection-access';

let identityVersion = 0;
let pendingUnlock: { version: number; collection: PaidCollection; before: PaidCollection[] } | null = null;
const applyInfo = (info: CustomerInfo, version = identityVersion) => {
  if (version !== identityVersion) return;
  const owned = ownedCollections(info);
  const confirmed = pendingUnlock?.version === version && owned.includes(pendingUnlock.collection) ? pendingUnlock : null;
  if (confirmed) pendingUnlock = null;
  useCollectionPurchases.setState({
    owned,
    ready: true,
    checked: true,
    ...(confirmed ? { unlocked: newlyUnlockedCollections(confirmed.before, owned) } : {}),
  });
};
let identityOperation: Promise<void> = Promise.resolve();
let refreshPurchases: (() => Promise<void>) | null = null;

async function identify(userId: string | null) {
  const { default: Purchases } = await import('react-native-purchases');
  const apiKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  if (!apiKey || (!__DEV__ && apiKey.startsWith('test_')) || Platform.OS === 'web' || Constants.appOwnership === 'expo') throw new Error('Compras indisponíveis nesta versão do app.');
  if (!await Purchases.isConfigured()) Purchases.configure({ apiKey, appUserID: userId ?? undefined });
  else if (userId && await Purchases.getAppUserID() !== userId) await Purchases.logIn(userId);
  else if (!userId && !await Purchases.isAnonymous()) await Purchases.logOut();
  return Purchases.getCustomerInfo();
}

export function CollectionPurchasesLifecycle() {
  const { user, isLoading } = useAuth();
  useEffect(() => {
    if (!IAP_ENABLED || isLoading) return;
    const version = ++identityVersion;
    pendingUnlock = null;
    let disposed = false;
    let unsubscribe = () => {};
    let listening = false;
    useCollectionPurchases.setState({ owned: [], ready: false, checked: false, unlocked: [] });
    const refresh = () => {
      identityOperation = identityOperation.catch(() => {}).then(async () => {
        if (disposed) return;
        const info = await identify(user?.id ?? null);
        if (disposed) return;
        applyInfo(info, version);
        if (listening) return;
        const { default: Purchases } = await import('react-native-purchases');
        if (disposed) return;
        const listener = (info: CustomerInfo) => { if (!disposed) applyInfo(info, version); };
        Purchases.addCustomerInfoUpdateListener(listener);
        listening = true;
        unsubscribe = () => { Purchases.removeCustomerInfoUpdateListener(listener); };
      });
      return identityOperation;
    };
    refreshPurchases = refresh;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh().catch(() => {});
    });
    void refresh();
    void identityOperation.catch(() => { if (!disposed) useCollectionPurchases.setState({ ready: false, checked: true }); });
    return () => {
      disposed = true;
      if (version === identityVersion) {
        pendingUnlock = null;
        identityVersion += 1;
        useCollectionPurchases.setState({ owned: [], ready: false, checked: false, unlocked: [] });
      }
      unsubscribe();
      subscription.remove();
      if (refreshPurchases === refresh) refreshPurchases = null;
    };
  }, [user?.id, isLoading]);
  return IAP_ENABLED ? <CollectionUnlock /> : null;
}

export async function openCollectionPaywall(collection: PaidCollection) {
  if (!IAP_ENABLED || useCollectionPurchases.getState().busy) return;
  const version = identityVersion;
  useCollectionPurchases.setState({ busy: true });
  try {
    await (refreshPurchases?.() ?? identityOperation);
    if (version !== identityVersion) return;
    if (!useCollectionPurchases.getState().ready) throw new Error('Compras indisponíveis nesta versão do app.');
    const before = useCollectionPurchases.getState().owned;
    const { default: Purchases } = await import('react-native-purchases');
    const { default: RevenueCatUI, PAYWALL_RESULT } = await import('react-native-purchases-ui');
    const offering = (await Purchases.getOfferings()).all[PAID_COLLECTIONS[collection].offering];
    if (!offering?.availablePackages.length) throw new Error('Esta coleção ainda não está disponível para compra.');
    const result = await RevenueCatUI.presentPaywall({ offering, displayCloseButton: true });
    if (result === PAYWALL_RESULT.ERROR) throw new Error("Não foi possível concluir a compra. Tente novamente.");
    if (version !== identityVersion) return;
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      // The entitlement can arrive after the native paywall closes. Keep the
      // celebration pending until this account's CustomerInfo confirms access.
      pendingUnlock = { version, collection, before };
      await Purchases.invalidateCustomerInfoCache();
    }
    const info = await Purchases.getCustomerInfo();
    applyInfo(info, version);
  } catch (error) {
    showAlert('Compra indisponível', error instanceof Error ? error.message : 'Tente novamente em instantes.');
  } finally { useCollectionPurchases.setState({ busy: false }); }
}

export async function restoreCollectionPurchases() {
  if (!IAP_ENABLED || useCollectionPurchases.getState().busy) return;
  const version = identityVersion;
  useCollectionPurchases.setState({ busy: true });
  try {
    await (refreshPurchases?.() ?? identityOperation);
    if (version !== identityVersion) return;
    if (!useCollectionPurchases.getState().ready) throw new Error('Compras indisponíveis nesta versão do app.');
    const before = useCollectionPurchases.getState().owned;
    const { default: Purchases } = await import('react-native-purchases');
    const info = await Purchases.restorePurchases();
    applyInfo(info, version);
    if (version !== identityVersion) return;
    const unlocked = newlyUnlockedCollections(before, ownedCollections(info));
    useCollectionPurchases.setState({ unlocked });
    if (!unlocked.length) showAlert('Compras restauradas', useCollectionPurchases.getState().owned.length ? 'Suas coleções estão disponíveis.' : 'Nenhuma compra dessas coleções foi encontrada.');
  } catch { showAlert('Não foi possível restaurar', 'Verifique sua conexão e tente novamente.'); }
  finally { useCollectionPurchases.setState({ busy: false }); }
}
