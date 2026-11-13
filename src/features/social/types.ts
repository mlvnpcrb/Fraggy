export type PublicCollector = {
  id: string;
  handle: string;
  name: string;
  bio: string;
  followers?: number;
  following?: boolean;
};
export type SharedBottle = {
  id: string;
  brand: string;
  name: string;
  image_path: string;
};
export type ShelfPost = {
  id: string;
  owner_id: string;
  caption: string;
  bottles: SharedBottle[];
  created_at: string;
  collector: PublicCollector;
  liked: boolean;
  following: boolean;
  likes: number;
  comment_count: number;
  comments: { id: string; owner_id: string; handle: string; body: string }[];
};
export type SocialPage = {
  posts: ShelfPost[];
  page_enabled: boolean;
  profile: PublicCollector | null;
};
