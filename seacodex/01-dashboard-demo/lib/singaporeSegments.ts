import type { SingaporeSegment, SocialEdge, SocialNode } from "./types";

export const singaporeSegments: SingaporeSegment[] = [
  {
    id: "gen-z-students",
    label: "Gen Z students",
    shortLabel: "Students",
    influence: 0.74,
    priceSensitivity: 0.82,
    preferredAngle: "voucherEmphasis",
    baselineInterest: 0.56,
    objection: "Needs a sharper reason to buy now instead of waiting for payday.",
    trigger: "stackable vouchers and peer proof"
  },
  {
    id: "young-professionals",
    label: "Young professionals",
    shortLabel: "Professionals",
    influence: 0.68,
    priceSensitivity: 0.48,
    preferredAngle: "premiumPositioning",
    baselineInterest: 0.61,
    objection: "Discount copy feels noisy unless convenience is clear.",
    trigger: "delivery speed, quality cues, and authentic reviews"
  },
  {
    id: "parents-family",
    label: "Parents and family buyers",
    shortLabel: "Families",
    influence: 0.81,
    priceSensitivity: 0.7,
    preferredAngle: "familyBulkBuyAngle",
    baselineInterest: 0.64,
    objection: "Wants practical household value, not flash-sale hype.",
    trigger: "bulk-buy savings and household usefulness"
  },
  {
    id: "heartland-value",
    label: "Heartland value shoppers",
    shortLabel: "Heartland",
    influence: 0.63,
    priceSensitivity: 0.9,
    preferredAngle: "discountPercent",
    baselineInterest: 0.59,
    objection: "Will compare against Lazada, TikTok Shop, and nearby stores.",
    trigger: "clear final price after vouchers and shipping"
  },
  {
    id: "live-resellers",
    label: "Resellers and livestream sellers",
    shortLabel: "Resellers",
    influence: 0.77,
    priceSensitivity: 0.58,
    preferredAngle: "creatorAngle",
    baselineInterest: 0.42,
    objection: "Margin story is weak if the listing only promises consumer discounts.",
    trigger: "creator bundles, replenishment margin, and repeat demand"
  },
  {
    id: "category-enthusiasts",
    label: "Beauty and gadget enthusiasts",
    shortLabel: "Enthusiasts",
    influence: 0.86,
    priceSensitivity: 0.44,
    preferredAngle: "creatorAngle",
    baselineInterest: 0.66,
    objection: "Needs taste-maker validation before it spreads.",
    trigger: "creator picks, ingredient/spec proof, and early access"
  }
];

