import type { Entity, EntityType, Memory, MemorySource, MemoryStatus, MemoryType } from '../db/memory-db.types';

export interface IEntityRepository {
  findById(id: string): Promise<Entity | undefined>;
  findByTelegramPeerId(telegramPeerId: string): Promise<Entity | undefined>;
  findByType(type: EntityType): Promise<Entity[]>;
  findAll(): Promise<Entity[]>;
  findByName(name: string): Promise<Entity | undefined>;
  searchByName(query: string, limit?: number): Promise<Entity[]>;
  upsert(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity>;
  save(entity: Entity): Promise<void>;
  linkParticipantToDialog(entityId: string, peerId: string): Promise<void>;
}

export interface MemoryGraphNeighborhood {
  memories: Memory[];
  entities: Entity[];
}

export interface IMemoryRepository {
  findById(id: string): Promise<Memory | undefined>;
  findBySubject(subjectId: string): Promise<Memory[]>;
  findByType(type: MemoryType): Promise<Memory[]>;
  findByStatus(status: MemoryStatus): Promise<Memory[]>;
  findActive(subjectId?: string): Promise<Memory[]>;
  findAll(): Promise<Memory[]>;
  findActiveBySubjectAndPredicate(subjectId: string, predicate: string): Promise<Memory | undefined>;
  save(memory: Memory): Promise<void>;
  create(partial: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Memory>;
  markSuperseded(id: string, validUntil?: number, supersededByMemoryId?: string): Promise<void>;
  markDeleted(id: string): Promise<void>;
  searchByText(query: string, topK?: number): Promise<Memory[]>;
  searchHybrid(queryText: string, queryVector?: number[], topK?: number): Promise<Memory[]>;
  traverseEntityNeighborhood(
    entityIds: string[],
    options?: { peerId?: string; limit?: number },
  ): Promise<MemoryGraphNeighborhood>;
}

export interface MessageRefMetadata {
  peerId: string;
  date: number;
  fromId?: string;
  authorEntityId?: string;
}

export interface IMemorySourceRepository {
  findById(id: string): Promise<MemorySource | undefined>;
  findByMemoryId(memoryId: string): Promise<MemorySource[]>;
  findByMessageId(messageId: string): Promise<MemorySource[]>;
  existsForMessageId(messageId: string): Promise<boolean>;
  insert(
    partial: Omit<MemorySource, 'id' | 'createdAt'>,
    meta?: MessageRefMetadata,
  ): Promise<MemorySource>;
}
