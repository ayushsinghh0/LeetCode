// The 100xDevs "AI & ML" cohort (course 23), tracked alongside the DSA roadmap at a pace of
// one week-module per two days. Hand-maintained: titles/dates/content ids verified against the
// public course outline API on 2026-07-31; resource links come from the owner's course notes.
// Week 19 was cancelled on the site and is deliberately absent. Content ids are strings —
// early lectures use numeric ids, the newest use `v_<uuid>` ids.

export type CourseResourceKind =
  | 'slides'
  | 'colab'
  | 'excalidraw'
  | 'video'
  | 'article'
  | 'docs'
  | 'github'
  | 'assignment'
  | 'sheet'
  | 'link';

export interface CourseResource {
  label: string;
  url: string;
  kind: CourseResourceKind;
}

export interface CourseWeek {
  id: string; // 'w00'…'w26' core, 'x-…' extras
  week: number | null; // null for extras
  title: string;
  taughtOn: string | null; // ISO yyyy-MM-dd (original lecture date)
  contentId: string | null; // 100xDevs content item id
  contentKind: 'video' | 'folder';
  resources: CourseResource[];
  optional?: true; // extras: single-session, outside the 2-day plan
}

export const AIML_COURSE_URL = 'https://100xdevs.com/new-courses/23/content?parentId=4148';

export function lectureUrl(week: CourseWeek): string {
  if (week.contentId === null) return AIML_COURSE_URL;
  return week.contentKind === 'folder'
    ? `https://100xdevs.com/new-courses/23/content?parentId=${week.contentId}`
    : `https://100xdevs.com/new-courses/23/video/${week.contentId}`;
}

const drive = (label: string, url: string): CourseResource => ({ label, url, kind: 'slides' });
const colab = (url: string): CourseResource => ({ label: 'Colab', url, kind: 'colab' });
const excalidraw = (url: string): CourseResource => ({ label: 'Excalidraw', url, kind: 'excalidraw' });

