function hasColumn(db, tableName, columnName) {
  const cols = db.all(`PRAGMA table_info(${tableName})`);
  return cols.some((col) => col.name === columnName);
}

function ensureColumn(db, tableName, columnName, columnDef) {
  if (hasColumn(db, tableName, columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
}

export default {
  version: 2,
  name: "api-keys-telegram",
  up(db) {
    ensureColumn(db, "apiKeys", "source", "TEXT DEFAULT 'manual'");
    ensureColumn(db, "apiKeys", "telegramUserId", "TEXT");
    ensureColumn(db, "apiKeys", "scheduleMode", "TEXT DEFAULT 'none'");
    ensureColumn(db, "apiKeys", "updatedAt", "TEXT");
    ensureColumn(db, "apiKeys", "manualDisabled", "INTEGER DEFAULT 0");

    db.exec(`UPDATE apiKeys SET source = COALESCE(source, 'manual')`);
    db.exec(`UPDATE apiKeys SET scheduleMode = COALESCE(scheduleMode, 'none')`);
    db.exec(`UPDATE apiKeys SET updatedAt = COALESCE(updatedAt, createdAt)`);
    db.exec(`UPDATE apiKeys SET manualDisabled = COALESCE(manualDisabled, 0)`);

    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_ak_telegram_user_id ON apiKeys(telegramUserId) WHERE telegramUserId IS NOT NULL`
    );
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ak_schedule_mode ON apiKeys(scheduleMode)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ak_source ON apiKeys(source)`);
  },
};

