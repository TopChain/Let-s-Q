#!/usr/bin/env node

// Deterministic architecture simulation for Let’s Q.
// This does NOT send traffic to production Supabase or AdMob. It models the
// queue invariants and request shape so scale reviews can be repeated safely.

const hosts = Number(process.argv[2] || 100);
const queuers = Number(process.argv[3] || 10000);

if (!Number.isInteger(hosts) || hosts < 1 || !Number.isInteger(queuers) || queuers < hosts) {
  throw new Error('Usage: node scripts/simulate-scale.mjs [hosts>=1] [queuers>=hosts]');
}

const queues = Array.from({ length: hosts }, () => ({ nextTicket: 1, tickets: [] }));

for (let customer = 0; customer < queuers; customer += 1) {
  const queue = queues[customer % hosts];
  const number = queue.nextTicket;
  queue.nextTicket += 1;
  queue.tickets.push(number);
}

let duplicateQueues = 0;
let orderingFailures = 0;
let unlimitedCountComparisons = 0;

for (const queue of queues) {
  if (new Set(queue.tickets).size !== queue.tickets.length) duplicateQueues += 1;
  if (queue.tickets.some((ticket, index) => ticket !== index + 1)) orderingFailures += 1;

  // Approximation of the avoidable work in the old unlimited-queue join path:
  // each new join counted all previously active tickets.
  const n = queue.tickets.length;
  unlimitedCountComparisons += (n * (n - 1)) / 2;
}

// Previous Queuer polling called get_my_ticket + get_public_queue every 10s.
// The hardened client calls only get_my_ticket every 15s and skips polling while
// the document is hidden/backgrounded.
const previousQueuerRpcPerRefresh = queuers * 2;
const hardenedQueuerRpcPerRefresh = queuers;
const previousWorstCaseRpcPerSecond = previousQueuerRpcPerRefresh / 10;
const hardenedWorstCaseRpcPerSecond = hardenedQueuerRpcPerRefresh / 15;

const result = {
  scenario: { hosts, queuers },
  distribution: {
    minQueuersPerHost: Math.min(...queues.map((queue) => queue.tickets.length)),
    maxQueuersPerHost: Math.max(...queues.map((queue) => queue.tickets.length))
  },
  invariants: {
    duplicateTicketNumberQueues: duplicateQueues,
    queueOrderingFailures: orderingFailures
  },
  architectureEstimates: {
    oldUnlimitedJoinCountComparisons: unlimitedCountComparisons,
    optimizedUnlimitedJoinCountComparisons: 0,
    previousQueuerRpcPer10SecondRefresh: previousQueuerRpcPerRefresh,
    hardenedQueuerRpcPer15SecondRefresh: hardenedQueuerRpcPerRefresh,
    previousWorstCaseQueuerRpcPerSecond: previousWorstCaseRpcPerSecond,
    hardenedWorstCaseQueuerRpcPerSecond: hardenedWorstCaseRpcPerSecond,
    worstCaseQueuerRpcReductionPercent: Math.round((1 - hardenedWorstCaseRpcPerSecond / previousWorstCaseRpcPerSecond) * 100)
  },
  notes: [
    'Ticket uniqueness here models the database row-lock/counter design; it is not a production benchmark.',
    'RPC estimates assume every simulated Queuer is simultaneously viewing a live ticket with the app visible.',
    'Background/hidden clients now pause polling, so real steady-state request volume should be lower than this worst-case estimate.',
    'Real database latency, contention, network jitter, retries, and Supabase plan limits require staging load tests.'
  ]
};

console.log(JSON.stringify(result, null, 2));

if (duplicateQueues || orderingFailures) process.exitCode = 1;
