export const P = {
  chevL:'<path d="m15 18-6-6 6-6"/>', chevR:'<path d="m9 18 6-6-6-6"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>', up:'<path d="M12 3.5 3.5 12.5H8.5V20.5H15.5V12.5H20.5Z"/>',
  cmt:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  img:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>', undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  check:'<path d="M20 6 9 17l-5-5"/>', more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>', eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeOff:'<path d="M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.5M3 3l18 18"/>', logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>', search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>', flame:'<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8 0 4 3 7 7 7z"/>',
  hammer:'<path d="m15 12-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9M17.6 3.4l3 3-4.2 4.2-3-3zM14 6l-2-2 3-3 2 2"/>', road:'<path d="M4 21 9 3M20 21 15 3M12 5v2.5M12 10.5V13M12 16v3"/>',
};
export const CATS = {
  city:{label:'Cities', icon:'<path d="M3 21h18M5 21V9l6-3v15M11 21V4l8 4v13M8 11v.01M8 15v.01M15 11v.01M15 15v.01"/>'},
  town:{label:'Towns & Villages', icon:'<path d="m3 11 9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>'},
  airport:{label:'Airport Access', icon:'<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'},
  mountain:{label:'Mountain Passes', icon:'<path d="m3 20 6-11 4 6 3-4 5 9z"/>'},
  coastal:{label:'Coastal Roads', icon:'<path d="M2 12c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M2 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M12 3v4"/>'},
  race:{label:'Race Tracks', icon:'<path d="M4 22V4M4 4h14l-3 4 3 4H4"/>'},
  island:{label:'Islands', icon:'<path d="M12 22V11M12 11c-2-3-6-3-8-1M12 11c2-3 6-3 8-1M12 11c-1-3-4-5-7-5M12 11c1-3 4-5 7-5M6 22h12"/>'},
};
export const STATUS = {
  requested:{label:'Requested',color:'#7c3aed',tint:'#f3eefe',ink:'#6d28d9'},
  progress:{label:'In progress',color:'#d97706',tint:'#fef3e2',ink:'#b45309'},
  released:{label:'Released',color:'#16a34a',tint:'#e7f6ec',ink:'#15803d'},
  unable:{label:'Unable',color:'#dc2626',tint:'#fdecec',ink:'#b42318'},
};
// Why an "Unable" area can't be done. Its marker is half red, half the reason's colour.
export const REASONS = {
  alternative:{label:'Alternative available',color:'#0891b2',tint:'#e0f5fa',ink:'#0e7490',
    note:"I couldn't cover this one, but there's a better alternative already available."},
  'no-photogrammetry':{label:'No photogrammetry',color:'#facc15',tint:'#fef9c3',ink:'#a16207',
    // the message box is red (the badge and marker stay yellow)
    noteTint:'#fdecec',noteInk:'#b42318',
    note:"Sorry, this area isn't covered by photogrammetry, so it doesn't meet the requirements for smoothing roads across the whole area.\n\nIf you have serious interest in improving any terrain within this existing area and would like me to try, please click \"Request improvement\" below and mark one small, specific spot that needs flattening, and I'll try it as a test."},
  tried:{label:'Tried, didn\'t work',color:'#dc2626',tint:'#fdecec',ink:'#b42318',
    note:"I tried, but couldn't get this one drivable."},
};
export type Reason = keyof typeof REASONS;
// The status chips filter by this: the status, or for "unable" the status and its reason
export type FilterKey = "requested" | "progress" | "released" | `unable:${Reason}`;
export const filterKey = (a: { status: keyof typeof STATUS; reason?: Reason }): FilterKey =>
  a.status === "unable" ? `unable:${a.reason ?? "tried"}` : a.status;
// What an area's status reads as: "Unable · No photogrammetry"
export const statusLabel = (a: { status: keyof typeof STATUS; reason?: Reason }) =>
  a.status === "unable" ? `Unable · ${REASONS[a.reason ?? "tried"].label}` : STATUS[a.status].label;
// Shown in the area panel and the list tooltip for statuses that need explaining
export const statusNote = (a: { status: keyof typeof STATUS; reason?: Reason }) =>
  a.status === "unable" ? REASONS[a.reason ?? "tried"].note : undefined;
// The second colour of an area's marker (the reason's), or its status colour
export const sideColor = (a: { status: keyof typeof STATUS; reason?: Reason }) =>
  a.status === "unable" ? REASONS[a.reason ?? "tried"].color : STATUS[a.status].color;