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

-- ---------------------------------------------------------------------------
-- Expansion to 20 questions per (level, category) bucket - see
-- db/migrations/004_expand_question_bank.sql for the changelog entry.
-- ---------------------------------------------------------------------------
-- content to). No overlap in riddle answers with the existing seed.sql set,
-- and none between the level 1 and level 2 riddles added here either.

-- ---------------------------------------------------------------------------
-- Level 1 logic (+14, from 6 to 20)
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(1, 'logic', 'Priya has more stickers than Zoe. Zoe has more than Tom. Who has the fewest stickers?', '["Priya", "Zoe", "Tom", "They are equal"]', 2, 'Priya > Zoe > Tom, so Tom has the fewest.'),
(1, 'logic', 'Three kids stand in a line. Amy is behind Ben. Ben is behind Carl. Who is first in line?', '["Amy", "Ben", "Carl", "Cannot tell"]', 2, 'The order from front to back is Carl, Ben, Amy - so Carl is first.'),
(1, 'logic', 'Mia is younger than Noah. Noah is younger than Priya. Who is the oldest?', '["Mia", "Noah", "Priya", "They are equal"]', 2, 'Mia < Noah < Priya in age, so Priya is the oldest.'),
(1, 'logic', 'If today is Wednesday, what day was it 2 days ago?', '["Sunday", "Monday", "Tuesday", "Thursday"]', 1, 'Counting back 2 days from Wednesday: Tuesday, then Monday.'),
(1, 'logic', 'Yesterday was Friday. What day is tomorrow?', '["Saturday", "Sunday", "Monday", "Friday"]', 1, 'If yesterday was Friday, today is Saturday, so tomorrow is Sunday.'),
(1, 'logic', 'All dogs bark. Rex is a dog. Does Rex bark?', '["Yes", "No", "Only sometimes", "Cannot tell"]', 0, 'Since all dogs bark and Rex is a dog, Rex must bark.'),
(1, 'logic', 'Which number is missing: 1, 2, ___, 4, 5?', '["6", "3", "9", "0"]', 1, 'Counting up by 1 each time, the missing number between 2 and 4 is 3.'),
(1, 'logic', 'Which one does not belong: Car, Bus, Train, Apple?', '["Car", "Bus", "Train", "Apple"]', 3, 'Car, Bus, and Train are all vehicles. Apple is a fruit.'),
(1, 'logic', 'Which one is not a shape: Circle, Square, Monday, Triangle?', '["Circle", "Square", "Monday", "Triangle"]', 2, 'Circle, Square, and Triangle are shapes. Monday is a day of the week.'),
(1, 'logic', 'If it is raining, Mom brings an umbrella. It is raining right now. What does Mom bring?', '["A hat", "An umbrella", "Sunglasses", "Nothing"]', 1, 'The rule says rain means Mom brings an umbrella, and it is raining, so she brings an umbrella.'),
(1, 'logic', 'What comes next in the pattern: A, B, C, ___?', '["A", "D", "C", "E"]', 1, 'The pattern follows the alphabet in order, so after C comes D.'),
(1, 'logic', 'Block A weighs more than Block B. Block B weighs more than Block C. Which block is the lightest?', '["Block A", "Block B", "Block C", "They weigh the same"]', 2, 'A > B > C in weight, so Block C is the lightest.'),
(1, 'logic', 'Sam always tells the truth. Sam says, "It is sunny today." Is it sunny today?', '["Yes", "No", "Cannot tell", "Only in summer"]', 0, 'Since Sam always tells the truth, whatever Sam says is true - so it is sunny.'),
(1, 'logic', 'Which one is not a fruit: Grape, Orange, Potato, Banana?', '["Grape", "Orange", "Potato", "Banana"]', 2, 'Grape, Orange, and Banana are fruits. Potato is a vegetable.');

