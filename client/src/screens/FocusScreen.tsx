import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, AppState
} from 'react-native';
import { DeviceStorage } from '../storage/indexeddb';
import { SyncEngine } from '../sync/syncEngine';
import { lamport } from '../services/lamport';
import { FocusSession } from '../types/session';

const DEVICE_ID = 'device-A';
const GRACE_PERIOD_MS = 5000;

const storage = new DeviceStorage(DEVICE_ID);
const syncEngine = new SyncEngine(storage, DEVICE_ID);

function generateId() {
  return 'session-' + Math.random().toString(36).substring(2, 10);
}

export function FocusScreen() {
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentSession, setCurrentSession] = useState<FocusSession | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [student, setStudent] = useState<any>(null);

  const intervalRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    storage.init().then(() => loadStudent());
  }, []);

  const loadStudent = async () => {
    try {
      const res = await fetch('https://lcovia-offline-first.onrender.com/sync/state');
      const data = await res.json();
      if (data.student) {
        await storage.saveStudent(data.student);
        setStudent(data.student);
      }
    } catch {
      const local = await storage.getStudent();
      setStudent(local);
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        running &&
        appStateRef.current === 'active' &&
        nextState.match(/inactive|background/)
      ) {
        backgroundTimeRef.current = Date.now();
      }
      if (nextState === 'active' && backgroundTimeRef.current) {
        const elapsed = Date.now() - backgroundTimeRef.current;
        if (elapsed > GRACE_PERIOD_MS && running) {
          handleFail('app_switch');
        }
        backgroundTimeRef.current = null;
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [running]);

  const startSession = async () => {
    await storage.init();
    const session: FocusSession = {
      sessionId: generateId(),
      deviceId: DEVICE_ID,
      targetDuration: targetMinutes,
      status: 'RUNNING',
      startTime: Date.now(),
    };
    setCurrentSession(session);
    setSecondsLeft(targetMinutes * 60);
    setRunning(true);
    setLastResult(null);
    await storage.saveSession(session);
  };

  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (running && secondsLeft === 0) {
      handleSuccess();
    }
    return () => clearInterval(intervalRef.current);
  }, [running, secondsLeft]);

  const handleSuccess = async () => {
    setRunning(false);
    if (!currentSession) return;
    const completed: FocusSession = {
      ...currentSession,
      status: 'SUCCESS',
      endTime: Date.now(),
    };
    await storage.saveSession(completed);
    setLastResult('🎉 Session Complete! +50 coins');
    await syncEngine.queueOperation({
      operationId: `op-${DEVICE_ID}-${completed.sessionId}`,
      deviceId: DEVICE_ID,
      type: 'FOCUS_SESSION_COMPLETED',
      payload: completed,
      lamport: lamport.tick(),
      createdAt: Date.now(),
    });
    await loadStudent();
  };

  const handleFail = async (reason: 'give_up' | 'app_switch') => {
    setRunning(false);
    clearInterval(intervalRef.current);
    if (!currentSession) return;
    const failed: FocusSession = {
      ...currentSession,
      status: 'FAILED',
      failReason: reason,
      endTime: Date.now(),
    };
    await storage.saveSession(failed);
    setLastResult(reason === 'give_up' ? '❌ You gave up' : '❌ App switched');
    await syncEngine.queueOperation({
      operationId: `op-${DEVICE_ID}-${failed.sessionId}`,
      deviceId: DEVICE_ID,
      type: 'FOCUS_SESSION_COMPLETED',
      payload: failed,
      lamport: lamport.tick(),
      createdAt: Date.now(),
    });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>⏱ Focus Session</Text>
      <Text style={styles.deviceLabel}>Device: {DEVICE_ID}</Text>

      {student && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{student.streak ?? 0}</Text>
            <Text style={styles.statLabel}>🔥 Streak</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{student.coins ?? 0}</Text>
            <Text style={styles.statLabel}>🪙 Coins</Text>
          </View>
        </View>
      )}

      {!running ? (
        <View style={styles.setupBlock}>
          <Text style={styles.label}>Target Duration</Text>
          <View style={styles.durationRow}>
            {[15, 25, 45, 60].map((min) => (
              <TouchableOpacity
                key={min}
                style={[styles.durationBtn, targetMinutes === min && styles.durationBtnActive]}
                onPress={() => setTargetMinutes(min)}
              >
                <Text style={styles.durationText}>{min}m</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={startSession}>
            <Text style={styles.startBtnText}>Start Session</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.timerBlock}>
          <Text style={styles.timer}>{formatTime(secondsLeft)}</Text>
          <Text style={styles.timerLabel}>{targetMinutes} min session</Text>
          <TouchableOpacity style={styles.giveUpBtn} onPress={() => handleFail('give_up')}>
            <Text style={styles.giveUpText}>Give Up</Text>
          </TouchableOpacity>
        </View>
      )}

      {lastResult && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{lastResult}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 24 },
  header: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 40 },
  deviceLabel: { color: '#6c63ff', fontSize: 12, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  statBox: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  statLabel: { color: '#aaa', fontSize: 13, marginTop: 4 },
  setupBlock: { alignItems: 'center' },
  label: { color: '#aaa', marginBottom: 12, fontSize: 14 },
  durationRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  durationBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1a1a1a' },
  durationBtnActive: { backgroundColor: '#6c63ff' },
  durationText: { color: '#fff', fontWeight: 'bold' },
  startBtn: { backgroundColor: '#6c63ff', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 12 },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  timerBlock: { alignItems: 'center', marginTop: 40 },
  timer: { fontSize: 72, fontWeight: 'bold', color: '#fff' },
  timerLabel: { color: '#aaa', marginTop: 8, marginBottom: 40 },
  giveUpBtn: { borderWidth: 1, borderColor: '#e53935', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  giveUpText: { color: '#e53935', fontWeight: 'bold' },
  resultBox: { marginTop: 32, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20, alignItems: 'center' },
  resultText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});