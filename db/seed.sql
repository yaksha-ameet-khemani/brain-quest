-- Curated logic / riddle / spatial question bank.
-- Run this after schema.sql. Every answer below has been worked through by
-- hand - see docs/blueprint.md if you want the worked reasoning restated.
-- Math questions are NOT seeded here; they're generated at request time by
-- lib/mathQuestions.ts so that category never runs out of variety.

-- ---------------------------------------------------------------------------
-- Level 1 (younger group)
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(1, 'logic', 'Alex is taller than Sam. Sam is taller than Chris. Who is the shortest?', '["Alex", "Sam", "Chris", "They are equal"]', 2, 'Since Alex > Sam and Sam > Chris, Chris is the shortest.'),
(1, 'logic', 'Ben finishes his race before Cara. Cara finishes before Dan. Who finishes last?', '["Ben", "Cara", "Dan", "It is a tie"]', 2, 'Ben before Cara, Cara before Dan, so the order is Ben, Cara, Dan. Dan finishes last.'),
(1, 'riddle', 'What has hands but cannot clap?', '["A clock", "A glove", "A statue", "A tree"]', 0, 'A clock has hour and minute hands, but it cannot clap them together.'),
(1, 'riddle', 'I have keys but no locks. I have space but no room. You can enter, but you cannot go inside. What am I?', '["A keyboard", "A house", "A piano", "A map"]', 0, 'A keyboard has keys and a space bar, and you press "Enter" on it, but there is no real room.'),
(1, 'riddle', 'The more you take, the more you leave behind. What am I?', '["Footsteps", "Shadow", "Money", "Time"]', 0, 'Each step you take leaves a footprint behind you.'),
(1, 'spatial', 'Which direction is opposite to North?', '["East", "South", "West", "Up"]', 1, 'North and South are opposite directions on a compass.'),
(1, 'spatial', 'Which of these shapes has no straight sides at all?', '["Square", "Triangle", "Circle", "Rectangle"]', 2, 'A circle is made entirely of one curved line - it has no straight sides.'),
(1, 'spatial', 'Which shape has exactly 3 sides?', '["Square", "Triangle", "Pentagon", "Hexagon"]', 1, 'A triangle always has exactly 3 sides and 3 corners.'),
(1, 'logic', 'If today is Monday, what day will it be in 3 days?', '["Wednesday", "Thursday", "Friday", "Tuesday"]', 1, 'Monday + 3 days: Tuesday, Wednesday, Thursday. It will be Thursday.'),
(1, 'logic', 'Which number breaks the pattern: 2, 4, 6, 7, 8?', '["2", "7", "6", "8"]', 1, 'All the other numbers are even. 7 is the only odd number.'),
(1, 'logic', 'Which one does not belong with the others: Apple, Banana, Carrot, Mango?', '["Apple", "Banana", "Carrot", "Mango"]', 2, 'Apple, Banana, and Mango are fruits. Carrot is a vegetable.'),
(1, 'riddle', 'I am full of holes, but I can still hold water. What am I?', '["A sponge", "A bucket", "A net", "A bottle"]', 0, 'A sponge is full of tiny holes but soaks up and holds water anyway.'),
(1, 'logic', 'What comes next in the pattern: Circle, Square, Circle, Square, ___?', '["Circle", "Square", "Triangle", "Star"]', 0, 'The pattern alternates Circle, Square, repeating. After Square comes Circle again.'),
(1, 'riddle', 'What can you catch but not throw?', '["A cold", "A ball", "A fish", "A kite"]', 0, 'You can "catch" a cold (get sick), but you cannot throw it to someone.'),
(1, 'spatial', 'Which shape has four sides that are all equal in length?', '["Square", "Rectangle", "Triangle", "Circle"]', 0, 'A square has 4 sides, and all 4 are the same length.');

