CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,

    document_type VARCHAR(50),
    measure TEXT,
    measure_date DATE,

    date_processed TIMESTAMPTZ,
    processed_by VARCHAR(100),

    processing_status VARCHAR(30) NOT NULL,

    error_message TEXT,
    confidence_score NUMERIC(5, 4),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);