const agentSeeds: Array<Omit<SocialNode, "id">> = [
  { segmentId: "gen-z-students", label: "Alyssa Tan", avatarInitials: "AT", persona: "Poly student", channel: "Poly group chat", influence: 0.62 },
  { segmentId: "gen-z-students", label: "Irfan Lim", avatarInitials: "IL", persona: "Hall organizer", channel: "Hall Telegram", influence: 0.76 },
  { segmentId: "gen-z-students", label: "Nadia Koh", avatarInitials: "NK", persona: "Budget commuter", channel: "MRT deal chat", influence: 0.55 },
  { segmentId: "gen-z-students", label: "Shawn Teo", avatarInitials: "ST", persona: "Gaming club lead", channel: "Discord server", influence: 0.68 },
  { segmentId: "gen-z-students", label: "Faris Ong", avatarInitials: "FO", persona: "NSF bargain hunter", channel: "Camp Telegram", influence: 0.58 },
  { segmentId: "gen-z-students", label: "Janelle Ho", avatarInitials: "JH", persona: "Campus creator", channel: "TikTok comments", influence: 0.79 },
  { segmentId: "gen-z-students", label: "Ravi Menon", avatarInitials: "RM", persona: "Hostel cook", channel: "Hostel pantry chat", influence: 0.61 },
  { segmentId: "gen-z-students", label: "Clara Wee", avatarInitials: "CW", persona: "Voucher spreadsheet keeper", channel: "Student deals sheet", influence: 0.72 },
  { segmentId: "young-professionals", label: "Priya Nair", avatarInitials: "PN", persona: "CBD analyst", channel: "CBD lunch crew", influence: 0.58 },
  { segmentId: "young-professionals", label: "Marcus Goh", avatarInitials: "MG", persona: "New homeowner", channel: "BTO planning chat", influence: 0.71 },
  { segmentId: "young-professionals", label: "Tessa Lee", avatarInitials: "TL", persona: "Product manager", channel: "Office Slack", influence: 0.66 },
  { segmentId: "young-professionals", label: "Daniel Chia", avatarInitials: "DC", persona: "Gym regular", channel: "ClassPass group", influence: 0.54 },
  { segmentId: "young-professionals", label: "Sabrina Yeo", avatarInitials: "SY", persona: "Review-first buyer", channel: "Instagram saves", influence: 0.69 },
  { segmentId: "young-professionals", label: "Hafiz Salleh", avatarInitials: "HS", persona: "Shift supervisor", channel: "Night-shift chat", influence: 0.52 },
  { segmentId: "young-professionals", label: "Elaine Quek", avatarInitials: "EQ", persona: "Minimalist renter", channel: "Apartment finds", influence: 0.63 },
  { segmentId: "young-professionals", label: "Vikram Pillai", avatarInitials: "VP", persona: "Tech reviewer", channel: "LinkedIn side chat", influence: 0.74 },
  { segmentId: "parents-family", label: "Rachel Wong", avatarInitials: "RW", persona: "Parent buyer", channel: "Parent circle", influence: 0.82 },
  { segmentId: "parents-family", label: "Uncle David", avatarInitials: "UD", persona: "Family recommender", channel: "Family WhatsApp", influence: 0.9 },
  { segmentId: "parents-family", label: "Mdm Latha", avatarInitials: "ML", persona: "Kitchen planner", channel: "Recipe exchange", influence: 0.73 },
  { segmentId: "parents-family", label: "Grace Lim", avatarInitials: "GL", persona: "Bulk-buy organizer", channel: "Condo parents chat", influence: 0.78 },
  { segmentId: "parents-family", label: "Kelvin Yap", avatarInitials: "KY", persona: "Weekend cook", channel: "Family dinner chat", influence: 0.64 },
  { segmentId: "parents-family", label: "Nur Aisyah", avatarInitials: "NA", persona: "School-run coordinator", channel: "Class parent group", influence: 0.7 },
  { segmentId: "parents-family", label: "Eugene Low", avatarInitials: "EL", persona: "Practical dad", channel: "Dad forum thread", influence: 0.59 },
  { segmentId: "parents-family", label: "Pei Ling", avatarInitials: "PL", persona: "Multi-gen household buyer", channel: "Household WhatsApp", influence: 0.76 },
  { segmentId: "parents-family", label: "Josephine Tay", avatarInitials: "JT", persona: "Lunchbox prepper", channel: "Meal-prep group", influence: 0.67 },
  { segmentId: "heartland-value", label: "Mdm Siti", avatarInitials: "MS", persona: "Deal comparer", channel: "Neighbourhood deals", influence: 0.69 },
  { segmentId: "heartland-value", label: "Ben Chua", avatarInitials: "BC", persona: "Voucher hunter", channel: "Voucher hunters", influence: 0.74 },
  { segmentId: "heartland-value", label: "Ahmad Rahim", avatarInitials: "AR", persona: "Wet-market regular", channel: "Hawker breakfast chat", influence: 0.57 },
  { segmentId: "heartland-value", label: "Wendy Foo", avatarInitials: "WF", persona: "Price tracker", channel: "Lazada comparison thread", influence: 0.71 },
  { segmentId: "heartland-value", label: "Cheryl Ng", avatarInitials: "CN", persona: "Neighbourhood admin", channel: "Estate Facebook group", influence: 0.83 },
  { segmentId: "heartland-value", label: "Mr Ho", avatarInitials: "MH", persona: "Retired bargain scout", channel: "Coffee shop circle", influence: 0.65 },
  { segmentId: "heartland-value", label: "Suresh Kumar", avatarInitials: "SK", persona: "Payday shopper", channel: "Payday deals chat", influence: 0.6 },
  { segmentId: "heartland-value", label: "Lynn Tan", avatarInitials: "LT", persona: "Flash-sale skeptic", channel: "Marketplace comments", influence: 0.56 },
  { segmentId: "live-resellers", label: "Jia Min", avatarInitials: "JM", persona: "Live seller", channel: "Live seller pod", influence: 0.8 },
  { segmentId: "live-resellers", label: "Arjun Rao", avatarInitials: "AR", persona: "Supplier scout", channel: "Supplier chat", influence: 0.57 },
  { segmentId: "live-resellers", label: "Yvonne Seah", avatarInitials: "YS", persona: "Bundle packager", channel: "Seller WhatsApp", influence: 0.69 },
  { segmentId: "live-resellers", label: "Darren Ang", avatarInitials: "DA", persona: "Margin calculator", channel: "Reseller spreadsheet", influence: 0.62 },
  { segmentId: "live-resellers", label: "Lina Zulkifli", avatarInitials: "LZ", persona: "Livestream host", channel: "TikTok seller room", influence: 0.84 },
  { segmentId: "live-resellers", label: "Terence Soh", avatarInitials: "TS", persona: "Wholesale negotiator", channel: "Warehouse Telegram", influence: 0.66 },
  { segmentId: "live-resellers", label: "Xinyi Lau", avatarInitials: "XL", persona: "Affiliate seller", channel: "Affiliate Discord", influence: 0.73 },
  { segmentId: "live-resellers", label: "Rizal Hamid", avatarInitials: "RH", persona: "Pop-up stall owner", channel: "Bazaar vendor chat", influence: 0.6 },
  { segmentId: "category-enthusiasts", label: "Kai Neo", avatarInitials: "KN", persona: "Creator follower", channel: "Creator fandom", influence: 0.88 },
  { segmentId: "category-enthusiasts", label: "Mei Chen", avatarInitials: "MC", persona: "Review reader", channel: "Review thread", influence: 0.72 },
  { segmentId: "category-enthusiasts", label: "Daphne Sim", avatarInitials: "DS", persona: "Beauty sample collector", channel: "Sample swap chat", influence: 0.64 },
  { segmentId: "category-enthusiasts", label: "Leonard Wee", avatarInitials: "LW", persona: "Spec checker", channel: "Gadget forum", influence: 0.75 },
  { segmentId: "category-enthusiasts", label: "Amira Noor", avatarInitials: "AN", persona: "Ingredient reader", channel: "Skincare Telegram", influence: 0.68 },
  { segmentId: "category-enthusiasts", label: "Brenda Tan", avatarInitials: "BT", persona: "Unboxing fan", channel: "YouTube Shorts comments", influence: 0.61 },
  { segmentId: "category-enthusiasts", label: "Isaac Wong", avatarInitials: "IW", persona: "Comparison reviewer", channel: "Reddit SG thread", influence: 0.7 },
  { segmentId: "category-enthusiasts", label: "Mira Das", avatarInitials: "MD", persona: "Early adopter", channel: "Launch alert chat", influence: 0.79 },
  { segmentId: "category-enthusiasts", label: "Joel Pang", avatarInitials: "JP", persona: "Taste-maker friend", channel: "Close friends story", influence: 0.67 }
];

