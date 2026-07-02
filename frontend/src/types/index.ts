// ─── User & Auth ─────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  displayName: string;
  avatarUrl?: string;
  provider?: "local" | "google" | "github";
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  productId: string;
  name: string;
  roaster: string | null;
  roastType: string | null;
  origin: string | null;
  process: string | null;
  tastingNotes: string | null;
  score: number | null;
  price: number | null;
  imageUrl: string | null;
  cuppingDate: string | null;
  description: string | null;
  url: string | null;
  quantity: string | null;
  category: string | null;
  avgRating: number;
  reviewCount: number;
}

export interface ProductDetail extends Product {
  reviews: Review[];
  variants: ProductVariant[];
}

export interface ProductVariant {
  id: number;
  quantity: string;
  price: number;
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export interface Review {
  id: number;
  productId: number;
  reviewerName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

export interface RecipeStep {
  timeSec: number;
  instruction: string;
  pourGrams?: number;
}

export interface Recipe {
  id: number;
  name: string;
  brewerType: string;
  grindSize: string | null;
  coffeeGrams: number | null;
  waterGrams: number | null;
  waterTempC: number | null;
  bloomTimeSec: number | null;
  targetBrewTimeSec: number | null;
  steps: RecipeStep[];
  isBuiltIn: number;
  sourceRecipe: string | null;
  notes: string | null;
  isPublic: number;
  authorName: string | null;
  authorSetup: Record<string, unknown> | null;
  roastLevel: string | null;
  coffeeBrand: string | null;
  coffeeName: string | null;
  userId: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface BeanInventoryItem {
  id: number;
  productId: number | null;
  customName: string | null;
  customRoaster: string | null;
  gramsRemaining: number;
  purchaseDate: string | null;
  openedDate: string | null;
  notes: string | null;
  userId: number | null;
  displayName: string;
  displayRoaster: string;
  imageUrl: string | null;
  tastingNotes: string | null;
  roastType: string | null;
  origin: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Brew Logs ───────────────────────────────────────────────────────────────

export interface BrewLog {
  id: number;
  recipeId: number | null;
  beanInventoryId: number | null;
  brewerName: string | null;
  grinderName: string | null;
  grindSize: string | null;
  coffeeGrams: number | null;
  waterGrams: number | null;
  waterTempC: number | null;
  brewTimeSec: number | null;
  rating: number | null;
  notes: string | null;
  isPublic: number;
  userId: number | null;
  createdAt: string;
  beanName?: string;
  beanRoaster?: string;
  recipeName?: string;
}

// ─── Brew Notes ──────────────────────────────────────────────────────────────

export interface BrewNote {
  id: number;
  productId: number;
  authorName: string;
  body: string;
  brewLogId: number | null;
  userId: number | null;
  createdAt: string;
  brewerName?: string;
  coffeeGrams?: number;
  waterGrams?: number;
  brewTimeSec?: number;
  brewRating?: number;
}

// ─── Community Posts ─────────────────────────────────────────────────────────

export interface CommunityPost {
  id: number;
  title: string;
  body: string | null;
  authorName: string | null;
  recipeId: number | null;
  likes: number;
  userId: number | null;
  createdAt: string;
  attachedRecipe?: Partial<Recipe> & { id: number; name: string };
}

// ─── Roasters ────────────────────────────────────────────────────────────────

export interface Roaster {
  id: number;
  name: string;
  websiteUrl: string | null;
  establishedYear: number | null;
  description: string | null;
  overallRating: number | null;
  consistencyRating: number | null;
  experimentationRating: number | null;
  totalReviews: number | null;
  locationCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface FilterOptions {
  roasters: string[];
  roastTypes: string[];
  origins: string[];
  processes: string[];
  priceMin: number;
  priceMax: number;
}

export interface ActiveFilters {
  roaster: string[];
  roastType: string[];
  origin: string[];
  process: string[];
  flavour: string[];
  priceMin: number | null;
  priceMax: number | null;
  category: string;
  search: string;
  sort: string;
}
