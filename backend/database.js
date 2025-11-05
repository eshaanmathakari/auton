import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'db.json');

class Database {
  constructor() {
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(data);
      } else {
        this.data = { creators: {}, tips: {} };
        this.save();
      }
    } catch (error) {
      console.error('Error loading database:', error);
      this.data = { creators: {}, tips: {} };
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  // Creator operations
  getCreator(creatorId) {
    return this.data.creators[creatorId] || null;
  }

  createCreator(creatorId, walletAddress) {
    if (!this.data.creators[creatorId]) {
      this.data.creators[creatorId] = {
        id: creatorId,
        walletAddress,
        createdAt: new Date().toISOString(),
      };
      this.save();
    }
    return this.data.creators[creatorId];
  }

  // Tip operations
  addTip(creatorId, tipData) {
    const tipId = `${creatorId}_${Date.now()}`;
    const tip = {
      id: tipId,
      creatorId,
      ...tipData,
      timestamp: new Date().toISOString(),
    };

    if (!this.data.tips[creatorId]) {
      this.data.tips[creatorId] = [];
    }
    this.data.tips[creatorId].push(tip);
    this.save();
    return tip;
  }

  getTips(creatorId) {
    return this.data.tips[creatorId] || [];
  }

  getAllTips() {
    return this.data.tips;
  }
}

export default new Database();

