import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

// TiDB connection configuration
const connectionConfig = {
  host: process.env.TIDB_HOST || 'localhost',
  port: parseInt(process.env.TIDB_PORT || '4000'),
  user: process.env.TIDB_USER || 'root',
  password: process.env.TIDB_PASSWORD || '',
  database: process.env.TIDB_DATABASE || 'novi',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // TiDB specific optimizations
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  // Connection pool settings for high availability
  connectionLimit: 10,
  queueLimit: 0,
};

// Create connection pool
const pool = mysql.createPool(connectionConfig);

// Create Drizzle instance with schema
export const db = drizzle(pool, { 
  schema, 
  mode: 'default',
  logger: process.env.NODE_ENV === 'development'
});

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ TiDB connection successful');
    return true;
  } catch (error) {
    console.error('❌ TiDB connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await pool.end();
    console.log('🔌 TiDB connection pool closed');
  } catch (error) {
    console.error('Error closing TiDB connection:', error);
  }
}

// Export types for use in agents
export type Database = typeof db;
export * from './schema';
