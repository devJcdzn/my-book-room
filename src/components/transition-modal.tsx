import { Modal, type ModalProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export function TransitionModal({ animationType = 'fade', ...props }: ModalProps) {
  const reduceMotion = useReducedMotion();
  return <Modal {...props} animationType={reduceMotion ? 'none' : animationType} />;
}
