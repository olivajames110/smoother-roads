export const CONFIG = {
  // Upvotes
  votes: true,
  // The Map/Leaderboard switch and the leaderboard page
  leaderboard: false,
  // "Hill Climbs" as a category in the request form: turn on once supabase/026_hill_climbs.sql has run
  // (until then the database refuses a request with that category)
  hillRequests: true,
  // The Vote page: the day voting ends, as "2026-12-31" (the last day votes count, UTC), or "" while no
  // date is set. The page shows it either way; after that day the vote buttons are switched off.
  voteEnds: "",
  // The Leaderboards page (hill climb times from Street GPS; needs supabase/028_climb_times.sql). Until that SQL
  // has run the page says the leaderboards aren't open yet.
  climbBoards: true,
  // Comments and feedback
  database: true,
  // Screenshot uploads on comments: turn on once approval is built
  screenshots: false,
  // Photo galleries on areas (needs supabase/009_area_photos.sql)
  photos: true,
  // Shown under the comment box for removal requests
  contactEmail: "olivajames110@gmail.com",
  supabase: {
    url: "https://wdeeyvzdrsakphgdnwhv.supabase.co",
    key: "sb_publishable_X-K3J7779urJP8FPgA5HJA_F0cl9T7L", // Public by design; the database rules protect the data
  },
  turnstileSiteKey: "0x4AAAAAAF21Ko7dIZpv-zKT",
  // flightsim.to page for the mod
  downloadUrl: "https://flightsim.to/addon/118361/smoother-roads",
  // flightsim.to page for Street GPS, the companion satnav mod
  gpsUrl: "https://flightsim.to/addon/118813/smoother-roads-street-gps",
  // Requests still go to the Google Form until the database is set up
  formUrl: "https://docs.google.com/forms/d/e/1FAIpQLScVRxjvCpeIfGorNrgSnyEDUzc5pUqHID3kDfYGQ5CKOJtYPw/viewform",
  formFields: {
    place: "entry.544154387",
    lat: "entry.701741949",
    lon: "entry.1418313407",
    radius: "entry.890763123",
    notes: "entry.1442149465",
  },
};
