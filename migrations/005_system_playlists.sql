ALTER TABLE playlists ADD COLUMN IF NOT EXISTS system_key varchar(32);
CREATE UNIQUE INDEX IF NOT EXISTS playlists_user_system_key ON playlists(user_id, system_key);
CREATE TABLE IF NOT EXISTS track_likes (
    user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    track_id integer NOT NULL REFERENCES tracks(track_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, track_id)
);
INSERT INTO playlists(user_id,title,privacy,system_key)
SELECT u.user_id, s.title, 'private', s.key FROM users u CROSS JOIN
(VALUES ('liked','Понравившиеся'),('mood:happy','Радостное'),('mood:calm','Спокойное'),('mood:sad','Грустное'),('mood:energetic','Энергичное')) AS s(key,title)
ON CONFLICT (user_id,system_key) DO NOTHING;
INSERT INTO playlist_tracks(playlist_id,track_id)
SELECT p.playlist_id,t.track_id FROM playlists p JOIN tracks t ON t.user_id=p.user_id AND p.system_key='mood:'||t.mood
ON CONFLICT DO NOTHING;
INSERT INTO playlist_tracks(playlist_id,track_id)
SELECT p.playlist_id,l.track_id FROM playlists p JOIN track_likes l ON p.user_id=l.user_id AND p.system_key='liked'
ON CONFLICT DO NOTHING;
