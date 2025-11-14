import "dotenv/config";
import { prisma } from "./prisma";

const questions = [
  {
    text: "Pick the brunch spot everyone else is picturing",
    category: "Food & Drinks",
    optionA: "Trendy avocado toast café",
    optionB: "Bottomless mimosa bistro",
    optionC: "Neighborhood diner",
    optionD: "Farmers market food truck",
  },
  {
    text: "Which city would most players daydream about visiting right now?",
    category: "Travel",
    optionA: "Lisbon",
    optionB: "Tokyo",
    optionC: "Mexico City",
    optionD: "Reykjavík",
  },
  {
    text: "Ultimate comfort show the group binges",
    category: "Entertainment",
    optionA: "The Office",
    optionB: "Great British Bake Off",
    optionC: "Bluey",
    optionD: "Friends",
  },
  {
    text: "Morning beverage vibe check",
    category: "Daily Habits",
    optionA: "Cold brew with oat milk",
    optionB: "Matcha latte",
    optionC: "Black coffee",
    optionD: "Protein smoothie",
  },
  {
    text: "Preferred remote work backdrop",
    category: "Lifestyle",
    optionA: "Minimalist studio",
    optionB: "Lush plant jungle",
    optionC: "Sunlit beach house",
    optionD: "Hip coffee shop",
  },
  {
    text: "Pick the sneaker everyone flexes",
    category: "Fashion",
    optionA: "Nike Dunks",
    optionB: "Adidas Sambas",
    optionC: "New Balance 550s",
    optionD: "Veja V-10s",
  },
  {
    text: "Which daily habit does this crew brag about?",
    category: "Habit Tracking",
    optionA: "10k steps",
    optionB: "Meditation streak",
    optionC: "Wordle in 3",
    optionD: "Cold plunges",
  },
  {
    text: "Preferred group chat reaction style",
    category: "Social",
    optionA: "All emojis",
    optionB: "Voice notes",
    optionC: "Memes & gifs",
    optionD: "Short replies",
  },
];

async function main() {
  await prisma.question.createMany({ data: questions, skipDuplicates: true });
  // eslint-disable-next-line no-console
  console.log(`Seeded ${questions.length} questions`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
