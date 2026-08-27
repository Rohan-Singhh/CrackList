import type { Company, PdfSubmission, Question } from './types';

export const COMPANIES: Company[] = [
  { id: 'google', slug: 'google', name: 'Google', questionCount: 312, contributorCount: 61, mostRecent: "Jul '26", mostActiveRole: 'Intern', x: 210, y: 120, size: 92 },
  { id: 'amazon', slug: 'amazon', name: 'Amazon', questionCount: 418, contributorCount: 72, mostRecent: "Aug '26", mostActiveRole: 'SDE-1', x: 380, y: 90, size: 108 },
  { id: 'microsoft', slug: 'microsoft', name: 'Microsoft', questionCount: 184, contributorCount: 38, mostRecent: "Aug '26", mostActiveRole: 'SDE-2', x: 840, y: 110, size: 88 },
  { id: 'meta', slug: 'meta', name: 'Meta', questionCount: 142, contributorCount: 29, mostRecent: "Jun '26", mostActiveRole: 'SDE-2', x: 960, y: 200, size: 78 },
  { id: 'stripe', slug: 'stripe', name: 'Stripe', questionCount: 96, contributorCount: 22, mostRecent: "Jun '26", mostActiveRole: 'SDE-2', x: 910, y: 360, size: 84 },
  { id: 'tcs', slug: 'tcs', name: 'TCS', questionCount: 203, contributorCount: 47, mostRecent: "Aug '26", mostActiveRole: 'Intern', x: 680, y: 400, size: 74 },
  { id: 'infosys', slug: 'infosys', name: 'Infosys', questionCount: 168, contributorCount: 40, mostRecent: "Aug '26", mostActiveRole: 'Intern', x: 360, y: 380, size: 80 },
  { id: 'flipkart', slug: 'flipkart', name: 'Flipkart', questionCount: 88, contributorCount: 19, mostRecent: "Jul '26", mostActiveRole: 'SDE-1', x: 160, y: 290, size: 76 },
  { id: 'uber', slug: 'uber', name: 'Uber', questionCount: 34, contributorCount: 9, mostRecent: "Aug '26", mostActiveRole: 'SDE-2', x: 580, y: 90, size: 62, comingSoon: true },
];

let idCounter = 5000;
export function nextId() {
  idCounter += 1;
  return idCounter;
}