-- ---------------------------------------------------------------------------
-- Level 2 (older group)
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(2, 'logic', 'Maya is older than Noah. Noah is older than Liam. Liam is older than Chloe. Who is the second oldest?', '["Maya", "Noah", "Liam", "Chloe"]', 1, 'The order from oldest to youngest is Maya, Noah, Liam, Chloe - so Noah is second oldest.'),
(2, 'logic', 'Four friends (Maya, Liam, Noah, Chloe) play different instruments: Piano, Flute, Drums, Violin. Maya does not play strings or keys. Liam plays Piano. Noah does not play Violin. Who plays the Violin?', '["Maya", "Noah", "Chloe", "Liam"]', 2, 'Liam = Piano. Maya cannot play Violin (strings) or Piano (keys), so Maya plays Flute or Drums. Noah does not play Violin either, so Noah also plays Flute or Drums. That leaves Violin for Chloe.'),
(2, 'logic', 'If 6 cats can catch 6 mice in 6 minutes, how many cats are needed to catch 100 mice in 50 minutes?', '["12 cats", "100 cats", "6 cats", "50 cats"]', 0, '1 cat catches 1 mouse every 6 minutes, so in 50 minutes one cat catches 50/6 mice. To catch 100 mice: 100 / (50/6) = 12 cats.'),
(2, 'riddle', 'What has a head and a tail but no body?', '["A coin", "A snake", "A hammer", "A river"]', 0, 'A coin has a "heads" side and a "tails" side, but no body at all.'),
(2, 'riddle', 'I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?', '["An echo", "A ghost", "The wind itself", "A dream"]', 0, 'An echo "speaks back" your own words and only happens when sound bounces - it has no body of its own.'),
(2, 'logic', 'All Bloops are Razzies. All Razzies are Lazzies. Are all Bloops definitely Lazzies?', '["Yes, definitely", "No", "Cannot be determined", "Only sometimes"]', 0, 'Since every Bloop is a Razzy, and every Razzy is a Lazzy, every Bloop must also be a Lazzy.'),
(2, 'logic', 'A is B''s father. B is C''s father. What is A to C?', '["Grandfather", "Uncle", "Father", "Brother"]', 0, 'A is the father of B, and B is the father of C, so A is C''s grandfather.'),
(2, 'logic', 'Five houses stand in a row. The red house is immediately to the left of the blue house. The blue house is 3rd in the row. Which position is the red house in?', '["1st", "2nd", "4th", "5th"]', 1, 'If the blue house is 3rd and red is immediately to its left, red must be 2nd.'),
(2, 'spatial', 'How many faces does a cube have?', '["4", "6", "8", "12"]', 1, 'A cube has 6 square faces.'),
(2, 'spatial', 'How many edges does a cube have?', '["8", "10", "12", "6"]', 2, 'A cube has 12 edges - 4 on the top face, 4 on the bottom face, and 4 connecting them vertically.'),
(2, 'riddle', 'The more of this there is, the less you can see. What is it?', '["Darkness", "Fog", "Smoke", "Silence"]', 0, 'As darkness increases, visibility decreases - the more darkness, the less you can see.'),
(2, 'logic', 'A bag has 3 red balls and 2 blue balls. If you pick one ball without looking, what is the probability it is red?', '["3/5", "2/5", "1/2", "2/3"]', 0, 'There are 5 balls total, 3 of which are red, so the probability is 3/5.'),
(2, 'logic', 'What comes next in the pattern: 2, 6, 18, 54, ___?', '["162", "108", "216", "180"]', 0, 'Each number is multiplied by 3. 54 x 3 = 162.'),
(2, 'logic', 'If 5 machines take 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?', '["5 minutes", "100 minutes", "20 minutes", "50 minutes"]', 0, 'Each machine makes 1 widget in 5 minutes regardless of how many machines there are - so 100 machines make 100 widgets in the same 5 minutes.'),
(2, 'logic', 'A farmer has 17 sheep. All but 9 run away. How many sheep does the farmer have left?', '["8", "9", "17", "0"]', 1, '"All but 9 run away" means 9 sheep did NOT run away - so 9 are left.');

-- ---------------------------------------------------------------------------
-- Starter reward catalog - matches lib/config.ts DEFAULT_REWARDS. Edit freely
-- from the parent dashboard afterwards; this is just a sensible starting point.
-- ---------------------------------------------------------------------------
insert into rewards (name, cost, emoji) values
('Small snack or ice cream', 50, '🍦'),
('30 minutes extra screen time', 50, '📺'),
('Pick tonight''s dinner', 80, '🍽️'),
('Outing to the park or playground', 150, '🛝'),
('Movie night pick', 150, '🎬'),
('A favourite toy or small game', 500, '🎁'),
('Special day outing', 500, '🎉');