-- ---------------------------------------------------------------------------
-- Level 1 riddle (+15, from 5 to 20)
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(1, 'riddle', 'What gets wetter the more it dries?', '["A towel", "The sun", "A fire", "Sand"]', 0, 'A towel dries other things by soaking up water, which makes the towel itself wetter.'),
(1, 'riddle', 'What has to be broken before you can use it?', '["A key", "An egg", "A promise", "A rule"]', 1, 'You have to crack an egg open before you can cook or eat it.'),
(1, 'riddle', 'What goes up but never comes down?', '["A balloon", "Your age", "The sun", "A kite"]', 1, 'Your age only ever increases - it never goes back down.'),
(1, 'riddle', 'What has one eye but cannot see?', '["A needle", "A potato", "A storm", "A doll"]', 0, 'A sewing needle has an "eye" (the hole for thread) but cannot actually see.'),
(1, 'riddle', 'What can travel all around the world while staying stuck in one corner?', '["A map", "A stamp", "A coin", "A key"]', 1, 'A postage stamp travels the world on letters while staying stuck in the corner of the envelope.'),
(1, 'riddle', 'What has many teeth but cannot bite?', '["A comb", "A saw", "A shark", "A zipper"]', 0, 'A comb has a row of teeth for combing hair, but they cannot bite anything.'),
(1, 'riddle', 'What has a neck but no head?', '["A shirt", "A bottle", "A giraffe", "A road"]', 1, 'A bottle has a narrow "neck" near its top, but no head.'),
(1, 'riddle', 'What kind of room has no doors and no windows?', '["A tent", "A cave", "A mushroom", "A box"]', 2, 'A mushroom has a cap shaped like a "room," but obviously no real doors or windows - it is a classic riddle.'),
(1, 'riddle', 'What has a bed but never sleeps in it?', '["A hotel", "A river", "A hospital", "A dream"]', 1, 'A river flows over its "riverbed," but a river never actually sleeps.'),
(1, 'riddle', 'What is easy to get into, but hard to get out of?', '["A pool", "Trouble", "A car", "A book"]', 1, 'Getting into trouble is easy, but getting out of it is often much harder.'),
(1, 'riddle', 'What has a thumb and four fingers but is not alive?', '["A robot", "A glove", "A puppet", "A statue"]', 1, 'A glove is shaped like a hand with a thumb and four fingers, but it is not alive.'),
(1, 'riddle', 'Which month of the year has 28 days?', '["February", "December", "All of them", "January"]', 2, 'Every month has at least 28 days - February just does not have any more than that in a normal year.'),
(1, 'riddle', 'What has legs but cannot walk?', '["A table", "A snake", "A worm", "A shadow"]', 0, 'A table has legs to stand on, but it cannot walk anywhere.'),
(1, 'riddle', 'What goes through cities and fields but never moves itself?', '["A car", "A road", "A river", "A train"]', 1, 'A road passes through cities and fields, but the road itself stays still.'),
(1, 'riddle', 'The more air it gets, the bigger it grows - until it might even pop. What is it?', '["A balloon", "A cloud", "A bubble", "A tire"]', 0, 'A balloon grows bigger as more air is blown into it, and can pop if it gets too full.');

-- ---------------------------------------------------------------------------
-- Level 1 spatial (+16, from 4 to 20)
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(1, 'spatial', 'How many corners does a triangle have?', '["2", "3", "4", "5"]', 1, 'A triangle always has exactly 3 corners (and 3 sides).'),
(1, 'spatial', 'How many sides does a hexagon have?', '["5", "6", "7", "8"]', 1, 'A hexagon has 6 sides.'),
(1, 'spatial', 'Which direction is opposite to East?', '["North", "South", "West", "Up"]', 2, 'East and West are opposite directions on a compass.'),
(1, 'spatial', 'If you are facing North and turn left twice, which direction do you face?', '["North", "East", "South", "West"]', 2, 'Turning left once from North faces West; turning left again faces South.'),
(1, 'spatial', 'Which shape has 4 sides, but they are not all the same length?', '["Square", "Rectangle", "Triangle", "Pentagon"]', 1, 'A rectangle has 4 sides, but only opposite sides match in length, unlike a square.'),
(1, 'spatial', 'Each flat face of a cube is what shape?', '["Circle", "Triangle", "Square", "Pentagon"]', 2, 'Every face of a cube is a square.'),
(1, 'spatial', 'How many corners (vertices) does a cube have?', '["4", "6", "8", "10"]', 2, 'A cube has 8 corners.'),
(1, 'spatial', 'Which shape has 6 equal sides?', '["Pentagon", "Hexagon", "Square", "Rectangle"]', 1, 'A regular hexagon has 6 equal sides.'),
(1, 'spatial', 'On a map, if North is at the top, which direction is at the bottom?', '["East", "West", "South", "North"]', 2, 'South is always opposite North, so it is at the bottom when North is at the top.'),
(1, 'spatial', 'Which shape has exactly 5 sides?', '["Square", "Hexagon", "Pentagon", "Triangle"]', 2, 'A pentagon has 5 sides.'),
(1, 'spatial', 'How many sides does a rectangle have?', '["3", "4", "5", "6"]', 1, 'A rectangle has 4 sides.'),
(1, 'spatial', 'Which is larger: a square with 4 cm sides, or a square with 6 cm sides?', '["The 4 cm square", "The 6 cm square", "They are the same size", "Cannot tell"]', 1, 'A bigger side length means a bigger square, so the 6 cm square is larger.'),
(1, 'spatial', 'Which direction is opposite to West?', '["North", "South", "East", "Down"]', 2, 'West and East are opposite directions on a compass.'),
(1, 'spatial', 'How many corners does a rectangle have?', '["2", "3", "4", "5"]', 2, 'A rectangle has 4 corners.'),
(1, 'spatial', 'If you are facing South and turn right, which direction do you face?', '["East", "West", "North", "South"]', 1, 'Turning right (clockwise) from South faces West.'),
(1, 'spatial', 'Which has more sides: a pentagon or a square?', '["A pentagon", "A square", "They are equal", "Neither has sides"]', 0, 'A pentagon has 5 sides, while a square only has 4.');