// [x, y, r, title, tags, cluster, role, round, asked, submitter, upvotes]
const AMAZON_CLUSTER_NODES: Array<[number, number, number, string, string[], string, Question['roleLevel'], Question['roundType'], string, string, number]> = [
  [120, 100, 8, 'Find all subarrays with a sum equal to k', ['arrays', 'prefix-sum'], 'arrays', 'SDE-1', 'Tech-1', "Feb '26", '@nidhi_k', 19],
  [200, 160, 10, 'Product of array except self, no division', ['arrays'], 'arrays', 'Intern', 'OA', "Jan '26", '@arjun.codes', 27],
  [160, 240, 8, 'Merge overlapping intervals', ['arrays', 'sorting'], 'arrays', 'SDE-1', 'Tech-1', "Mar '26", '@rhea_p', 15],
  [240, 300, 9, 'Trapping rain water', ['arrays', 'two-pointers'], 'arrays', 'SDE-2', 'Tech-2', "Apr '26", '@vikram_s', 22],
  [280, 130, 7, 'Next permutation, done in place', ['arrays'], 'arrays', 'Intern', 'OA', "May '26", '@t_ananth', 11],
  [340, 200, 9, 'Rotate an array by k steps in O(1) space', ['arrays'], 'arrays', 'SDE-1', 'Phone screen', "Jun '26", '@priya_dev', 14],

  [440, 130, 8, 'Longest increasing subsequence in O(n log n)', ['dp', 'binary-search'], 'dp', 'SDE-2', 'Tech-2', "Feb '26", '@kabir_r', 31],
  [500, 180, 10, 'Edit distance between two strings', ['dp', 'strings'], 'dp', 'SDE-1', 'Tech-1', "Mar '26", '@sana_m', 26],
  [560, 110, 7, '0/1 knapsack with a weight cap', ['dp'], 'dp', 'Intern', 'OA', "Jan '26", '@dev_null_9', 9],
  [580, 230, 8, 'Coin change — fewest coins for an amount', ['dp'], 'dp', 'SDE-1', 'Tech-2', "May '26", '@ishaan_v', 18],
  [520, 300, 9, 'Maximum subarray sum with at most one deletion', ['dp'], 'dp', 'SDE-2', 'Tech-3', "Jul '26", '@meera_j', 21],

  [100, 480, 7, 'Number of islands in a grid', ['graphs', 'bfs'], 'graphs', 'Intern', 'OA', "Feb '26", '@r_krish', 13],
  [180, 420, 9, 'Clone a graph with cycles', ['graphs'], 'graphs', 'SDE-1', 'Tech-1', "Mar '26", '@ojas_p', 17],
  [240, 500, 8, 'Course schedule — detect a cycle in a DAG', ['graphs', 'topological-sort'], 'graphs', 'SDE-2', 'Tech-2', "Apr '26", '@fiza_a', 24],
  [320, 460, 10, 'Shortest path in a weighted DAG', ['graphs', 'dp'], 'graphs', 'SDE-2', 'Tech-3', "Jun '26", '@harshv', 20],
  [120, 360, 7, 'Word ladder — shortest transformation sequence', ['graphs', 'bfs'], 'graphs', 'SDE-1', 'Tech-2', "Jan '26", '@n_kapoor', 16],
  [280, 400, 8, 'Network delay time — Dijkstra from a source', ['graphs'], 'graphs', 'SDE-2', 'Tech-1', "May '26", '@yash_r', 23],

  [600, 500, 7, 'Lowest common ancestor in a BST', ['trees'], 'trees', 'Intern', 'OA', "Feb '26", '@aakash_t', 10],
  [520, 460, 9, 'Serialize and deserialize a binary tree', ['trees'], 'trees', 'SDE-2', 'Tech-2', "Apr '26", '@leela_s', 25],
  [560, 380, 8, 'Diameter of a binary tree', ['trees'], 'trees', 'SDE-1', 'Tech-1', "Mar '26", '@omkar_j', 12],
  [480, 340, 7, 'Validate a binary search tree', ['trees'], 'trees', 'Intern', 'Phone screen', "Jun '26", '@zoya_h', 8],

  [340, 350, 11, 'Given a stream of integers, find the running median.', ['heap', 'streaming'], 'dp', 'SDE-1', 'Tech-2', "Mar '26", '@rk_placement', 34],
  [440, 300, 9, 'Partition an array into k equal-sum subsets', ['dp', 'backtracking'], 'dp', 'SDE-2', 'Tech-2', "Jul '26", '@dvrma_', 20],
];

function makeAmazonClusterQuestions(): Question[] {
  return AMAZON_CLUSTER_NODES.map(([x, y, r, title, tags, cluster, role, round, asked, submitter, upvotes]) => {
    const isRunningMedian = title.startsWith('Given a stream');
    const id = isRunningMedian ? 'q-1046' : `q-${nextId()}`;
    return {
      id,
      displayId: isRunningMedian ? 'Q-1046' : `Q-${1000 + Math.round(x + y)}`,
      companyId: 'amazon',
      roleLevel: role,
      roundType: round,
      title,
      prompt: isRunningMedian
        ? 'Design a data structure that ingests a stream of integers one at a time and, after each insert, can return the current median in O(log n) time.'
        : `${title}. Walk through the approach, then implement it.`,
      followUps: isRunningMedian
        ? [
            'The stream is now a sliding window of the last K values. Same median guarantee.',
            'Instead of one machine, values are sharded across three. Sketch the coordination.',
          ]
        : [],
      codeSnippet: isRunningMedian
        ? `class RunningMedian:\n    def __init__(self):\n        self.lo = []   # max-heap (negated)\n        self.hi = []   # min-heap\n\n    def add(self, x: int) -> None:\n        ...\n\n    def median(self) -> float:\n        ...`
        : undefined,
      topicTags: tags,
      cluster,
      askedMonthYear: asked,
      submittedBy: submitter,
      status: 'approved',
      rejectionReason: null,
      sourceType: 'community-submitted',
      sourceUrl: isRunningMedian ? 'https://github.com/rk-placement/interview-log' : 'https://github.com/community/interview-log',
      sourceLabel: isRunningMedian ? 'via rk_placement' : 'via community submission',
      intakePath: 'structured',
      upvoteCount: upvotes,
      confirmers: isRunningMedian
        ? [
            { handle: '@ananya_r', detail: 'SDE-1 onsite · Apr \'26' },
            { handle: '@shrey42', detail: 'SDE-1 onsite · Feb \'26' },
          ]
        : [],
      approvedAt: isRunningMedian ? '28 Mar 2026' : undefined,
      approvedBy: isRunningMedian ? '@rohan' : undefined,
      createdAt: asked,
      x,
      y,
      r,
    };
  });
}

