import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// FR-1: seven screens; FR-2: persistent navigation bar with a Settings button.
const screens: { name: string; title: string; icon: IoniconName }[] = [
  { name: 'index', title: 'Plan', icon: 'calendar' },
  { name: 'items', title: 'Items', icon: 'list' },
  { name: 'daily', title: 'Daily', icon: 'today' },
  { name: 'weekly', title: 'Weekly', icon: 'albums' },
  { name: 'monthly', title: 'Monthly', icon: 'grid' },
  { name: 'cycle', title: 'Cycle', icon: 'sync' },
  { name: 'annual', title: 'Annual', icon: 'earth' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
];

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#7C4DBE', tabBarLabelStyle: { fontSize: 10 } }}>
      {screens.map((s) => (
        <Tabs.Screen
          key={s.name}
          name={s.name}
          options={{
            title: s.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={s.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