-- ---------------------------------------------------------------------------
-- Level 2 logic (+10, from 10 to 20)
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(2, 'logic', 'Five racers finish a race. Priya finishes before Raj. Raj finishes before Sam. Sam finishes before Tia. Who finishes last among these four?', '["Priya", "Raj", "Sam", "Tia"]', 3, 'The finishing order is Priya, Raj, Sam, Tia - so Tia finishes last of the four.'),
(2, 'logic', 'All squares are rectangles. This shape is a square. Is it definitely a rectangle?', '["Yes", "No", "Only sometimes", "Cannot tell"]', 0, 'Since every square is a rectangle by definition, a shape that is a square must also be a rectangle.'),
(2, 'logic', 'No fish can fly. A shark is a fish. Can a shark fly?', '["Yes", "No", "Only young sharks", "Cannot tell"]', 1, 'Since no fish can fly and a shark is a fish, a shark cannot fly.'),
(2, 'logic', 'What comes next in the pattern: 1, 1, 2, 3, 5, 8, ___?', '["11", "12", "13", "10"]', 2, 'Each number is the sum of the two before it (the Fibonacci sequence): 5 + 8 = 13.'),
(2, 'logic', 'A is older than B. C is older than A. Who is the oldest of the three?', '["A", "B", "C", "Cannot tell"]', 2, 'Since C > A and A > B, the order is C > A > B, making C the oldest.'),
(2, 'logic', 'A train leaves the station at 3:00 and takes 2 hours to reach its destination. What time does it arrive?', '["4:00", "5:00", "5:30", "6:00"]', 1, '3:00 plus 2 hours of travel time is 5:00.'),
(2, 'logic', 'You have 3 identical-looking coins; exactly one is fake and lighter than the other two. You weigh Coin A against Coin B on a balance scale and they balance exactly. Which coin is fake?', '["Coin A", "Coin B", "Coin C", "None of them"]', 2, 'If A and B balance, neither is lighter, so the untested Coin C must be the fake, lighter one.'),
(2, 'logic', 'All Zargons are Blips. Some Blips are Wumps. Are all Zargons definitely Wumps?', '["Yes, definitely", "No, never", "Cannot be determined", "Only sometimes"]', 2, 'Every Zargon is a Blip, but only *some* Blips are Wumps - there is no guarantee the Zargons fall into that "some," so it cannot be determined from the given facts.'),
(2, 'logic', 'In a race, Meera finished 2 places behind Arjun. Arjun finished 3rd. What place did Meera finish?', '["1st", "4th", "5th", "6th"]', 2, '2 places behind 3rd place is 3 + 2 = 5th place.'),
(2, 'logic', 'Three friends - Alex, Blair, and Casey - sit in a row of 3 seats. Alex is not sitting at either end. Who is sitting in the middle seat?', '["Alex", "Blair", "Casey", "Cannot tell"]', 0, 'With only 3 seats, "not at either end" leaves only the middle seat, so Alex must be in the middle.');

-- ---------------------------------------------------------------------------
-- Level 2 riddle (+17, from 3 to 20)
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(2, 'riddle', 'What has a spine but no bones?', '["A cactus", "A book", "A snake", "A fish"]', 1, 'A book has a "spine" along its bound edge, but it contains no actual bones.'),
(2, 'riddle', 'What can you break without ever touching it?', '["A promise", "Glass", "A record", "Silence"]', 0, 'You can break a promise just by not keeping your word, with no physical touching involved.'),
(2, 'riddle', 'What can fill an entire room but takes up no physical space?', '["Water", "Furniture", "Light", "Air"]', 2, 'Light can fill a room and reach every corner, without taking up any physical space itself.'),
(2, 'riddle', 'What has many keys but cannot open a single lock?', '["A piano", "A keyring", "A locksmith", "A safe"]', 0, 'A piano has many keys for playing music, but none of them open locks.'),
(2, 'riddle', 'What word begins with an "E", ends with an "E", but usually only contains one letter?', '["Eye", "Envelope", "Edge", "Eagle"]', 1, 'An envelope begins and ends with "E," and typically holds a single letter inside it.'),
(2, 'riddle', 'What is always right in front of you, but you can never actually see it?', '["A mirror", "The future", "The horizon", "Your nose"]', 1, 'The future is always ahead of you in time, but it can never actually be seen before it happens.'),
(2, 'riddle', 'What word, no matter how you spell it, is always spelled wrong?', '["Wrong", "Write", "Right", "Rong"]', 0, 'The word "wrong" is literally spelled w-r-o-n-g, so saying "it is spelled wrong" describes it correctly - it is a play on words.'),
(2, 'riddle', 'The more you take away from it, the bigger it gets. What is it?', '["A hole", "A debt", "A shadow", "A crowd"]', 0, 'Digging more out of a hole makes the hole itself larger.'),
(2, 'riddle', 'What kind of band never plays any music?', '["A jazz band", "A rubber band", "A marching band", "A wedding band"]', 1, 'A rubber band is just a stretchy loop - it has nothing to do with playing music.'),
(2, 'riddle', 'What has a ring, but no finger to wear it on?', '["A telephone", "A tree trunk", "A boxing match", "A bell"]', 0, 'A (ringing) telephone has a "ring," but obviously no finger.'),
(2, 'riddle', 'What can be cracked, made, told, and played, but is not a physical object?', '["A game", "A joke", "A code", "A song"]', 1, 'You can crack a joke, make a joke, tell a joke, and play a practical joke.'),
(2, 'riddle', 'What invention lets you see clearly through a solid wall?', '["A telescope", "A window", "A mirror", "A camera"]', 1, 'A window is built right into a wall, letting you see straight through it.'),
(2, 'riddle', 'What goes up and down constantly, but never actually moves from its place?', '["An elevator", "A staircase", "A see-saw", "A flag"]', 1, 'A staircase itself stays fixed in place, even though people go up and down it constantly.'),
(2, 'riddle', 'What is so fragile that even saying its name can break it?', '["Silence", "Glass", "Ice", "Trust"]', 0, 'The moment you speak and break the quiet, you have broken the silence.'),
(2, 'riddle', 'What can you hold in your hands without ever actually touching it?', '["Your breath", "A cloud", "Fire", "Water"]', 0, 'You can hold your breath, which does not involve touching anything physical.'),
(2, 'riddle', 'What has cities but no houses, forests but no trees, and rivers but no water?', '["A globe", "A map", "A dream", "A story"]', 1, 'A map shows cities, forests, and rivers, but only as drawings - none of the real things are actually there.'),
(2, 'riddle', 'What shows your face, but is not alive and has no eyes of its own?', '["A photograph", "A mirror", "A statue", "A mask"]', 1, 'A mirror reflects your face back at you, without being alive or having eyes.');