export const singaporeNodes: SocialNode[] = agentSeeds.map((agent, index) => ({
  ...agent,
  id: `n${index + 1}`
}));

const bridgeEdges: SocialEdge[] = [
  { source: "n2", target: "n42", strength: 0.54 },
  { source: "n6", target: "n27", strength: 0.38 },
  { source: "n10", target: "n17", strength: 0.5 },
  { source: "n12", target: "n45", strength: 0.42 },
  { source: "n18", target: "n25", strength: 0.61 },
  { source: "n21", target: "n34", strength: 0.35 },
  { source: "n29", target: "n33", strength: 0.73 },
  { source: "n30", target: "n39", strength: 0.48 },
  { source: "n36", target: "n41", strength: 0.7 },
  { source: "n38", target: "n46", strength: 0.52 },
  { source: "n40", target: "n24", strength: 0.44 },
  { source: "n47", target: "n13", strength: 0.46 },
  { source: "n49", target: "n4", strength: 0.4 },
  { source: "n50", target: "n20", strength: 0.37 }
];

export const singaporeEdges: SocialEdge[] = [
  ...singaporeNodes.slice(0, -1).map((node, index) => ({
    source: node.id,
    target: singaporeNodes[index + 1].id,
    strength: node.segmentId === singaporeNodes[index + 1].segmentId ? 0.76 : 0.34
  })),
  ...singaporeNodes
    .filter((_, index) => index + 4 < singaporeNodes.length)
    .map((node, index) => ({
      source: node.id,
      target: singaporeNodes[index + 4].id,
      strength: node.segmentId === singaporeNodes[index + 4].segmentId ? 0.58 : 0.29
    })),
  ...bridgeEdges
];
