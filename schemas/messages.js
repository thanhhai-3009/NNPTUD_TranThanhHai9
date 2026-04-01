let mongoose = require('mongoose');

let messageSchema = mongoose.Schema(
    {
        from: {
            type: mongoose.Types.ObjectId,
            ref: 'user',
            required: true
        },
        to: {
            type: mongoose.Types.ObjectId,
            ref: 'user',
            required: true
        },
        messageContent: {
            type: {
                type: String,
                enum: ['file', 'text'],
                required: true
            },
            text: {
                type: String,
                required: true
            }
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

messageSchema.index({ from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model('message', messageSchema);