-- ---------------------------------------------------------------------------
-- Level 2 spatial (+18, from 2 to 20)
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(2, 'spatial', 'How many faces does a rectangular box (cuboid) have?', '["4", "6", "8", "12"]', 1, 'A cuboid, like a cube, has 6 rectangular faces.'),
(2, 'spatial', 'How many vertices (corners) does a cube have?', '["6", "8", "10", "12"]', 1, 'A cube has 8 corners.'),
(2, 'spatial', 'How many edges does a rectangular box (cuboid) have?', '["6", "8", "10", "12"]', 3, 'A cuboid has 12 edges, just like a cube.'),
(2, 'spatial', 'How many degrees are there in a right angle?', '["45", "90", "180", "360"]', 1, 'A right angle measures exactly 90 degrees.'),
(2, 'spatial', 'How many degrees are there in a full circle?', '["90", "180", "270", "360"]', 3, 'A full circle measures 360 degrees.'),
(2, 'spatial', 'If you rotate a square by 90 degrees, what shape do you get?', '["A square", "A rectangle", "A different shape entirely", "A circle"]', 0, 'A square looks identical after any 90-degree rotation - it is still a square.'),
(2, 'spatial', 'A clock shows exactly 3:00. What is the angle between the hour hand and the minute hand?', '["45 degrees", "90 degrees", "120 degrees", "180 degrees"]', 1, 'At 3:00, the hour hand points at 3 and the minute hand points at 12 - exactly a quarter of the clock apart, which is 90 degrees.'),
(2, 'spatial', 'How many lines of symmetry does a square have?', '["1", "2", "4", "8"]', 2, 'A square has 4 lines of symmetry: 2 through the midpoints of opposite sides, and 2 through opposite corners.'),
(2, 'spatial', 'How many lines of symmetry does a perfect circle have?', '["1", "2", "4", "Infinite"]', 3, 'A circle can be folded along any line through its center and match perfectly, giving it infinite lines of symmetry.'),
(2, 'spatial', 'If you are facing East and turn 180 degrees, which direction do you face?', '["North", "South", "West", "East"]', 2, 'Turning 180 degrees is a full half-turn, which always faces the exact opposite direction - West is opposite East.'),
(2, 'spatial', 'If you are facing North and turn 90 degrees clockwise, which direction do you face?', '["East", "South", "West", "North"]', 0, 'Turning 90 degrees clockwise from North faces East.'),
(2, 'spatial', 'Which 3D shape has one flat circular face, one curved surface, and comes to a point?', '["A cylinder", "A cone", "A sphere", "A pyramid"]', 1, 'A cone has a single circular base, a curved side, and tapers to a point at the top.'),
(2, 'spatial', 'Which 3D shape has no flat faces at all?', '["A cube", "A cone", "A sphere", "A pyramid"]', 2, 'A sphere is perfectly round all over, with no flat faces.'),
(2, 'spatial', 'A regular pentagon has how many lines of symmetry?', '["3", "4", "5", "6"]', 2, 'A regular pentagon has 5 lines of symmetry, one through each vertex and the midpoint of the opposite side.'),
(2, 'spatial', 'How many right angles does a rectangle have?', '["1", "2", "4", "0"]', 2, 'All four corners of a rectangle are right angles, so it has 4.'),
(2, 'spatial', 'If two straight lines never meet no matter how far they extend, what are they called?', '["Perpendicular lines", "Parallel lines", "Intersecting lines", "Diagonal lines"]', 1, 'Lines that never meet, staying the same distance apart forever, are called parallel lines.'),
(2, 'spatial', 'What do you call two lines that cross each other at a right angle (90 degrees)?', '["Parallel lines", "Perpendicular lines", "Curved lines", "Diagonal lines"]', 1, 'Lines that cross at exactly 90 degrees are called perpendicular lines.'),
(2, 'spatial', 'A triangle has three angles that each measure 60 degrees. What type of triangle is it?', '["Right triangle", "Isosceles triangle", "Equilateral triangle", "Scalene triangle"]', 2, 'A triangle with all three angles equal (60 degrees each) also has all three sides equal - that makes it equilateral.');

