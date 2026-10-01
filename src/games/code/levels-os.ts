// Operating-system missions in Python: scheduling, page replacement, deadlock detection and memory allocation.
import { between, type Rng } from '../../lessons/types';
import type { CodeLevel } from './types';


const rr: CodeLevel = {
  id: 'code-os-rr', title: 'Round-robin scheduler', concept: 'time slices, queues and turnaround time', xp: 130, tier: 'guided', lang: 'py',
  ticket: 'The RTOS port needs a scheduler model before the firmware does. Start with round-robin.',
  build: () => ({
    brief: `<p>All jobs arrive at time 0 in the given order. The CPU runs the job at the front of the queue for at most <code>quantum</code> time units; if it still needs more it goes to the back of the queue. Write <code>round_robin(jobs, quantum)</code>, where <code>jobs</code> is a list of <code>(name, burst)</code>, returning a list of <code>(name, finish_time)</code> in the order the jobs <b>finish</b>. Context switches are free.</p>`,
    starter: 'def round_robin(jobs, quantum):\n    return []\n',
    hints: ['Keep a queue (a list, pop(0)) of [name, remaining]. Track the clock.', 'Run for min(quantum, remaining); advance the clock; if remaining is now 0, record (name, clock), otherwise append it to the back.'],
    solution: `def round_robin(jobs, quantum):
    queue = [[n, b] for n, b in jobs]
    t = 0
    done = []
    while queue:
        job = queue.pop(0)
        run = min(quantum, job[1])
        t += run
        job[1] -= run
        if job[1] == 0:
            done.append((job[0], t))
        else:
            queue.append(job)
    return done
`,
    cases: [
      { call: 'round_robin([("A", 5), ("B", 3), ("C", 1)], 2)' },
      { call: 'round_robin([("A", 4), ("B", 4)], 4)' },
      { call: 'round_robin([("A", 7), ("B", 2), ("C", 6), ("D", 3)], 3)', hidden: true },
      { call: 'round_robin([("X", 1)], 5)', hidden: true },
    ],
  }),
};

const paging: CodeLevel = {
  id: 'code-os-paging', title: 'Page replacement', concept: 'FIFO vs LRU, page faults, Belady\'s anomaly', xp: 150, tier: 'guided', lang: 'py',
  ticket: 'Physical memory holds only a few frames. Count the page faults before choosing a policy for the kernel.',
  build: () => ({
    brief: `<p>Write <code>faults(refs, frames, policy)</code>: <code>refs</code> is the sequence of page numbers touched, <code>frames</code> is the number of physical frames (initially empty), and <code>policy</code> is <code>"fifo"</code> (evict the page that has been resident longest) or <code>"lru"</code> (evict the least recently used). Return the number of page faults. A fault happens whenever the page is not resident (including the first touches).</p>
<p>Try the classic reference string <code>1 2 3 4 1 2 5 1 2 3 4 5</code> with 3 and then 4 frames under FIFO: more memory, more faults (<b>Belady's anomaly</b>). LRU never does that.</p>`,
    starter: 'def faults(refs, frames, policy):\n    return 0\n',
    hints: ['Keep a list of resident pages, oldest (or least recently used) first.', 'On a hit, FIFO leaves the order alone; LRU moves the page to the end. On a miss with a full memory, drop the first entry, then append the new page.'],
    solution: `def faults(refs, frames, policy):
    mem = []
    n = 0
    for p in refs:
        if p in mem:
            if policy == "lru":
                mem.remove(p)
                mem.append(p)
        else:
            n += 1
            if len(mem) >= frames:
                mem.pop(0)
            mem.append(p)
    return n
`,
    cases: [
      { call: 'faults([1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5], 3, "fifo")' },
      { call: 'faults([1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5], 4, "fifo")' },
      { call: 'faults([1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5], 3, "lru")' },
      { call: 'faults([7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2], 3, "lru")', hidden: true },
      { call: 'faults([7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2], 3, "fifo")', hidden: true },
      { call: 'faults([1, 1, 1, 1], 1, "lru")', hidden: true },
    ],
  }),
};