const RECENTLY_APPROVED_EXTRA: Question[] = [
  {
    id: 'q-stripe-idempotency',
    displayId: 'Q-2210',
    companyId: 'stripe',
    roleLevel: 'SDE-2',
    roundType: 'Tech-2',
    title: 'Design an idempotency key middleware for a payments API.',
    prompt: 'Design middleware that guarantees an idempotent POST is only ever applied once, even under retries and concurrent requests.',
    followUps: [],
    topicTags: ['systems', 'api'],
    cluster: 'systems',
    askedMonthYear: "Jun '26",
    submittedBy: '@anon_412',
    status: 'approved',
    rejectionReason: null,
    sourceType: 'community-submitted',
    sourceUrl: 'https://github.com/community/interview-log',
    sourceLabel: 'via anon_412',
    intakePath: 'structured',
    upvoteCount: 51,
    confirmers: [],
    approvedAt: '18 Jun 2026',
    approvedBy: '@rohan',
    createdAt: "Jun '26",
    x: 350, y: 300, r: 10,
  },
  {
    id: 'q-tcs-second-largest',
    displayId: 'Q-3102',
    companyId: 'tcs',
    roleLevel: 'Intern',
    roundType: 'OA',
    title: 'Second-largest element without sorting the array.',
    prompt: 'Given an unsorted array, find the second-largest element in a single pass without sorting.',
    followUps: [],
    topicTags: ['arrays', 'easy'],
    cluster: 'arrays',
    askedMonthYear: "Aug '26",
    submittedBy: 'indexed',
    status: 'approved',
    rejectionReason: null,
    sourceType: 'indexed',
    sourceUrl: 'https://github.com/awesome-interview-questions/tcs',
    sourceLabel: 'via awesome-interview-questions repo',
    intakePath: null,
    upvoteCount: 12,
    confirmers: [],
    approvedAt: '20 Aug 2026',
    approvedBy: '@rohan',
    createdAt: "Aug '26",
    x: 350, y: 300, r: 8,
  },
];

