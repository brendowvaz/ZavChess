import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../apps/api/.env', import.meta.url));
if (!process.env.MYSQL_ROOT_PASSWORD) throw new Error('Defina MYSQL_ROOT_PASSWORD somente para executar este provisionamento local.');
const connection = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD });
try {
  const [rows] = await connection.query('SELECT VERSION() AS version');
  console.log(`MySQL ${rows[0].version}: conexão confirmada.`);
  await connection.query('CREATE DATABASE IF NOT EXISTS zav_chess CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  if (!existsSync(envPath)) {
    const [existing] = await connection.query("SELECT User FROM mysql.user WHERE User = 'zav_chess_app' AND Host = 'localhost'");
    if (existing.length) throw new Error('O usuário zav_chess_app já existe; restaure o .env antes de continuar.');
    const password = randomBytes(32).toString('hex');
    await connection.query("CREATE USER 'zav_chess_app'@'localhost' IDENTIFIED BY ?", [password]);
    writeFileSync(envPath, `DATABASE_URL=mysql://zav_chess_app:${password}@127.0.0.1:3306/zav_chess\nPORT=3001\nCORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081\n`, { mode: 0o600 });
  }
  await connection.query("GRANT ALL PRIVILEGES ON zav_chess.* TO 'zav_chess_app'@'localhost'");
  console.log('Banco zav_chess e usuário local do app prontos. Credenciais salvas apenas em apps/api/.env.');
} catch (error) {
  console.error('Falha no provisionamento:', error.code || error.message);
  process.exitCode = 1;
} finally { await connection.end(); }