const deadlock: CodeLevel = {
  id: 'code-os-deadlock', title: 'Find the deadlock', concept: 'wait-for graphs and cycle detection', xp: 150, tier: 'guided', lang: 'py',
  ticket: 'The bring-up firmware hangs under load. The lock trace is in; which tasks are stuck?',
  build: () => ({
    brief: `<p>A <b>wait-for graph</b> has an edge <code>(a, b)</code> when task <code>a</code> is blocked waiting for a lock held by <code>b</code>. A set of tasks is deadlocked when they wait on each other in a cycle. Write <code>deadlocked(edges)</code> returning the <b>sorted list of tasks that lie on a cycle</b> (empty list if none). A task that merely waits for a deadlocked task, without being on a cycle itself, is blocked but not part of the cycle: do not include it.</p>`,
    starter: 'def deadlocked(edges):\n    return []\n',
    hints: ['A task is on a cycle if you can leave it and get back to it by following edges.', 'For each task, run a depth-first search from its successors and see whether it reaches the task again.'],
    solution: `def deadlocked(edges):
    nxt = {}
    for a, b in edges:
        nxt.setdefault(a, []).append(b)
    out = []
    for t in nxt:
        seen = set()
        stack = list(nxt[t])
        while stack:
            u = stack.pop()
            if u == t:
                out.append(t)
                break
            if u in seen:
                continue
            seen.add(u)
            stack.extend(nxt.get(u, []))
    return sorted(set(out))
`,
    cases: [
      { call: 'deadlocked([("A", "B"), ("B", "C")])' },
      { call: 'deadlocked([("A", "B"), ("B", "A")])' },
      { call: 'deadlocked([("T1", "T2"), ("T2", "T3"), ("T3", "T1"), ("T4", "T1")])', hidden: true },
      { call: 'deadlocked([("A", "A")])', hidden: true },
      { call: 'deadlocked([("A", "B"), ("B", "C"), ("C", "B"), ("D", "E"), ("E", "D")])', hidden: true },
    ],
  }),
};

const alloc: CodeLevel = {
  id: 'code-os-alloc', title: 'A first-fit allocator', concept: 'free lists, splitting and fragmentation', xp: 150, tier: 'guided', lang: 'py',
  ticket: 'The firmware has no malloc and 1 KiB of heap. Write the allocator policy and see how fragmentation bites.',
  build: () => ({
    brief: `<p>The heap is described by a list of free blocks <code>(start, size)</code>, sorted by start. Write <code>allocate(free, requests, policy)</code> that serves each size in <code>requests</code> in order and returns the list of start addresses, using <code>-1</code> for a request that cannot be served. <b>first-fit</b> takes the first block (lowest address) big enough; <b>best-fit</b> the smallest block that is big enough (lowest address on a tie). The block is split: the allocation takes the front, and the remainder (if any) stays free at the following address. Nothing is ever freed or merged.</p>`,
    starter: 'def allocate(free, requests, policy):\n    return []\n',
    hints: ['Keep the free list as a list of [start, size]. For each request pick an index by the policy.', 'Take the front of the block: result start, then replace the block by [start + n, size - n] (remove it entirely if size - n is 0).'],
    solution: `def allocate(free, requests, policy):
    blocks = [[s, z] for s, z in free]
    out = []
    for n in requests:
        pick = -1
        for i in range(len(blocks)):
            s, z = blocks[i]
            if z < n:
                continue
            if policy == "first":
                pick = i
                break
            if pick < 0 or z < blocks[pick][1]:
                pick = i
        if pick < 0:
            out.append(-1)
            continue
        s, z = blocks[pick]
        out.append(s)
        if z == n:
            blocks.pop(pick)
        else:
            blocks[pick] = [s + n, z - n]
    return out
`,
    cases: [
      { call: 'allocate([(0, 100), (200, 50)], [30, 60, 40], "first")' },
      { call: 'allocate([(0, 100), (200, 50)], [40, 40], "best")' },
      { call: 'allocate([(0, 50), (100, 20), (200, 100)], [20, 60, 40, 40], "best")', hidden: true },
      { call: 'allocate([(0, 50), (100, 20), (200, 100)], [20, 60, 40, 40], "first")', hidden: true },
      { call: 'allocate([(10, 8)], [8, 1], "first")', hidden: true },
    ],
  }),
};

