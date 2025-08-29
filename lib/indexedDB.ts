import { HackathonData } from "@/hooks/useHackathons"

// Extended interface for hackathon details including all interaction data
interface ExtendedHackathonDetails {
  // Basic hackathon data
  hackathonData: HackathonData
  // Additional interaction data
  depositedTokens?: string[]
  approvedTokens?: string[]
  tokenMinAmounts?: Record<string, string> // Store bigint as string for serialization
  tokenSymbols: Record<string, string>
  tokenTotals: Record<string, string> // Store bigint as string for serialization
  tokenDecimals: Record<string, number>
  sponsors: Array<{
    address: string
    name: string
    image: string
    contributions: Array<{ token: string; amount: string }> // Store bigint as string
  }>
  // Metadata
  timestamp: number
  chainId: number
  contractAddress: string
}

interface CacheEntry {
  data: any
  timestamp: number
  chainId: number
  key: string
}

interface UserHackathonsCache {
  id: string
  // Legacy single-page fields (kept for backward compatibility)
  participating: HackathonData[]
  judging: HackathonData[]
  organizing: HackathonData[]
  // New multi-page caches per tab
  participatingPages?: Record<number, HackathonData[]>
  judgingPages?: Record<number, HackathonData[]>
  organizingPages?: Record<number, HackathonData[]>
  participatingPage?: number
  judgingPage?: number
  organizingPage?: number
  participatingTotal: number
  judgingTotal: number
  organizingTotal: number
  timestamp: number
  chainId: number
  userAddress: string
}

interface OrganizerHackathonsCache {
  id: string
  hackathons: HackathonData[]
  totalHackathons: number
  timestamp: number
  chainId: number
  organizerAddress: string
}

