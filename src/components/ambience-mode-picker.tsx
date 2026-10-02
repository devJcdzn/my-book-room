import { Host, Picker } from '@expo/ui';

import { colors, darkTheme, controls } from '@/src/theme';
import type { AmbienceMode } from '@/src/store/library-store';

type Props = {
  isNight: boolean;
  onChange: (value: string | number) => void;
  value: AmbienceMode;
};

export default function AmbienceModePicker({ isNight, onChange, value }: Props) {
  return (
    <Host
      colorScheme={isNight ? 'dark' : 'light'}
      matchContents={{ vertical: true }}
      seedColor={isNight ? darkTheme.accent : colors.terracottaDark}
      style={{
        width: '100%',
        minHeight: controls.input.minHeight,
        borderRadius: controls.input.borderRadius,
        backgroundColor: 'transparent',
      }}
    >
      <Picker appearance="menu" selectedValue={value} onValueChange={onChange}>
        <Picker.Item label="Automático" value="auto" />
        <Picker.Item label="Dia" value="day" />
        <Picker.Item label="Noite" value="night" />
      </Picker>
    </Host>
  );
}
