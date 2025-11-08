import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'db.json');

class Database {
  constructor() {
    this.load();
  }

  createEmptyState() {
    return {
      creators: {},
      tips: {},
      content: {},
      paymentIntents: {},
      accessGrants: {},
    };
  }

  ensureShape() {
    this.data.creators = this.data.creators || {};
    this.data.tips = this.data.tips || {};
    this.data.content = this.data.content || {};
    this.data.paymentIntents = this.data.paymentIntents || {};
    this.data.accessGrants = this.data.accessGrants || {};
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(data);
      } else {
        this.data = this.createEmptyState();
        this.save();
      }
    } catch (error) {
      console.error('Error loading database:', error);
      this.data = this.createEmptyState();
    }

    this.ensureShape();
  }

  save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  generateId(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
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

  // Tip operations (legacy tipping surface)
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

  // Content operations
  createContent(creatorId, payload) {
    const contentId = payload.id || this.generateId('content');
    const now = new Date().toISOString();
    const record = {
      id: contentId,
      creatorId,
      createdAt: now,
      updatedAt: now,
      ...payload,
    };

    this.data.content[contentId] = record;
    this.save();
    return record;
  }

  updateContent(contentId, updates) {
    if (!this.data.content[contentId]) {
      return null;
    }
    const updated = {
      ...this.data.content[contentId],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.content[contentId] = updated;
    this.save();
    return updated;
  }

  getContent(contentId) {
    return this.data.content[contentId] || null;
  }

  listContent(filter = {}) {
    const all = Object.values(this.data.content || {});
    if (!all.length) return [];

    return all.filter((item) => {
      if (filter.creatorId && item.creatorId !== filter.creatorId) {
        return false;
      }
      if (typeof filter.published === 'boolean' && item.published !== filter.published) {
        return false;
      }
      return true;
    });
  }

  // Payment intents
  createPaymentIntent(intent) {
    const id = intent.id || this.generateId('intent');
    const now = new Date().toISOString();
    const record = {
      id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      ...intent,
    };

    this.data.paymentIntents[id] = record;
    this.save();
    return record;
  }

  getPaymentIntent(intentId) {
    return this.data.paymentIntents[intentId] || null;
  }

  updatePaymentIntent(intentId, updates) {
    if (!this.data.paymentIntents[intentId]) {
      return null;
    }
    const updated = {
      ...this.data.paymentIntents[intentId],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.paymentIntents[intentId] = updated;
    this.save();
    return updated;
  }

  // Access grants
  addAccessGrant(grant) {
    const tokenId = grant.tokenId || this.generateId('grant');
    const record = {
      tokenId,
      ...grant,
      createdAt: new Date().toISOString(),
    };

    this.data.accessGrants[tokenId] = record;
    this.save();
    return record;
  }

  getAccessGrant(tokenId) {
    return this.data.accessGrants[tokenId] || null;
  }

  listAccessGrantsForBuyer(contentId, buyerPubkey) {
    return Object.values(this.data.accessGrants || {}).filter(
      (grant) => grant.contentId === contentId && grant.buyerPubkey === buyerPubkey
    );
  }
}

export default new Database();