class HackathonDB {
  private dbName = 'HackathonDB'
  private version = 2 // Increment version to handle schema changes
  private db: IDBDatabase | null = null
  private cacheExpiration = 5 * 60 * 1000 // 5 minutes

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve() // Skip on server side
        return
      }

      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        // Close gracefully if a new version is opened elsewhere
        this.db.onversionchange = () => {
          try { this.db?.close() } catch {}
          this.db = null
        }
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Store for general hackathon data (explorer, home page, etc.)
        if (!db.objectStoreNames.contains('hackathons')) {
          const hackathonStore = db.createObjectStore('hackathons', { keyPath: 'key' })
          hackathonStore.createIndex('chainId', 'chainId', { unique: false })
          hackathonStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Store for user-specific hackathon data (myHackathons)
        if (!db.objectStoreNames.contains('userHackathons')) {
          const userStore = db.createObjectStore('userHackathons', { keyPath: 'id' })
          userStore.createIndex('userAddress', 'userAddress', { unique: false })
          userStore.createIndex('chainId', 'chainId', { unique: false })
        }

        // Store for organizer-specific hackathon data
        if (!db.objectStoreNames.contains('organizerHackathons')) {
          const organizerStore = db.createObjectStore('organizerHackathons', { keyPath: 'id' })
          organizerStore.createIndex('organizerAddress', 'organizerAddress', { unique: false })
          organizerStore.createIndex('chainId', 'chainId', { unique: false })
        }

        // Store for individual hackathon details
        if (!db.objectStoreNames.contains('hackathonDetails')) {
          const detailsStore = db.createObjectStore('hackathonDetails', { keyPath: 'contractAddress' })
          detailsStore.createIndex('chainId', 'chainId', { unique: false })
          detailsStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }

      request.onblocked = () => {
        // Another tab still holds the older connection; best effort: let it close
        console.warn('IndexedDB upgrade blocked; existing connections must close')
      }
    })
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB')
    }
    return this.db
  }

  private async openStore(storeName: string, mode: IDBTransactionMode): Promise<{ tx: IDBTransaction, store: IDBObjectStore }>
  {
    const getTx = async () => {
      const db = await this.ensureDB()
      const tx = db.transaction([storeName], mode)
      return { tx, store: tx.objectStore(storeName) }
    }

    try {
      return await getTx()
    } catch (e: any) {
      // If the connection is closing/closed, re-init once and retry
      if (e && (e.name === 'InvalidStateError' || /closing/i.test(String(e?.message)))) {
        try { this.db?.close() } catch {}
        this.db = null
        await this.init()
        return await getTx()
      }
      throw e
    }
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.cacheExpiration
  }

  // General hackathon data methods (for explorer, home page)
  async getHackathons(key: string, chainId: number): Promise<HackathonData[] | null> {
    try {
      const { store } = await this.openStore('hackathons', 'readonly')
      const cacheKey = `${key}_${chainId}`
      
      return new Promise((resolve, reject) => {
        const request = store.get(cacheKey)
        request.onsuccess = () => {
          const result = request.result as CacheEntry | undefined
          if (result && !this.isExpired(result.timestamp) && result.chainId === chainId) {
            resolve(result.data)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error getting hackathons from cache:', error)
      return null
    }
  }

  async setHackathons(key: string, chainId: number, data: HackathonData[]): Promise<void> {
    try {
      const { store } = await this.openStore('hackathons', 'readwrite')
      const cacheKey = `${key}_${chainId}`

      const entry: CacheEntry = {
        key: cacheKey,
        data,
        timestamp: Date.now(),
        chainId
      }

      return new Promise((resolve, reject) => {
        const request = store.put(entry)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error setting hackathons cache:', error)
    }
  }

  // User hackathons methods (for myHackathons page)
  async getUserHackathons(userAddress: string, chainId: number): Promise<UserHackathonsCache | null> {
    try {
      const { store } = await this.openStore('userHackathons', 'readonly')
      const id = `${userAddress}_${chainId}`
      
      return new Promise((resolve, reject) => {
        const request = store.get(id)
        request.onsuccess = () => {
          const result = request.result as UserHackathonsCache | undefined
          if (result && !this.isExpired(result.timestamp) && result.chainId === chainId) {
            resolve(result)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error getting user hackathons from cache:', error)
      return null
    }
  }

  async setUserHackathons(userAddress: string, chainId: number, data: Omit<UserHackathonsCache, 'timestamp' | 'chainId' | 'userAddress' | 'id'>): Promise<void> {
    try {
      const { store } = await this.openStore('userHackathons', 'readwrite')
      const id = `${userAddress}_${chainId}`

      const entry: UserHackathonsCache = {
        id,
        ...data,
        timestamp: Date.now(),
        chainId,
        userAddress
      }

      return new Promise((resolve, reject) => {
        const request = store.put(entry)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error setting user hackathons cache:', error)
    }
  }

  // Organizer hackathons methods
  async getOrganizerHackathons(organizerAddress: string, chainId: number): Promise<OrganizerHackathonsCache | null> {
    try {
      const { store } = await this.openStore('organizerHackathons', 'readonly')
      const id = `${organizerAddress}_${chainId}`
      
      return new Promise((resolve, reject) => {
        const request = store.get(id)
        request.onsuccess = () => {
          const result = request.result as OrganizerHackathonsCache | undefined
          if (result && !this.isExpired(result.timestamp) && result.chainId === chainId) {
            resolve(result)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error getting organizer hackathons from cache:', error)
      return null
    }
  }

  async setOrganizerHackathons(organizerAddress: string, chainId: number, data: Omit<OrganizerHackathonsCache, 'timestamp' | 'chainId' | 'organizerAddress' | 'id'>): Promise<void> {
    try {
      const { store } = await this.openStore('organizerHackathons', 'readwrite')
      const id = `${organizerAddress}_${chainId}`

      const entry: OrganizerHackathonsCache = {
        id,
        ...data,
        timestamp: Date.now(),
        chainId,
        organizerAddress
      }

      return new Promise((resolve, reject) => {
        const request = store.put(entry)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error setting organizer hackathons cache:', error)
    }
  }

  // Individual hackathon details methods
  async getHackathonDetails(contractAddress: string, chainId: number): Promise<HackathonData | null> {
    try {
      const { store } = await this.openStore('hackathonDetails', 'readonly')
      
      return new Promise((resolve, reject) => {
        const request = store.get(contractAddress)
        request.onsuccess = () => {
          const result = request.result
          if (result && !this.isExpired(result.timestamp) && result.chainId === chainId) {
            resolve(result)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error getting hackathon details from cache:', error)
      return null
    }
  }

  async setHackathonDetails(contractAddress: string, chainId: number, data: HackathonData): Promise<void> {
    try {
      const { store } = await this.openStore('hackathonDetails', 'readwrite')

      const entry = {
        ...data,
        timestamp: Date.now(),
        chainId
      }

      return new Promise((resolve, reject) => {
        const request = store.put(entry)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error setting hackathon details cache:', error)
    }
  }

  // Extended hackathon details methods (includes all interaction data)
  async getExtendedHackathonDetails(contractAddress: string, chainId: number): Promise<{
    hackathonData: HackathonData
    depositedTokens?: string[]
    approvedTokens?: string[]
    tokenMinAmounts?: Record<string, bigint>
    tokenSymbols: Record<string, string>
    tokenTotals: Record<string, bigint>
    tokenDecimals: Record<string, number>
    sponsors: Array<{
      address: string
      name: string
      image: string
      contributions: Array<{ token: string; amount: bigint }>
    }>
    timestamp: number
    chainId: number
    contractAddress: string
  } | null> {
    try {
      const { store } = await this.openStore('hackathonDetails', 'readonly')
      const cacheKey = `extended_${contractAddress}`
      
      return new Promise((resolve, reject) => {
        const request = store.get(cacheKey)
        request.onsuccess = () => {
          const result = request.result as ExtendedHackathonDetails | undefined
          if (result && !this.isExpired(result.timestamp) && result.chainId === chainId) {
            console.log('📊 IndexedDB: Retrieved extended data with judges:', result.hackathonData?.judges?.length, 'sponsors:', result.sponsors?.length)
            // Convert string bigints back to bigint
            const processed = {
              ...result,
              tokenMinAmounts: result.tokenMinAmounts ? Object.fromEntries(
                Object.entries(result.tokenMinAmounts).map(([k, v]) => [k, BigInt(v)])
              ) : undefined,
              tokenTotals: Object.fromEntries(
                Object.entries(result.tokenTotals).map(([k, v]) => [k, BigInt(v)])
              ),
              sponsors: result.sponsors.map(sponsor => ({
                ...sponsor,
                contributions: sponsor.contributions.map(contrib => ({
                  ...contrib,
                  amount: BigInt(contrib.amount)
                }))
              }))
            }
            resolve(processed as any)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error getting extended hackathon details from cache:', error)
      return null
    }
  }

  async setExtendedHackathonDetails(
    contractAddress: string, 
    chainId: number, 
    data: {
      hackathonData: HackathonData
      depositedTokens?: string[]
      approvedTokens?: string[]
      tokenMinAmounts?: Record<string, bigint>
      tokenSymbols: Record<string, string>
      tokenTotals: Record<string, bigint>
      tokenDecimals: Record<string, number>
      sponsors: Array<{
        address: string
        name: string
        image: string
        contributions: Array<{ token: string; amount: bigint }>
      }>
    }
  ): Promise<void> {
    try {
      const { store } = await this.openStore('hackathonDetails', 'readwrite')
      const cacheKey = `extended_${contractAddress}`

      // Convert bigints to strings for serialization
      const entry: ExtendedHackathonDetails = {
        ...data,
        tokenMinAmounts: data.tokenMinAmounts ? Object.fromEntries(
          Object.entries(data.tokenMinAmounts).map(([k, v]) => [k, v.toString()])
        ) : undefined,
        tokenTotals: Object.fromEntries(
          Object.entries(data.tokenTotals).map(([k, v]) => [k, v.toString()])
        ),
        sponsors: data.sponsors.map(sponsor => ({
          ...sponsor,
          contributions: sponsor.contributions.map(contrib => ({
            ...contrib,
            amount: contrib.amount.toString()
          }))
        })),
        timestamp: Date.now(),
        chainId,
        contractAddress: cacheKey
      }

      return new Promise((resolve, reject) => {
        const request = store.put(entry)
        request.onsuccess = () => {
          console.log('📊 IndexedDB: Saved extended data with judges:', data.hackathonData?.judges?.length, 'sponsors:', data.sponsors?.length)
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error setting extended hackathon details cache:', error)
    }
  }

  // Clear all data for a specific chain
  async clearChainData(chainId: number): Promise<void> {
    try {
      const db = await this.ensureDB()
      const stores = ['hackathons', 'userHackathons', 'organizerHackathons', 'hackathonDetails']
      
      const transaction = db.transaction(stores, 'readwrite')
      
      for (const storeName of stores) {
        const store = transaction.objectStore(storeName)
        const index = store.index('chainId')
        const request = index.openCursor(IDBKeyRange.only(chainId))
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor) {
            cursor.delete()
            cursor.continue()
          }
        }
      }
    } catch (error) {
      console.error('Error clearing chain data:', error)
    }
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    try {
      const db = await this.ensureDB()
      const stores = ['hackathons', 'userHackathons', 'organizerHackathons', 'hackathonDetails']
      
      const transaction = db.transaction(stores, 'readwrite')
      
      for (const storeName of stores) {
        const store = transaction.objectStore(storeName)
        store.clear()
      }
    } catch (error) {
      console.error('Error clearing all data:', error)
    }
  }

  // Get cache statistics
  async getCacheStats(): Promise<{ totalEntries: number, chainBreakdown: Record<number, number> }> {
    try {
      const db = await this.ensureDB()
      const stores = ['hackathons', 'userHackathons', 'organizerHackathons', 'hackathonDetails']
      let totalEntries = 0
      const chainBreakdown: Record<number, number> = {}
      
      for (const storeName of stores) {
        const transaction = db.transaction([storeName], 'readonly')
        const store = transaction.objectStore('hackathons')
        
        await new Promise<void>((resolve, reject) => {
          const request = store.openCursor()
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result
            if (cursor) {
              totalEntries++
              const chainId = cursor.value.chainId
              chainBreakdown[chainId] = (chainBreakdown[chainId] || 0) + 1
              cursor.continue()
            } else {
              resolve()
            }
          }
          request.onerror = () => reject(request.error)
        })
      }
      
      return { totalEntries, chainBreakdown }
    } catch (error) {
      console.error('Error getting cache stats:', error)
      return { totalEntries: 0, chainBreakdown: {} }
    }
  }
}

// Create singleton instance
export const hackathonDB = new HackathonDB()

// Initialize on client side
if (typeof window !== 'undefined') {
  hackathonDB.init().catch(console.error)
}
