CREATE TABLE vehicle_builds(
 user_id TEXT NOT NULL REFERENCES users(id),car_id TEXT NOT NULL,
 engine INTEGER NOT NULL DEFAULT 0 CHECK(engine BETWEEN 0 AND 3),
 chassis INTEGER NOT NULL DEFAULT 0 CHECK(chassis BETWEEN 0 AND 3),
 brakes INTEGER NOT NULL DEFAULT 0 CHECK(brakes BETWEEN 0 AND 3),
 color TEXT,vinyl TEXT NOT NULL DEFAULT 'none',hood TEXT NOT NULL DEFAULT 'stock',
 spoiler TEXT NOT NULL DEFAULT 'stock',wheels TEXT NOT NULL DEFAULT 'stock',
 PRIMARY KEY(user_id,car_id),FOREIGN KEY(user_id,car_id) REFERENCES owned_cars(user_id,car_id)
);
CREATE TABLE owned_vehicle_parts(
 user_id TEXT NOT NULL,car_id TEXT NOT NULL,part_id TEXT NOT NULL,acquired_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,car_id,part_id),FOREIGN KEY(user_id,car_id) REFERENCES owned_cars(user_id,car_id)
);
ALTER TABLE runs ADD COLUMN vehicle_build TEXT NOT NULL DEFAULT '{"engine":0,"chassis":0,"brakes":0,"color":null,"vinyl":"none","hood":"stock","spoiler":"stock","wheels":"stock"}';
ALTER TABLE runs ADD COLUMN build_key TEXT NOT NULL DEFAULT 'M0-C0-F0';
CREATE INDEX runs_build ON runs(user_id,track,car,handling,build_key,completed,elapsed);
PRAGMA user_version=4;
