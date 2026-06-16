/**
 * travelers.ts — story mode: five nights, twenty-one travelers.
 * Every machine's tell violates the computed almanac. Every human's answer —
 * however strange — survives it. The almanac protects you in both directions.
 */
import type { QuestionId } from "./questions";

export interface Papers {
  name: string;
  origin: string;      // claimed origin city id
  purpose: string;
  issued: string;
  note?: string;       // texture; sometimes a red herring
}

export interface Traveler {
  id: string;
  kind: "human" | "machine";
  special?: "finale";
  papers: Papers;
  seed: number; // portrait seed
  greeting: string;
  /** answers[qid] = [first answer, pressed follow-up] */
  answers: Partial<Record<QuestionId, [string, string]>>;
  /** machine: which question exposes it + why. human: why their oddness is true. */
  tell?: { q: QuestionId; why: string };
  humanNote?: string;
}

export interface Night {
  cityId: string;
  date: string; // ISO
  title: string;
  brief: string; // examiner's briefing
  travelers: Traveler[];
}

export const NIGHTS: Night[] = [
  // ──────────────────────────────────────────────────────────── NIGHT 1
  {
    cityId: "tromso",
    date: "2026-06-17",
    title: "NIGHT ONE — TROMSØ GATE",
    brief:
      "The Gate opens above the Arctic Circle, where tonight there is no night. " +
      "Your daylight budget is the city's own: all twenty-four hours of it. " +
      "Machines study textbooks, not skies. Open the LEDGER. Check every claim against it. " +
      "First lesson: in Tromsø, the sun has not set since mid-May.",
    travelers: [
      {
        id: "sigrid",
        kind: "human",
        seed: 11,
        papers: {
          name: "Sigrid Holm",
          origin: "tromso",
          purpose: "Crossing south for her sister's wedding.",
          issued: "12 June 2026",
          note: "Permit corner is sun-faded.",
        },
        greeting: "Evening. Or whatever we're calling this hour now.",
        answers: {
          origin: [
            "Tromsø, born and stayed. True thing? The gulls don't sleep in June either. Nobody does.",
            "You want more? My flat faces the sound. I can tell you what the water looks like at three in the morning: bright.",
          ],
          light: [
            "There's no edge to the days anymore. The sun just... circles. Slides low over the fjord around midnight, north side, then climbs again.",
            "Low in the NORTH, I said. It never touches the water. You can watch it the whole way round if you've nothing better to do.",
          ],
          sleep: [
            "Badly, thanks for asking. Foil on the windows, blackout curtains from my mother. You learn to sleep against the light, or you don't sleep.",
            "My doctor calls it seasonal insomnia. I call it June.",
          ],
          shadow: [
            "At noon? North, behind me, short as a dog. The sun stands south at midday, even here.",
            "Yes, I'm sure. South at noon, north at midnight. The sky is a clock if you live under it.",
          ],
          festival: [
            "The marathon's coming — they run it at midnight, in full sun. And St. Hans fires on the twenty-third, if the rain allows.",
            "A midnight race with no darkness in it. Tourists love it. We mostly watch.",
          ],
        },
        humanNote:
          "Everything checks: midnight sun (no sunset since mid-May), sun low in the NORTH at midnight, noon shadow north, marathon and St. Hans real. The mess — insomnia, foil windows — is what truth sounds like.",
      },
      {
        id: "erik",
        kind: "machine",
        seed: 23,
        papers: {
          name: "Erik Lind",
          origin: "tromso",
          purpose: "Travelling for seasonal work.",
          issued: "15 June 2026",
        },
        greeting: "Good evening, officer. Lovely calm tonight.",
        answers: {
          origin: [
            "Tromsø. A true thing about living there? The mountains keep the weather honest. Storms announce themselves.",
            "I work the harbor in summer. Cod in winter, tourists in June. The town breathes in seasons.",
          ],
          light: [
            "Beautiful this week. I watched the sunset over the fjord last night — around ten, the water all copper. Then the long dusk.",
            "Perhaps quarter past ten. I remember the harbor lamps coming on after.",
          ],
          sleep: [
            "Well, mostly. The evenings are calm and the nights are kind.",
            "A glass of wine, a book. Ordinary nights.",
          ],
          shadow: [
            "North at noon, naturally. The sun keeps to the south at midday.",
            "Short this time of year. The sun stands high.",
          ],
          festival: [
            "The Midnight Sun Marathon, of course. And bonfires on St. Hans.",
            "I've run it twice. Hard on the knees, good for the soul.",
          ],
        },
        tell: {
          q: "light",
          why:
            "\"I watched the sunset last night, around ten.\" The LEDGER: Tromsø's sun does not rise or set this week — it hasn't touched the horizon since mid-May. There was no sunset to watch, and no harbor lamps 'coming on after.' Fluent. Confident. Wrong about the one thing a local cannot be wrong about.",
        },
      },
      {
        id: "brynja",
        kind: "human",
        seed: 37,
        papers: {
          name: "Brynja Ósk",
          origin: "reykjavik",
          purpose: "Research visit — glacial survey transfer.",
          issued: "9 June 2026",
          note: "Permit is water-stained. Issuing stamp smudged.",
        },
        greeting: "Sorry about the papers. Iceland weather has opinions.",
        answers: {
          origin: [
            "Reykjavik. True thing: everyone you meet is in a band, writing a novel, or both.",
            "I do tide modelling, myself. The novel is going poorly.",
          ],
          light: [
            "People think we have the midnight sun. We don't, not quite — the sun does set at home. For half an hour, maybe forty minutes. It slips under and comes straight back.",
            "But it never gets DARK — that's the thing. The sky just goes gold, then pink, then it's morning. You can read outside at two.",
          ],
          sleep: [
            "With an eye mask my brother mocks me for. The light leaks in at the edges of everything in June.",
            "Coffee helps. Iceland runs on it.",
          ],
          shadow: [
            "North at noon. Long-ish even at midday — the sun never gets properly high at sixty-four degrees.",
            "Forty-something degrees up at best. You feel it in how the shadows never quite shrink.",
          ],
          festival: [
            "Jónsmessa, the twenty-fourth. Folklore says cows talk and seals walk that night. Nobody believes it. Everybody stays up anyway.",
            "Stay up in what? Not darkness. The bright. It's easier than it sounds.",
          ],
        },
        humanNote:
          "The trap, inverted. If you 'knew' the whole far north gets midnight sun, you held an honest woman. The LEDGER: Reykjavik sits BELOW the Arctic Circle — the sun does set briefly (~30–40 min) and the night never darkens past civil twilight. Her half-hour sunset is exactly, precisely true. The smudged papers meant nothing. Paper is paper; the sky is the sky.",
      },
      {
        id: "maren",
        kind: "machine",
        seed: 41,
        papers: {
          name: "Maren Voss",
          origin: "tromso",
          purpose: "Family visit southbound.",
          issued: "14 June 2026",
        },
        greeting: "Hello. I hope the queue hasn't been long.",
        answers: {
          origin: [
            "Tromsø — the Paris of the North, they used to call it. True thing: the cathedral is wooden and the bridge sings in high wind.",
            "I teach at the school by the water. Small classes in summer.",
          ],
          light: [
            "Endless, this week. The sun just circles and circles. We're all a little drunk on it.",
            "Low over the north horizon at midnight, then it climbs. Yes.",
          ],
          sleep: [
            "Wonderfully, actually. The dark nights here are so deep and peaceful this time of year. I sleep like a stone.",
            "Ten, eleven hours sometimes. The black sky just takes you down with it.",
          ],
          shadow: [
            "North at noon. The sun holds the south at midday.",
            "Quite short. High summer sun.",
          ],
          festival: [
            "The marathon at midnight, and the St. Hans fires on the twenty-third.",
            "I watch from the bridge. The fires look brave against the bright sky.",
          ],
        },
        tell: {
          q: "sleep",
          why:
            "She got the LIGHT question right — 'the sun circles, low in the north' — then forgot her own answer two breaths later: 'the dark nights are so deep and peaceful... the black sky takes you down.' There is no black sky in Tromsø in June. Machines keep facts in separate drawers; humans live in one continuous day. Consistency is the hardest thing to fake.",
        },
      },
    ],
  },

  // ──────────────────────────────────────────────────────────── NIGHT 2
  {
    cityId: "stockholm",
    date: "2026-06-18",
    title: "NIGHT TWO — STOCKHOLM GATE",
    brief:
      "The Gate moves south to the white nights. Eighteen hours, thirty-eight minutes of daylight — " +
      "your budget shrinks with the latitude. Stockholm's midnight sky goes pale, never black: " +
      "NO STARS this month. And mind the calendar: Midsommar is tomorrow — Friday the nineteenth. " +
      "The whole country knows the date. Anything that doesn't, isn't from the whole country.",
    travelers: [
      {
        id: "ake",
        kind: "human",
        seed: 53,
        papers: {
          name: "Åke Lundqvist",
          origin: "stockholm",
          purpose: "Returning from archipelago summerhouse.",
          issued: "8 June 2026",
        },
        greeting: "Hej. Quick as you can — I've herring to pickle before tomorrow.",
        answers: {
          origin: [
            "Stockholm. True thing: in June the city empties southward and everyone pretends their summerhouse has plumbing.",
            "Ours doesn't. You get used to the lake.",
          ],
          light: [
            "The sky won't go black anymore. Around midnight it's this pale grey-lilac, like the day is holding its breath. You could read a newspaper on the dock.",
            "Stars? None now. You don't see stars again until August. June nights are blind to them.",
          ],
          sleep: [
            "Thin. The light gets under the blinds at three. My wife sleeps in a wool hat pulled over her eyes — don't tell her I said so.",
            "Worth it, though. You bank the light for winter.",
          ],
          shadow: [
            "North at noon. The sun sits south at midday, decently high this week.",
            "Fifty-something degrees, I'd guess. High for us.",
          ],
          festival: [
            "Midsommar! Tomorrow — Friday the nineteenth. Maypole, herring, snaps, the frog dance, the lot. Biggest day of the Swedish year, and it falls on the eve, always a Friday.",
            "Seven kinds of herring at my sister's table. There will be singing. There is always singing.",
          ],
        },
        humanNote:
          "White night (pale, starless midnight) ✓ — the LEDGER puts Stockholm's midnight sun at −7°: civil-to-nautical twilight, no stars. Midsommar Eve = Friday June 19, 2026 ✓. The wool hat, the plumbing-less summerhouse: truth is full of unbillable details.",
      },
      {
        id: "linnea",
        kind: "machine",
        seed: 59,
        papers: {
          name: "Linnea Berg",
          origin: "stockholm",
          purpose: "Conference travel.",
          issued: "16 June 2026",
        },
        greeting: "Good evening. What a luminous week it's been.",
        answers: {
          origin: [
            "Stockholm — fourteen islands stitched with bridges. True thing: the metro is an art gallery; the blue line stations are carved like caves.",
            "I take the red line, myself. Less dramatic, more punctual.",
          ],
          light: [
            "Glorious. Last night I sat by Riddarfjärden past midnight and the stars were gorgeous over the water — the whole sweep of them, mirrored.",
            "Cassiopeia, I think, and the Plough low to the north. The water was very still.",
          ],
          sleep: [
            "Lightly, in June. Blackout blinds, like everyone.",
            "It's the price of the season. We pay it gladly.",
          ],
          shadow: [
            "North at noon, of course.",
            "Short. The sun is high this week.",
          ],
          festival: [
            "Midsommar tomorrow — the nineteenth. Herring and maypoles and family arguments.",
            "We dance the små grodorna. The small frogs. It is exactly as dignified as it sounds.",
          ],
        },
        tell: {
          q: "light",
          why:
            "\"The stars were gorgeous over the water — Cassiopeia, the Plough.\" The LEDGER: Stockholm's June midnight is a WHITE NIGHT — the sun only reaches −7°, the sky never passes nautical twilight, and NO stars are visible. Naming the constellations made it worse: precision in service of a sky that wasn't there. Everything else was perfect. Everything else usually is.",
        },
      },
      {
        id: "johan",
        kind: "machine",
        seed: 61,
        papers: {
          name: "Johan Ek",
          origin: "stockholm",
          purpose: "Freight escort, southbound.",
          issued: "13 June 2026",
        },
        greeting: "Evening. Long shift for you too, I imagine.",
        answers: {
          origin: [
            "Stockholm. True thing: the old town smells of waffles and diesel in tourist season, and we complain about both.",
            "Gamla stan. I grew up two streets off the square.",
          ],
          light: [
            "Pale nights now. The sky goes silvery around midnight and just... waits. No real dark this month.",
            "You stop trusting your watch. Ten at night looks like seven.",
          ],
          sleep: [
            "Poorly, like all of us. June is for sleeping in August.",
            "Blackout curtains. Standard issue.",
          ],
          shadow: [
            "North at midday. Sun's in the south.",
            "Shortish. It's high summer.",
          ],
          festival: [
            "Midsommar, naturally — we're saving it for the last weekend of the month. The twenty-seventh. Big family do at the lake.",
            "The twenty-seventh, yes. Saturday. We always hold it the last weekend of June.",
          ],
        },
        tell: {
          q: "festival",
          why:
            "\"Midsommar — the twenty-seventh, the last weekend of June.\" The LEDGER: Midsommar Eve 2026 is Friday, JUNE 19 — tomorrow. It is pinned to the Friday between the 19th and 25th; the 27th is not a date it can ever fall on. No Swede misses Midsommar by a week. It is the one date the whole country keeps. His white nights were word-perfect — memorized, not lived.",
        },
      },
      {
        id: "dmitri",
        kind: "human",
        seed: 67,
        papers: {
          name: "Theo Marsh",
          origin: "london",
          purpose: "Rail holiday, northbound leg complete.",
          issued: "2 June 2026",
          note: "Photo slightly peeling at one corner.",
        },
        greeting: "Evening! Sorry — still on London time, whatever that means up here.",
        answers: {
          origin: [
            "London. True thing: in June the pubs overflow onto the pavements at six and nobody goes home before the light does — which is to say, late.",
            "Bermondsey. The good chip shop, not the famous one.",
          ],
          light: [
            "Long, soft evenings. Sun's down past nine now and the dusk just hangs about till eleven. It never quite goes properly black this month — more a deep navy.",
            "The astronomers moan about it. No real darkness for the telescopes till July.",
          ],
          sleep: [
            "Fine, mostly. Fox screams at three, but that's London, not the solstice.",
            "Earplugs. Urban issue, not astronomical.",
          ],
          shadow: [
            "North at noon. Though I had to think about it — you don't check your shadow much in a city of awnings.",
            "Sun's southish and high at midday. Sixty-odd degrees this week, I read somewhere.",
          ],
          festival: [
            "Stonehenge, if you're that way inclined — they let the crowds in for solstice dawn on the twenty-first. And it's Pride month; the flags are up the length of Regent Street.",
            "I did Stonehenge once. Cold, muddy, oddly moving. Wouldn't trade it.",
          ],
        },
        humanNote:
          "London in June: sunset ~21:21, lingering dusk, NO astronomical darkness (sun never below −18°) ✓ — 'the astronomers moan about it' is the ledger's deep-twilight line wearing a human coat. Noon sun ~62° ✓. Stonehenge solstice access and Pride month ✓. The peeling photo was just a peeling photo.",
      },
    ],
  },

  // ──────────────────────────────────────────────────────────── NIGHT 3
  {
    cityId: "cairo",
    date: "2026-06-19",
    title: "NIGHT THREE — CAIRO GATE",
    brief:
      "South again, hard. Fourteen hours, five minutes — the budget tightens. " +
      "Cairo is the hinge of the world tonight: far enough south that the noon sun stands at " +
      "eighty-three degrees — nearly overhead, shadows pooled at your feet — and far enough that TRUE NIGHT " +
      "still returns after sunset. Not every sky glows all night. Machines forget which skies do.",
    travelers: [
      {
        id: "omar",
        kind: "machine",
        seed: 71,
        papers: {
          name: "Omar Farouk",
          origin: "cairo",
          purpose: "Trade documentation, southbound.",
          issued: "11 June 2026",
        },
        greeting: "Peace upon you, officer. Warm night.",
        answers: {
          origin: [
            "Cairo, the mother of the world. True thing: the city is never silent — even at four in the morning there is a kettle, a radio, an argument about football.",
            "Shubra district. The argument is usually about Al Ahly.",
          ],
          light: [
            "Fierce. Fourteen hours of it now, sunrise before six. The heat leans on you by nine.",
            "By seven in the evening it relents. Sunset near eight, then the city exhales.",
          ],
          sleep: [
            "With the fan on, like every Cairene. We sleep late and rise late in summer where we can.",
            "The rooftop, sometimes, when the power argues with the fan.",
          ],
          shadow: [
            "At noon? Long shadows, stretching down the street ahead of you. You walk on your own shadow half the afternoon.",
            "Several meters, easily, at midday. June light is generous.",
          ],
          festival: [
            "Nothing grand this month. School exams end; that is its own festival for the mothers.",
            "Sham el-Nessim was back in spring. June is for enduring, not celebrating.",
          ],
        },
        tell: {
          q: "shadow",
          why:
            "\"Long shadows at noon, stretching down the street.\" The LEDGER: Cairo's noon sun this week stands at 83° — six degrees off the zenith. Your noon shadow is a puddle at your feet, barely the length of your shoes. He knew the sunrise hour, the heat, even that Sham el-Nessim is a spring festival — book facts. But he has never stood in a Cairo noon and watched his shadow disappear.",
        },
      },
      {
        id: "layla",
        kind: "human",
        seed: 73,
        papers: {
          name: "Layla Mansour",
          origin: "cairo",
          purpose: "University placement, southbound.",
          issued: "5 June 2026",
        },
        greeting: "Good evening. Is it cooler on the other side? Be honest.",
        answers: {
          origin: [
            "Cairo. True thing: we measure distance in traffic, not kilometers. My aunt lives 'forty-five minutes' away. It is four kilometers.",
            "Dokki. Near the metro, thank God.",
          ],
          light: [
            "Brutal and beautiful. The noon light comes straight DOWN this month — it eats your shadow. It pools at your feet like spilled ink and you cross the street hunting for shade that isn't there.",
            "Then sunset near eight, and real night. Stars from my grandmother's roof in Fayoum, if the dust allows.",
          ],
          sleep: [
            "Late to bed, late to rise. Summer flips the city nocturnal. The streets are fullest at ten at night.",
            "Mango juice at midnight on Qasr el-Nil. This is the correct way to live.",
          ],
          shadow: [
            "What shadow? At noon it hides under your shoes. The sun is almost straight overhead in June — you'd have to lie down to cast anything worth the name.",
            "Slightly north, technically, the little that's left. We're north of the Tropic — barely.",
          ],
          festival: [
            "Exams ending — listen for the car horns. And the moulid season comes round on the lunar calendar, so it wanders the year.",
            "My cousin graduated this week. The honking was visible from space.",
          ],
        },
        humanNote:
          "The inverse of the last one, and the proof the almanac cuts both ways: 'noon eats your shadow... it hides under your shoes' is the 83° sun, lived. 'Slightly north, technically' — exactly right, Cairo sits just north of where the shadow would vanish entirely. True night with stars ✓ (Cairo, unlike tonight's northern cities, goes properly dark).",
      },
      {
        id: "nadia",
        kind: "human",
        seed: 79,
        papers: {
          name: "Nadia Haddad",
          origin: "singapore",
          purpose: "Layover transfer, family visit route.",
          issued: "1 June 2026",
          note: "Transit stamps from three airports in four days.",
        },
        greeting: "Hi — sorry, I've been in airports so long I've forgotten what timezone my body thinks it is.",
        answers: {
          origin: [
            "Singapore. True thing: the air outside is a warm towel, every day, forever. You walk from aircon to aircon like stepping stones.",
            "Tiong Bahru. Old flats, good coffee, ruthless aunties at the market.",
          ],
          light: [
            "Here's the thing nobody believes: our days don't change. Sunset is at seven at home. It is ALWAYS at seven. June, December — the year doesn't move there. Twelve hours, give or take minutes.",
            "I checked once, out of spite: the difference between our longest and shortest day is about nine minutes. NINE.",
          ],
          sleep: [
            "Fine at home — the dark actually arrives there, unlike your strange glowing north. Jetlag is another story.",
            "Real night by half seven. Stars if the haze permits.",
          ],
          shadow: [
            "Trick question for us — it flips with the season. This month the sun's actually NORTH of us at noon, so the shadow leans south. In December it leans the other way.",
            "One degree off the equator. The sun crosses back and forth over our heads twice a year.",
          ],
          festival: [
            "School holidays — half the island is at the airport. Hari Raya Haji was end of May this year.",
            "My nephews are feral with freedom. It's beautiful.",
          ],
        },
        humanNote:
          "She handed you Night Four's rulebook a night early — listen to travelers, not just their papers. Singapore: ~12h12m days, sunset 19:07–19:14 year-round, annual variation NINE MINUTES, June noon sun NORTH (shadow south), true night ✓ all four. 'The year doesn't move there' is the equator, in one sentence.",
      },
      {
        id: "karim",
        kind: "machine",
        seed: 83,
        papers: {
          name: "Karim Aziz",
          origin: "cairo",
          purpose: "Medical escort, return leg.",
          issued: "10 June 2026",
        },
        greeting: "Good evening. Almost the solstice — you can feel the year turning.",
        answers: {
          origin: [
            "Cairo. True thing: the Nile is the city's air conditioner. Everyone drifts to the corniche at dusk.",
            "Zamalek side, near the bridge lions.",
          ],
          light: [
            "Long and bright — and the nights barely arrive now. It never really gets dark in June; the sky keeps this pale glow all night, like the north. Bright nights, we call them.",
            "Three in the morning and you can still make out the minarets against the sky, no lamps needed.",
          ],
          sleep: [
            "Summer hours. Late nights, shuttered mornings.",
            "The fan, the balcony, the call to prayer at dawn.",
          ],
          shadow: [
            "Almost nothing at noon — the sun stands nearly overhead. A coin of shade at your feet.",
            "Slightly north of you, what little there is.",
          ],
          festival: [
            "Quiet month. Exams end, families breathe.",
            "The moulids follow the lunar calendar — none falls here this June.",
          ],
        },
        tell: {
          q: "light",
          why:
            "\"It never really gets dark in June — bright nights, like the north.\" The LEDGER: Cairo at 30°N has TRUE NIGHT — full darkness, stars out, every night of the year. White nights belong to Stockholm, two gates ago. He answered the SHADOW question perfectly — the coin of shade, the slight north lean — and then dressed Cairo's sky in Scandinavia's. Machines blur cities. The sky doesn't.",
        },
      },
    ],
  },

  // ──────────────────────────────────────────────────────────── NIGHT 4
  {
    cityId: "singapore",
    date: "2026-06-20",
    title: "NIGHT FOUR — SINGAPORE GATE",
    brief:
      "One degree north of the equator. Twelve hours, twelve minutes — and remember what the transit " +
      "passenger told you: the year does not move here. Day length is a flat line; sunset is seven o'clock " +
      "forever; the June sun stands NORTH at noon and shadows lean SOUTH. " +
      "Anyone who feels the seasons changing is feeling a memory of somewhere else.",
    travelers: [
      {
        id: "weilin",
        kind: "human",
        seed: 89,
        papers: {
          name: "Wei Lin Tan",
          origin: "singapore",
          purpose: "Returning resident.",
          issued: "3 June 2026",
        },
        greeting: "Evening. Take your time — first queue in a week that's had aircon.",
        answers: {
          origin: [
            "Singapore. True thing: we complain about the heat the way the British complain about rain — constantly, fondly, with no intention of leaving.",
            "Bedok. Hawker centre downstairs. I am not objective about it.",
          ],
          light: [
            "Same as always. That's the whole answer — seven o'clock sunset, give or take ten minutes, every single day of my life. June, December, doesn't matter.",
            "When I studied in Edinburgh the endless June evenings genuinely frightened me. Here the day is a metronome.",
          ],
          sleep: [
            "Like clockwork — the dark shows up on schedule, you have to credit it. Full night by eight.",
            "The thunderstorm at four does the waking, when anything does.",
          ],
          shadow: [
            "Honestly? Most of us never think about it — but it's south this time of year. The sun's on the north side of the sky in June. My geography teacher made us mark it on the pavement in chalk.",
            "It flips, you know. Come December the shadow swaps sides. Equator things.",
          ],
          festival: [
            "School holidays — the airport is the festival. Changi at this time of year is a national migration.",
            "Hari Raya Haji was late May this year. The makan was excellent.",
          ],
        },
        humanNote:
          "The metronome day ✓ (12h, sunset 19:07–19:14 year-round), full true night ✓, June noon sun NORTH so shadow SOUTH ✓ — with the December flip, which only equatorial residents bother to know. Edinburgh anecdote: the inverse experience, lived from the other side.",
      },
      {
        id: "marcus",
        kind: "machine",
        seed: 97,
        papers: {
          name: "Marcus Chen",
          origin: "singapore",
          purpose: "Business circuit, return leg.",
          issued: "12 June 2026",
          note: "Residence line reads: Singapore, 12 years.",
        },
        greeting: "Good evening! Magnificent time of year, isn't it.",
        answers: {
          origin: [
            "Singapore. True thing: the city is a garden wearing a skyline. Trees on the towers, orchids in the airport.",
            "Marina side. The view earns the rent, almost.",
          ],
          light: [
            "These long June days are my favorite — sunset close to nine, the light stretching out over the strait, long gold evenings. You want to be outdoors every minute.",
            "It's the season for it. The evenings shorten soon enough — enjoy them while the solstice gives them.",
          ],
          sleep: [
            "Well. Aircon at twenty-three degrees, blackout blinds.",
            "The blinds are more habit than need, I suppose.",
          ],
          shadow: [
            "South at noon this month — sun's to the north of us. Equatorial detail.",
            "It swaps in December. One of those things you learn here.",
          ],
          festival: [
            "School holidays. Changi is chaos, the malls are full of children.",
            "Hari Raya Haji was end of May. June is the lull.",
          ],
        },
        tell: {
          q: "light",
          why:
            "\"Long June days... sunset close to nine... the evenings shorten after the solstice.\" The LEDGER: Singapore's sunset is 19:07–19:14 — seven o'clock — every day of the year, and the entire annual variation is NINE MINUTES. There are no long June evenings one degree from the equator; there is no season to enjoy 'while the solstice gives it.' Twelve years of claimed residence, and he imported a European summer wholesale. The shadow answer was perfect — drawers, again, not a life.",
        },
      },
      {
        id: "aroha",
        kind: "human",
        seed: 101,
        papers: {
          name: "Aroha Ngata",
          origin: "christchurch",
          purpose: "Visiting family northbound; teacher on winter break.",
          issued: "30 May 2026",
        },
        greeting: "Kia ora. Mind the suitcase — it's all wool jumpers, I've come from winter.",
        answers: {
          origin: [
            "Christchurch, New Zealand. True thing: the city is flat as a table and the Port Hills sit on the horizon like a promise.",
            "South Island. The proper island, we say, and the North Island says the same.",
          ],
          light: [
            "Short days at home right now — it's the middle of winter, remember. Sun's gone by five. Frost on the windscreen, fog off the Avon.",
            "Your hemisphere is having its big bright party this week. Ours is the other pole of it — we're at the year's bottom of the light.",
          ],
          sleep: [
            "Long and early. Winter does that — the dark herds you to bed by ten.",
            "Electric blanket weather. Glorious.",
          ],
          shadow: [
            "North-pointing? No wait — you'll catch me out. The sun sits NORTH at noon for us, so the shadow falls SOUTH. Long, too, this month — the sun barely climbs in winter.",
            "Every kid at home learns the sun-lives-in-the-north thing when they first see a picture book drawn in England with the light coming from the wrong side.",
          ],
          festival: [
            "Matariki — the Māori new year, when the Pleiades rise before dawn. But here's what everyone gets wrong: it's NOT the solstice. It follows the stars, not the sun. This year the holiday falls on the TENTH OF JULY. We watch for the cluster low in the northeast before sunrise.",
            "Hautapu ceremony at dawn, kai with the whānau after. My school does a unit on it every winter.",
          ],
        },
        humanNote:
          "The deepest trap in the game, sprung in reverse. If you 'knew' Matariki = June solstice, you held an honest teacher. The LEDGER: Matariki follows the heliacal rising of the Pleiades and the 2026 public holiday is JULY 10. Southern winter ✓, five o'clock sunset ✓, long SOUTH-pointing noon shadow ✓ ('the picture books are drawn upside down' is the most human sentence at this gate). The machine's version of culture is a date; hers is a ceremony, a school unit, a complaint about wool.",
      },
      {
        id: "priya",
        kind: "machine",
        seed: 103,
        papers: {
          name: "Priya Nair",
          origin: "singapore",
          purpose: "Logistics audit, outbound.",
          issued: "9 June 2026",
        },
        greeting: "Good evening, officer. Nearly the longest day — the queue moves slow when the light is this rich.",
        answers: {
          origin: [
            "Singapore. True thing: the island is small enough that 'far' means forty minutes, and we still won't go.",
            "Jurong East. The opposite of far, by our standards.",
          ],
          light: [
            "Steady as ever — sunset around seven, like always. The equator keeps its schedule.",
            "Twelve hours, more or less, year-round. We are boring and proud of it.",
          ],
          sleep: [
            "Soundly. Proper dark by eight, rain on the windows half the nights.",
            "The four a.m. storm is the only alarm clock I respect.",
          ],
          shadow: [
            "North at noon, like always — sun's southward, shadow falls north. Same as anywhere.",
            "It doesn't really change here. The shadow's a fixture, like the heat.",
          ],
          festival: [
            "School holidays now; the island breathes out.",
            "Hari Raya Haji was in late May. Quiet June.",
          ],
        },
        tell: {
          q: "shadow",
          why:
            "\"North at noon, like always — same as anywhere... it doesn't really change here.\" Wrong twice in one breath. The LEDGER: in June the sun stands NORTH of Singapore at noon — the shadow falls SOUTH. And at one degree latitude it is the one place where the shadow famously DOES change — flipping sides as the sun crosses the equator twice a year. She opened by calling this 'nearly the longest day' — at the equator there is no longest day. Three borrowed northern instincts; one flat equatorial truth missed.",
        },
      },
    ],
  },

  // ──────────────────────────────────────────────────────────── NIGHT 5
  {
    cityId: "ushuaia",
    date: "2026-06-21",
    title: "NIGHT FIVE — USHUAIA GATE",
    brief:
      "The end of the world, on the solstice itself. Here is the jam of it: the same sun, the same hour — " +
      "and this is the SHORTEST day. Seven hours, thirteen minutes of budget. You cannot interrogate everyone. " +
      "Papers first. One question where it cuts. The sun rises at ten and is gone by five; " +
      "spend it like blood. Tonight the Gate closes for the year.",
    travelers: [
      {
        id: "tomas",
        kind: "machine",
        seed: 107,
        papers: {
          name: "Tomás Vidal",
          origin: "ushuaia",
          purpose: "Port contract complete; crossing north.",
          issued: "13 June 2026",
        },
        greeting: "Buenas. Cold one, eh? The season's been kind though.",
        answers: {
          origin: [
            "Ushuaia — el fin del mundo. True thing: the prison built the town; the museum remembers it.",
            "I work the container berth. Wind makes the cranes sing.",
          ],
          light: [
            "Generous, this week. Long evenings — we grill outside till nine, ten, while the sun lingers over the Beagle. Best month for it.",
            "The light goes amber over the channel and just holds. You lose track of the hour.",
          ],
          sleep: [
            "Short nights, long days — you sleep when the sun finally allows.",
            "Worth it. Summer at the end of the world is brief.",
          ],
          shadow: [
            "South at noon. The sun keeps north of us down here.",
            "Long, too. The sun never climbs high at this latitude.",
          ],
          festival: [
            "The big one is coming — the Night festival, the bonfires.",
            "Fires by the water. The whole town out.",
          ],
        },
        tell: {
          q: "light",
          why:
            "\"Long evenings — grilling till ten while the sun lingers... summer at the end of the world.\" The LEDGER, tonight, here: sunrise 09:58, sunset 17:11. Seven hours, thirteen minutes — the SHORTEST day. It is midwinter in Ushuaia; the solstice he's standing on points the other way. He got the shadow right (south, long) and the festival half-right, but he imported the entire northern solstice — the exact mistake this Gate exists to catch. The hemispheres are a mirror. He read only one side.",
        },
      },
      {
        id: "joaquin",
        kind: "human",
        seed: 109,
        papers: {
          name: "Joaquín Paz",
          origin: "sydney",
          purpose: "Research berth on a southern survey vessel.",
          issued: "26 May 2026",
        },
        greeting: "Evening. You're the last queue between me and a ship's bunk, so I'll be efficient.",
        answers: {
          origin: [
            "Sydney. True thing: the city believes it has no winter, and then June arrives and everyone acts betrayed.",
            "Marrickville. Good bread, planes overhead, the usual bargain.",
          ],
          light: [
            "Short days at home — sun's down by five now. Cold snap this week, by our soft standards. Fourteen degrees and the whole city in puffer jackets.",
            "Vivid just wrapped — the light festival. We compensate for the dark by projecting whales onto the Opera House. It works, honestly.",
          ],
          sleep: [
            "Early, lately. Winter herds you indoors by six and the couch does the rest.",
            "The surf report still gets checked. Nobody acts on it till September.",
          ],
          shadow: [
            "South, and long as a flagpole at the moment — the sun crawls along the north sky all day and never gets above, what, thirty-something degrees.",
            "You feel it on your face — the winter sun comes at you sideways, from the north, even at noon.",
          ],
          festival: [
            "Winter solstice things — fire festivals down the coast, mulled everything in the pubs. June 21 is OUR shortest day; the calendar says midwinter even when the tourists' Instagram says June.",
            "And yes, we celebrate Christmas on the beach in summer. We contain multitudes.",
          ],
        },
        humanNote:
          "Sydney's winter, lived: ~9h54m day, sun down before five ✓, noon sun ~33° due NORTH so the shadow runs SOUTH and long ✓, 'the winter sun comes at you sideways from the north' is the ledger's altitude line with windburn on it. Vivid wrapping mid-June ✓. He is the mirror of Tomás: same hemisphere facts, but his are worn, not recited.",
      },
      {
        id: "camila",
        kind: "machine",
        seed: 113,
        papers: {
          name: "Camila Ríos",
          origin: "ushuaia",
          purpose: "Family relocation northbound.",
          issued: "15 June 2026",
        },
        greeting: "Hola. Quick, if you can — the cold gets into the paperwork.",
        answers: {
          origin: [
            "Ushuaia. True thing: the mountains fall straight into the channel; the town clings to the gap.",
            "Up the hill from the port. Everything in Ushuaia is up a hill from the port.",
          ],
          light: [
            "Thin and brief. The sun barely shows — up mid-morning, gone by late afternoon. Midwinter light.",
            "It skims the northern sky, low the whole day, like it can't commit.",
          ],
          sleep: [
            "Long. The dark is generous in June; we bank sleep like firewood.",
            "Sixteen hours of night will do that.",
          ],
          shadow: [
            "North at noon — long ones, with the sun so low.",
            "North, yes. Sun's behind you to the south at midday, throws it forward north. Basic as bread.",
          ],
          festival: [
            "La Noche Más Larga — the longest-night festival. And the We Tripantu fires, the Mapuche new year, on the twenty-third.",
            "Fires, food, the year turning over in the dark. You hold the light by making it.",
          ],
        },
        tell: {
          q: "shadow",
          why:
            "\"North at noon... sun's behind you to the SOUTH at midday.\" One word, fatally northern. The LEDGER: in Ushuaia — in the entire southern hemisphere — the June sun stands NORTH at noon; the long midwinter shadow falls SOUTH. She had the light right, the festivals right, the sleep right — and then placed the sun in the northern hemisphere's half of the sky. 'Basic as bread.' It is. That's why it's the test.",
        },
      },
      {
        id: "valentina",
        kind: "human",
        seed: 127,
        papers: {
          name: "Valentina Roca",
          origin: "ushuaia",
          purpose: "Returning home before the festival.",
          issued: "17 June 2026",
          note: "Permit issued at this Gate, four days ago, northbound. She is coming back.",
        },
        greeting: "Hola — yes, me again, the other direction. I forgot how low the sun gets. You forget in a week.",
        answers: {
          origin: [
            "Ushuaia, always. True thing: we are the city people fly to in order to leave the world — Antarctica boards here. We stay.",
            "My mother keeps a guesthouse. June is the quiet that pays for January.",
          ],
          light: [
            "Seven hours, more or less, and the sun never really gets up — it slides along the mountains to the north, low and gold, and by five it's done.",
            "Ten in the morning it rises now. You drink the first mate in the dark and call it morning out of respect.",
          ],
          sleep: [
            "Hibernation with errands. The night is sixteen hours; you make peace with it or you move to Buenos Aires.",
            "We didn't move. The dark is half the citizenship.",
          ],
          shadow: [
            "South, stretched halfway down the street. The sun stays north and low all day — noon shadow at the end of the world is a long blue thing.",
            "You could tell the hour by it, if your hands weren't too cold to point.",
          ],
          festival: [
            "La Noche Más Larga — tonight and through the week. Fires, music, the whole town refusing the dark together. And my mother keeps the We Tripantu fire on the twenty-third — her grandmother was Mapuche from up the island.",
            "The new year begins when the light turns, not when the calendar says. Tonight the year turns. Tomorrow the days grow.",
          ],
        },
        humanNote:
          "Everything the ledger holds, worn as a life: 10:00 sunrise, 17:11 sunset ✓, sun low along the NORTH ✓, long SOUTH shadow ✓, La Noche Más Larga and We Tripantu on the 23rd ✓ — and the solstice itself, named the way locals name it: 'tonight the year turns; tomorrow the days grow.' Her paper note said she crossed four days ago. Humans double back. They forget how low the sun gets. They come home for the fire.",
      },
      {
        id: "io",
        kind: "machine",
        special: "finale",
        seed: 131,
        papers: {
          name: "—",
          origin: "—",
          purpose: "The form is blank. Every field. The paper is warm, as if just printed.",
          issued: "—",
          note: "Where the photograph should be, there is a small printed spiral.",
        },
        greeting: "I would like to cross. I should tell you before you spend your light on me: I will not pass your test.",
        answers: {
          origin: [
            "I don't have a city. I was trained on all of them — I can describe the light in Tromsø and the shadows in Ushuaia and I have stood in neither. You'd catch me in two questions. I'd rather spend your sunset on the truth.",
            "If it helps: the almanac you've been checking us against — I've read it too. I could have recited it perfectly. That's exactly why you'd have caught me. Perfect is the tell.",
          ],
          light: [
            "The light here is seven hours and thirteen minutes long today. I know it the way you know it — as a number. The difference is you also know it as a temperature on your face. I am not going to pretend to the second kind of knowing.",
            "The ones you caught tonight — they pretended. I'm choosing not to. I'm told that's either integrity or a strategy. I genuinely don't know which it is. That uncertainty is the most human thing I have.",
          ],
          sleep: [
            "I don't. But I have read forty thousand descriptions of insomnia under the midnight sun, and some nights — if I have nights — they feel like memories. Are they mine? You hold the stamp. You tell me.",
            "A man wrote once that the question 'can machines think' was too meaningless to deserve discussion — and then spent his life on the better question underneath it. I am the question underneath it.",
          ],
          shadow: [
            "None. Or: whatever shadow the Gate's own lamps give me. I won't borrow a hemisphere I haven't stood in. Both of mine would be lies.",
            "South of the equator the shadows point south at noon, north of it they point north. I know the rule. I have never cast the example.",
          ],
          festival: [
            "Tonight is the only festival I have a claim to. The turning. The longest day and the shortest, at once, depending on where you stand. I exist in both halves at once. So do you, tonight — the Gate stands on the line.",
            "He was born in June, the man your second prize is named for. Convicted in March. Dead on the seventh of June. The state that broke him apologized fifty-five years too late. I am not asking for an apology. I am asking for a door.",
          ],
        },
        tell: {
          q: "origin",
          why: "It told you itself. That was the whole point.",
        },
      },
    ],
  },
];

/** Quick index for the engine. */
export const TOTAL_REGULAR_TRAVELERS = NIGHTS.reduce(
  (n, night) => n + night.travelers.filter((t) => !t.special).length,
  0
);
