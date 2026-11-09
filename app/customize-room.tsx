import { Redirect } from 'expo-router';

// Legacy palette links now return to the room editor's model-based appearance.
export default function CustomizeRoomScreen() {
  return <Redirect href="/(tabs)" />;
}
