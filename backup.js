// ─── Boss Installations - Database Backup Script ───
// Run manually: node backup.js
// Or schedule with Windows Task Scheduler for daily backups

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'boss_installations.db');
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 30; // Keep last 30 backups

function runBackup() {
  // Create backup directory if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Check if database exists
  if (!fs.existsSync(DB_FILE)) {
    console.log('No database file found. Nothing to back up.');
    return;
  }

  // Create timestamped backup filename
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.db`);

  try {
    fs.copyFileSync(DB_FILE, backupFile);
    const sizeMB = (fs.statSync(backupFile).size / (1024 * 1024)).toFixed(2);
    console.log(`Backup created: ${backupFile} (${sizeMB} MB)`);

    // Clean up old backups (keep only MAX_BACKUPS most recent)
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .sort()
      .reverse();

    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      toDelete.forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
        console.log(`Deleted old backup: ${f}`);
      });
    }

    console.log(`Total backups: ${Math.min(backups.length, MAX_BACKUPS)}`);
  } catch (err) {
    console.error('Backup failed:', err.message);
  }
}

runBackup();