-- ---------------------------------------------------------------------------
-- Level 3 (most advanced group) - added later; see db/migrations/008 and
-- docs/blueprint.md for how this content was authored and duplicate-checked.
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(3, 'logic', 'Four friends - Dev, Priya, Raj, and Sana - are ranked 1st to 4th in a race. Dev finished right after Priya. Raj finished before Priya. Sana finished last. Who finished first?', '["Raj","Priya","Dev","Sana"]', 0, 'Raj finished before Priya, and Dev finished right after Priya, so the order is Raj, Priya, Dev, then Sana last - Raj is first.'),
(3, 'logic', 'A bag has 4 red balls and 6 blue balls. If you pick one ball without looking, what is the probability it is red?', '["2/5","1/2","3/5","1/4"]', 0, '4 red out of 10 total balls = 4/10, which simplifies to 2/5.'),
(3, 'logic', 'All Woggles are Zibbits. No Zibbits are Plunk. Is it possible for a Woggle to be a Plunk?', '["Yes, always","No, never","Only sometimes","Cannot be determined"]', 1, 'Every Woggle is a Zibbit, and no Zibbit is a Plunk, so no Woggle can possibly be a Plunk.'),
(3, 'logic', 'If today is Tuesday, what day of the week will it be in 100 days?', '["Wednesday","Thursday","Friday","Saturday"]', 1, '100 divided by 7 leaves a remainder of 2, so 100 days from Tuesday lands 2 days later: Thursday.'),
(3, 'logic', 'A store sells notebooks for $3 each, with a deal: buy 2, get 1 free. How much do 6 notebooks cost under this deal?', '["$12","$15","$18","$9"]', 0, 'With buy-2-get-1-free, every 3 notebooks only costs 2. For 6 notebooks (two groups of 3), you pay for 4: 4 x $3 = $12.'),
(3, 'logic', 'In a class of 30 students, 18 like math and 15 like science. 8 students like both. How many students like neither?', '["5","8","10","7"]', 0, '18 + 15 - 8 = 25 students like at least one subject (the 8 who like both are not double-counted). 30 - 25 = 5 like neither.'),
(3, 'logic', 'A cipher shifts every letter forward by 2 (A to C, B to D, and so on). The word ICOG was encoded this way. What is the original word?', '["GAME","GATE","CODE","GAZE"]', 0, 'Shifting each letter of ICOG back by 2: I to G, C to A, O to M, G to E, giving GAME.'),
(3, 'logic', 'Ravi is twice as old as his sister Meera. In 5 years, Ravi will be 25. How old is Meera right now?', '["10","15","8","12"]', 0, 'In 5 years Ravi will be 25, so Ravi is 20 now. Since Ravi is twice Meera''s age, Meera is 20 / 2 = 10.'),
(3, 'logic', 'Three boxes are labeled Apples, Oranges, and Mixed - but all three labels are wrong. You may pick one fruit from one box to figure out the true contents of all three. Which box should you pick from?', '["Apples","Oranges","Mixed","Any box works"]', 2, 'Since every label is wrong, the box labeled Mixed cannot actually be mixed - it must be all one fruit. Picking from it reveals the truth, and from there the wrong labels on the other two boxes give themselves away.'),
(3, 'logic', 'A frog is at the bottom of a 10-meter well. Each day it climbs up 3 meters, but each night it slides back 2 meters. On which day does it first reach the top?', '["Day 7","Day 8","Day 9","Day 10"]', 1, 'Each full day-night cycle gains 1 meter net (climb 3, slide back 2). After 7 nights the frog is at 7m; on day 8 it climbs from 7m to 10m and reaches the top before sliding back.'),
(3, 'logic', 'Five houses stand in a row, numbered 1 to 5 left to right. The red house is house 1. The blue house is house 3. The green house is immediately left of the blue house. Which house is green?', '["House 1","House 2","House 4","House 5"]', 1, 'The blue house is house 3, and green is immediately to its left, so green is house 2.'),
(3, 'logic', 'If all Krobs are Flurbs, and some Flurbs are Nix, can we be sure that some Krobs are Nix?', '["Yes, definitely","No, cannot be sure","No, definitely not","Only if all Flurbs are Nix"]', 1, 'All Krobs are Flurbs, but only SOME Flurbs are Nix - there is no guarantee any Krob falls into that some, so we cannot be sure.'),
(3, 'logic', 'At 4:00 on a standard clock, what is the angle between the hour hand and the minute hand?', '["90 degrees","100 degrees","120 degrees","150 degrees"]', 2, 'At 4:00 the minute hand points at 12 (0 degrees) and the hour hand points at the 4 (4 x 30 degrees = 120 degrees), so the angle between them is 120 degrees.'),
(3, 'logic', 'In a race, Arjun beats Priya, and Priya beats Kabir. If the race had no ties, who definitely finished last among these three?', '["Arjun","Priya","Kabir","Cannot tell"]', 2, 'Arjun finished ahead of Priya, and Priya finished ahead of Kabir, so the order is Arjun, then Priya, then Kabir - Kabir is last.'),
(3, 'logic', 'A jar has only red and green marbles. There are 3 times as many red marbles as green. If there are 8 green marbles, how many marbles are in the jar in total?', '["24","32","28","20"]', 1, 'Red marbles = 3 x 8 = 24. Total = 24 red + 8 green = 32.'),
(3, 'logic', 'What is the next number in this sequence: 2, 6, 12, 20, 30, ___?', '["40","42","36","44"]', 1, 'The differences between terms increase by 2 each time (4, 6, 8, 10, then 12), so the next term is 30 + 12 = 42.'),
(3, 'logic', 'Two friends, Alex and Sam, are either always truthful or always lying. Alex says, Sam always lies. Sam says, Alex and I are both truthful. Who is telling the truth?', '["Only Alex","Only Sam","Both","Neither"]', 0, 'If Alex is truthful, Sam must always lie (per Alex''s statement) - and Sam''s claim that both are truthful would then be false, which fits a liar. The other case leads to a contradiction, so Alex is truthful and Sam lies.'),
(3, 'logic', 'A rope burns unevenly but takes exactly 60 minutes to burn completely from one end. If you light both ends at once, how long until the rope is completely burnt?', '["15 minutes","30 minutes","45 minutes","60 minutes"]', 1, 'Even though the rope burns unevenly, lighting both ends means the two flames together consume the same total rope in half the time - 30 minutes.'),
(3, 'logic', 'A number is chosen at random from 1 to 20. What is the probability that it is divisible by 3?', '["3/10","1/3","1/4","2/5"]', 0, 'There are 6 multiples of 3 between 1 and 20 (3, 6, 9, 12, 15, 18), so the probability is 6/20 = 3/10.'),
(3, 'logic', 'Sonia, Tanvi, and Uday each play exactly one sport: chess, tennis, or swimming, with no two playing the same sport. Sonia does not play tennis. Uday does not play chess or tennis. What sport does Uday play?', '["Chess","Tennis","Swimming","Cannot tell"]', 2, 'Since Uday plays neither chess nor tennis, and each person plays exactly one of the three sports, Uday must play swimming.');

