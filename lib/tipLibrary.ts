// The tips children see (lib/tips.ts picks them). Written to encourage: a
// trick to try, never a score or "you're weak at". Each skill has a few, used
// in turn, so a child who keeps missing the same skill gets a new trick each
// time rather than the same sentence again. Keys match the `skills` table
// (db/migrations/016_skills.sql); every skill must have at least one tip.

export interface Tip {
  title: string;
  text: string;
}

export const SKILL_TIPS: Record<string, Tip[]> = {
  patterns: [
    { title: "Pattern detective", text: "Write the gap between each pair of numbers under them. Is it always the same? Growing? Doubling? The gaps tell the secret." },
    { title: "Say it out loud", text: "Read the pattern out loud and say what changes each time: 'add 3, add 3, add 3...'. Then do it once more to find the next one." },
    { title: "Check both ways", text: "When you find a rule, check it works for EVERY step, not just the first two. One step that doesn't fit means there's a better rule." },
  ],
  ordering: [
    { title: "Draw a line", text: "Draw a line and put the names on it as you read each clue - tallest at one end, shortest at the other. The answer is easy to see." },
    { title: "Front and back trick", text: "If someone is 7th from the front and 12th from the back, add the places and take away 1 - they were counted twice! 7 + 12 - 1 = 18." },
  ],
  if_then: [
    { title: "If it didn't happen...", text: "'If it rains, the grass gets wet. The grass is dry.' So it did NOT rain! When the result didn't happen, the cause didn't happen either." },
    { title: "Family tree", text: "For family puzzles, draw a small family tree: parents on top, children below. Then point to each person as you read." },
    { title: "Step by step", text: "When something must happen in order, number the steps 1, 2, 3 on paper before you answer." },
  ],
  truth_lies: [
    { title: "Flip it", text: "If someone always lies, flip what they say. 'The door is open' from a liar means the door is closed." },
    { title: "Some is not all", text: "'Some cats are black' does not mean every cat is black. Watch out for the words ALL, SOME and NONE." },
  ],
  elimination: [
    { title: "Make a grid", text: "Draw a small table: names down the side, things across the top. Put a cross for every 'not' clue. The empty box is the answer!" },
    { title: "Start with the sure one", text: "Begin with the clue that tells you something for certain ('Mo has green'), then cross off that choice for everyone else." },
  ],
  odd_one_out: [
    { title: "What do three share?", text: "Find what three of them have in common - colour, group, number of legs. The one that doesn't share it is the odd one out." },
    { title: "Say the link", text: "For 'A is to B as C is to ?', say the link in a sentence: 'A cow's baby is a calf.' Then use the same sentence for C." },
  ],
  codes: [
    { title: "Alphabet helper", text: "Write the alphabet at the top of your page and count along it with your finger. No more slipping by one letter!" },
    { title: "Crack the rule first", text: "Look at the example first. Line up each letter with its code letter and write how far it moved. Then use the same move." },
  ],
  counting: [
    { title: "List them all", text: "Write every possibility in a list (AB, AC, BC...). Lists are slower than guessing, but they don't miss any." },
    { title: "Don't count twice", text: "For handshakes, A shaking B is the same as B shaking A - count each pair only once." },
  ],
  lateral: [
    { title: "Read every word", text: "Trick puzzles hide the answer in one small word like 'all but' or 'electric'. Read the question twice before answering." },
    { title: "Is the easy answer too easy?", text: "If the answer pops into your head in one second, stop and ask: is there a catch? These puzzles love a surprise." },
  ],
  add_subtract: [
    { title: "Line them up", text: "Write the numbers one above the other with ones under ones and tens under tens. Then add or take away column by column." },
    { title: "Check it back", text: "After taking away, add your answer back to check: if 52 - 17 = 35, then 35 + 17 should give 52." },
  ],
  multiply_divide: [
    { title: "Groups picture", text: "Draw it as groups: 4 bags with 3 sweets each is 4 circles with 3 dots in each. Count the dots!" },
    { title: "Times tables friends", text: "Division is times tables backwards: 24 shared by 6? Ask 'what times 6 makes 24?'" },
  ],
  money: [
    { title: "Write the prices", text: "Write each price on paper before adding. Then check: is the change less than what was paid?" },
    { title: "Price puzzle check", text: "When two things cost a total together, test your answer: do the two prices really add up to the total?" },
  ],
  time_calendar: [
    { title: "Count on your fingers", text: "For 'what day is it 3 days after Monday', say the days out loud and count on your fingers: Tuesday 1, Wednesday 2, Thursday 3." },
    { title: "Hours and minutes", text: "Remember 60 minutes make 1 hour. Add the minutes first, then move any extra 60s into hours." },
  ],
  fractions_ratios: [
    { title: "Draw the pieces", text: "Draw a bar or a pizza and cut it into the parts the question says. Shading the pieces makes fractions easy to see." },
    { title: "Find one part first", text: "For 'split in the ratio 2 : 3', add the parts (5), find what ONE part is worth, then multiply." },
  ],
  rates: [
    { title: "One first", text: "Work out what happens for ONE first - one minute, one plate, one worker - then multiply up." },
    { title: "Make a table", text: "Make a little table: 1 hour, 2 hours, 3 hours... and fill it in. The pattern gives the answer." },
  ],
  unknowns: [
    { title: "Solve one at a time", text: "Find the line with only ONE unknown and solve that first. Then use it in the next line, one step at a time." },
    { title: "Check your answer", text: "When you've found a number, put it back into the question. Does every line work? Then you've got it!" },
    { title: "Pen and paper", text: "Write each step down as you go. Puzzles with three or four steps are much easier on paper than in your head." },
  ],
  number_facts: [
    { title: "Even and odd", text: "Even numbers end in 0, 2, 4, 6 or 8. Odd numbers end in 1, 3, 5, 7 or 9. Just look at the last digit!" },
    { title: "Test each one", text: "For 'which of these is...', test every option one by one instead of picking the first that looks right." },
  ],
  shape_facts: [
    { title: "Draw it", text: "Draw the shape quickly and count its sides and corners with your pencil - touch each one as you count." },
    { title: "Name helpers", text: "Shape names often tell you the number: TRI = 3, QUAD = 4, PENTA = 5, HEXA = 6, OCTA = 8." },
  ],
  directions: [
    { title: "Never Eat Soggy Waffles", text: "Going clockwise: North, East, South, West - 'Never Eat Soggy Waffles'. Turning right moves to the next one." },
    { title: "Turn your body", text: "Stand up and really turn! Face the direction in the question, then turn left or right and see where you're facing." },
  ],
  rotation_symmetry: [
    { title: "Turn the paper", text: "Write the letter or shape on paper and actually turn the paper round. Your eyes will show you the answer." },
    { title: "Fold test", text: "For symmetry, imagine folding the shape in half. If the two halves match exactly, that fold is a line of symmetry." },
  ],
  folding: [
    { title: "Try it with paper", text: "Grab a scrap of paper and fold or cut it just like the question says. Then unfold and look!" },
    { title: "Count the layers", text: "Every fold doubles the layers. One hole through 2 layers makes 2 holes when you open it." },
  ],
  cubes_blocks: [
    { title: "Count in layers", text: "Count a block tower one layer at a time - bottom layer, then the next - and add the layers up." },
    { title: "Opposite faces", text: "On a dice, opposite faces always add up to 7: 1 and 6, 2 and 5, 3 and 4." },
  ],
  count_shapes: [
    { title: "Small, then big", text: "Count the smallest shapes first, then shapes made of two pieces, then three, then the whole thing. Add them all up." },
    { title: "Mark as you go", text: "Draw the picture and put a tick in each shape as you count it, so you don't count any twice." },
  ],
  position_maps: [
    { title: "Picture the places", text: "Draw a quick picture: boxes stacked, people in a line, or floors of a building. Pictures beat remembering." },
    { title: "Up and down", text: "For floors and steps, write the starting number, then add when going up and take away when going down." },
  ],
  clocks_angles: [
    { title: "Draw the clock", text: "Draw a clock face with 12, 3, 6 and 9 first, then put the hands in. A quarter turn is 3 numbers along." },
    { title: "Minutes count by 5", text: "Each number on the clock is 5 minutes for the long hand: 1 is 5 minutes, 2 is 10, 3 is 15..." },
  ],
  measuring: [
    { title: "Around or inside?", text: "Perimeter is the fence around the outside - add all the sides. Area is the carpet inside - multiply length by width." },
    { title: "Same units", text: "Before adding lengths, make sure they are in the same unit: change metres to centimetres (1 m = 100 cm) first." },
  ],
  clue_riddle: [
    { title: "Use every clue", text: "Read each clue and cross out the answers that don't fit. The answer has to match ALL the clues, not just one." },
    { title: "Picture it", text: "Close your eyes and picture the thing the clues describe. What does it look like? Where would you find it?" },
  ],
  wordplay: [
    { title: "Two meanings", text: "Many riddles use a word with two meanings - a 'bat' that flies and a cricket 'bat'. Think: what else could this word mean?" },
    { title: "Look inside the word", text: "Some answers hide inside the word itself - HAIR is hiding in CHAIR. Read the letters slowly." },
  ],
  trick_question: [
    { title: "Read it twice", text: "Trick questions want you to answer too fast. Read the question twice, slowly, and look for the catch." },
    { title: "What does it really ask?", text: "Ask yourself 'what is the question REALLY asking?' before you look at the answers." },
  ],
  word_meaning: [
    { title: "Use it in a sentence", text: "Put each word into a sentence. The word that fits the meaning best is usually the answer." },
    { title: "Opposites", text: "For opposites, think of the word's partner: hot-cold, up-down, happy-sad." },
  ],
  everyday_knowledge: [
    { title: "Think of real life", text: "Picture where you have seen it at home, at school or outside. Real life often holds the answer." },
    { title: "Ask and learn", text: "When you learn a new fact here, tell someone at home about it - telling others helps you remember." },
  ],
};

// Habits spotted across all of a period's wrong answers (lib/tips.ts).
export const HABIT_TIPS: Record<"rushing" | "timeouts", Tip> = {
  rushing: {
    title: "Slow and steady wins",
    text: "Super-fast answers are often the tricky ones. If you answer in just a few seconds, read the question once more before you tap.",
  },
  timeouts: {
    title: "Beat the clock",
    text: "For long questions, start by writing down what you know. If the time is nearly up, pick your best guess instead of leaving it blank.",
  },
};
