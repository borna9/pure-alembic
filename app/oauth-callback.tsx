// OAuth redirect target for the web build. The provider redirects the
// popup here; maybeCompleteAuthSession() hands the result back to the
// opener window and closes the popup.

import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export default function OAuthCallback() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Completing sign-in…</Text>
      <Text style={styles.sub}>You can close this window if it does not close itself.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, color: '#888', marginTop: 8 },
});
