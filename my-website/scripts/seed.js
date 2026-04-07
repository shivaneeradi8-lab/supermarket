// Seed script to populate database with sample data
import connectToDatabase from '../lib/mongodb';
import Product from '../models/Product';
import User from '../models/User';

const sampleProducts = [
  {
    name: "Organic Bananas",
    description: "Fresh organic bananas, perfect for smoothies and snacks",
    price: 2.99,
    originalPrice: 3.49,
    category: "Fruits",
    image: "/next.svg",
    stock: 50,
    rating: 4.5,
    numReviews: 23,
    discount: 15,
    tags: ["organic", "fresh", "healthy"],
    weight: "1",
    unit: "kg"
  },
  {
    name: "Fresh Milk 1L",
    description: "Whole milk from local dairy farms",
    price: 3.49,
    originalPrice: 3.99,
    category: "Dairy",
    image: "/next.svg",
    stock: 30,
    rating: 4.8,
    numReviews: 45,
    discount: 12,
    tags: ["dairy", "fresh", "local"],
    weight: "1",
    unit: "L"
  },
  {
    name: "Whole Wheat Bread",
    description: "Artisan whole wheat bread, freshly baked daily",
    price: 4.99,
    originalPrice: 5.49,
    category: "Bakery",
    image: "/next.svg",
    stock: 0,
    rating: 4.3,
    numReviews: 18,
    discount: 9,
    tags: ["bakery", "whole wheat", "fresh"],
    weight: "500",
    unit: "g"
  },
  {
    name: "Organic Tomatoes",
    description: "Vine-ripened organic tomatoes",
    price: 5.99,
    originalPrice: 6.99,
    category: "Vegetables",
    image: "/next.svg",
    stock: 25,
    rating: 4.6,
    numReviews: 31,
    discount: 14,
    tags: ["organic", "vegetable", "fresh"],
    weight: "1",
    unit: "kg"
  },
  {
    name: "Chicken Breast 500g",
    description: "Free-range chicken breast, antibiotic-free",
    price: 12.99,
    originalPrice: 14.99,
    category: "Meat",
    image: "/next.svg",
    stock: 15,
    rating: 4.7,
    numReviews: 27,
    discount: 13,
    tags: ["meat", "chicken", "free-range"],
    weight: "500",
    unit: "g"
  },
  {
    name: "Orange Juice 1L",
    description: "100% pure orange juice, no added sugar",
    price: 4.49,
    originalPrice: 4.99,
    category: "Beverages",
    image: "/next.svg",
    stock: 0,
    rating: 4.4,
    numReviews: 22,
    discount: 10,
    tags: ["juice", "beverage", "healthy"],
    weight: "1",
    unit: "L"
  }
];

const sampleUsers = [
  {
    name: "Admin User",
    email: "admin@freshmart.com",
    password: "admin123",
    role: "admin",
    phone: "+1234567890",
    address: {
      street: "123 Admin St",
      city: "Admin City",
      state: "AC",
      zipCode: "12345",
      country: "USA"
    },
    isActive: true,
    emailVerified: true
  },
  {
    name: "John Doe",
    email: "john@example.com",
    password: "password123",
    role: "customer",
    phone: "+1987654321",
    address: {
      street: "456 Customer Ave",
      city: "Customer City",
      state: "CC",
      zipCode: "67890",
      country: "USA"
    },
    isActive: true,
    emailVerified: true
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database...');

    await connectToDatabase();

    // Clear existing data
    await Product.deleteMany({});
    await User.deleteMany({});

    // Insert sample products
    const products = await Product.insertMany(sampleProducts);
    console.log(`✅ Inserted ${products.length} products`);

    // Insert sample users
    const users = await User.insertMany(sampleUsers);
    console.log(`✅ Inserted ${users.length} users`);

    console.log('🎉 Database seeded successfully!');
    console.log('\n📋 Sample login credentials:');
    console.log('Admin: admin@freshmart.com / admin123');
    console.log('Customer: john@example.com / password123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();