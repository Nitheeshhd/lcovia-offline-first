import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { lamport } from '../services/lamport';
import { Task, TaskStatus } from '../types/task';
import { storageA, engineA } from '../services/globalState';

const DEVICE_ID = 'device-A';
const storage = storageA;
const syncEngine = engineA;

const STATUS_ORDER: TaskStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'];
const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: '⬜ Not Started',
  IN_PROGRESS: '🔄 In Progress',
  DONE: '✅ Done',
};
const STATUS_COLOR: Record<TaskStatus, string> = {
  NOT_STARTED: '#444',
  IN_PROGRESS: '#f0a500',
  DONE: '#4caf50',
};

export function TaskScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const loadTasks = useCallback(async () => {
    await storage.init();
    const stored = await storage.getTasks();

    if (stored.length === 0) {
      try {
        const res = await fetch('https://lcovia-offline-first.onrender.com/sync/state');
        const data = await res.json();
        await storage.saveTasks(data.tasks);
        setTasks(data.tasks.filter((t: Task) => !t.isDeleted));
      } catch {
        setTasks([]);
      }
    } else {
      setTasks(stored.filter((t) => !t.isDeleted));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, []);

  // Poll online status from engine every second
  useEffect(() => {
    const interval = setInterval(() => {
      setIsOnline(syncEngine.getOnline());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const cycleStatus = async (task: Task) => {
    const currentIndex = STATUS_ORDER.indexOf(task.status);
    const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
    const newLamport = lamport.tick();
    const newVersion = task.version + 1;

    const updatedTask: Task = {
      ...task,
      status: nextStatus,
      version: newVersion,
      lamport: newLamport,
    };

    // Always save locally first
    await storage.saveTask(updatedTask);
    setTasks((prev) =>
      prev.map((t) => (t.taskId === task.taskId ? updatedTask : t))
    );

    // Queue operation — will sync only if online
    await syncEngine.queueOperation({
      operationId: `op-${DEVICE_ID}-${Date.now()}`,
      deviceId: DEVICE_ID,
      type: 'TASK_STATUS_CHANGED',
      payload: {
        taskId: task.taskId,
        newStatus: nextStatus,
        version: newVersion,
        lamport: newLamport,
      },
      lamport: newLamport,
      createdAt: Date.now(),
    });
  };

  const grouped: Record<string, Record<string, Task[]>> = {};
  for (const task of tasks) {
    if (!grouped[task.subjectId]) grouped[task.subjectId] = {};
    if (!grouped[task.subjectId][task.chapterId])
      grouped[task.subjectId][task.chapterId] = [];
    grouped[task.subjectId][task.chapterId].push(task);
  }

  const getChapterProgress = (chapterTasks: Task[]) => {
    const done = chapterTasks.filter((t) => t.status === 'DONE').length;
    return Math.round((done / chapterTasks.length) * 100);
  };

  const getSubjectProgress = (chapters: Record<string, Task[]>) => {
    const allTasks = Object.values(chapters).flat();
    const done = allTasks.filter((t) => t.status === 'DONE').length;
    return Math.round((done / allTasks.length) * 100);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6c63ff" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>📚 Syllabus Progress</Text>
      <View style={styles.deviceRow}>
        <Text style={styles.deviceLabel}>Device: {DEVICE_ID}</Text>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#4caf50' : '#e53935' }]} />
        <Text style={[styles.onlineText, { color: isOnline ? '#4caf50' : '#e53935' }]}>
          {isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>

      {Object.entries(grouped).map(([subjectId, chapters]) => (
        <View key={subjectId} style={styles.subjectCard}>
          <View style={styles.subjectHeader}>
            <Text style={styles.subjectTitle}>{subjectId.toUpperCase()}</Text>
            <Text style={styles.progressText}>
              {getSubjectProgress(chapters)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${getSubjectProgress(chapters)}%` },
              ]}
            />
          </View>

          {Object.entries(chapters).map(([chapterId, chapterTasks]) => (
            <View key={chapterId} style={styles.chapterBlock}>
              <View style={styles.chapterHeader}>
                <Text style={styles.chapterTitle}>{chapterId}</Text>
                <Text style={styles.chapterProgress}>
                  {getChapterProgress(chapterTasks)}%
                </Text>
              </View>

              {chapterTasks.map((task) => (
                <TouchableOpacity
                  key={task.taskId}
                  style={styles.taskRow}
                  onPress={() => cycleStatus(task)}
                >
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: STATUS_COLOR[task.status] },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {STATUS_LABEL[task.status]}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 40, marginBottom: 4 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 6 },
  deviceLabel: { color: '#6c63ff', fontSize: 12 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 11 },
  subjectCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 16 },
  subjectHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  subjectTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  progressText: { color: '#6c63ff', fontWeight: 'bold' },
  progressBar: { height: 6, backgroundColor: '#333', borderRadius: 3, marginBottom: 12 },
  progressFill: { height: 6, backgroundColor: '#6c63ff', borderRadius: 3 },
  chapterBlock: { marginBottom: 12 },
  chapterHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chapterTitle: { color: '#aaa', fontSize: 13 },
  chapterProgress: { color: '#aaa', fontSize: 13 },
  taskRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  taskTitle: { color: '#fff', fontSize: 14, flex: 1 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { color: '#fff', fontSize: 11 },
});