import express from "express";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// -----------------------------
// DATABASE CONNECTION
// -----------------------------
const MONGO_URL = process.env.MONGO_URL;

mongoose.connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));


// -----------------------------
// USER MODEL
// -----------------------------
const userSchema = new mongoose.Schema({
    telegram_id: String,
    coinz: { type: Number, default: 0 }
});

const User = mongoose.model("User", userSchema);


// -----------------------------
// API: ADD REWARD
// -----------------------------
app.post("/reward", async (req, res) => {
    const { telegram_id, reward } = req.body;

    if (!telegram_id || !reward) {
        return res.status(400).json({ error: "Missing data" });
    }

    let user = await User.findOne({ telegram_id });

    if (!user) {
        user = new User({ telegram_id, coinz: 0 });
    }

    user.coinz += reward;
    await user.save();

    res.json({ success: true, coinz: user.coinz });
});


// -----------------------------
// API: LEADERBOARD
// -----------------------------
app.get("/leaderboard", async (req, res) => {
    const users = await User.find().sort({ coinz: -1 }).limit(50);
    res.json(users);
});


// -----------------------------
// ROOT ROUTE (OPTIONAL)
// -----------------------------
app.get("/", (req, res) => {
    res.send("AdRewards Backend is running!");
});


// -----------------------------
// START SERVER (RENDER FIX)
// -----------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});
