/**
 * @fileoverview Resource manager for permission system
 * @module @openagent/permission/resource-manager
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Resource,
  ResourceManagerConfig,
} from './types';

/**
 * Resource manager for managing resources
 */
export class ResourceManager {
  private resources: Map<string, Resource> = new Map();
  private resourcesByType: Map<string, Set<string>> = new Map();
  private resourcesByOwner: Map<string, Set<string>> = new Map();

  constructor(config: ResourceManagerConfig) {
    // Initialize resource manager
  }

  /**
   * Create a new resource
   * @param resourceData - Resource data without id and createdAt
   * @returns Created resource
   */
  async createResource(
    resourceData: Omit<Resource, 'id' | 'createdAt'>
  ): Promise<Resource> {
    const resource: Resource = {
      ...resourceData,
      id: `resource_${uuidv4()}`,
      createdAt: new Date(),
    };

    this.resources.set(resource.id, resource);

    // Index by type
    if (!this.resourcesByType.has(resource.type)) {
      this.resourcesByType.set(resource.type, new Set());
    }
    this.resourcesByType.get(resource.type)!.add(resource.id);

    // Index by owner
    if (resource.ownerId) {
      if (!this.resourcesByOwner.has(resource.ownerId)) {
        this.resourcesByOwner.set(resource.ownerId, new Set());
      }
      this.resourcesByOwner.get(resource.ownerId)!.add(resource.id);
    }

    return resource;
  }

  /**
   * Get resource by ID
   * @param resourceId - Resource ID
   * @returns Resource or undefined
   */
  async getResource(resourceId: string): Promise<Resource | undefined> {
    return this.resources.get(resourceId);
  }

  /**
   * Update resource
   * @param resourceId - Resource ID
   * @param updates - Partial resource data
   * @returns Updated resource or undefined
   */
  async updateResource(
    resourceId: string,
    updates: Partial<Omit<Resource, 'id' | 'createdAt'>>
  ): Promise<Resource | undefined> {
    const resource = this.resources.get(resourceId);
    if (!resource) return undefined;

    // Handle owner change
    if (updates.ownerId && updates.ownerId !== resource.ownerId) {
      // Remove from old owner index
      if (resource.ownerId) {
        this.resourcesByOwner.get(resource.ownerId)?.delete(resourceId);
      }

      // Add to new owner index
      if (!this.resourcesByOwner.has(updates.ownerId)) {
        this.resourcesByOwner.set(updates.ownerId, new Set());
      }
      this.resourcesByOwner.get(updates.ownerId)!.add(resourceId);
    }

    // Handle type change
    if (updates.type && updates.type !== resource.type) {
      // Remove from old type index
      this.resourcesByType.get(resource.type)?.delete(resourceId);

      // Add to new type index
      if (!this.resourcesByType.has(updates.type)) {
        this.resourcesByType.set(updates.type, new Set());
      }
      this.resourcesByType.get(updates.type)!.add(resourceId);
    }

    // Update resource
    const updatedResource: Resource = {
      ...resource,
      ...updates,
    };

    this.resources.set(resourceId, updatedResource);
    return updatedResource;
  }

  /**
   * Delete resource
   * @param resourceId - Resource ID
   */
  async deleteResource(resourceId: string): Promise<void> {
    const resource = this.resources.get(resourceId);
    if (!resource) return;

    // Remove from indexes
    this.resourcesByType.get(resource.type)?.delete(resourceId);
    if (resource.ownerId) {
      this.resourcesByOwner.get(resource.ownerId)?.delete(resourceId);
    }

    // Remove resource
    this.resources.delete(resourceId);
  }

  /**
   * List resources by type
   * @param type - Resource type
   * @returns Array of resources
   */
  async listResourcesByType(type: string): Promise<Resource[]> {
    const resourceIds = this.resourcesByType.get(type);
    if (!resourceIds) return [];

    const resources: Resource[] = [];
    for (const id of resourceIds) {
      const resource = this.resources.get(id);
      if (resource) resources.push(resource);
    }

    return resources;
  }

  /**
   * List resources by owner
   * @param ownerId - Owner ID
   * @returns Array of resources
   */
  async listResourcesByOwner(ownerId: string): Promise<Resource[]> {
    const resourceIds = this.resourcesByOwner.get(ownerId);
    if (!resourceIds) return [];

    const resources: Resource[] = [];
    for (const id of resourceIds) {
      const resource = this.resources.get(id);
      if (resource) resources.push(resource);
    }

    return resources;
  }

  /**
   * List all resources
   * @returns Array of resources
   */
  async listAllResources(): Promise<Resource[]> {
    return Array.from(this.resources.values());
  }

  /**
   * Search resources by attributes
   * @param criteria - Search criteria
   * @returns Array of matching resources
   */
  async searchResources(criteria: {
    type?: string;
    ownerId?: string;
    attributes?: Record<string, any>;
  }): Promise<Resource[]> {
    let resources = await this.listAllResources();

    if (criteria.type) {
      resources = resources.filter(r => r.type === criteria.type);
    }

    if (criteria.ownerId) {
      resources = resources.filter(r => r.ownerId === criteria.ownerId);
    }

    if (criteria.attributes) {
      resources = resources.filter(r => {
        if (!r.attributes) return false;
        
        for (const [key, value] of Object.entries(criteria.attributes!)) {
          if (r.attributes[key] !== value) {
            return false;
          }
        }
        
        return true;
      });
    }

    return resources;
  }

  /**
   * Check if resource exists
   * @param resourceId - Resource ID
   * @returns True if resource exists
   */
  async exists(resourceId: string): Promise<boolean> {
    return this.resources.has(resourceId);
  }

  /**
   * Get resource count
   * @returns Total number of resources
   */
  async count(): Promise<number> {
    return this.resources.size;
  }

  /**
   * Get resource count by type
   * @param type - Resource type
   * @returns Number of resources of this type
   */
  async countByType(type: string): Promise<number> {
    return this.resourcesByType.get(type)?.size || 0;
  }

  /**
   * Get resource count by owner
   * @param ownerId - Owner ID
   * @returns Number of resources owned by this owner
   */
  async countByOwner(ownerId: string): Promise<number> {
    return this.resourcesByOwner.get(ownerId)?.size || 0;
  }

  /**
   * Clear all resources
   */
  async clear(): Promise<void> {
    this.resources.clear();
    this.resourcesByType.clear();
    this.resourcesByOwner.clear();
  }
}
