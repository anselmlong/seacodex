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

export const singaporeNodes: SocialNode[] = [
  {
    id: "n1",
    segmentId: "gen-z-students",
    label: "Alyssa Tan",
    avatarInitials: "AT",
    persona: "Poly student",
    channel: "Poly group chat",
    influence: 0.62
  },
  {
    id: "n2",
    segmentId: "gen-z-students",
    label: "Irfan Lim",
    avatarInitials: "IL",
    persona: "Hall organizer",
    channel: "Hall Telegram",
    influence: 0.76
  },
  {
    id: "n3",
    segmentId: "young-professionals",
    label: "Priya Nair",
    avatarInitials: "PN",
    persona: "CBD analyst",
    channel: "CBD lunch crew",
    influence: 0.58
  },
  {
    id: "n4",
    segmentId: "young-professionals",
    label: "Marcus Goh",
    avatarInitials: "MG",
    persona: "New homeowner",
    channel: "BTO planning chat",
    influence: 0.71
  },
  {
    id: "n5",
    segmentId: "parents-family",
    label: "Rachel Wong",
    avatarInitials: "RW",
    persona: "Parent buyer",
    channel: "Parent circle",
    influence: 0.82
  },
  {
    id: "n6",
    segmentId: "parents-family",
    label: "Uncle David",
    avatarInitials: "UD",
    persona: "Family recommender",
    channel: "Family WhatsApp",
    influence: 0.9
  },
  {
    id: "n7",
    segmentId: "heartland-value",
    label: "Mdm Siti",
    avatarInitials: "MS",
    persona: "Deal comparer",
    channel: "Neighbourhood deals",
    influence: 0.69
  },
  {
    id: "n8",
    segmentId: "heartland-value",
    label: "Ben Chua",
    avatarInitials: "BC",
    persona: "Voucher hunter",
    channel: "Voucher hunters",
    influence: 0.74
  },
  {
    id: "n9",
    segmentId: "live-resellers",
    label: "Jia Min",
    avatarInitials: "JM",
    persona: "Live seller",
    channel: "Live seller pod",
    influence: 0.8
  },
  {
    id: "n10",
    segmentId: "category-enthusiasts",
    label: "Kai Neo",
    avatarInitials: "KN",
    persona: "Creator follower",
    channel: "Creator fandom",
    influence: 0.88
  },
  {
    id: "n11",
    segmentId: "category-enthusiasts",
    label: "Mei Chen",
    avatarInitials: "MC",
    persona: "Review reader",
    channel: "Review thread",
    influence: 0.72
  },
  {
    id: "n12",
    segmentId: "live-resellers",
    label: "Arjun Rao",
    avatarInitials: "AR",
    persona: "Supplier scout",
    channel: "Supplier chat",
    influence: 0.57
  }
];

export const singaporeEdges: SocialEdge[] = [
  { source: "n1", target: "n2", strength: 0.82 },
  { source: "n2", target: "n10", strength: 0.54 },
  { source: "n10", target: "n11", strength: 0.78 },
  { source: "n11", target: "n3", strength: 0.46 },
  { source: "n3", target: "n4", strength: 0.74 },
  { source: "n4", target: "n5", strength: 0.5 },
  { source: "n5", target: "n6", strength: 0.89 },
  { source: "n6", target: "n7", strength: 0.58 },
  { source: "n7", target: "n8", strength: 0.83 },
  { source: "n8", target: "n9", strength: 0.42 },
  { source: "n9", target: "n12", strength: 0.7 },
  { source: "n12", target: "n5", strength: 0.35 },
  { source: "n10", target: "n9", strength: 0.49 },
  { source: "n2", target: "n8", strength: 0.38 }
];
