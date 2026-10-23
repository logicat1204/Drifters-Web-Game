-- Store migrates avatar JSON and grants both independent starter catalogs in the
-- same transaction. Old cosmetic rows remain available for inventory history.
PRAGMA user_version=2;
