import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

let app;
let auth;
let db;
let uid;

function configured(config) {
  return Boolean(config?.apiKey && config?.projectId && config?.appId);
}

async function init(config) {
  if (!configured(config)) return null;
  app = getApps()[0] || initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  uid = auth.currentUser.uid;
  return { uid };
}

async function createQueue(queue) {
  if (!db || !uid) throw new Error('Firebase is not connected yet.');
  const ref = doc(collection(db, 'queues'));
  const data = { ...queue, hostUid: uid, status: 'open', nextTicket: 1, nowServing: 0, served: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
}

async function updateQueue(queueId, changes) {
  if (!db || !uid) throw new Error('Firebase is not connected yet.');
  await updateDoc(doc(db, 'queues', queueId), { ...changes, updatedAt: serverTimestamp() });
}

async function updateTicket(queueId, ticketId, changes) {
  if (!db || !uid) throw new Error('Firebase is not connected yet.');
  await updateDoc(doc(db, 'queues', queueId, 'tickets', ticketId), { ...changes, updatedAt: serverTimestamp() });
}

async function findQueueByCode(code) {
  if (!db) return null;
  const results = await getDocs(query(collection(db, 'queues'), where('code', '==', code), where('status', '==', 'open'), limit(1)));
  if (results.empty) return null;
  return { id: results.docs[0].id, ...results.docs[0].data() };
}

async function joinQueue(queueId, ticket) {
  if (!db || !uid) throw new Error('Firebase is not connected yet.');
  const queueRef = doc(db, 'queues', queueId);
  return runTransaction(db, async transaction => {
    const queueSnapshot = await transaction.get(queueRef);
    if (!queueSnapshot.exists() || queueSnapshot.data().status !== 'open') throw new Error('This queue is no longer open.');
    const queue = queueSnapshot.data();
    const ticketNumber = queue.nextTicket || 1;
    const ticketRef = doc(collection(queueRef, 'tickets'));
    transaction.update(queueRef, { nextTicket: ticketNumber + 1, updatedAt: serverTimestamp() });
    transaction.set(ticketRef, { ...ticket, ticketNumber, ownerUid: uid, status: 'waiting', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { id: ticketRef.id, ticketNumber };
  });
}

function watchHostQueue(queueId, callback) {
  if (!db) return () => {};
  const queueRef = doc(db, 'queues', queueId);
  const ticketsRef = query(collection(queueRef, 'tickets'), orderBy('ticketNumber'));
  let currentQueue = null;
  const emit = tickets => callback({ queue: currentQueue, tickets });
  const stopQueue = onSnapshot(queueRef, snap => { currentQueue = snap.exists() ? { id: snap.id, ...snap.data() } : null; });
  const stopTickets = onSnapshot(ticketsRef, snap => emit(snap.docs.map(ticket => ({ id: ticket.id, ...ticket.data() }))));
  return () => { stopQueue(); stopTickets(); };
}

window.LetsQFirebase = { init, createQueue, updateQueue, updateTicket, findQueueByCode, joinQueue, watchHostQueue, get uid() { return uid; } };
