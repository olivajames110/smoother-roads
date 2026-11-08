export type LatLng = [number, number];
export type Cat = "city" | "town" | "airport" | "mountain" | "coastal" | "race" | "island";
export type Status = "requested" | "progress" | "released";
export type CommentType = "feedback" | "issue" | "question";
export type GroupBy = "country" | "az" | "votes" | "new" | "status";
export type SortBy = "votes" | "new" | "issues";

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
  votes: number;
  voted: boolean;
  by: string;
  date: number;
  notes: string;
  shape: Shape;
  comments: AreaComment[];
  spots?: ProblemSpot[];
  packageName?: string;
  version?: string;
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
}

export interface FlyRequest {
  bounds: [LatLng, LatLng];
  maxZoom: number;
  nonce: number;
}
