import { seedDemoData } from "../src/lib/db/seed";

async function run() {
  console.log("Seeding database...");
  await seedDemoData();
  console.log("Done!");
}

run().catch(console.error);
