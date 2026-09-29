-- Skill map (see lib/skills.ts). Every bank question gets ONE skill - what a
-- child must be able to do to answer it - plus a step (1 easier than typical,
-- 2 typical, 3 harder than typical) relative to the other questions at the
-- same level. Skills deliberately cut across categories: a "logic" question
-- about ages is "unknowns", a "spatial" one about area is "measuring". Math
-- questions are generated, not stored, so they map to skills by template_key
-- in lib/skills.ts instead of a column.
--
-- Skills are the layer underneath categories. Rounds are still built by
-- category; this migration only records the tags, nothing a kid sees changes.
create table skills (
  key text primary key,
  area text not null check (area in ('reasoning', 'numbers', 'shapes', 'words')),
  name text not null,
  description text not null,
  sort_order smallint not null
);

insert into skills (key, area, name, description, sort_order) values
  ('patterns', 'reasoning', 'Patterns and sequences', 'What comes next / what is missing in a number, letter, shape or word sequence.', 1),
  ('ordering', 'reasoning', 'Ordering and comparing', 'Chains like A taller than B taller than C, positions in a line or race, ranking, left/right order of a few named things (not map directions).', 2),
  ('if_then', 'reasoning', 'If-then and rules', 'Conditionals, rules with exceptions, ''what must be true'', cause and effect deductions, necessary order of steps (e.g. socks before shoes), family-relation puzzles (what is A to C?).', 3),
  ('truth_lies', 'reasoning', 'Truth and lies', 'Truth-tellers and liars, is this statement true/false, ''all/some/none'' statement logic.', 4),
  ('elimination', 'reasoning', 'Who-has-what puzzles', 'Match people to things/places using clues and crossing out options (grid/elimination puzzles), which cup hides the prize.', 5),
  ('odd_one_out', 'reasoning', 'Odd one out and grouping', 'Which does not belong, which group something belongs to, analogies (A is to B as C is to ?).', 6),
  ('codes', 'reasoning', 'Codes and ciphers', 'Letter/number/symbol codes, A=1 B=2 letter values, secret-code rules, symbol arithmetic.', 7),
  ('counting', 'reasoning', 'Counting cleverly', 'Handshakes/games/cards between people, arrangements, how many numbers in a range satisfy X, Venn/overlap (both/neither), fewest draws to be sure, probability/chance.', 8),
  ('lateral', 'reasoning', 'Think outside the box', 'Classic insight puzzles whose obvious answer is wrong or needing a clever plan: bat and ball, three light switches, water jugs, river crossing, weighing to find the fake.', 9),
  ('add_subtract', 'numbers', 'Add and subtract', 'Straight addition/subtraction or simple one-step word problems using them.', 10),
  ('multiply_divide', 'numbers', 'Multiply, divide and sharing', 'Multiplication, division, equal sharing, groups of, halves/doubles as simple operations.', 11),
  ('money', 'numbers', 'Money and shopping', 'Prices, costs, change, how many can you buy, profit, discounts in a shopping setting.', 12),
  ('time_calendar', 'numbers', 'Time and calendar', 'Days of the week, dates, months, durations, ''what time will it be'', schedules, leap years. (Reading a clock face or clock-hand angles is clocks_angles instead.)', 13),
  ('fractions_ratios', 'numbers', 'Fractions, percentages and ratios', 'Fractions of amounts, percent, ratio splits, proportions.', 14),
  ('rates', 'numbers', 'Speed and work rates', 'Speed/distance/time, pipes filling or draining, several workers together, rate per hour.', 15),
  ('unknowns', 'numbers', 'Find the unknown', 'Algebra-style: ages puzzles, ''think of a number'', equations, chickens-and-cows heads/legs, balance scales with unknown weights, sums and differences.', 16),
  ('number_facts', 'numbers', 'Number facts', 'Multiples, factors, primes, even/odd, remainders, squares/powers/roots, averages, place value, series sums like 1+3+5+...', 17),
  ('shape_facts', 'shapes', 'Shape facts', 'Names and properties of 2D/3D shapes: sides, corners, faces, edges, triangle types, polygon names, cross-sections.', 18),
  ('directions', 'shapes', 'Directions and turns', 'Compass directions, left/right turns, turning by degrees or quarter turns of yourself, walking paths and ending position.', 19),
  ('rotation_symmetry', 'shapes', 'Rotation, mirrors and symmetry', 'Rotating letters/shapes, lines of symmetry, rotational symmetry, mirror images and mirror words, reflections.', 20),
  ('folding', 'shapes', 'Folding, cutting and nets', 'Paper folding, holes punched then unfolded, cutting, layers, nets that fold into 3D shapes.', 21),
  ('cubes_blocks', 'shapes', 'Cubes and blocks', 'Counting cubes in stacks/boxes, dice opposite faces, rolling cubes, painted cubes, front/side/top views of block models.', 22),
  ('count_shapes', 'shapes', 'Counting shapes in a picture', 'How many triangles/squares/rectangles of all sizes in a figure or grid.', 23),
  ('position_maps', 'shapes', 'Position and maps', 'Above/below/on top/between in stacks and buildings, grid coordinates, map scale, chess-board moves, where things are relative to each other in space.', 24),
  ('clocks_angles', 'shapes', 'Clocks and angles', 'Reading clock faces and hands, angle between clock hands, angles in shapes, degrees in slices/turns of shapes.', 25),
  ('measuring', 'shapes', 'Measuring', 'Length, area, perimeter, volume, surface area, scale drawings to real size, similar triangles/shadows.', 26),
  ('clue_riddle', 'words', 'Guess from clues', 'Description riddles where the clues literally describe an everyday thing, animal, place or job and you must name it (tests vocabulary/knowledge more than reasoning).', 27),
  ('wordplay', 'words', 'Wordplay and double meanings', 'The answer depends on a pun or a second meaning of a word (band that plays no music, table without legs, what has keys but opens no locks), spelling/letter tricks, palindromes.', 28),
  ('trick_question', 'words', 'Trick questions', 'Careful-reading or insight riddles where the obvious reading is wrong or the answer is a surprising twist (bald man in rain, two mothers two daughters, the more you take the more you leave behind, abstract things like footsteps/silence/a promise).', 29),
  ('word_meaning', 'words', 'Word meanings', 'Synonyms, opposites, which word fits, meaning of a word or phrase.', 30),
  ('everyday_knowledge', 'words', 'Everyday knowledge', 'General knowledge and common sense facts (which month is shortest, what plants need, which animal is heaviest, what group an instrument belongs to) where no puzzle-solving is needed.', 31);

alter table questions add column skill_key text references skills (key);
alter table questions add column skill_step smallint check (skill_step between 1 and 3);
create index questions_skill_key_idx on questions (skill_key);
