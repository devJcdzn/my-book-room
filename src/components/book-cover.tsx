import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = PropsWithChildren<{
  color: string;
  coverUrl?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function BookCover({ children, color, coverUrl, style }: Props) {
  return (
    <View style={[styles.container, { backgroundColor: color }, style]}>
      {coverUrl ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={coverUrl}
          source={coverUrl}
          style={StyleSheet.absoluteFill}
          transition={120}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
