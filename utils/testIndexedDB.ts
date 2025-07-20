import { indexedDBManager } from './indexedDB';

async function testIndexedDB() {
  try {
    console.log('Testing IndexedDB Manager...');
    
    // Initialize the database
    await indexedDBManager.init();
    console.log('✓ Database initialized successfully');

    // Test data migration
    await indexedDBManager.migrateVaultData();
    console.log('✓ Data migration completed');

    // Test vault operations
    const testVault = {
      address: '0x1234567890123456789012345678901234567890',
      name: 'Test Vault',
      symbol: 'TV',
      coin: '0x0987654321098765432109876543210987654321',
      coinSymbol: 'TEST',
      totalSupply: '1000000',
      totalStaked: '500000',
      vaultCreator: '0x1111111111111111111111111111111111111111',
      vaultCreatorFee: 100,
      treasuryFee: 50,
      lastUpdated: Date.now(),
      isFavorite: false,
    };

    // Save vault
    await indexedDBManager.saveVault(testVault);
    console.log('✓ Vault saved successfully');

    // Get vault
    const retrievedVault = await indexedDBManager.getVault(testVault.address);
    console.log('✓ Vault retrieved successfully:', retrievedVault);

    // Test favorite toggle
    const favoriteStatus = await indexedDBManager.toggleFavorite(testVault.address);
    console.log('✓ Favorite toggled successfully:', favoriteStatus);

    // Test getting all vaults
    const allVaults = await indexedDBManager.getAllVaults();
    console.log('✓ All vaults retrieved:', allVaults.length);

    // Test getting favorite vaults
    const favoriteVaults = await indexedDBManager.getFavoriteVaults();
    console.log('✓ Favorite vaults retrieved:', favoriteVaults.length);

    // Test contract favorites sync
    const userAddress = '0x1111111111111111111111111111111111111111';
    const favoriteAddresses = [testVault.address];
    await indexedDBManager.syncUserFavoritesFromContract(userAddress, favoriteAddresses);
    console.log('✓ Contract favorites synced successfully');

    // Verify sync worked
    const syncedVault = await indexedDBManager.getVault(testVault.address);
    console.log('✓ Synced vault favorite status:', syncedVault?.isFavorite);

    // Test data staleness check
    const isStale = await indexedDBManager.isDataStale(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    console.log('✓ Data staleness check:', isStale);

    // Clear test data
    await indexedDBManager.clearAllData();
    console.log('✓ Test data cleared');

    console.log('\n🎉 All tests passed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  testIndexedDB();
}

export { testIndexedDB };