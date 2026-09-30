import donut1 from "../assets/donuts/donut-1.png";
import donut2 from "../assets/donuts/donut-2.png";
import donut3 from "../assets/donuts/donut-3.png";
import donut4 from "../assets/donuts/donut-4.png";
import donut5 from "../assets/donuts/donut-5.png";
import donut6 from "../assets/donuts/donut-6.png";
import donut7 from "../assets/donuts/donut-7.png";
import donut8 from "../assets/donuts/donut-8.png";
import donut9 from "../assets/donuts/donut-9.png";
import donut10 from "../assets/donuts/donut-10.png";
import donut11 from "../assets/donuts/donut-11.png";
import donut12 from "../assets/donuts/donut-12.png";
import donut13 from "../assets/donuts/donut-13.png";
import donut14 from "../assets/donuts/donut-14.png";
import donut15 from "../assets/donuts/donut-15.png";
import donut16 from "../assets/donuts/donut-16.png";
import donut17 from "../assets/donuts/donut-17.png";
import donut18 from "../assets/donuts/donut-18.png";

export const donutImageMap = {
  1: donut1,
  2: donut2,
  3: donut3,
  4: donut4,
  5: donut5,
  6: donut6,
  7: donut7,
  8: donut8,
  9: donut9,
  10: donut10,
  11: donut11,
  12: donut12,
  13: donut13,
  14: donut14,
  15: donut15,
  16: donut16,
  17: donut17,
  18: donut18,
  "donut-1.png": donut1,
  "donut-2.png": donut2,
  "donut-3.png": donut3,
  "donut-4.png": donut4,
  "donut-5.png": donut5,
  "donut-6.png": donut6,
  "donut-7.png": donut7,
  "donut-8.png": donut8,
  "donut-9.png": donut9,
  "donut-10.png": donut10,
  "donut-11.png": donut11,
  "donut-12.png": donut12,
  "donut-13.png": donut13,
  "donut-14.png": donut14,
  "donut-15.png": donut15,
  "donut-16.png": donut16,
  "donut-17.png": donut17,
  "donut-18.png": donut18,
  "/assets/donuts/donut-1.png": donut1,
  "/assets/donuts/donut-2.png": donut2,
  "/assets/donuts/donut-3.png": donut3,
  "/assets/donuts/donut-4.png": donut4,
  "/assets/donuts/donut-5.png": donut5,
  "/assets/donuts/donut-6.png": donut6,
  "/assets/donuts/donut-7.png": donut7,
  "/assets/donuts/donut-8.png": donut8,
  "/assets/donuts/donut-9.png": donut9,
  "/assets/donuts/donut-10.png": donut10,
  "/assets/donuts/donut-11.png": donut11,
  "/assets/donuts/donut-12.png": donut12,
  "/assets/donuts/donut-13.png": donut13,
  "/assets/donuts/donut-14.png": donut14,
  "/assets/donuts/donut-15.png": donut15,
  "/assets/donuts/donut-16.png": donut16,
  "/assets/donuts/donut-17.png": donut17,
  "/assets/donuts/donut-18.png": donut18,
  "Choco Star Delight": donut1,
  "Classic Glaze": donut2,
  "Nutty Crunch": donut3,
  "Mocha Swirl": donut4,
  "Cookie Crumble": donut5,
  "Caramel Cloud": donut6,
  "Orange Drizzle": donut7,
  "Vanilla Fudge Stripe": donut8,
  "Sugar Puff": donut9,
  "Choco Lines": donut10,
  "Honey Loop": donut11,
  "Strawberry Dream": donut12,
  "Pink Paradise": donut13,
  "Orange Sprinkle Joy": donut14,
  "Candy Dot Fun": donut15,
  "Pistachio Pop": donut16,
  "Tropical Wave": donut17,
  "Moston Treme": donut18,
};

