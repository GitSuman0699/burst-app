// ============================================================
// Burst — Drop CRUD Operations
// ============================================================

import { getItem, putItem, queryItems, updateItem, generateId } from '../dynamodb';
import type { DropItem, Drop, InventoryItem, Inventory, DropStatus } from '../types';

// ---- Key Builders ----

function dropPK(dropId: string): string { return `DROP#${dropId}`; }
const DROP_SK = 'METADATA';
const INVENTORY_SK = 'INVENTORY';

// ---- Mappers ----

export function toDropDomain(item: DropItem): Drop {
  return {
    dropId: item.dropId,
    title: item.title,
    description: item.description,
    imageUrl: item.imageUrl,
    price: item.price,
    totalInventory: item.totalInventory,
    scheduledStart: item.scheduledStart,
    status: item.status,
    sellerId: item.sellerId,
    createdAt: item.createdAt,
  };
}

function toInventoryDomain(item: InventoryItem, totalInventory: number): Inventory {
  return {
    available: item.available,
    reserved: item.reserved,
    total: totalInventory,
    percentRemaining: totalInventory > 0 ? Math.round((item.available / totalInventory) * 100) : 0,
  };
}

// ---- Operations ----

export async function createDrop(params: {
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  totalInventory: number;
  scheduledStart: string;
  sellerId: string;
}): Promise<Drop> {
  const dropId = generateId('drop');
  const now = new Date().toISOString();

  const dropItem: DropItem = {
    PK: dropPK(dropId),
    SK: DROP_SK,
    GSI1PK: 'DROPS',
    GSI1SK: `STATUS#upcoming#${params.scheduledStart}`,
    entityType: 'DROP',
    dropId,
    title: params.title,
    description: params.description,
    imageUrl: params.imageUrl,
    price: params.price,
    totalInventory: params.totalInventory,
    scheduledStart: params.scheduledStart,
    status: 'upcoming',
    sellerId: params.sellerId,
    createdAt: now,
  };

  const inventoryItem: InventoryItem = {
    PK: dropPK(dropId),
    SK: INVENTORY_SK,
    entityType: 'INVENTORY',
    available: params.totalInventory,
    reserved: 0,
  };

  // Create both items
  await putItem(dropItem);
  await putItem(inventoryItem);

  console.log(`[Burst] Created drop: ${params.title} (${dropId}), inventory: ${params.totalInventory}`);
  return toDropDomain(dropItem);
}

export async function getDrop(dropId: string): Promise<Drop | null> {
  const item = await getItem<DropItem>(dropPK(dropId), DROP_SK);
  return item ? toDropDomain(item) : null;
}

export async function getInventory(dropId: string): Promise<Inventory | null> {
  const [invItem, dropItem] = await Promise.all([
    getItem<InventoryItem>(dropPK(dropId), INVENTORY_SK),
    getItem<DropItem>(dropPK(dropId), DROP_SK),
  ]);
  if (!invItem || !dropItem) return null;
  return toInventoryDomain(invItem, dropItem.totalInventory);
}

export async function getDropWithInventory(dropId: string): Promise<{
  drop: Drop;
  inventory: Inventory;
} | null> {
  const [dropItem, invItem] = await Promise.all([
    getItem<DropItem>(dropPK(dropId), DROP_SK),
    getItem<InventoryItem>(dropPK(dropId), INVENTORY_SK),
  ]);
  if (!dropItem || !invItem) return null;
  return {
    drop: toDropDomain(dropItem),
    inventory: toInventoryDomain(invItem, dropItem.totalInventory),
  };
}

export async function listDrops(status?: DropStatus, sellerId?: string): Promise<Drop[]> {
  let items: DropItem[];
  if (status) {
    items = await queryItems<DropItem>(
      'GSI1PK = :pk AND begins_with(GSI1SK, :skPrefix)',
      { ':pk': 'DROPS', ':skPrefix': `STATUS#${status}` },
      { indexName: 'GSI1', scanForward: false },
    );
  } else {
    items = await queryItems<DropItem>(
      'GSI1PK = :pk',
      { ':pk': 'DROPS' },
      { indexName: 'GSI1', scanForward: false },
    );
  }
  
  if (sellerId) {
    items = items.filter(item => item.sellerId === sellerId);
  }

  return items.map(toDropDomain);
}

export async function activateDrop(dropId: string): Promise<Drop> {
  const now = new Date().toISOString();
  const result = await updateItem(
    dropPK(dropId),
    DROP_SK,
    'SET #status = :live, GSI1SK = :newGsi1sk',
    {
      ':live': 'live',
      ':newGsi1sk': `STATUS#live#${now}`,
      ':upcoming': 'upcoming',
      ':soldOut': 'sold_out',
    },
    '#status = :upcoming OR #status = :soldOut OR #status = :live',
    { '#status': 'status' },
  );
  console.log(`[Burst] Activated drop: ${dropId}`);
  return toDropDomain(result as unknown as DropItem);
}

export async function completeDrop(dropId: string): Promise<Drop> {
  const now = new Date().toISOString();
  const result = await updateItem(
    dropPK(dropId),
    DROP_SK,
    'SET #status = :completed, GSI1SK = :newGsi1sk',
    {
      ':completed': 'completed',
      ':newGsi1sk': `STATUS#completed#${now}`,
    },
    undefined,
    { '#status': 'status' },
  );
  console.log(`[Burst] Completed drop: ${dropId}`);
  return toDropDomain(result as unknown as DropItem);
}

export async function markSoldOut(dropId: string): Promise<Drop> {
  const now = new Date().toISOString();
  const result = await updateItem(
    dropPK(dropId),
    DROP_SK,
    'SET #status = :soldOut, GSI1SK = :newGsi1sk',
    {
      ':soldOut': 'sold_out',
      ':newGsi1sk': `STATUS#sold_out#${now}`,
    },
    undefined,
    { '#status': 'status' },
  );
  console.log(`[Burst] Marked drop as sold out: ${dropId}`);
  return toDropDomain(result as unknown as DropItem);
}
