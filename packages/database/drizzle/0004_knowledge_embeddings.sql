CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "embeddings" ADD COLUMN "embedding" vector(1536) NOT NULL;
ALTER TABLE "embeddings" DROP COLUMN "vector";

CREATE INDEX "embeddings_embedding_hnsw_idx" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
