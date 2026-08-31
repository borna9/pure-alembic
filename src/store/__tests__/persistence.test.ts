import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDataStore } from '../dataStore';
import { usePlanningSession } from '../planningSession';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${Math.random()}` }));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('store persistence', () => {
  it('persists data-store mutations to AsyncStorage', async () => {
    useDataStore.getState().createCategory('Persist check');
    await flush();
    const raw = await AsyncStorage.getItem('pure-alembic-data');
    expect(raw).toBeTruthy();
    expect(raw).toContain('Persist check');
  });

  it('persists planning-session mutations to AsyncStorage', async () => {
    usePlanningSession.getState().setWindow('2026-09-01', '2026-09-05');
    await flush();
    const raw = await AsyncStorage.getItem('pure-alembic-session');
    expect(raw).toBeTruthy();
    expect(raw).toContain('2026-09-01');
  });
});
