import type { ListingParameters, ProductListing } from "./types";

export const defaultProduct: ProductListing = {
  name: "Airfryer Demo Listing",
  category: "Home appliance",
  priceSgd: 69,
  discountPercent: 28,
  imageUrl: "",
  shopeeUrl: "https://shopee.sg/demo-airfryer",
  headline: "Compact airfryer with vouchers and stackable shipping support",
  description:
    "A space-saving air fryer for quick weekday dinners, family snacks, and small kitchens."
};

export const defaultParameters: ListingParameters = {
  freeShipping: true,
  voucherEmphasis: 72,
  urgency: 48,
  creatorAngle: 42,
  familyBulkBuyAngle: 64,
  budgetPositioning: 70,
  premiumPositioning: 34
};

export const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Math.round(value)));
