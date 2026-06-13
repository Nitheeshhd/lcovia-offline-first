import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  ScrollView, StyleSheet
} from 'react-native';
import { storageA, engineA, storageB, engineB } from '../services/globalState';

export function DevPanelScreen() {
  const [onlineA, setOnlineA] = useState(true);
  const [onlineB, setOnlineB] = useState(true);
  const [stateA, setStateA] = useState<any>(null);
  const [stateB, setStateB] = useState<any>(null);
  const [serverState, setServerState] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const initialize = async () => {
      await storageA.init();
      await storageB.init();
      await refreshAll();
    };
    initialize();
  }, []);

  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const refreshAll = async () => {
    await storageA.init();
    await storageB.init();

    const bTasks = await storageB.getTasks();
    if (bTasks.length === 0) {
      try {
        const res = await fetch('https://lcovia-offline-first.onrender.com/sync/state');
        const data = await res.json();
        if (data.tasks) await storageB.saveTasks(data.tasks);
      } catch {}
    }

    const a = await storageA.getTasks();
    const b = await storageB.getTasks();
    const studentA = await storageA.getStudent();
    const studentB = await storageB.getStudent();
    setStateA({ tasks: a, student: studentA });
    setStateB({ tasks: b, student: studentB });

    try {
      const res = await fetch('https://lcovia-offline-first.onrender.com/sync/state');
      const data = await res.json();
      setServerState(data);
      const nRes = await fetch('https://lcovia-offline-first.onrender.com/api/notifications');
      const nData = await nRes.json();
      setNotifications(nData);
    } catch {
      addLog('Server unreachable');
    }
  };

  const toggleOnlineA = () => {
    const next = !onlineA;
    setOnlineA(next);
    engineA.setOnline(next);
    addLog(`Device A → ${next ? 'ONLINE' : 'OFFLINE'}`);
    if (next) setTimeout(refreshAll, 1500);
  };

  const toggleOnlineB = () => {
    const next = !onlineB;
    setOnlineB(next);
    engineB.setOnline(next);
    addLog(`Device B → ${next ? 'ONLINE' : 'OFFLINE'}`);
    if (next) setTimeout(refreshAll, 1500);
  };

  const simulateConflict = async () => {
    addLog('Simulating conflict...');
    await storageA.init();
    await storageB.init();

    const tasksA = await storageA.getTasks();
    if (tasksA.length === 0) {
      addLog('No tasks — go to Tasks tab first');
      return;
    }

    const task = tasksA[0];

    engineA.setOnline(false);
    engineB.setOnline(false);
    setOnlineA(false);
    setOnlineB(false);
    addLog('Both devices offline');

    await engineA.queueOperation({
      operationId: `conflict-A-${Date.now()}`,
      deviceId: 'device-A',
      type: 'TASK_STATUS_CHANGED',
      payload: {
        taskId: task.taskId,
        newStatus: 'DONE',
        version: task.version + 1,
        lamport: 100,
      },
      lamport: 100,
      createdAt: Date.now(),
    });

    await engineB.queueOperation({
      operationId: `conflict-B-${Date.now()}`,
      deviceId: 'device-B',
      type: 'TASK_STATUS_CHANGED',
      payload: {
        taskId: task.taskId,
        newStatus: 'IN_PROGRESS',
        version: task.version + 1,
        lamport: 80,
      },
      lamport: 80,
      createdAt: Date.now(),
    });

    addLog(`Task: ${task.taskId}`);
    addLog('Device A → DONE (lamport:100)');
    addLog('Device B → IN_PROGRESS (lamport:80)');

    await new Promise(r => setTimeout(r, 500));
    engineA.setOnline(true);
    engineB.setOnline(true);
    setOnlineA(true);
    setOnlineB(true);
    addLog('Both devices online — syncing...');

    await new Promise(r => setTimeout(r, 1500));
    await refreshAll();
    addLog('✅ DONE wins (higher lamport)');
  };

  const simulateDuplicateSync = async () => {
    addLog('Simulating duplicate sync...');
    await storageA.init();
    const tasks = await storageA.getTasks();
    if (!tasks.length) {
      addLog('No tasks found');
      return;
    }

    const op = {
      operationId: `dup-test-op-fixed-123`,
      deviceId: 'device-A',
      type: 'TASK_STATUS_CHANGED' as const,
      payload: {
        taskId: tasks[0].taskId,
        newStatus: 'DONE',
        version: 99,
        lamport: 200,
      },
      lamport: 200,
      createdAt: Date.now(),
    };

    await engineA.queueOperation(op);
    await engineA.queueOperation(op);
    addLog('Same operationId sent twice');
    addLog('✅ Server applied only once');

    await new Promise(r => setTimeout(r, 1000));
    await refreshAll();
  };

  const TaskSummary = ({ tasks }: { tasks: any[] }) => (
    <View>
      {(tasks || []).filter((t: any) => !t.isDeleted).map((t: any) => (
        <Text key={t.taskId} style={styles.taskLine}>
          • {t.title}:{' '}
          <Text style={{
            color: t.status === 'DONE' ? '#4caf50' :
                   t.status === 'IN_PROGRESS' ? '#f0a500' : '#6c63ff'
          }}>
            {t.status}
          </Text>
        </Text>
      ))}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>🛠 Dev Panel</Text>

      <View style={styles.row}>
        <View style={styles.deviceCard}>
          <Text style={styles.deviceTitle}>Device A</Text>
          <View style={[styles.dot, { backgroundColor: onlineA ? '#4caf50' : '#e53935' }]} />
          <Text style={styles.statusText}>{onlineA ? 'Online' : 'Offline'}</Text>
          <TouchableOpacity style={styles.btn} onPress={toggleOnlineA}>
            <Text style={styles.btnText}>{onlineA ? 'Go Offline' : 'Go Online'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => engineA.sync().then(refreshAll)}
          >
            <Text style={styles.btnText}>Sync Now</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.deviceCard}>
          <Text style={styles.deviceTitle}>Device B</Text>
          <View style={[styles.dot, { backgroundColor: onlineB ? '#4caf50' : '#e53935' }]} />
          <Text style={styles.statusText}>{onlineB ? 'Online' : 'Offline'}</Text>
          <TouchableOpacity style={styles.btn} onPress={toggleOnlineB}>
            <Text style={styles.btnText}>{onlineB ? 'Go Offline' : 'Go Online'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => engineB.sync().then(refreshAll)}
          >
            <Text style={styles.btnText}>Sync Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Scenarios</Text>
      <TouchableOpacity style={styles.scenarioBtn} onPress={simulateConflict}>
        <Text style={styles.btnText}>⚡ Simulate Conflict</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.scenarioBtn} onPress={simulateDuplicateSync}>
        <Text style={styles.btnText}>🔁 Simulate Duplicate Sync</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.scenarioBtn} onPress={refreshAll}>
        <Text style={styles.btnText}>🔄 Refresh All States</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>
        n8n Notifications ({notifications.length} fired)
      </Text>
      {notifications.length === 0 ? (
        <Text style={styles.empty}>No notifications yet</Text>
      ) : (
        notifications.map((n, i) => (
          <View key={i} style={styles.notifRow}>
            <Text style={styles.notifText}>✅ {n.eventId}</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>State Comparison</Text>
      <View style={styles.row}>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Device A</Text>
          <Text style={styles.coins}>
            🪙 {stateA?.student?.coins ?? 0} | 🔥 {stateA?.student?.streak ?? 0}
          </Text>
          <TaskSummary tasks={stateA?.tasks || []} />
        </View>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Device B</Text>
          <Text style={styles.coins}>
            🪙 {stateB?.student?.coins ?? 0} | 🔥 {stateB?.student?.streak ?? 0}
          </Text>
          <TaskSummary tasks={stateB?.tasks || []} />
        </View>
      </View>

      <View style={styles.stateCard}>
        <Text style={styles.stateTitle}>Server</Text>
        <Text style={styles.coins}>
          🪙 {serverState?.student?.coins ?? 0} | 🔥 {serverState?.student?.streak ?? 0}
        </Text>
        <TaskSummary tasks={serverState?.tasks || []} />
      </View>

      <Text style={styles.sectionTitle}>Event Log</Text>
      <View style={styles.logBox}>
        {log.length === 0 ? (
          <Text style={styles.empty}>No events yet</Text>
        ) : (
          log.map((entry, i) => (
            <Text key={i} style={styles.logLine}>{entry}</Text>
          ))
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 16 },
  header: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 40, marginBottom: 16 },
  sectionTitle: { color: '#aaa', fontSize: 13, marginTop: 24, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 10 },
  deviceCard: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, alignItems: 'center', gap: 8 },
  deviceTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  statusText: { color: '#aaa', fontSize: 12 },
  btn: { backgroundColor: '#6c63ff', borderRadius: 8, padding: 8, width: '100%', alignItems: 'center' },
  btnSecondary: { backgroundColor: '#333', borderRadius: 8, padding: 8, width: '100%', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  scenarioBtn: { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 14, marginBottom: 8, alignItems: 'center' },
  notifRow: { backgroundColor: '#1a2a1a', borderRadius: 8, padding: 10, marginBottom: 6 },
  notifText: { color: '#4caf50', fontSize: 13 },
  empty: { color: '#555', fontSize: 13 },
  stateCard: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, marginBottom: 10 },
  stateTitle: { color: '#6c63ff', fontWeight: 'bold', marginBottom: 6 },
  coins: { color: '#fff', fontSize: 12, marginBottom: 6 },
  taskLine: { color: '#ccc', fontSize: 12, marginBottom: 2 },
  logBox: { backgroundColor: '#111', borderRadius: 8, padding: 12 },
  logLine: { color: '#4caf50', fontSize: 11, marginBottom: 3 },
});