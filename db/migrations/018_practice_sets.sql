-- Practice sets: named groups of bank questions an admin assigns to a child
-- as extra, unscored practice (first use: 60 logic questions for Banku's
-- school assessment, 2026-10-01). See docs/blueprint.md v34.
--
-- * questions.in_rotation = false keeps a question out of standard, bonus,
--   checkup and review rounds (lib/buildRound.ts) while it still lives in
--   the main bank. The 60 questions below start out of rotation.
-- * A set is split into fixed rounds (practice_set_questions.round_no), so a
--   kid always sees "round 3 of 6" and the same round has the same questions.
-- * rounds.kind = 'practice' rounds never earn or lose points and are left
--   out of every report, the skill map, streaks, checkup and review.

alter table questions add column in_rotation boolean not null default true;

create table practice_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table practice_set_questions (
  set_id uuid not null references practice_sets (id) on delete cascade,
  question_id uuid not null references questions (id),
  round_no smallint not null check (round_no >= 1),
  position smallint not null check (position >= 0),
  primary key (set_id, question_id),
  unique (set_id, round_no, position)
);

create table practice_assignments (
  set_id uuid not null references practice_sets (id) on delete cascade,
  child_id uuid not null references children (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (set_id, child_id)
);

alter table rounds drop constraint rounds_kind_check;
alter table rounds add constraint rounds_kind_check check (kind in ('standard', 'review', 'checkup', 'practice'));
alter table rounds add column practice_set_id uuid references practice_sets (id) on delete set null;
alter table rounds add column practice_round_no smallint;

-- 60 logic questions: 6 rounds of 5 Level 1 then 5 Level 2.
with new_set as (
  insert into practice_sets (title, description)
  values ('Logic practice 1', '60 logic questions in 6 rounds of 10 (5 Level 1 + 5 Level 2). Written for school assessment practice.')
  returning id
),
v (round_no, position, level, skill_key, skill_step, question_text, options, correct_option_index, explanation) as (values
  (1, 0, 1, 'patterns', 1, 'What comes next? 5, 10, 15, 20, 25, ___', '["30","35","26","40"]', 0, 'Each number is 5 more than the one before it. 25 + 5 = 30.'),
  (1, 1, 1, 'ordering', 1, 'Riya is taller than Sam. Sam is taller than Tom. Who is the shortest?', '["Riya","Sam","Tom","They are all the same"]', 2, 'Riya is taller than Sam, and Sam is taller than Tom. So Tom is shorter than both of them.'),
  (1, 2, 1, 'odd_one_out', 1, 'Which one does not belong: Grapes, Papaya, Potato, Guava?', '["Grapes","Papaya","Potato","Guava"]', 2, 'Grapes, papaya and guava are fruits. A potato is a vegetable.'),
  (1, 3, 1, 'elimination', 1, 'A ball is hidden under one of three cups: red, blue or green. It is not under the red cup. It is not under the green cup. Where is the ball?', '["Under the red cup","Under the blue cup","Under the green cup","It is not under any cup"]', 1, 'Red and green are both ruled out, so the only cup left is the blue one.'),
  (1, 4, 1, 'if_then', 1, 'The shop is open every day except Sunday. Today is Sunday. Is the shop open today?', '["Yes","No","Only in the morning","Only in the evening"]', 1, 'The shop is closed on Sunday, and today is Sunday, so it is not open.'),
  (1, 5, 2, 'patterns', 1, 'What comes next? 1, 4, 9, 16, 25, ___', '["30","35","36","49"]', 2, 'These are square numbers: 1x1, 2x2, 3x3, 4x4, 5x5. Next is 6x6 = 36.'),
  (1, 6, 2, 'ordering', 2, 'Asha is older than Bina but younger than Chitra. Deepa is older than Chitra. Who is the youngest?', '["Asha","Bina","Chitra","Deepa"]', 1, 'From oldest to youngest: Deepa, Chitra, Asha, Bina. So Bina is the youngest.'),
  (1, 7, 2, 'odd_one_out', 1, 'Book is to library as painting is to ___?', '["Artist","Brush","Frame","Museum"]', 3, 'Books are kept for people to see in a library. Paintings are kept for people to see in a museum.'),
  (1, 8, 2, 'elimination', 1, 'A prize is in one of four boxes numbered 1, 2, 3 and 4. It is not in a box with an odd number. It is not in the box with the biggest number. Which box has the prize?', '["Box 1","Box 2","Box 3","Box 4"]', 1, 'Boxes 1 and 3 have odd numbers, so they are out. Box 4 has the biggest number, so it is out too. Only box 2 is left.'),
  (1, 9, 2, 'if_then', 2, 'A lamp lights up only when switch A and switch B are both ON. The lamp is OFF. Switch A is ON. What must switch B be?', '["ON","OFF","It could be either","Switch B is missing"]', 1, 'If B were ON too, both switches would be ON and the lamp would light. The lamp is off, so B must be OFF.'),
  (2, 0, 1, 'patterns', 1, 'What comes next? Red, Blue, Blue, Red, Blue, Blue, Red, ___', '["Red","Blue","Green","Yellow"]', 1, 'The pattern Red, Blue, Blue keeps repeating. After Red always comes Blue.'),
  (2, 1, 1, 'ordering', 1, 'In a race, Anu finished before Bala. Chetan finished after Bala. Who came last?', '["Anu","Bala","Chetan","Anu and Chetan tied"]', 2, 'The order is Anu, then Bala, then Chetan. So Chetan came last.'),
  (2, 2, 1, 'odd_one_out', 1, 'Cow is to calf as dog is to ___?', '["Kitten","Lamb","Cub","Puppy"]', 3, 'A baby cow is called a calf. A baby dog is called a puppy.'),
  (2, 3, 1, 'truth_lies', 1, 'Gopal always tells lies. Gopal says, "I am 10 years old." Is Gopal 10 years old?', '["Yes","No","Only on his birthday","Sometimes"]', 1, 'Everything Gopal says is false, so "I am 10" is false. Gopal is not 10.'),
  (2, 4, 1, 'codes', 1, 'In a secret code, each letter moves one step forward in the alphabet, so CAT is written as DBU. How is DOG written?', '["EPH","CNF","EPG","FPH"]', 0, 'Move each letter one step forward: D becomes E, O becomes P, G becomes H. So DOG is EPH.'),
  (2, 5, 2, 'patterns', 2, 'What comes next? 1, 2, 4, 7, 11, 16, ___', '["20","21","22","23"]', 2, 'The gaps grow by one each time: +1, +2, +3, +4, +5. The next gap is +6, so 16 + 6 = 22.'),
  (2, 6, 2, 'ordering', 2, 'In a line of children, Rohan is 7th from the front and 12th from the back. How many children are in the line?', '["17","18","19","20"]', 1, 'There are 6 children in front of Rohan and 11 behind him. 6 + 11 + Rohan himself = 18.'),
  (2, 7, 2, 'odd_one_out', 1, 'Which pair goes together in the same way as Bird : Fly?', '["Fish : Swim","Cat : Milk","Dog : Tail","Cow : Grass"]', 0, 'A bird moves by flying. A fish moves by swimming.'),
  (2, 8, 2, 'truth_lies', 1, 'Sonu says, "The sky is green." Riya says, "Sonu is lying." Is Riya telling the truth?', '["Yes","No","It cannot be told","Both are lying"]', 0, 'The sky is not green, so Sonu is lying. Riya said Sonu is lying, which is true.'),
  (2, 9, 2, 'codes', 1, 'If PENCIL is written in code as QFODJM, how is BOOK written in the same code?', '["CPPM","ANNJ","CQQL","CPPL"]', 3, 'Each letter moves one step forward: P to Q, E to F, and so on. So B to C, O to P, O to P, K to L gives CPPL.'),
  (3, 0, 1, 'patterns', 1, 'Find the missing number: 1, 3, 5, ___, 9, 11', '["6","7","8","10"]', 1, 'The numbers go up by 2 each time: 1, 3, 5, 7, 9, 11.'),
  (3, 1, 1, 'ordering', 1, 'A pencil is longer than a crayon. A crayon is longer than an eraser. Which is the longest?', '["The pencil","The crayon","The eraser","They are all the same"]', 0, 'The pencil is longer than the crayon, and the crayon is longer than the eraser. So the pencil is the longest.'),
  (3, 2, 1, 'odd_one_out', 1, 'Which number does not belong: 2, 4, 7, 8?', '["2","4","7","8"]', 2, '2, 4 and 8 are even numbers. 7 is an odd number.'),
  (3, 3, 1, 'elimination', 2, 'Ali, Ben and Chen each have one pet: a cat, a dog or a fish. Ali has the dog. Ben does not have the cat. What pet does Chen have?', '["The cat","The dog","The fish","No pet"]', 0, 'Ali has the dog. Ben cannot have the dog or the cat, so Ben has the fish. That leaves the cat for Chen.'),
  (3, 4, 1, 'counting', 2, 'Three children meet. Each one shakes hands once with each of the others. How many handshakes are there in all?', '["2","3","6","9"]', 1, 'Call them A, B and C. The handshakes are A-B, A-C and B-C. That is 3.'),
  (3, 5, 2, 'patterns', 2, 'Find the missing number: 3, 6, 12, ___, 48', '["18","20","24","36"]', 2, 'Each number is double the one before: 3, 6, 12, 24, 48.'),
  (3, 6, 2, 'ordering', 3, 'Five books are in a pile. The white book is at the top. The yellow book is just below the white book. The green book is at the very bottom. The red book is just above the blue book. Which book is in the middle of the pile?', '["Red","Blue","Yellow","Green"]', 0, 'From the top: white, then yellow. Green is at the bottom. Red and blue fill the two places left, with red just above blue. So the order is white, yellow, red, blue, green, and red is in the middle.'),
  (3, 7, 2, 'odd_one_out', 1, 'Which number does not belong: 9, 25, 30, 36?', '["9","25","30","36"]', 2, '9 is 3x3, 25 is 5x5 and 36 is 6x6. 30 cannot be made by multiplying a number by itself.'),
  (3, 8, 2, 'elimination', 2, 'Arun, Bela, Chirag and Diya each have a different favourite fruit: apple, banana, cherry or grape. Arun likes neither apple nor banana. Bela likes cherry. Diya does not like apple. Who likes apple?', '["Arun","Bela","Diya","Chirag"]', 3, 'Bela likes cherry. Arun cannot like apple, banana or cherry, so Arun likes grape. Diya cannot like apple, so Diya likes banana. Chirag is left with apple.'),
  (3, 9, 2, 'counting', 2, 'Four friends each shake hands with every other friend once. How many handshakes are there in all?', '["4","8","12","6"]', 3, 'The first friend shakes 3 hands, the second 2 new ones, the third 1 new one. 3 + 2 + 1 = 6.'),
  (4, 0, 1, 'patterns', 2, 'What comes next? AB, CD, EF, GH, ___', '["HI","IJ","IK","JK"]', 1, 'Each pair is the next two letters of the alphabet: AB, CD, EF, GH, then IJ.'),
  (4, 1, 1, 'ordering', 2, 'Five children stand in a line. Meera is 3rd from the front. What is her place counting from the back?', '["2nd","3rd","4th","5th"]', 1, 'There are 2 children in front of Meera and 2 behind her. So she is 3rd from the back too.'),
  (4, 2, 1, 'odd_one_out', 1, 'Pen is to write as knife is to ___?', '["Eat","Cook","Draw","Cut"]', 3, 'We use a pen to write, and we use a knife to cut.'),
  (4, 3, 1, 'if_then', 2, 'Rahul''s mother is Sita. Sita''s mother is Kamla. Who is Kamla to Rahul?', '["His aunt","His sister","His grandmother","His cousin"]', 2, 'Kamla is the mother of Rahul''s mother. Your mother''s mother is your grandmother.'),
  (4, 4, 1, 'truth_lies', 1, 'All the balls in a box are red. Maya takes one ball out of the box. What colour is it?', '["Blue","Red","Green","It cannot be told"]', 1, 'Every ball in the box is red, so any ball Maya takes out must be red.'),
  (4, 5, 2, 'patterns', 3, 'What comes next? 2, 6, 3, 9, 6, 18, ___', '["15","21","54","12"]', 0, 'The rule takes turns: times 3, then minus 3. 2x3=6, 6-3=3, 3x3=9, 9-3=6, 6x3=18, and next 18-3=15.'),
  (4, 6, 2, 'ordering', 2, 'Om scored the highest marks in a test. Kabir scored more than Leela. Mohan scored less than Leela but more than Nisha. Who came 3rd?', '["Kabir","Leela","Mohan","Nisha"]', 1, 'From highest to lowest: Om, Kabir, Leela, Mohan, Nisha. So Leela came 3rd.'),
  (4, 7, 2, 'if_then', 2, 'Aarav''s father is the only son of Mr. Rao. Who is Mr. Rao to Aarav?', '["His uncle","His father","His grandfather","His brother"]', 2, 'Mr. Rao is the father of Aarav''s father. Your father''s father is your grandfather.'),
  (4, 8, 2, 'truth_lies', 3, 'Ajay always lies and Bala always tells the truth. One of them says, "I am Bala." Who said it?', '["Ajay","Bala","It could be either of them","Neither of them could say it"]', 2, 'Bala would say "I am Bala" because it is true. Ajay would also say "I am Bala" because it is a lie. So either of them could have said it.'),
  (4, 9, 2, 'codes', 2, 'If A = 1, B = 2, C = 3 and so on, which word has the biggest total when you add up its letters?', '["BED","CAB","FED","DEAF"]', 3, 'BED = 2 + 5 + 4 = 11. CAB = 3 + 1 + 2 = 6. FED = 6 + 5 + 4 = 15. DEAF = 4 + 5 + 1 + 6 = 16, the biggest.'),
  (5, 0, 1, 'patterns', 1, 'What comes next? 3, 6, 9, 3, 6, 9, 3, ___', '["3","6","9","12"]', 1, 'The group 3, 6, 9 keeps repeating. After 3 always comes 6.'),
  (5, 1, 1, 'ordering', 2, 'Dev has more stickers than Zoya. Zoya has more stickers than Kiran. Kiran has more stickers than Pooja. Who has the second most stickers?', '["Dev","Kiran","Pooja","Zoya"]', 3, 'From most to fewest: Dev, Zoya, Kiran, Pooja. So Zoya has the second most.'),
  (5, 2, 1, 'elimination', 2, 'Mia, Noor and Om each like one colour: red, yellow or green. Mia does not like red or yellow. Noor does not like red. Who likes red?', '["Mia","Noor","Om","Nobody"]', 2, 'Mia must like green. Noor cannot like red or green, so Noor likes yellow. That leaves red for Om.'),
  (5, 3, 1, 'codes', 2, 'If A = 1, B = 2, C = 3, D = 4 and so on, what do the letters of BAD add up to?', '["6","7","8","9"]', 1, 'B = 2, A = 1 and D = 4. 2 + 1 + 4 = 7.'),
  (5, 4, 1, 'if_then', 3, 'Tina always wears her raincoat when it rains. Today Tina is not wearing her raincoat. What can you say?', '["It is raining","It is not raining","It is snowing","Tina has lost her raincoat"]', 1, 'If it were raining, Tina would be wearing her raincoat. She is not wearing it, so it cannot be raining.'),
  (5, 5, 2, 'odd_one_out', 2, 'Which word does not belong: Kilometre, Litre, Metre, Centimetre?', '["Kilometre","Litre","Metre","Centimetre"]', 1, 'Kilometre, metre and centimetre measure length. A litre measures how much liquid something holds.'),
  (5, 6, 2, 'if_then', 3, 'Pointing to a girl, Raju says, "She is the daughter of my mother''s only son." Who is the girl to Raju?', '["His sister","His daughter","His niece","His cousin"]', 1, 'Raju''s mother''s only son is Raju himself. So the girl is Raju''s own daughter.'),
  (5, 7, 2, 'elimination', 3, 'Three houses in a row are painted red, blue and green, in some order. The red house is not next to the green house. The green house is to the right of the blue house. What colour is the house on the far left?', '["Red","Blue","Green","It cannot be told"]', 0, 'Red and green are not next to each other, so blue must be in the middle. Green is to the right of blue, so green is on the far right, and red is on the far left.'),
  (5, 8, 2, 'counting', 2, 'A drawer has 3 red socks and 3 blue socks. In the dark, what is the fewest socks you must take out to be sure you have two of the same colour?', '["2","3","4","6"]', 1, 'With 2 socks you might get one red and one blue. The 3rd sock must match one of them. So 3 is enough.'),
  (5, 9, 2, 'codes', 2, 'In a code, the word MAT is written as TAM. How is PART written in the same code?', '["TRAP","RAPT","TARP","PRAT"]', 0, 'The code writes the word backwards. PART backwards is TRAP.'),
  (6, 0, 1, 'odd_one_out', 2, 'Which one does not belong: Eagle, Sparrow, Parrot, Bat?', '["Eagle","Sparrow","Parrot","Bat"]', 3, 'Eagles, sparrows and parrots are birds. A bat can fly, but it is not a bird.'),
  (6, 1, 1, 'if_then', 2, 'Ria''s father has only one child. Who is the daughter of Ria''s father?', '["Ria","Ria''s sister","Ria''s aunt","Nobody"]', 0, 'Ria''s father has just one child, and that child is Ria. So his daughter is Ria herself.'),
  (6, 2, 1, 'truth_lies', 2, 'Some cats are black. Kitty is a cat. Is Kitty black?', '["Yes, for sure","No, for sure","Maybe - we cannot be sure","Kitty is not a cat"]', 2, 'Only some cats are black, not all of them. Kitty might be black or might be another colour, so we cannot be sure.'),
  (6, 3, 1, 'elimination', 2, 'Ravi, Sona and Tara sit on chairs 1, 2 and 3. Sona sits on chair 3. Ravi is not on chair 1. Which chair is Tara on?', '["Chair 1","Chair 2","Chair 3","She is standing"]', 0, 'Sona has chair 3. Ravi is not on chair 1, so Ravi is on chair 2. That leaves chair 1 for Tara.'),
  (6, 4, 1, 'counting', 2, 'Priya has 2 shirts (red and blue) and 2 pants (black and brown). How many different outfits of one shirt and one pant can she make?', '["2","3","4","6"]', 2, 'Red with black, red with brown, blue with black, blue with brown. That is 4 outfits.'),
  (6, 5, 2, 'truth_lies', 2, 'All roses are flowers. Some flowers fade quickly. Which of these is surely true?', '["All roses fade quickly","Some roses fade quickly","No rose fades quickly","None of these is surely true"]', 3, 'The flowers that fade quickly might not be roses at all. So we cannot be sure about roses either way.'),
  (6, 6, 2, 'if_then', 2, 'Every student who finishes their homework gets a star. Neha did not get a star. What must be true?', '["Neha finished her homework","Neha did not finish her homework","Neha got two stars","Neha was not in school"]', 1, 'If Neha had finished her homework, she would have got a star. She did not get one, so she did not finish it.'),
  (6, 7, 2, 'elimination', 2, 'The Maths, Science and English tests are on Monday, Tuesday and Wednesday, one on each day. Science is not on Monday. English is the day after Science. Which test is on Monday?', '["Maths","Science","English","It cannot be told"]', 0, 'Science cannot be on Wednesday, because English comes the day after it. So Science is on Tuesday and English on Wednesday. Maths is on Monday.'),
  (6, 8, 2, 'counting', 3, 'How many numbers from 1 to 30 have the digit 3 in them?', '["3","4","5","6"]', 1, 'They are 3, 13, 23 and 30. That is 4 numbers. Do not forget 30!'),
  (6, 9, 2, 'lateral', 2, 'It takes 5 minutes to boil 1 egg. How long does it take to boil 3 eggs together in the same pot?', '["5 minutes","10 minutes","15 minutes","3 minutes"]', 0, 'All three eggs boil at the same time in the same pot, so it still takes 5 minutes.')
),
inserted as (
  insert into questions (level, category, question_text, options, correct_option_index, explanation, skill_key, skill_step, in_rotation)
  select level, 'logic', question_text, options::jsonb, correct_option_index, explanation, skill_key, skill_step, false
  from v
  returning id, question_text
)
insert into practice_set_questions (set_id, question_id, round_no, position)
select new_set.id, inserted.id, v.round_no::smallint, v.position::smallint
from new_set, inserted join v on v.question_text = inserted.question_text;
