import 'dotenv/config';
import { PrismaClient, type IntakePath, type QuestionStatus, type SourceType } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedQuestion {
  companyId: string;
  roleLevel: string;
  roundType: string;
  questionText: string;
  codeSnippet?: string;
  topicTags: string[];
  askedMonthYear: string;
  submittedBy: string | null;
  status: QuestionStatus;
  sourceType: SourceType;
  sourceUrl: string;
  sourceLabel: string;
  intakePath: IntakePath | null;
  upvoteCount: number;
}

const COMPANIES = [
  { id: 'google', name: 'Google', slug: 'google' },
  { id: 'amazon', name: 'Amazon', slug: 'amazon' },
  { id: 'microsoft', name: 'Microsoft', slug: 'microsoft' },
  { id: 'meta', name: 'Meta', slug: 'meta' },
  { id: 'stripe', name: 'Stripe', slug: 'stripe' },
  { id: 'tcs', name: 'TCS', slug: 'tcs' },
  { id: 'infosys', name: 'Infosys', slug: 'infosys' },
  { id: 'flipkart', name: 'Flipkart', slug: 'flipkart' },
  { id: 'uber', name: 'Uber', slug: 'uber' },
];

const COMMUNITY: SourceType = 'community_submitted';

// [title, tags, role, round, asked, submitter, upvotes]
const amazon: Array<[string, string[], string, string, string, string, number]> = [
  ['Find all subarrays with a sum equal to k', ['arrays', 'prefix-sum'], 'SDE-1', 'Tech-1', "Feb '26", '@nidhi_k', 19],
  ['Product of array except self, no division', ['arrays'], 'Intern', 'OA', "Jan '26", '@arjun.codes', 27],
  ['Merge overlapping intervals', ['arrays', 'sorting'], 'SDE-1', 'Tech-1', "Mar '26", '@rhea_p', 15],
  ['Trapping rain water', ['arrays', 'two-pointers'], 'SDE-2', 'Tech-2', "Apr '26", '@vikram_s', 22],
  ['Next permutation, done in place', ['arrays'], 'Intern', 'OA', "May '26", '@t_ananth', 11],
  ['Rotate an array by k steps in O(1) space', ['arrays'], 'SDE-1', 'Phone screen', "Jun '26", '@priya_dev', 14],
  ['Longest increasing subsequence in O(n log n)', ['dp', 'binary-search'], 'SDE-2', 'Tech-2', "Feb '26", '@kabir_r', 31],
  ['Edit distance between two strings', ['dp', 'strings'], 'SDE-1', 'Tech-1', "Mar '26", '@sana_m', 26],
  ['0/1 knapsack with a weight cap', ['dp'], 'Intern', 'OA', "Jan '26", '@dev_null_9', 9],
  ['Coin change — fewest coins for an amount', ['dp'], 'SDE-1', 'Tech-2', "May '26", '@ishaan_v', 18],
  ['Maximum subarray sum with at most one deletion', ['dp'], 'SDE-2', 'Tech-3', "Jul '26", '@meera_j', 21],
  ['Number of islands in a grid', ['graphs', 'bfs'], 'Intern', 'OA', "Feb '26", '@r_krish', 13],
  ['Clone a graph with cycles', ['graphs'], 'SDE-1', 'Tech-1', "Mar '26", '@ojas_p', 17],
  ['Course schedule — detect a cycle in a DAG', ['graphs', 'topological-sort'], 'SDE-2', 'Tech-2', "Apr '26", '@fiza_a', 24],
  ['Shortest path in a weighted DAG', ['graphs', 'dp'], 'SDE-2', 'Tech-3', "Jun '26", '@harshv', 20],
  ['Word ladder — shortest transformation sequence', ['graphs', 'bfs'], 'SDE-1', 'Tech-2', "Jan '26", '@n_kapoor', 16],
  ['Network delay time — Dijkstra from a source', ['graphs'], 'SDE-2', 'Tech-1', "May '26", '@yash_r', 23],
  ['Lowest common ancestor in a BST', ['trees'], 'Intern', 'OA', "Feb '26", '@aakash_t', 10],
  ['Serialize and deserialize a binary tree', ['trees'], 'SDE-2', 'Tech-2', "Apr '26", '@leela_s', 25],
  ['Diameter of a binary tree', ['trees'], 'SDE-1', 'Tech-1', "Mar '26", '@omkar_j', 12],
  ['Validate a binary search tree', ['trees'], 'Intern', 'Phone screen', "Jun '26", '@zoya_h', 8],
  ['Partition an array into k equal-sum subsets', ['dp', 'backtracking'], 'SDE-2', 'Tech-2', "Jul '26", '@dvrma_', 20],
];

const RUNNING_MEDIAN_SNIPPET = `class RunningMedian:
    def __init__(self):
        self.lo = []   # max-heap (negated)
        self.hi = []   # min-heap

    def add(self, x: int) -> None:
        ...

    def median(self) -> float:
        ...`;

