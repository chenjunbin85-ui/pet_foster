// 多端联调 · MySQL 落库断言辅助（直连演示库 pet_foster，root/root@127.0.0.1:3306）
const mysql = require('mysql2/promise')

const DB = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'pet_foster',
}

async function query(sql, params) {
  const conn = await mysql.createConnection(DB)
  try {
    const [rows] = await conn.execute(sql, params || [])
    return rows
  } finally {
    await conn.end()
  }
}

module.exports = { query }