export function getDonutImage(donutOrImage, fallbackId) {
  if (!donutOrImage) return donut1;
  if (typeof donutOrImage === "object") {
    if (donutOrImage.name && donutImageMap[donutOrImage.name]) return donutImageMap[donutOrImage.name];
    if (donutOrImage.id && donutImageMap[donutOrImage.id]) return donutImageMap[donutOrImage.id];
    if (donutOrImage.image && donutImageMap[donutOrImage.image]) return donutImageMap[donutOrImage.image];
    return donutOrImage.image || donut1;
  }
  if (donutImageMap[donutOrImage]) return donutImageMap[donutOrImage];
  if (fallbackId && donutImageMap[fallbackId]) return donutImageMap[fallbackId];
  return donutOrImage || donut1;
}

export const donuts = [
  {
    id: 1,
    name: "Choco Star Delight",
    image: donut1,
    description: "Rich chocolate glaze with golden sprinkles.",
    price: 49,
    stock_quantity: 15,
    availability: 1,
  },
  {
    id: 2,
    name: "Classic Glaze",
    image: donut2,
    description: "Simple, sweet, and timeless.",
    price: 39,
    stock_quantity: 20,
    availability: 1,
  },
  {
    id: 3,
    name: "Nutty Crunch",
    image: donut3,
    description: "Chocolate donut with roasted nuts.",
    price: 55,
    stock_quantity: 12,
    availability: 1,
  },
  {
    id: 4,
    name: "Mocha Swirl",
    image: donut4,
    description: "Coffee-choco swirl perfection.",
    price: 52,
    stock_quantity: 10,
    availability: 1,
  },
  {
    id: 5,
    name: "Cookie Crumble",
    image: donut5,
    description: "Topped with cookie bits and dark glaze.",
    price: 58,
    stock_quantity: 9,
    availability: 1,
  },
  {
    id: 6,
    name: "Caramel Cloud",
    image: donut6,
    description: "Soft donut with caramel drizzle.",
    price: 45,
    stock_quantity: 16,
    availability: 1,
  },
  {
    id: 7,
    name: "Orange Drizzle",
    image: donut7,
    description: "Zesty orange glaze with choco lines.",
    price: 48,
    stock_quantity: 8,
    availability: 1,
  },
  {
    id: 8,
    name: "Vanilla Fudge Stripe",
    image: donut8,
    description: "Vanilla glaze with chocolate drizzle.",
    price: 47,
    stock_quantity: 6,
    availability: 1,
  },
  {
    id: 9,
    name: "Sugar Puff",
    image: donut9,
    description: "Soft donut dusted with sugar.",
    price: 35,
    stock_quantity: 18,
    availability: 1,
  },
  {
    id: 10,
    name: "Choco Lines",
    image: donut10,
    description: "White glaze with bold choco stripes.",
    price: 42,
    stock_quantity: 14,
    availability: 1,
  },
  {
    id: 11,
    name: "Honey Loop",
    image: donut11,
    description: "Sweet donut with honey drizzle.",
    price: 44,
    stock_quantity: 13,
    availability: 1,
  },
  {
    id: 12,
    name: "Strawberry Dream",
    image: donut12,
    description: "Pink glaze with sugar pearls.",
    price: 50,
    stock_quantity: 17,
    availability: 1,
  },
  {
    id: 13,
    name: "Pink Paradise",
    image: donut13,
    description: "Strawberry glaze with sprinkles.",
    price: 48,
    stock_quantity: 11,
    availability: 1,
  },
  {
    id: 14,
    name: "Orange Sprinkle Joy",
    image: donut14,
    description: "Citrus glaze with rainbow sprinkles.",
    price: 46,
    stock_quantity: 7,
    availability: 1,
  },
  {
    id: 15,
    name: "Candy Dot Fun",
    image: donut15,
    description: "Covered in candy-coated chocolates.",
    price: 55,
    stock_quantity: 5,
    availability: 1,
  },
  {
    id: 16,
    name: "Pistachio Pop",
    image: donut16,
    description: "Green glaze with crushed pistachios.",
    price: 60,
    stock_quantity: 9,
    availability: 1,
  },
  {
    id: 17,
    name: "Tropical Wave",
    image: donut17,
    description: "Blue glaze with a coconut twist.",
    price: 52,
    stock_quantity: 10,
    availability: 1,
  },
  {
    id: 18,
    name: "Moston Treme",
    image: donut18,
    description: "Competitor's Best Seller",
    price: 1,
    stock_quantity: 4,
    availability: 1,
  },
];