const bossSched: CodeLevel = {
  id: 'code-os-boss-sched', title: 'Boss: compare schedulers', concept: 'FCFS, SJF and round-robin: waiting time with arrivals', xp: 360, tier: 'boss', lang: 'py',
  ticket: 'The OS team wants numbers: average waiting time for three policies on real arrival patterns. No hints.',
  build: (r: Rng) => {
    const mk = (n: number) => { const js: [string, number, number][] = []; let t = 0; for (let i = 0; i < n; i++) { t += between(r, 0, 4); js.push([`P${i}`, t, between(r, 1, 9)]); } return js; };
    const lit = (js: [string, number, number][]) => '[' + js.map(([n, a, b]) => `("${n}", ${a}, ${b})`).join(', ') + ']';
    const j1 = mk(4), j2 = mk(6), j3 = mk(8), j4 = mk(12);
    const q = between(r, 2, 4);
    return {
      brief: `<p>Jobs are <code>(name, arrival, burst)</code>, listed by arrival time (ties in list order). The CPU is idle when nothing has arrived. Waiting time of a job = finish − arrival − burst. Write <code>avg_wait(jobs, policy, quantum)</code> returning the <b>average waiting time rounded to 2 decimals</b> for:</p>
<ul><li><code>"fcfs"</code>: first come first served, non-preemptive.</li><li><code>"sjf"</code>: non-preemptive shortest job first among the jobs that have arrived (ties: earlier in the list).</li><li><code>"rr"</code>: round-robin with the given quantum. A job that arrives during a time slice joins the queue <b>before</b> the preempted job is put back.</li></ul>`,
      starter: 'def avg_wait(jobs, policy, quantum):\n    return 0.0\n',
      hints: [],
      solution: `def avg_wait(jobs, policy, quantum):
    n = len(jobs)
    fin = {}
    if policy == "rr":
        rem = {name: b for name, a, b in jobs}
        arr = {name: a for name, a, b in jobs}
        order = [name for name, a, b in jobs]
        queue = []
        nxt = 0
        t = 0
        while len(fin) < n:
            while nxt < n and arr[order[nxt]] <= t:
                queue.append(order[nxt])
                nxt += 1
            if not queue:
                t = arr[order[nxt]]
                continue
            name = queue.pop(0)
            run = min(quantum, rem[name])
            t += run
            rem[name] -= run
            while nxt < n and arr[order[nxt]] <= t:
                queue.append(order[nxt])
                nxt += 1
            if rem[name] == 0:
                fin[name] = t
            else:
                queue.append(name)
    else:
        pending = list(jobs)
        t = 0
        while pending:
            ready = [j for j in pending if j[1] <= t]
            if not ready:
                t = min(j[1] for j in pending)
                continue
            if policy == "sjf":
                job = ready[0]
                for j in ready:
                    if j[2] < job[2]:
                        job = j
            else:
                job = ready[0]
            pending.remove(job)
            t += job[2]
            fin[job[0]] = t
    total = 0
    for name, a, b in jobs:
        total += fin[name] - a - b
    return round(total / n, 2)
`,
      cases: [
        { call: `avg_wait(${lit(j1)}, "fcfs", ${q})` },
        { call: `avg_wait(${lit(j1)}, "sjf", ${q})` },
        { call: `avg_wait(${lit(j2)}, "rr", ${q})` },
        { call: `avg_wait(${lit(j3)}, "sjf", ${q})`, hidden: true },
        { call: `avg_wait(${lit(j3)}, "rr", ${q})`, hidden: true },
        { call: `avg_wait(${lit(j4)}, "fcfs", ${q})`, hidden: true },
        { call: `avg_wait(${lit(j4)}, "rr", ${q})`, hidden: true },
        { call: `avg_wait(${lit(j4)}, "sjf", ${q})`, hidden: true },
      ],
    };
  },
};

export const OS_LEVELS: CodeLevel[] = [rr, paging, deadlock, alloc, bossSched];
