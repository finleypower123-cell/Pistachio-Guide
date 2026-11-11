/**
 * Short, friendly descriptions for places that come with no description of their own.
 *
 * Each line describes the KIND of place (an escape room, a market), never the particular venue:
 * no claims about quality, price, opening times, size or what a specific place offers. Anything
 * specific must come from real data. A place always gets the same line (chosen from its id), so
 * the page doesn't change between visits.
 */
const BLURBS: Record<string, string[]> = {
  "Escape room": [
    "Fancy locking yourself in a room and trying to get out before the clock runs down? Bring your sharpest friends.",
    "An hour, a locked door and a pile of clues. Friendships have been tested by less.",
    "Puzzles, padlocks and mild panic. Best with people who stay calm under pressure.",
  ],
  Arcade: [
    "Buttons to mash and high scores to chase. Bring a competitive streak.",
    "Flashing lights, joysticks and the quiet thrill of beating a stranger's score.",
  ],
  "Bowling alley": [
    "Borrowed shoes, heavy balls and loud celebrations over very little. A classic for a reason.",
    "Ten pins, questionable technique and one person taking it far too seriously.",
  ],
  "Mini golf": [
    "Tiny clubs, daft obstacles and a scorecard nobody trusts.",
    "Golf, minus the long walk and the dress code.",
  ],
  "Trampoline park": [
    "Wall-to-wall trampolines for bouncing off the day. Harder work than it looks.",
    "Jump about until your legs give in. Grown-ups are allowed to enjoy it too.",
  ],
  Climbing: [
    "Walls to scramble up and mats to land on. Your forearms will have opinions tomorrow.",
    "Pick a route, reach for the next hold and try not to look down.",
  ],
  "Water park": ["Slides, splashes and the walk back up the stairs for one more go."],
  "Swimming pool": ["Lengths, lanes or just a float about. Pack a towel.", "A swim to clear your head. Goggles optional."],
  "Swimming centre": ["Lengths, lanes or just a float about. Pack a towel."],
  "Leisure centre": ["Courts, classes and kit under one roof, for when you fancy moving about a bit."],
  "Board-game café": ["Shelves of board games and something to drink while you argue about the rules."],
  "Games shop": ["Board games, cards and dice. Dangerous for anyone who only wants a look."],
  "Independent café": [
    "A local café for a proper sit-down coffee and a bit of people-watching.",
    "Coffee, something sweet and nowhere you need to be for an hour.",
    "One of the neighbourhood's own. Pull up a chair.",
  ],
  "Chain café": ["A familiar name for when you just need a coffee."],
  "Independent cinema": ["Big screen, dark room, phone away. Still the best way to see a film."],
  Cinema: ["Big screen, dark room, phone away. Still the best way to see a film."],
  Theatre: ["Live on stage and different every night. See what's on before you go."],
  "Arts centre": ["Shows, exhibitions and classes under one roof. See what's on this week."],
  Market: [
    "Stalls to browse, things to taste and at least one purchase you didn't plan.",
    "Wander the stalls and see what turns up. Bring a bag.",
  ],
  Museum: [
    "Things in glass cases and the stories behind them. You'll leave knowing something new.",
    "A good hour or two for the curious, whatever the weather.",
    "Step inside and let your curiosity do the walking.",
  ],
  Gallery: ["Walls of art to wander past at your own pace. No expertise required.", "Come for a look, stay for the one piece you can't stop thinking about."],
  "Local attraction": ["One of the sights around here. Worth a detour if you're nearby.", "The sort of thing you walk past for years, then finally stop and look at."],
  Viewpoint: ["Somewhere to stop, look out and take the photo everyone takes."],
  Park: [
    "Grass, trees and room to breathe. Bring a picnic or just go for a wander.",
    "Green space for a stroll, a sit-down or a kickabout.",
    "Fresh air and a bench with your name on it.",
  ],
  Garden: ["Planted paths and quiet corners. A calm half hour away from the noise.", "A green pocket to slow down in."],
  "Charity shop": ["Second-hand shelves for bargain hunters. You never know what's turned up this week."],
  "Second-hand shop": ["Pre-loved finds waiting for a new home. Half the fun is the rummage."],
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** A line for this kind of place, or null when we have nothing honest to say beyond the type. */
export function blurbFor(typeLabel: string, id: string): string | null {
  const lines = BLURBS[typeLabel];
  return lines ? lines[hash(id) % lines.length] : null;
}
