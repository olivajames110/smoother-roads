export type LatLng = [number, number];
export type Cat = "city" | "town" | "airport" | "mountain" | "coastal" | "race" | "island";
export type Status = "requested" | "progress" | "released" | "unable";
export type Reason = "alternative" | "no-photogrammetry" | "tried"; // Why an area is "unable"
export type CommentType = "feedback" | "issue" | "improve" | "question" | "review";
export type GroupBy = "country" | "az" | "votes" | "new" | "old" | "status";
export type SortBy = "votes" | "new" | "old" | "issues";

export type Shape =
  | { type: "circle"; center: LatLng; radius: number } // radius in metres
  | { type: "polygon"; points: LatLng[] };

export interface AreaComment {
  id: string;
  author: string;
  dev?: boolean;
  type: CommentType;
  text: string;
  image?: string;
  pin?: LatLng;
  date: number;
  local?: boolean; // Only stored in this browser until the database exists
  hidden?: boolean; // Hidden from visitors; only an admin receives these
  replyTo?: string; // The comment this one answers
  rating?: number; // A review: 1 to 5 stars
}

export interface AreaPhoto {
  id: string;
  path: string; // In the storage bucket
  url: string;
  author: string;
  dev: boolean;
  width: number;
  height: number;
  approved: boolean; // Waiting photos only reach the admin
  date: number;
}

// A place to visit (one point) or a route (start and finish) in an area
export type TimeOfDay = "sunrise" | "noon" | "golden" | "sunset" | "night";

export interface AreaPoi {
  id: string;
  kind: "place" | "route";
  name: string;
  category: string; // "Viewpoint", "Landmark"…
  note: string;
  start: LatLng; // the place itself, or the route's start
  end?: LatLng; // routes only: the finish
  via: LatLng[]; // routes only: the stops between start and finish, in order
  time: TimeOfDay | null; // routes only: the best time to drive it (Street GPS sets the clock on Start)
  author: string;
  approved: boolean; // waiting ones only reach the admin
}

export interface ProblemSpot {
  pin: LatLng;
  note: string;
  date: number;
}

export interface Area {
  id: string;
  name: string;
  region: string;
  country: string;
  icao: string;
  cat: Cat;
  noPhotogrammetry?: boolean;
  status: Status;
  reason?: Reason; // Only for "unable"
  votes: number;
  voted: boolean;
  by: string;
  date: number;
  notes: string;
  notesAdmin?: boolean; // Notes written by the admin: shown with bold, underline and links
  requestNotes?: string; // What the requester wrote when sending the request (shown in Feedback)
  shape: Shape;
  comments: AreaComment[];
  photos?: AreaPhoto[]; // In display order
  pois?: AreaPoi[]; // Places and routes, in display order
  spots?: ProblemSpot[];
  packageName?: string;
  version?: string;
  roadKm?: number; // Length of road in the released pack
  local?: boolean; // Only stored in this browser until the database exists
  hidden?: boolean; // Hidden from visitors from the admin page
  request?: boolean; // Sent through the site and stored in the database
}

export interface Draft {
  type: "radius" | "polygon";
  center: LatLng | null;
  radius: number;
  points: LatLng[];
  closed: boolean;
}

export interface SubmitForm {
  name: string;
  region: string;
  icao: string;
  notes: string;
  cat: Cat;
}

export interface CommentDraft {
  type: CommentType;
  text: string;
  image: string | null;
  pin: LatLng | null;
  replyTo: string | null; // Admin replies: the comment being answered
  rating: number; // A review's stars (0 = not picked yet)
}

export interface FlyRequest {
  bounds: [LatLng, LatLng];
  maxZoom: number;
  nonce: number;
}
