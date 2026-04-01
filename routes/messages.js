let express = require('express');
let router = express.Router();
let mongoose = require('mongoose');
let multer = require('multer');
let path = require('path');

let messageModel = require('../schemas/messages');
let userModel = require('../schemas/users');
let { CheckLogin } = require('../utils/authHandler');

let storageSetting = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname);
        let filename = Date.now() + '-' + Math.round(Math.random() * 1000_000_000) + ext;
        cb(null, filename);
    }
});

let uploadAnyFile = multer({
    storage: storageSetting,
    limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let userID = req.params.userID;

        if (!mongoose.Types.ObjectId.isValid(userID)) {
            return res.status(400).send({ message: 'userID khong hop le' });
        }

        let messages = await messageModel
            .find({
                isDeleted: false,
                $or: [
                    { from: currentUserId, to: userID },
                    { from: userID, to: currentUserId }
                ]
            })
            .populate('from', 'username fullName avatarUrl')
            .populate('to', 'username fullName avatarUrl')
            .sort({ createdAt: 1 });

        res.send(messages);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

router.post('/:userID', CheckLogin, uploadAnyFile.single('file'), async function (req, res, next) {
    try {
        let from = req.user._id;
        let to = req.params.userID;

        if (!mongoose.Types.ObjectId.isValid(to)) {
            return res.status(400).send({ message: 'userID khong hop le' });
        }

        let receiver = await userModel.findById(to);
        if (!receiver || receiver.isDeleted) {
            return res.status(404).send({ message: 'nguoi nhan khong ton tai' });
        }

        let messageContent = null;
        if (req.file) {
            messageContent = {
                type: 'file',
                text: req.file.path
            };
        } else {
            let text = req.body.text;
            if (!text || !text.trim()) {
                return res.status(400).send({ message: 'noi dung khong duoc de trong' });
            }
            messageContent = {
                type: 'text',
                text: text.trim()
            };
        }

        let newMessage = new messageModel({
            from: from,
            to: to,
            messageContent: messageContent
        });

        await newMessage.save();
        await newMessage.populate('from', 'username fullName avatarUrl');
        await newMessage.populate('to', 'username fullName avatarUrl');

        res.send(newMessage);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);

        let latestMessages = await messageModel.aggregate([
            {
                $match: {
                    isDeleted: false,
                    $or: [
                        { from: currentUserObjectId },
                        { to: currentUserObjectId }
                    ]
                }
            },
            {
                $addFields: {
                    partner: {
                        $cond: [{ $eq: ['$from', currentUserObjectId] }, '$to', '$from']
                    }
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: '$partner',
                    message: { $first: '$$ROOT' }
                }
            },
            {
                $replaceRoot: { newRoot: '$message' }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);

        let populatedMessages = await messageModel.populate(latestMessages, [
            { path: 'from', select: 'username fullName avatarUrl' },
            { path: 'to', select: 'username fullName avatarUrl' }
        ]);

        res.send(populatedMessages);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

module.exports = router;