-- ---------------------------------------------------------------------------
-- Level 3 Riddle (20 new)
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(3, 'riddle', 'I am taken from a mine, and shut up in a wooden case, from which I am never released, and yet I am used by almost everyone. What am I?', '["Pencil lead","A nail","A key","A battery"]', 0, 'Pencil lead (graphite) is mined, then sealed inside a wooden pencil case - it is never removed from the wood, yet almost everyone uses it to write.'),
(3, 'riddle', 'I am not alive, but I grow. I do not have lungs, but I need air. I do not have a mouth, but water kills me. What am I?', '["Fire","A plant","A crystal","A shadow"]', 0, 'Fire spreads (grows), needs oxygen to keep burning, and is put out by water.'),
(3, 'riddle', 'What kind of cup does not hold any water at all?', '["A cupcake","A teacup","A buttercup","A measuring cup"]', 0, 'The word cupcake contains cup but is a baked treat - it cannot hold water at all.'),
(3, 'riddle', 'What can you hold without ever touching it, and lose forever the moment you say it out loud to someone else?', '["A secret","A promise","A whisper","A wish"]', 0, 'A secret is something you can hold in your mind with no physical object at all, and it stops being a secret the moment you share it.'),
(3, 'riddle', 'What word becomes shorter when you add two letters to it?', '["Short","Long","Big","Tiny"]', 0, 'Adding er to the word short spells shorter - the word itself becomes the word shorter.'),
(3, 'riddle', 'I have branches, but no fruit, trunk, or leaves. What am I?', '["A bank","A tree","A river","A library"]', 0, 'A bank has branches (different locations) but none of the parts a real tree has.'),
(3, 'riddle', 'What English word refers to all 26 letters, yet the word itself has only three syllables?', '["Alphabet","Dictionary","Vocabulary","Language"]', 0, 'The word alphabet refers to all 26 letters, while the word itself has only three syllables: al-pha-bet.'),
(3, 'riddle', 'What kind of ship has no captain, no crew, and never once sails on water?', '["A relationship","A paper ship","A ghost ship","A toy ship"]', 0, 'The word relationship ends in ship, playing on the word - but it has no captain, no crew, and nothing to do with water.'),
(3, 'riddle', 'What begins with T, ends with T, and has T in it?', '["A teapot","A toast","A trumpet","A ticket"]', 0, 'Teapot begins with T, ends with T, and has a T right in the middle too.'),
(3, 'riddle', 'What gets bigger every time you share it with someone else, yet never actually runs out?', '["Knowledge","Money","Time","Food"]', 0, 'Sharing knowledge with someone does not use it up - teaching it to others often deepens your own understanding too.'),
(3, 'riddle', 'What runs all day without legs and can be found humming quietly in your kitchen?', '["A refrigerator","A clock","A faucet","A fan"]', 0, 'A refrigerator runs constantly (operates) without having any legs, and hums quietly while keeping food cold in the kitchen.'),
(3, 'riddle', 'What kind of tree can you carry in your hand?', '["A palm tree","An oak tree","A fir tree","A willow tree"]', 0, 'It is a play on words - a palm tree shares its name with the palm of your hand, which you can obviously carry.'),
(3, 'riddle', 'What kind of table has no legs at all?', '["A multiplication table","A dinner table","A picnic table","A coffee table"]', 0, 'A multiplication table is just a grid of numbers - it has no physical legs like a piece of furniture would.'),
(3, 'riddle', 'What comes once in a minute, twice in a moment, but never in a thousand years?', '["The letter M","The letter O","The number 1","The word now"]', 0, 'The letter M appears once in minute, twice in moment, but not at all in thousand years.'),
(3, 'riddle', 'What do you experience every night with your eyes closed, that feels completely real until you wake up?', '["A dream","A memory","A thought","A wish"]', 0, 'A dream happens while you sleep with your eyes closed, and often feels completely real - until you wake up and realize it was not.'),
(3, 'riddle', 'What kind of coat is always wet when you put it on?', '["A coat of paint","A raincoat","A fur coat","A coat of ice"]', 0, 'Freshly applied paint - a coat of paint - is always wet right when it goes on.'),
(3, 'riddle', 'What kind of nut has no shell at all?', '["A doughnut","A peanut","A walnut","A coconut"]', 0, 'A doughnut has the word nut right in its name, but it is a fried pastry with no shell at all.'),
(3, 'riddle', 'What English word keeps the same pronunciation even after you take away four of its five letters?', '["Queue","Eight","Bread","Knight"]', 0, 'Queue is pronounced just like the single letter Q - so even after removing four of its five letters, it still sounds the same.'),
(3, 'riddle', 'A man looks at a portrait and says: Brothers and sisters, I have none. But this man''s father is my father''s son. Whose picture is he looking at?', '["His own son","His father","His brother","Himself"]', 0, 'Since he has no siblings, my father''s son can only be himself. So this man''s father is me - meaning the man in the picture is his own son.'),
(3, 'riddle', 'What has many rings but no fingers, and can tell you how old a tree is?', '["A tree trunk","A phone","An onion","A target"]', 0, 'The rings inside a tree trunk''s cross-section each represent one year of growth, letting you count a tree''s age.');

