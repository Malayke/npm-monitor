CREATE TABLE IF NOT EXISTS npm_packages (
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    published_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 