export const COURSE_WEEKS: CourseWeek[] = [
  {
    id: 'w00', week: 0, title: 'Orientation', taughtOn: '2026-01-09', contentId: '4149', contentKind: 'video',
    resources: [drive('Slides', 'https://drive.google.com/file/d/1vYuRDxfmKeDN8hVMpQ-1mVB8A8rgAdyc/view?usp=drive_link')],
  },
  {
    id: 'w01', week: 1, title: 'Fast-tracking the Course of AI', taughtOn: '2026-01-18', contentId: '4150', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1B8Dltp-P_-ZFuf_On_FcwJFLYVTyNN5T/view?usp=sharing'),
      { label: 'LLM visualization', url: 'https://bbycroft.net/llm', kind: 'link' },
      { label: 'Jailbreaking AI', url: 'https://github.com/elder-plinius/L1B3RT4S', kind: 'github' },
    ],
  },
  {
    id: 'w02', week: 2, title: 'Neural Networks from Scratch', taughtOn: '2026-01-24', contentId: '4167', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1wDBIvKpq69d37ki_aoOuiy1grpuWNicR/view?usp=sharing'),
      colab('https://colab.research.google.com/drive/1OuJA1KC2IUexv0TXGkkQTTl1B-kJKV-P?usp=sharing'),
    ],
  },
  {
    id: 'w03', week: 3, title: 'Transformers — Part 1', taughtOn: '2026-01-31', contentId: '4209', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1TfTlTvVGw9WsXf9V0h_XpG51TYoKwO8F/view'),
      colab('https://colab.research.google.com/drive/13KJpq-2zr3b8NcTiIpwBmHHuhMUWSk1T?usp=sharing'),
    ],
  },
  {
    id: 'w04', week: 4, title: 'Transformers — Part 2', taughtOn: '2026-02-07', contentId: '4606', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1opPJYcDjthlw9cnNyYh0Dcuyj09toPrQ/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/1GI4cHskjgsmT1KupN5shNXa51ZcOyPWK?usp=sharing'),
    ],
  },
  {
    id: 'w05', week: 5, title: 'Introduction to Tensors and PyTorch', taughtOn: '2026-02-14', contentId: '4966', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1kwR7-MmcYeNrI_M4zSkKyNl3108WWBPq/view?usi=drive_link'),
      colab('https://colab.research.google.com/drive/1V5qEIwUu4fD6jfTR_x_L3BlEeJwAYvsT?usp=sharing'),
      { label: 'Tensors video', url: 'https://youtu.be/f5liqUk0ZTw?si=AVkGGRRNO_rm3-Q0', kind: 'video' },
    ],
  },
  {
    id: 'w06', week: 6, title: "What Changed Since 2017 — and Let's Build It", taughtOn: '2026-02-21', contentId: '5279', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1DEEMKix6eyi_PQE0XWuooksY6_jym6e-/view?usp=drive_link'),
      excalidraw('https://excalidraw.com/#json=VcgqSnBC74dLEWeqhmFP0,THeOoMUaZIrRjNGuFCOvOg'),
      { label: 'GQA blog', url: 'https://syhya.github.io/posts/2025-01-16-group-query-attention/', kind: 'article' },
    ],
  },
  {
    id: 'w07', week: 7, title: 'Training Your First Model', taughtOn: '2026-02-28', contentId: '6372', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1UfPaCMnt1Cq1hKNZJUFjWrx76B8bLuRw/view'),
      colab('https://colab.research.google.com/drive/1t1k3cwSyOUQ48cSVziiS9SAtNzeoudwU?usp=sharing'),
    ],
  },
  {
    id: 'w08', week: 8, title: 'From APIs to Agents', taughtOn: '2026-03-07', contentId: '6410', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1IbDRyLBotw3cAoobDw9KTsnHrSzOINy0/view'),
      colab('https://colab.research.google.com/drive/1X6Tl1VZ9FFBgyt0YgMJDv6vJpb4hu-cp#scrollTo=u7RR31nCUnW5'),
      excalidraw('https://excalidraw.com/#json=eesSkvg9N8hlYekpHbzmd,XV1VhLMWEGRyPssJ1Nx78A'),
    ],
  },
  {
    id: 'w09', week: 9, title: 'RAG from the Ground Up — Part 1', taughtOn: '2026-03-13', contentId: '6428', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1iXEJe4LTdjKIuudECf8szyciiqnooCZW/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/1vaaXrsHyOuqtpArFdGbiT8My5Ucs7mnx?usp=sharing'),
      excalidraw('https://excalidraw.com/#json=y4F46fapKAXAyzeJZSgYD,WlwtkiN5brjUIKcX4U50Yg'),
    ],
  },
  {
    id: 'w10', week: 10, title: 'RAG Continuation — Part 2', taughtOn: '2026-03-23', contentId: '6477', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1Y-KEqY6KgWhK3c9acjuVJuZbON6cwvPd/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/1iDSYG-iGPEjz9cW8U5uINtn3G1SQiugS?usp=sharing'),
      excalidraw('https://excalidraw.com/#json=xaD5a1TWnmTDldugcVIGr,lUHkHMdGHTVUFcQ9CUP-QQ'),
    ],
  },
  {
    id: 'w11', week: 11, title: 'Recursive Language Model', taughtOn: '2026-03-28', contentId: '6494', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1zs1bkDSuDgE_7NQd95Meiy7k6K8RU8Y6/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/13iLqgUNO5UDlWZfpDqDZrswakANtGLrB?usp=sharing'),
      excalidraw('https://excalidraw.com/#json=saM65Y8hD4SzY3XE2e486,mtX3p7DQKAQ1Aie-qP4VIg'),
    ],
  },
  {
    id: 'w12', week: 12, title: 'Fine-tuning', taughtOn: '2026-04-04', contentId: '6521', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1flr83qaKpJflb2oVvyJ3XS0A2_4vc6C0/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/1FGL29xeEMvDZ3gXeIsFmraP30gZksmf7?usp=sharing'),
    ],
  },
  {
    id: 'w13', week: 13, title: 'Fine-tuning — Part 2', taughtOn: '2026-04-11', contentId: '6600', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1EfwjyT-1THzxANVWc2GQ55tebivR0phF/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/1RdNKrolUyivGYLXiO4syLxIkPUHgg505?usp=sharing'),
      excalidraw('https://excalidraw.com/#json=yMBhyaNkIWOQkPBly4EYA,aN9ukNsNwWCvy0cQeYLpTg'),
    ],
  },
  {
    id: 'w14', week: 14, title: 'Fine-tuning — Part 3', taughtOn: '2026-04-17', contentId: '6630', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1s8TaEOB93OnqSsc_vgwu_NMu_GYhgE-m/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/1k2G-0ipWzR6ZYttMga-LqrV3jE1gyXoF?usp=sharing'),
      { label: 'Deep RL course', url: 'https://huggingface.co/learn/deep-rl-course/unit0/introduction', kind: 'docs' },
      { label: 'YC AI companies', url: 'https://www.ycombinator.com/companies?batch=Summer%202026&batch=Spring%202026&batch=Winter%202026', kind: 'link' },
    ],
  },
  {
    id: 'w15', week: 15, title: 'RLVR', taughtOn: '2026-04-25', contentId: '6652', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1OL4HC1qJDUoojQopGJPMO77qZpGsDLe8/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/10nKO6a5pp5owF_O8bMkHeUBHiMt-doZa?usp=sharing'),
      { label: 'Learning to reason (OpenAI)', url: 'https://openai.com/index/learning-to-reason-with-llms/', kind: 'article' },
      { label: 'DeepSeek-R1 deep dive', url: 'https://fireworks.ai/blog/deepseek-r1-deepdive', kind: 'article' },
      { label: 'R1 paper', url: 'https://arxiv.org/pdf/2501.12948', kind: 'article' },
      { label: 'Compute sheet', url: 'https://docs.google.com/spreadsheets/d/13UDfRDjgIZXsMI2s9-Lmn8KSMMsgk2_zsfju6cx_pNU/edit?gid=650541192#gid=650541192', kind: 'sheet' },
    ],
  },
  {
    id: 'w16', week: 16, title: 'Offline: RL Environments for LLMs', taughtOn: '2026-05-08', contentId: '6687', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1xluPAQXjXXA3eRlNkzieTD7BNb2pUefb/view?usp=drive_link'),
      excalidraw('https://excalidraw.com/#json=j9gliuL2jj0a0JeNILMTj,F7W5Q_6i93-Tb3xCmzWm7g'),
      colab('https://colab.research.google.com/drive/10OsnR_9ItWWC2a7j6TlSDd9uVkgRHgfE?usp=sharing'),
      { label: 'Prime Intellect environments', url: 'https://app.primeintellect.ai/dashboard/environments?ex_sort=by_sections', kind: 'link' },
    ],
  },
  {
    id: 'w17', week: 17, title: 'Harness, Context, and Evals', taughtOn: '2026-05-09', contentId: '6698', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1ZQztsVbbvKAb96Y_idLA34Zp7JcyiteG/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/1wiA-AYTetERTicaau3Jy1NAJ7GjMpP2o'),
      excalidraw('https://excalidraw.com/#json=Ipy3w_uTl5O62C70bK_0P,5ZCPqYMnoHVsV_ur8uyaMg'),
    ],
  },
  {
    id: 'w18', week: 18, title: 'Memory', taughtOn: '2026-05-16', contentId: '6752', contentKind: 'video',
    resources: [drive('Slides', 'https://drive.google.com/file/d/1N2sXXtJcJuLNFO_Uhad0g9B53TQWNlkn/view?usp=drive_link')],
  },
  {
    id: 'w20', week: 20, title: 'How to Read Research Papers', taughtOn: '2026-05-31', contentId: '7069', contentKind: 'video',
    resources: [drive('Slides', 'https://drive.google.com/file/d/1vpwWb_MzqS-TApTXI0lHMYaoGyN-WR8X/view')],
  },
  {
    id: 'w21', week: 21, title: 'LangGraph', taughtOn: '2026-06-06', contentId: '7092', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1l6_fD6aH-8ccHM72x4bkqzQu_agwTqBi/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/1oH6m5Ib3R69duTO8lDkYESqQ-ZUOfNVw?usp=sharing'),
      { label: 'Deep Agents docs', url: 'http://docs.langchain.com/oss/python/deepagents/overview', kind: 'docs' },
      { label: 'open-swe', url: 'https://github.com/langchain-ai/open-swe', kind: 'github' },
    ],
  },
  {
    id: 'w22', week: 22, title: 'Coding an Agent (Assignment)', taughtOn: '2026-06-13', contentId: '7117', contentKind: 'video',
    resources: [
      { label: 'Assignment', url: 'https://brindle-goal-102.notion.site/Build-a-Mini-Workflow-Orchestration-Engine-37d46b36b2e980b4aa95df09bfa31019', kind: 'assignment' },
      { label: 'Boilerplate', url: 'https://github.com/rahul-MyGit/contest-2', kind: 'github' },
      { label: 'Solution repo', url: 'https://github.com/100xdevs-bootcamp-1/13-june-assignment', kind: 'github' },
    ],
  },
  {
    id: 'w23', week: 23, title: 'Hugging Face End-to-End', taughtOn: '2026-06-20', contentId: '7278', contentKind: 'video',
    resources: [drive('Slides', 'https://drive.google.com/file/d/1DrbO9w1S-wBMtC9lKqP81maNFe29bzX-/view?usp=drive_link')],
  },
  {
    id: 'w24', week: 24, title: 'LLM Observability', taughtOn: '2026-07-01', contentId: '7421', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1MseRAsCny5YlSP_YnSX6HWEkbTNVChB2/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/1U7fxDpRphMkTRJtkl0ZOpOmQhxtKkRmq?usp=sharing'),
    ],
  },
  {
    id: 'w25', week: 25, title: 'Computer Use Agents', taughtOn: '2026-07-08', contentId: 'v_2091fb99-2623-4c95-95a6-1464365741ac', contentKind: 'video',
    resources: [
      drive('Slides', 'https://drive.google.com/file/d/1Q0a0QhHkjOzr9QGcyyqFh-n8SYubHLXF/view?usp=drive_link'),
      colab('https://colab.research.google.com/drive/1H3rEbd7pQZhKhb_4kAgXtNiPskQMuaEh?usp=sharing'),
    ],
  },
  {
    id: 'w26', week: 26, title: 'Evals', taughtOn: '2026-07-11', contentId: 'v_6c28c4bd-23b8-4ab6-821c-82d8931f58ad', contentKind: 'video',
    resources: [],
  },

  // --- Extras (optional, outside the 2-day plan) --------------------------------------------
  {
    id: 'x-agents-1', week: null, title: 'How Modern AI Agents Work Under the Hood — Part 1',
    taughtOn: null, contentId: '7141', contentKind: 'folder', resources: [], optional: true,
  },
  {
    id: 'x-agents-2', week: null, title: 'How Modern AI Agents Work Under the Hood — Part 2',
    taughtOn: null, contentId: '7143', contentKind: 'video', resources: [], optional: true,
  },
  {
    id: 'x-memory-1', week: null, title: 'Memory — Class by Samiksha',
    taughtOn: '2026-06-20', contentId: '7400', contentKind: 'video', resources: [], optional: true,
  },
  {
    id: 'x-memory-2', week: null, title: 'Memory II — Class by Samiksha',
    taughtOn: '2026-06-21', contentId: '7401', contentKind: 'video', resources: [], optional: true,
  },
  {
    id: 'x-super30-evals', week: null, title: 'Evals, Benchmarks and RL Environments — Super 30',
    taughtOn: null, contentId: 'v_aada66b3-47fe-4acf-b646-86f5eac4b0f0', contentKind: 'video', resources: [], optional: true,
  },
];

export const CORE_WEEKS: CourseWeek[] = COURSE_WEEKS.filter((w) => !w.optional);
export const EXTRA_WEEKS: CourseWeek[] = COURSE_WEEKS.filter((w) => w.optional);

export const courseWeekById: Map<string, CourseWeek> = new Map(COURSE_WEEKS.map((w) => [w.id, w]));
