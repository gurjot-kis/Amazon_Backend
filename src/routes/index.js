import express from 'express';
import authRoutes from './auth.routes.js';
import subCategoryRoutes from './sub-category.routes.js';
import userRoutes from './user.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import adminRoutes from './admin.routes.js';
import addressRoutes from './address.routes.js';
import orderRoutes from './order.routes.js';
import vendorRoutes from './vendor/index.js';
import conversationRoutes from './conversation.routes.js';
import messageRoutes from './message.routes.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.send('Hello World');
});

router.use(authRoutes);
router.use(subCategoryRoutes);
router.use(userRoutes);
router.use(dashboardRoutes);
router.use(adminRoutes);
router.use(addressRoutes);
router.use(orderRoutes);
router.use('/vendor', vendorRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);

export default router;