import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TaskScreen } from './src/screens/TaskScreen';
import { FocusScreen } from './src/screens/FocusScreen';
import { DevPanelScreen } from './src/screens/DevPanelScreen';

type Tab = 'tasks' | 'focus' | 'devpanel';

export default function App() {
  const [tab, setTab] = useState<Tab>('tasks');

  return (
    <View style={styles.container}>
      {tab === 'tasks' && <TaskScreen />}
      {tab === 'focus' && <FocusScreen />}
      {tab === 'devpanel' && <DevPanelScreen />}

      <View style={styles.tabBar}>
        <TouchableOpacity onPress={() => setTab('tasks')} style={styles.tab}>
          <Text style={tab === 'tasks' ? styles.active : styles.inactive}>Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('focus')} style={styles.tab}>
          <Text style={tab === 'focus' ? styles.active : styles.inactive}>Focus</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('devpanel')} style={styles.tab}>
          <Text style={tab === 'devpanel' ? styles.active : styles.inactive}>Dev Panel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  tabBar: { flexDirection: 'row', backgroundColor: '#1a1a1a', paddingBottom: 20 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  active: { color: '#6c63ff', fontWeight: 'bold', fontSize: 14 },
  inactive: { color: '#666', fontSize: 14 },
});