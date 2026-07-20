class ProductController {
    constructor({ productRepo }) {
        this.productRepo = productRepo;
    }

    async list(req, res) {
        try {
            const products = await this.productRepo.findByOrganization(req.user?.orgId);
            res.json(products);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ProductController;
