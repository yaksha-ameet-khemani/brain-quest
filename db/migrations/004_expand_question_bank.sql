-- Expands the curated bank to at least 20 questions per (level, category)
-- bucket. Before this: L1 logic=6 riddle=5 spatial=4, L2 logic=10 riddle=3
-- spatial=2. Adds 14/15/16 to level 1 and 10/17/18 to level 2 respectively,
-- reaching 20 in every bucket. Every answer below has been worked through
-- by hand (see docs/blueprint.md for the standard this repo holds seed
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
