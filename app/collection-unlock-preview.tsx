import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CollectionUnlock } from '@/src/components/room/collection-unlock';
import { PAID_COLLECTIONS, type PaidCollection } from '@/src/services/collection-access';

// Animation preview only: it never grants access or simulates a purchase.
export default function CollectionUnlockPreview() {
  const [collection, setCollection] = useState<PaidCollection>();
  if (!__DEV__) return <Redirect href="/" />;
  return <View style={styles.screen}>
    <Stack.Screen options={{ title: 'Prévia de desbloqueio' }} />
    {(Object.keys(PAID_COLLECTIONS) as PaidCollection[]).map(id => <Pressable accessibilityRole="button" key={id} onPress={() => setCollection(id)} style={styles.button}><Text>{PAID_COLLECTIONS[id].name}</Text></Pressable>)}
    <CollectionUnlock preview={collection} onPreviewClose={() => setCollection(undefined)} />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, padding: 24, justifyContent: 'center', gap: 16, backgroundColor: '#F2E9DA' }, button: { padding: 20, borderRadius: 16, backgroundColor: '#FAF5EE', alignItems: 'center' } });
