import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useAuth } from '@/src/providers/auth-provider';
import { cacheAvatar } from '@/src/services/profile-avatar';
import { supabase } from '@/src/services/supabase';
import type { ProfileAvatar as Avatar } from '@/src/types/profile-avatar';
import { colors, typography } from '@/src/theme';

export function ProfileAvatar({ avatar, name, size = 72 }: { avatar?: Avatar; name: string; size?: number }) {
  const { user } = useAuth();
  const [failed, setFailed] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') { setFailed(undefined); setRefresh(value => value + 1); }
    });
    return () => listener.remove();
  }, []);
  const [cached, setCached] = useState<{ version: string; uri: string }>();
  useEffect(() => {
    if (!avatar || avatar.source === 'none') return;
    let active = true;
    void cacheAvatar(supabase, user?.id ?? 'guest', avatar).then(uri => {
      if (active && uri) setCached({ version: avatar.version, uri });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [avatar, user?.id, refresh]);
  const uri = avatar?.source === 'none' ? undefined : cached?.version === avatar?.version ? cached?.uri : avatar?.localUri ?? avatar?.providerUrl;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.terracotta, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {uri && failed !== avatar?.version ? <Image source={{ uri }} contentFit="cover" onError={() => setFailed(avatar?.version)} style={{ width: size, height: size }} accessibilityLabel="Foto de perfil" /> : <Text style={{ color: colors.paper, fontFamily: typography.editorial, fontSize: size * 0.44 }}>{name.trim().charAt(0).toUpperCase() || 'L'}</Text>}
    </View>
  );
}
