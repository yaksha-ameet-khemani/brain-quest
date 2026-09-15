import "server-only";
import type { Level } from "@/lib/config";

// Infinite math questions generated from templates with randomised numbers,
// so the game doesn't run dry after a few hundred rounds like a fixed bank
// would. Generated server-side only - the answer never touches the network
// until the kid has already answered (see app/api/round).

export interface GeneratedQuestion {
  category: "math";
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Builds options from a correct value + distractor values, shuffles them,
 * and returns the index the correct value landed on. De-dupes distractors
 * that collide with the correct answer or each other. */
function buildOptions(correct: number, distractors: number[]): { options: string[]; correctIndex: number } {
  const seen = new Set<number>([correct]);
  const unique = distractors.filter((d) => {
    if (seen.has(d)) return false;
    seen.add(d);
    return true;
  });
  while (unique.length < 3) {
    const filler = correct + randInt(-5, 5) * (unique.length + 1);
    if (!seen.has(filler)) {
      seen.add(filler);
      unique.push(filler);
    }
  }
  const values = shuffle([correct, ...unique.slice(0, 3)]);
  return {
    options: values.map(String),
    correctIndex: values.indexOf(correct),
  };
}

type Template = () => GeneratedQuestion;

// ---- Level 1 (younger kids: arithmetic, simple word problems, patterns) ----

const level1Templates: Template[] = [
  () => {
    const a = randInt(12, 89);
    const b = randInt(12, 89);
    const correct = a + b;
    const { options, correctIndex } = buildOptions(correct, [correct + 10, correct - 10, correct + 1]);
    return {
      category: "math",
      questionText: `What is ${a} + ${b}?`,
      options,
      correctIndex,
      explanation: `${a} + ${b} = ${correct}.`,
    };
  },
  () => {
    const a = randInt(30, 99);
    const b = randInt(10, a - 5);
    const correct = a - b;
    const { options, correctIndex } = buildOptions(correct, [correct + 10, correct - 1, a + b]);
    return {
      category: "math",
      questionText: `What is ${a} - ${b}?`,
      options,
      correctIndex,
      explanation: `${a} - ${b} = ${correct}.`,
    };
  },
  () => {
    const a = randInt(2, 12);
    const b = randInt(2, 12);
    const correct = a * b;
    const { options, correctIndex } = buildOptions(correct, [a * (b + 1), a * (b - 1), a + b]);
    return {
      category: "math",
      questionText: `What is ${a} x ${b}?`,
      options,
      correctIndex,
      explanation: `${a} x ${b} = ${correct}.`,
    };
  },
  () => {
    const start = randInt(2, 9);
    const ratio = randInt(2, 3);
    const seq: [number, number, number, number] = [start, start * ratio, start * ratio * ratio, start * ratio * ratio * ratio];
    const correct = seq[3] * ratio;
    const { options, correctIndex } = buildOptions(correct, [correct + ratio, correct - seq[3], correct / ratio]);
    return {
      category: "math",
      questionText: `What comes next in the pattern: ${seq.join(", ")}, ___?`,
      options,
      correctIndex,
      explanation: `Each number is multiplied by ${ratio}. ${seq[3]} x ${ratio} = ${correct}.`,
    };
  },
  () => {
    const step = randInt(3, 9);
    const start = randInt(1, 10);
    const seq: [number, number, number, number] = [start, start + step, start + 2 * step, start + 3 * step];
    const correct = start + 4 * step;
    const { options, correctIndex } = buildOptions(correct, [correct + step, correct - step, correct + 1]);
    return {
      category: "math",
      questionText: `What comes next: ${seq.join(", ")}, ___?`,
      options,
      correctIndex,
      explanation: `Each number increases by ${step}. ${seq[3]} + ${step} = ${correct}.`,
    };
  },
  () => {
    // cheap item + expensive item that differ by a fixed amount, total given
    const cheap = randInt(1, 8) / 2; // allows .5 values like the classic "ball and bat"
    const diff = randInt(4, 9) * 2; // keep arithmetic friendly
    const total = cheap * 2 + diff;
    const correctCents = cheap;
    const names = ["a toy car", "a balloon", "a sticker pack", "a pencil"];
    const name = names[randInt(0, names.length - 1)]!;
    const { options, correctIndex } = buildOptionsDecimal(correctCents, [correctCents + 1, correctCents + diff, total / 2]);
    return {
      category: "math",
      questionText: `${name.charAt(0).toUpperCase()}${name.slice(1)} and a toy train cost $${total.toFixed(2)} together. The train costs $${diff.toFixed(2)} more than ${name}. How much does ${name} cost?`,
      options,
      correctIndex,
      explanation: `If ${name} costs $${correctCents.toFixed(2)}, the train costs $${(correctCents + diff).toFixed(2)}. Together: $${total.toFixed(2)}.`,
    };
  },
  () => {
    const total = randInt(4, 10) * 4;
    const groups = randInt(2, 4);
    const correct = total / groups;
    const { options, correctIndex } = buildOptions(correct, [correct + groups, correct - 1, total]);
    return {
      category: "math",
      questionText: `${total} candies are shared equally among ${groups} friends. How many candies does each friend get?`,
      options,
      correctIndex,
      explanation: `${total} / ${groups} = ${correct} candies each.`,
    };
  },
  () => {
    const minutesPerItem = randInt(2, 5);
    const items = randInt(3, 8);
    const correct = minutesPerItem * items;
    const { options, correctIndex } = buildOptions(correct, [correct + minutesPerItem, correct - minutesPerItem, items + minutesPerItem]);
    return {
      category: "math",
      questionText: `It takes ${minutesPerItem} minutes to wash one plate. How many minutes to wash ${items} plates?`,
      options,
      correctIndex,
      explanation: `${minutesPerItem} x ${items} = ${correct} minutes.`,
    };
  },
];

function buildOptionsDecimal(correct: number, distractors: number[]) {
  const { options, correctIndex } = buildOptions(Math.round(correct * 100), distractors.map((d) => Math.round(d * 100)));
  return { options: options.map((o) => `$${(Number(o) / 100).toFixed(2)}`), correctIndex };
}

// ---- Level 2 (older kid: percentages, ratios, simple algebra, geometry) ----

const level2Templates: Template[] = [
  () => {
    const base = randInt(20, 200);
    const pct = [10, 20, 25, 50][randInt(0, 3)]!;
    const correct = (base * pct) / 100;
    const { options, correctIndex } = buildOptions(correct, [base - correct, correct + 5, base]);
    return {
      category: "math",
      questionText: `What is ${pct}% of ${base}?`,
      options,
      correctIndex,
      explanation: `${pct}% of ${base} = (${pct}/100) x ${base} = ${correct}.`,
    };
  },
  () => {
    const x2 = randInt(2, 15);
    const coeff = randInt(2, 6);
    const offset = randInt(1, 20);
    const correct = x2;
    const rhs = coeff * x2 + offset;
    const { options, correctIndex } = buildOptions(correct, [correct + 1, correct - 1, Math.round(rhs / coeff)]);
    return {
      category: "math",
      questionText: `Solve for x: ${coeff}x + ${offset} = ${rhs}`,
      options,
      correctIndex,
      explanation: `${coeff}x = ${rhs} - ${offset} = ${rhs - offset}. x = ${rhs - offset} / ${coeff} = ${correct}.`,
    };
  },
  () => {
    const length = randInt(4, 20);
    const width = randInt(3, 15);
    const correct = length * width;
    const { options, correctIndex } = buildOptions(correct, [2 * (length + width), length + width, correct + length]);
    return {
      category: "math",
      questionText: `A rectangle is ${length} cm long and ${width} cm wide. What is its area?`,
      options,
      correctIndex,
      explanation: `Area = length x width = ${length} x ${width} = ${correct} sq cm.`,
    };
  },
  () => {
    const length = randInt(4, 20);
    const width = randInt(3, 15);
    const correct = 2 * (length + width);
    const { options, correctIndex } = buildOptions(correct, [length * width, length + width, correct + 2]);
    return {
      category: "math",
      questionText: `A rectangle is ${length} cm long and ${width} cm wide. What is its perimeter?`,
      options,
      correctIndex,
      explanation: `Perimeter = 2 x (length + width) = 2 x (${length} + ${width}) = ${correct} cm.`,
    };
  },
  () => {
    // rate problem
    const rate = randInt(40, 80); // km/h
    const hours = randInt(2, 6);
    const correct = rate * hours;
    const { options, correctIndex } = buildOptions(correct, [correct + rate, correct - rate, rate + hours]);
    return {
      category: "math",
      questionText: `A car travels at ${rate} km/h for ${hours} hours. How far does it travel?`,
      options,
      correctIndex,
      explanation: `Distance = speed x time = ${rate} x ${hours} = ${correct} km.`,
    };
  },
  () => {
    // ratio sharing
    const r1 = randInt(2, 5);
    const r2 = randInt(2, 5);
    const unit = randInt(3, 10);
    const total = (r1 + r2) * unit;
    const correct = r1 * unit;
    const { options, correctIndex } = buildOptions(correct, [r2 * unit, total, correct + unit]);
    return {
      category: "math",
      questionText: `$${total} is split between two friends in the ratio ${r1}:${r2}. How much does the first friend get?`,
      options,
      correctIndex,
      explanation: `Each "share" is worth $${total} / ${r1 + r2} = $${unit}. First friend gets ${r1} shares = $${correct}.`,
    };
  },
  () => {
    // classic "cats catching mice" style rate-of-work problem, randomised
    const cats = randInt(3, 8);
    const mins = randInt(3, 8);
    const targetMice = cats * randInt(10, 20);
    const targetMins = mins * randInt(5, 10);
    const correct = Math.round((targetMice * mins) / (cats * targetMins));
    const { options, correctIndex } = buildOptions(correct, [cats, targetMice, correct + cats]);
    return {
      category: "math",
      questionText: `If ${cats} cats can catch ${cats} mice in ${mins} minutes, how many cats are needed to catch ${targetMice} mice in ${targetMins} minutes?`,
      options,
      correctIndex,
      explanation: `1 cat catches 1 mouse every ${mins} minutes, so in ${targetMins} minutes it catches ${targetMins / mins} mice. To get ${targetMice} mice: ${targetMice} / ${targetMins / mins} = ${correct} cats.`,
    };
  },
  () => {
    // Parametrised so the numbers always resolve cleanly:
    // mother = m * daughter now; in `years` years, mother = 2x daughter.
    // Solving mother+years = 2*(daughter+years) gives years = daughter*(m-2).
    const daughter = randInt(8, 16);
    const m = randInt(3, 4);
    const mother = m * daughter;
    const years = daughter * (m - 2);
    const { options, correctIndex } = buildOptions(daughter, [daughter + years, mother, daughter + 2]);
    return {
      category: "math",
      questionText: `A mother is ${m} times as old as her daughter. In ${years} years, she will be twice as old as her daughter. How old is the daughter now?`,
      options,
      correctIndex,
      explanation: `Let daughter = d. Mother = ${m}d. In ${years} years: ${m}d + ${years} = 2(d + ${years}). Solving gives d = ${daughter}.`,
    };
  },
];

export function generateMathQuestion(level: Level): GeneratedQuestion {
  const templates = level === 1 ? level1Templates : level2Templates;
  const pick = templates[randInt(0, templates.length - 1)]!;
  return pick();
}

export function generateMathQuestions(level: Level, count: number): GeneratedQuestion[] {
  const out: GeneratedQuestion[] = [];
  const seenPrompts = new Set<string>();
  let guard = 0;
  while (out.length < count && guard < count * 10) {
    guard++;
    const q = generateMathQuestion(level);
    if (seenPrompts.has(q.questionText)) continue;
    seenPrompts.add(q.questionText);
    out.push(q);
  }
  return out;
}