-- ---------------------------------------------------------------------------
-- Level 3 Spatial (20 new)
-- ---------------------------------------------------------------------------
insert into questions (level, category, question_text, options, correct_option_index, explanation) values
(3, 'spatial', 'A cube is painted red on all faces, then cut into 27 smaller equal cubes (3x3x3). How many of the small cubes have exactly 2 red faces?', '["8","12","6","1"]', 1, 'In a 3x3x3 cube, the small cubes with exactly 2 painted faces are the ones along each edge (excluding corners) - there are 12 edges, each contributing exactly 1 such cube.'),
(3, 'spatial', 'How many faces does a triangular prism have?', '["4","5","6","8"]', 1, 'A triangular prism has 2 triangular faces (top and bottom) and 3 rectangular side faces, for 5 faces total.'),
(3, 'spatial', 'If you fold a net made of 6 equal squares arranged in a cross (plus) shape, what 3D shape do you get?', '["A cube","A pyramid","A cylinder","A prism"]', 0, 'A cross-shaped net of 6 squares folds up into a cube - each square becomes one face.'),
(3, 'spatial', 'You are facing East. You turn 90 degrees clockwise, then 180 degrees, then 90 degrees counter-clockwise. Which direction do you now face?', '["North","South","East","West"]', 3, 'Starting at East: turning 90 degrees clockwise faces South; turning 180 degrees faces North; turning 90 degrees counter-clockwise from North faces West.'),
(3, 'spatial', 'A rectangular box is 4 cm long, 3 cm wide, and 2 cm tall. What is its volume?', '["24 cubic cm","9 cubic cm","18 cubic cm","48 cubic cm"]', 0, 'Volume of a rectangular box = length x width x height = 4 x 3 x 2 = 24 cubic cm.'),
(3, 'spatial', 'How many lines of symmetry does a regular pentagon have?', '["3","4","5","10"]', 2, 'A regular pentagon has 5 lines of symmetry - one through each vertex and the midpoint of the opposite side.'),
(3, 'spatial', 'If you look at the letter B in a vertical mirror held to its right, what do you see?', '["A backwards B (mirror image)","The letter D","The letter P","The letter R"]', 0, 'A vertical mirror flips the letter left-to-right, producing a mirror image of B - it does not turn into a different real letter.'),
(3, 'spatial', 'A square paper is folded in half twice, so it becomes a smaller square. If you cut a small triangle off one corner (not touching any fold line) and then unfold it completely, how many holes are there?', '["1","2","4","8"]', 2, 'Folding the square in half twice stacks the paper into 4 layers. A cut through a corner not on a fold line goes through all 4 layers, creating 4 separate holes once unfolded.'),
(3, 'spatial', 'A ladder 13 meters long leans against a wall. The bottom of the ladder is 5 meters from the wall. How high up the wall does the ladder reach?', '["12 meters","10 meters","8 meters","14 meters"]', 0, 'This is a 5-12-13 right triangle: 5 squared + 12 squared = 25 + 144 = 169 = 13 squared, so the ladder reaches 12 meters up the wall.'),
(3, 'spatial', 'How many edges does a square pyramid have (a pyramid with a square base)?', '["4","6","8","10"]', 2, 'A square pyramid has 4 edges around its square base plus 4 edges running up to the apex, for 8 edges total.'),
(3, 'spatial', 'If you unfold (flatten) a cylinder''s curved side into a flat shape, what shape do you get?', '["A rectangle","A triangle","A circle","A trapezoid"]', 0, 'The curved surface of a cylinder unrolls flat into a rectangle, with the circles remaining as the top and bottom.'),
(3, 'spatial', 'Two mirrors are placed at a right angle (90 degrees) to each other. If you look into the corner where they meet, how many reflections of yourself can you typically see?', '["1","2","3","4"]', 2, 'Two mirrors at a right angle produce three reflections: one in each mirror individually, plus one double reflection from light bouncing off both mirrors.'),
(3, 'spatial', 'A regular hexagon is cut in half through its center, from the midpoint of one flat side to the midpoint of the opposite flat side. What shape is each half?', '["A trapezoid","A triangle","A rectangle","A pentagon"]', 0, 'Slicing a regular hexagon between the midpoints of two opposite sides produces two identical trapezoid-shaped halves.'),
(3, 'spatial', 'A treasure map says: start at the flag, walk 3 steps North, then 4 steps East, then dig. If you instead walked directly from the flag to the treasure in a straight line, how many steps would that be?', '["5 steps","7 steps","6 steps","4 steps"]', 0, 'Walking 3 steps North and 4 steps East forms a right triangle with legs 3 and 4; the direct straight-line distance is the hypotenuse: the square root of (3 squared + 4 squared) = 5 steps.'),
(3, 'spatial', 'How many vertices (corners) does a regular octahedron have?', '["6","8","10","12"]', 0, 'A regular octahedron (8 triangular faces) has 6 vertices - like two pyramids joined at their square bases.'),
(3, 'spatial', 'If you fold a strip of paper into a loop with a half-twist before joining the ends (a Mobius strip) and draw a line down the middle all the way around, how many sides does the strip actually have?', '["1","2","3","0"]', 0, 'A Mobius strip''s half-twist means it only has one continuous side and one continuous edge - the line drawn down the middle eventually meets back up with itself on both sides.'),
(3, 'spatial', 'A rectangular garden is 12 meters by 8 meters. A square patio with 4-meter sides sits inside it. What is the area of the garden NOT covered by the patio?', '["80 sq m","84 sq m","76 sq m","88 sq m"]', 0, 'Garden area = 12 x 8 = 96 sq m. Patio area = 4 x 4 = 16 sq m. Remaining = 96 - 16 = 80 sq m.'),
(3, 'spatial', 'At what time do the hour and minute hands of a clock point in exactly opposite directions (180 degrees apart), right around 6 o''clock?', '["6:00","6:30","5:30","6:15"]', 0, 'At exactly 6:00, the minute hand points to 12 and the hour hand points to 6 - directly opposite each other, 180 degrees apart.'),
(3, 'spatial', 'A cube''s edge length is doubled. By what factor does its volume increase?', '["2 times","4 times","6 times","8 times"]', 3, 'Volume = edge cubed, so doubling the edge length multiplies the volume by 2 cubed = 8.'),
(3, 'spatial', 'If you walk 10 steps North, then 10 steps East, then 10 steps South, then 10 steps West, where do you end up compared to where you started?', '["Back at the start","10 steps North of start","10 steps East of start","20 steps away from start"]', 0, 'Walking North then East then South then West, each for the same distance, traces a square path that returns exactly to the starting point.');
