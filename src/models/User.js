const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 50 },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        // only the bcrypt hash is stored, never the real password
        passwordHash: { type: String, required: true }
    },
    { timestamps: true }
);

// never send the password hash to the browser
userSchema.set("toJSON", {
    transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model("User", userSchema);
