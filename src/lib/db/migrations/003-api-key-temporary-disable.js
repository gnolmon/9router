function hasColumn(db, tableName, columnName) {
  const cols = db.all(`PRAGMA table_info(${tableName})`);
  return cols.some((col) => col.name === columnName);
}

function ensureColumn(db, tableName, columnName, columnDef) {
  if (hasColumn(db, tableName, columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
}

export default {
  version: 3,
  name: "api-key-temporary-disable",
  up(db) {
    ensureColumn(db, "apiKeys", "temporaryDisabledUntil", "TEXT");
  },
};
