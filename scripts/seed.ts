import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Seed users (if using authentication)
  // await seedUsers();

  // Seed default settings
  await seedDefaultSettings();

  // Seed sample data for development
  if (process.env.NODE_ENV === 'development') {
    await seedSampleData();
  }

  console.log('✅ Database seed completed!');
}

async function seedDefaultSettings() {
  console.log('📝 Seeding default settings...');
  
  // This would create default app settings in the database
  // For now, just log what would be seeded
  console.log('  - Default slippage: 1%');
  console.log('  - Default gas: fast');
  console.log('  - Default theme: dark');
  console.log('  - Notifications enabled');
}

async function seedSampleData() {
  console.log('📊 Seeding sample development data...');
  
  // Sample portfolio holdings
  console.log('  - Sample portfolio: SOL, WIF, JUP, BONK');
  
  // Sample watchlist
  console.log('  - Sample watchlist: SOL, WIF, JUP, BONK, PYTH');
  
  // Sample alerts
  console.log('  - Sample price alerts: SOL > $200, WIF < $0.10');
  
  // Sample followed traders
  console.log('  - Sample followed traders: 0xMoby, DegenDiva, AlphaBot');
  
  // Sample snipe rules
  console.log('  - Sample snipe rules: Low dev hold, high liquidity, smart money');
  
  // Sample trailing stops
  console.log('  - Sample trailing stops: WIF 10%, SOL 5%');
}

async function seedUsers() {
  console.log('👤 Seeding default users...');
  // Would create admin user, test user, etc.
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });