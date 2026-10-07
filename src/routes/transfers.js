const router = require('express').Router();
const controller = require('../controllers/transferController');

router.post('/transfers', controller.create);
router.get('/transfers/:reference', controller.getByReference);
router.get('/accounts/:accountId/transactions', controller.history);
router.get('/accounts/:accountId/balance', controller.balance);

module.exports = router;
