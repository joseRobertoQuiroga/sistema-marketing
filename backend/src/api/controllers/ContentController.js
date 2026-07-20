const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const logger = require('../../infrastructure/utils/logger');

class ContentController {
    constructor({ pool }) {
        this.pool = pool;
    }

    async uploadAsset(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: { code: 'NO_FILE', message: 'Archivo requerido' } });
            }
            const orgId = req.user.orgId;
            const file = req.file;
            const uploadDir = path.join(__dirname, '../../../uploads', orgId);

            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            const metadata = await sharp(file.path).metadata();

            const variants = {};
            if (metadata.width > 1200) {
                const largePath = path.join(uploadDir, `large_${file.filename}`);
                await sharp(file.path).resize(1200).toFile(largePath);
                variants.large = `/uploads/${orgId}/large_${file.filename}`;
            }
            if (metadata.width > 600) {
                const mediumPath = path.join(uploadDir, `medium_${file.filename}`);
                await sharp(file.path).resize(600).toFile(mediumPath);
                variants.medium = `/uploads/${orgId}/medium_${file.filename}`;
            }
            const thumbPath = path.join(uploadDir, `thumb_${file.filename}`);
            await sharp(file.path).resize(300).toFile(thumbPath);
            variants.thumbnail = `/uploads/${orgId}/thumb_${file.filename}`;

            const url = `/uploads/${orgId}/${file.filename}`;

            const result = await this.pool.query(`
                INSERT INTO assets (organization_id, filename, original_name, mimetype, size, width, height, variants, url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
            `, [orgId, file.filename, file.originalname, file.mimetype, file.size,
                metadata.width, metadata.height, JSON.stringify(variants), url]);

            res.json(result.rows[0]);
        } catch (error) {
            logger.error({ err: error }, 'Asset upload failed');
            res.status(500).json({ error: error.message });
        }
    }

    async listAssets(req, res) {
        try {
            const result = await this.pool.query(
                'SELECT * FROM assets WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100',
                [req.user.orgId]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createPost(req, res) {
        try {
            const orgId = req.user.orgId;
            const { content, mediaUrls, scheduledAt, platformIds } = req.body;

            const result = await this.pool.query(`
                INSERT INTO posts (organization_id, content, media_urls, scheduled_at, status)
                VALUES ($1, $2, $3, $4, $5) RETURNING *
            `, [orgId, content, mediaUrls || [], scheduledAt || null,
                scheduledAt ? 'scheduled' : 'draft'
            ]);

            const post = result.rows[0];

            if (platformIds?.length) {
                for (const connId of platformIds) {
                    await this.pool.query(
                        'INSERT INTO post_accounts (post_id, social_connection_id) VALUES ($1, $2)',
                        [post.id, connId]
                    );
                }
            }

            res.status(201).json(post);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async listPosts(req, res) {
        try {
            const result = await this.pool.query(
                "SELECT * FROM posts WHERE organization_id = $1 AND status NOT IN ('draft') ORDER BY scheduled_at DESC NULLS LAST, created_at DESC LIMIT 50",
                [req.user.orgId]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteAsset(req, res) {
        try {
            const { id } = req.params;
            await this.pool.query(
                'UPDATE assets SET deleted_at = NOW() WHERE organization_id = $1 AND id = $2',
                [req.user.orgId, id]
            );
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ContentController;
