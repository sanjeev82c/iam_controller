const router = require('express').Router();
const model = require('../models/iam_model')
const verifyIdToken = require("../middleware/auth");



router.post('/initiateRole', verifyIdToken, (req, res) => {
    (async () => {
        let response = await model.initiateRole(req.body);
        res.sendStatus(200).send(response);
    })();
})

router.post('/updateRole', verifyIdToken, (req, res) => {
    (async () => {
        let response = await model.updateRole(req.body);
        res.status(200).send(response);
    })();
})

router.post('/changeCompanyForUser', verifyIdToken, (req, res) => {
    (async () => {
        let response = await model.changeCompanyForUser(req.body);
        res.status(200).send(response);
    })();
})

router.post('/addInvite', verifyIdToken, (req, res) => {
    (async () => {
        let response = await model.addInvite(req.body);
        res.status(200).send(response);
    })();
})

router.post('/getInviteDetail', verifyIdToken, (req, res) => {
    (async () => {
        let response = await model.getInviteDetail(req.body);
        res.status(200).send(response);
    })();
})

router.post('/confirmUserJoined', verifyIdToken, (req, res) => {
    (async () => {
        let response = await model.confirmUserJoined(req.body);
        res.status(200).send(response);
    })();
})

module.exports = router;