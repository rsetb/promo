export type Review = {
  id: string;
  author: string;
  avatarUrl: string;
  rating: number; // 1-5
  comment: string;
};

export type Category = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string; // This is now just a string, not a type union
};

export type NewProduct = {
  name: string;
  description: string;
  price: number;
  category: string; // This is now just a string
};


export type SiteInfo = {
  siteName: string;
  heroTitle1: string;
  heroTitle2: string;
  heroLocation: string;
  heroSlogan: string;
  heroPhone: string;
  heroPhoneDisplay: string;
  heroLocation2: string;
  heroPhone2: string;
  heroPhoneDisplay2: string;
};
