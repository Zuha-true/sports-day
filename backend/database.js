// backend/database.js
const mysql = require('mysql2');

const createConnection = () => {
  if (process.env.DATABASE_URL) {
    return mysql.createPool(process.env.DATABASE_URL);
  }
  
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'college_sports_day',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 20, // Handle more concurrent admins
    queueLimit: 50,
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000
  });
};

const pool = createConnection();

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Database connected successfully');
    connection.release();
  }
});

const promisePool = pool.promise();

module.exports = promisePool;