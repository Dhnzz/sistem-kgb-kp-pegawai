-- CreateEnum
CREATE TYPE "jenis" AS ENUM ('struktural', 'fungsional_muda', 'fungsional_biasa');

-- CreateEnum
CREATE TYPE "status" AS ENUM ('aktif', 'nonaktif');

-- CreateEnum
CREATE TYPE "role" AS ENUM ('admin', 'pegawai', 'viewer');

-- CreateEnum
CREATE TYPE "promotion_type" AS ENUM ('KGB', 'KP');

-- CreateEnum
CREATE TYPE "channel" AS ENUM ('email', 'webhook');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('sent', 'failed');

-- CreateTable
CREATE TABLE "pangkat" (
    "id" UUID NOT NULL,
    "kode" VARCHAR(10) NOT NULL,
    "nama" VARCHAR(50) NOT NULL,
    "golongan" VARCHAR(5) NOT NULL,
    "level" SMALLINT NOT NULL,
    "threshold_next" DECIMAL(5,1),
    "urutan" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pangkat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pegawai" (
    "id" UUID NOT NULL,
    "nip" VARCHAR(18) NOT NULL,
    "nama" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "pangkat_id" UUID NOT NULL,
    "jenis" "jenis" NOT NULL,
    "tmt_kgb" DATE NOT NULL,
    "tmt_kp" DATE NOT NULL,
    "kredit" DECIMAL(5,1) NOT NULL DEFAULT 0.0,
    "status" "status" NOT NULL DEFAULT 'aktif',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "pegawai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_history" (
    "id" UUID NOT NULL,
    "pegawai_id" UUID NOT NULL,
    "jenis" "promotion_type" NOT NULL,
    "dari_pangkat_id" UUID,
    "ke_pangkat_id" UUID,
    "dari_kredit" DECIMAL(5,1),
    "ke_kredit" DECIMAL(5,1),
    "tmt_lama" DATE,
    "tmt_baru" DATE,
    "catatan" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" UUID NOT NULL,
    "pegawai_id" UUID NOT NULL,
    "type" "promotion_type" NOT NULL,
    "due_date" DATE NOT NULL,
    "channel" "channel" NOT NULL,
    "status" "notification_status" NOT NULL,
    "payload" JSONB,
    "error" TEXT,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "role" NOT NULL DEFAULT 'pegawai',
    "pegawai_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pangkat_kode_key" ON "pangkat"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "pangkat_urutan_key" ON "pangkat"("urutan");

-- CreateIndex
CREATE UNIQUE INDEX "pegawai_nip_key" ON "pegawai"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "pegawai_email_key" ON "pegawai"("email");

-- CreateIndex
CREATE INDEX "idx_pegawai_tmt_kgb" ON "pegawai"("tmt_kgb");

-- CreateIndex
CREATE INDEX "idx_pegawai_tmt_kp" ON "pegawai"("tmt_kp");

-- CreateIndex
CREATE INDEX "idx_pegawai_jenis" ON "pegawai"("jenis");

-- CreateIndex
CREATE INDEX "idx_pegawai_status" ON "pegawai"("status");

-- CreateIndex
CREATE INDEX "idx_pegawai_pangkat" ON "pegawai"("pangkat_id");

-- CreateIndex
CREATE INDEX "idx_history_pegawai_created" ON "promotion_history"("pegawai_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notif_sent_at" ON "notification_log"("sent_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notif_due" ON "notification_log"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_notification_idempoten" ON "notification_log"("pegawai_id", "type", "due_date", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_pegawai_id_key" ON "user"("pegawai_id");

-- AddForeignKey
ALTER TABLE "pegawai" ADD CONSTRAINT "pegawai_pangkat_id_fkey" FOREIGN KEY ("pangkat_id") REFERENCES "pangkat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pegawai" ADD CONSTRAINT "pegawai_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_history" ADD CONSTRAINT "promotion_history_pegawai_id_fkey" FOREIGN KEY ("pegawai_id") REFERENCES "pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_history" ADD CONSTRAINT "promotion_history_dari_pangkat_id_fkey" FOREIGN KEY ("dari_pangkat_id") REFERENCES "pangkat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_history" ADD CONSTRAINT "promotion_history_ke_pangkat_id_fkey" FOREIGN KEY ("ke_pangkat_id") REFERENCES "pangkat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_history" ADD CONSTRAINT "promotion_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_pegawai_id_fkey" FOREIGN KEY ("pegawai_id") REFERENCES "pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_pegawai_id_fkey" FOREIGN KEY ("pegawai_id") REFERENCES "pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;