const questions: SeedQuestion[] = [
  ...amazon.map(
    ([title, tags, role, round, asked, submitter, upvotes]): SeedQuestion => ({
      companyId: 'amazon',
      roleLevel: role,
      roundType: round,
      questionText: title,
      topicTags: tags,
      askedMonthYear: asked,
      submittedBy: submitter,
      status: 'approved',
      sourceType: COMMUNITY,
      sourceUrl: 'https://github.com/community/interview-log',
      sourceLabel: 'via community submission',
      intakePath: 'structured',
      upvoteCount: upvotes,
    }),
  ),
  {
    companyId: 'amazon',
    roleLevel: 'SDE-1',
    roundType: 'Tech-2',
    questionText: 'Given a stream of integers, find the running median.',
    codeSnippet: RUNNING_MEDIAN_SNIPPET,
    topicTags: ['heap', 'streaming'],
    askedMonthYear: "Mar '26",
    submittedBy: '@rk_placement',
    status: 'approved',
    sourceType: COMMUNITY,
    sourceUrl: 'https://github.com/rk-placement/interview-log',
    sourceLabel: 'via rk_placement',
    intakePath: 'structured',
    upvoteCount: 34,
  },
  {
    companyId: 'stripe',
    roleLevel: 'SDE-2',
    roundType: 'Tech-2',
    questionText: 'Design an idempotency key middleware for a payments API.',
    topicTags: ['systems', 'api'],
    askedMonthYear: "Jun '26",
    submittedBy: '@anon_412',
    status: 'approved',
    sourceType: COMMUNITY,
    sourceUrl: 'https://github.com/community/interview-log',
    sourceLabel: 'via anon_412',
    intakePath: 'structured',
    upvoteCount: 51,
  },
  {
    companyId: 'tcs',
    roleLevel: 'Intern',
    roundType: 'OA',
    questionText: 'Second-largest element without sorting the array.',
    topicTags: ['arrays', 'easy'],
    askedMonthYear: "Aug '26",
    submittedBy: null,
    status: 'approved',
    sourceType: 'indexed',
    sourceUrl: 'https://github.com/awesome-interview-questions/tcs',
    sourceLabel: 'via awesome-interview-questions repo',
    intakePath: null,
    upvoteCount: 12,
  },
  // Pending queue
  ...([
    ['amazon', 'SDE-1', 'Tech-1', 'Merge two heap-based sorted streams into one output stream.', ['heap', 'streaming'], "Aug '26", '@dvrma_'],
    ['microsoft', 'SDE-2', 'Other', 'Build an LRU cache — do not use OrderedDict.', ['hashmap', 'design'], "Aug '26", '@s_pandey'],
    ['stripe', 'SDE-2', 'Tech-2', 'Rate-limit an idempotent POST endpoint.', ['systems'], "Jul '26", '@anon_412'],
    ['tcs', 'Intern', 'OA', 'Reverse a linked list in groups of k.', ['linked list'], "Aug '26", '@nkr_'],
    ['infosys', 'Intern', 'OA', 'Find the longest palindromic substring.', ['strings', 'dp'], "Aug '26", '@rp2026'],
    ['google', 'Intern', 'Phone screen', 'Two-sum — return indices, not values.', ['likely duplicate'], "Jul '26", '@gh_intern'],
    ['uber', 'SDE-2', 'Other', 'Design a job scheduler with retry back-off.', ['systems'], "Aug '26", '@km_'],
  ] as Array<[string, string, string, string, string[], string, string]>).map(
    ([companyId, role, round, title, tags, asked, submitter]): SeedQuestion => ({
      companyId,
      roleLevel: role,
      roundType: round,
      questionText: title,
      topicTags: tags,
      askedMonthYear: asked,
      submittedBy: submitter,
      status: 'pending',
      sourceType: COMMUNITY,
      sourceUrl: 'https://github.com/community/aug-2026-interviews',
      sourceLabel: 'via community submission',
      intakePath: 'structured',
      upvoteCount: 0,
    }),
  ),
];

const PDF_INBOX = [
  { email: 'ananya.r@college.edu', filename: 'placement_2026_batch.pdf', note: 'Amazon + TCS, roughly March 2026' },
  { email: 'whatsapp.export@gmail.com', filename: 'cs_group_export.pdf', note: 'WhatsApp export, mixed companies' },
  { email: 'nkr.placements@college.edu', filename: 'tcs_ninja_oa_screenshots.pdf', note: '' },
];

// Approval-rate stats from the PRD mock, applied on top of computed counts.
const STAT_OVERRIDES: Record<string, { approvedCount: number }> = {
  '@dvrma_': { approvedCount: 14 },
  '@s_pandey': { approvedCount: 2 },
  '@nkr_': { approvedCount: 24 },
  '@km_': { approvedCount: 7 },
};

async function main() {
  console.log('Clearing existing data…');
  await prisma.question.deleteMany();
  await prisma.pdfSubmission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  console.log('Seeding companies…');
  for (const c of COMPANIES) {
    await prisma.company.create({ data: { id: c.id, name: c.name, normalizedSlug: c.slug } });
  }

  console.log('Seeding users…');
  const handles = new Set<string>();
  for (const q of questions) if (q.submittedBy) handles.add(q.submittedBy);
  for (const h of ['@rohan', '@ananya_r', '@shrey42']) handles.add(h);

  for (const handle of handles) {
    const submissionCount = questions.filter((q) => q.submittedBy === handle).length;
    const approvedFromData = questions.filter((q) => q.submittedBy === handle && q.status === 'approved').length;
    const approvedCount = STAT_OVERRIDES[handle]?.approvedCount ?? approvedFromData;
    await prisma.user.create({ data: { handle, submissionCount, approvedCount } });
  }

  console.log(`Seeding ${questions.length} questions…`);
  for (const q of questions) {
    await prisma.question.create({
      data: {
        companyId: q.companyId,
        roleLevel: q.roleLevel,
        roundType: q.roundType,
        questionText: q.questionText,
        codeSnippet: q.codeSnippet ?? null,
        topicTags: q.topicTags,
        askedMonthYear: q.askedMonthYear,
        submittedByHandle: q.submittedBy,
        status: q.status,
        sourceType: q.sourceType,
        sourceUrl: q.sourceUrl,
        sourceLabel: q.sourceLabel,
        intakePath: q.intakePath,
        upvoteCount: q.upvoteCount,
      },
    });
  }

  console.log('Seeding PDF inbox…');
  for (const p of PDF_INBOX) {
    await prisma.pdfSubmission.create({ data: p });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
