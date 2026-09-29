CREATE TABLE devices (
    id                   SERIAL PRIMARY KEY,           -- entier auto-incrémenté
    tenant               TEXT NOT NULL,                -- le client (ici "ascencia")
    dev_eui              CHAR(16) NOT NULL UNIQUE,     -- identifiant LoRaWAN : impossible d'en avoir deux
    model                TEXT NOT NULL,                -- S31, CPL03, PF52 : le modèle du catalogue
    name                 TEXT NOT NULL,
    site                 TEXT NOT NULL,
    gateway_id           TEXT NOT NULL,
    role                 TEXT,                         -- sens métier : 'smoke' pour un contact câblé sur un détecteur
    reporting_interval_s INTEGER NOT NULL DEFAULT 10,  -- intervalle d'émission attendu
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE telemetry (
    id       BIGSERIAL PRIMARY KEY,     -- BIGSERIAL : il y aura beaucoup de lignes
    tenant   TEXT NOT NULL,
    dev_eui  CHAR(16) NOT NULL,
    metric   TEXT NOT NULL,             -- ex. 'temperature_c'
    value    DOUBLE PRECISION NOT NULL,
    unit     TEXT,
    ts       TIMESTAMPTZ NOT NULL,      -- heure de la mesure
    f_cnt    INTEGER,
    rssi     INTEGER,
    snr      REAL
);
-- La requête typique est "l'historique de telle métrique de tel capteur, du plus récent au plus ancien" :
CREATE INDEX telemetry_dev_metric_ts ON telemetry (dev_eui, metric, ts DESC);

CREATE TABLE alerts (
    id         BIGSERIAL PRIMARY KEY,
    tenant     TEXT NOT NULL,
    dev_eui    CHAR(16) NOT NULL,
    type       TEXT NOT NULL,           -- SMOKE, HIGH_TEMPERATURE, DEVICE_FAULT, OFFLINE
    message    TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cleared_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX one_active_alert ON alerts (dev_eui, type) WHERE status = 'ACTIVE';

CREATE TABLE dead_letters (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT,
    reason      TEXT NOT NULL,          -- pourquoi le message a été rejeté
    detail      TEXT,
    topic       TEXT,
    raw         TEXT,                   -- le message tel qu'il est arrivé, pour enquêter
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);