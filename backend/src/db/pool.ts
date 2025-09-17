// Import the mysql2 library (Promise wrapper version)
// This lets us use async/await with MySQL queries.
import mysql from "mysql2/promise";

// Create a connection pool to MySQL.
// A pool keeps a small set of database connections alive and reuses them,
// which is much faster than opening a new connection for every request.
export const pool = mysql.createPool({
  // Hostname of your MySQL server
  host: process.env.DB_HOST,

  // Port of the MySQL server (3306 is the default)
  port: Number(process.env.DB_PORT || 3306),

  // Username for authentication
  user: process.env.DB_USER,

  // Password for authentication
  password: process.env.DB_PASS,

  // Default database to use for queries
  database: process.env.DB_NAME,

  // Allows multiple requests to wait for a connection rather than failing immediately.
  waitForConnections: true,

  // Maximum number of connections in the pool.
  connectionLimit: 10,

  // Allows use of named placeholders (":name") instead of "?" if you prefer
  namedPlaceholders: true,
});