const PENDING_QUEUE: Question[] = [
  {
    id: 'q-3421', displayId: 'Q-3421', companyId: 'amazon', roleLevel: 'SDE-1', roundType: 'Tech-1',
    title: 'Merge two heap-based sorted streams into one output stream.',
    prompt: 'Given two streams that each emit values in sorted order, merge them into a single sorted output stream using a heap.',
    followUps: [], topicTags: ['heap', 'streaming'], cluster: 'dp',
    askedMonthYear: "Aug '26", submittedBy: '@dvrma_', status: 'pending', rejectionReason: null,
    sourceType: 'community-submitted', sourceUrl: 'https://github.com/community/aug-2026-interviews', sourceLabel: 'via community submission',
    intakePath: 'structured', upvoteCount: 0, confirmers: [], createdAt: "Aug '26", x: 0, y: 0, r: 9,
  },
  {
    id: 'q-3420', displayId: 'Q-3420', companyId: 'microsoft', roleLevel: 'SDE-2', roundType: 'Other',
    title: 'Build an LRU cache — do not use OrderedDict.',
    prompt: 'Implement an LRU cache with O(1) get/put without relying on a built-in ordered map.',
    followUps: [], topicTags: ['hashmap', 'design'], cluster: 'design',
    askedMonthYear: "Aug '26", submittedBy: '@s_pandey', status: 'pending', rejectionReason: null,
    sourceType: 'community-submitted', sourceUrl: 'https://github.com/community/aug-2026-interviews', sourceLabel: 'via community submission',
    intakePath: 'structured', upvoteCount: 0, confirmers: [], createdAt: "Aug '26", x: 0, y: 0, r: 9,
  },
  {
    id: 'q-3419', displayId: 'Q-3419', companyId: 'stripe', roleLevel: 'SDE-2', roundType: 'Tech-2',
    title: 'Rate-limit an idempotent POST endpoint.',
    prompt: 'Design a rate limiter for an idempotent POST endpoint that must not double-charge under retries.',
    followUps: [], topicTags: ['systems'], cluster: 'systems',
    askedMonthYear: "Jul '26", submittedBy: '@anon_412', status: 'pending', rejectionReason: null,
    sourceType: 'community-submitted', sourceUrl: 'https://github.com/community/jul-2026-interviews', sourceLabel: 'via community submission',
    intakePath: 'structured', upvoteCount: 0, confirmers: [], createdAt: "Jul '26", x: 0, y: 0, r: 9,
  },
  {
    id: 'q-3418', displayId: 'Q-3418', companyId: 'tcs', roleLevel: 'Intern', roundType: 'OA',
    title: 'Reverse a linked list in groups of k.',
    prompt: 'Given a linked list, reverse the nodes of it k at a time and return the modified list.',
    followUps: [], topicTags: ['linked list'], cluster: 'linked-list',
    askedMonthYear: "Aug '26", submittedBy: '@nkr_', status: 'pending', rejectionReason: null,
    sourceType: 'community-submitted', sourceUrl: 'https://github.com/community/aug-2026-interviews', sourceLabel: 'via community submission',
    intakePath: 'structured', upvoteCount: 0, confirmers: [], createdAt: "Aug '26", x: 0, y: 0, r: 9,
  },
  {
    id: 'q-3417', displayId: 'Q-3417', companyId: 'infosys', roleLevel: 'Intern', roundType: 'OA',
    title: 'Find the longest palindromic substring.',
    prompt: 'Given a string s, return the longest palindromic substring in s.',
    followUps: [], topicTags: ['strings', 'dp'], cluster: 'dp',
    askedMonthYear: "Aug '26", submittedBy: '@rp2026', status: 'pending', rejectionReason: null,
    sourceType: 'community-submitted', sourceUrl: 'https://github.com/community/aug-2026-interviews', sourceLabel: 'via community submission',
    intakePath: 'structured', upvoteCount: 0, confirmers: [], createdAt: "Aug '26", x: 0, y: 0, r: 9,
  },
  {
    id: 'q-3416', displayId: 'Q-3416', companyId: 'google', roleLevel: 'Intern', roundType: 'Phone screen',
    title: 'Two-sum — return indices, not values.',
    prompt: 'Given an array of integers and a target, return the indices of the two numbers that add up to the target.',
    followUps: [], topicTags: ['likely duplicate'], cluster: 'arrays',
    askedMonthYear: "Jul '26", submittedBy: '@gh_intern', status: 'pending', rejectionReason: null,
    sourceType: 'community-submitted', sourceUrl: 'https://github.com/community/jul-2026-interviews', sourceLabel: 'via community submission',
    intakePath: 'structured', upvoteCount: 0, confirmers: [], createdAt: "Jul '26", x: 0, y: 0, r: 9,
  },
  {
    id: 'q-3415', displayId: 'Q-3415', companyId: 'uber', roleLevel: 'SDE-2', roundType: 'Other',
    title: 'Design a job scheduler with retry back-off.',
    prompt: 'Design a job scheduler that supports retrying failed jobs with exponential back-off.',
    followUps: [], topicTags: ['systems'], cluster: 'systems',
    askedMonthYear: "Aug '26", submittedBy: '@km_', status: 'pending', rejectionReason: null,
    sourceType: 'community-submitted', sourceUrl: 'https://github.com/community/aug-2026-interviews', sourceLabel: 'via community submission',
    intakePath: 'structured', upvoteCount: 0, confirmers: [], createdAt: "Aug '26", x: 0, y: 0, r: 9,
  },
];

export const SUBMITTER_STATS: Record<string, { approvedCount: number; approvalRate: number }> = {
  '@dvrma_': { approvedCount: 14, approvalRate: 96 },
  '@s_pandey': { approvedCount: 2, approvalRate: 100 },
  '@anon_412': { approvedCount: 0, approvalRate: 0 },
  '@nkr_': { approvedCount: 24, approvalRate: 88 },
  '@rp2026': { approvedCount: 0, approvalRate: 0 },
  '@gh_intern': { approvedCount: 0, approvalRate: 0 },
  '@km_': { approvedCount: 7, approvalRate: 100 },
};

export const INITIAL_QUESTIONS: Question[] = [
  ...makeAmazonClusterQuestions(),
  ...RECENTLY_APPROVED_EXTRA,
  ...PENDING_QUEUE,
];

export const INITIAL_PDF_INBOX: PdfSubmission[] = [
  { id: 'pdf-1', email: 'ananya.r@college.edu', filename: 'placement_2026_batch.pdf', note: 'Amazon + TCS, roughly March 2026', createdAt: "Aug '26" },
  { id: 'pdf-2', email: 'whatsapp.export@gmail.com', filename: 'cs_group_export.pdf', note: 'WhatsApp export, mixed companies', createdAt: "Aug '26" },
  { id: 'pdf-3', email: 'nkr.placements@college.edu', filename: 'tcs_ninja_oa_screenshots.pdf', note: '', createdAt: "Jul '26" },
];

export const TOTAL_APPROVED_LIFETIME = 2418;
export const TOTAL_CONTRIBUTORS = 312;
