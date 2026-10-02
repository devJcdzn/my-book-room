import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { contentShape, frame, pickerStyle, shapes, tag, tint } from '@expo/ui/swift-ui/modifiers';

import { colors, darkTheme, controls } from '@/src/theme';
import type { AmbienceMode } from '@/src/store/library-store';

type Props = {
  isNight: boolean;
  onChange: (value: string | number) => void;
  value: AmbienceMode;
};

const labels: Record<AmbienceMode, string> = {
  auto: 'Automático',
  day: 'Dia',
  night: 'Noite',
};

export default function AmbienceModePicker({ isNight, onChange, value }: Props) {
  return (
    <Host
      colorScheme={isNight ? 'dark' : 'light'}
      ignoreSafeArea="all"
      style={{
        width: '100%',
        height: controls.input.minHeight,
        borderRadius: controls.input.borderRadius,
        backgroundColor: 'transparent',
      }}
    >
      <Picker
        label={labels[value]}
        selection={value}
        onSelectionChange={onChange}
        modifiers={[
          pickerStyle('menu'),
          tint(isNight ? darkTheme.accent : colors.terracottaDark),
          frame({ maxWidth: Infinity, height: controls.input.minHeight, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <Text modifiers={[tag('auto')]}>Automático</Text>
        <Text modifiers={[tag('day')]}>Dia</Text>
        <Text modifiers={[tag('night')]}>Noite</Text>
      </Picker>
    </Host>
  );
}
