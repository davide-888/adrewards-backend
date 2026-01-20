const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// -----------------------------
// MONGO CONNECTION
// -----------------------------
const MONGO_URL = process.env.MONGO_URL;

mongoose
  .connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// -----------------------------
// MODELS
// -----------------------------
const userSchema = new mongoose.Schema({
  telegram_id: { type: String, required: true, unique: true },
  telegram_username: { type: String },
  coinzTotal: { type: Number, default: 0 }, // all‑time
  coinzDaily: { type: Number, default: 0 }, // daily
});

const User = mongoose.model("User", userSchema);

const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed,
});

const Setting = mongoose.model("Setting", settingsSchema);

// -----------------------------
// DAILY RESET LOGIC
// -----------------------------
async function getDailyResetInfo() {
  let setting = await Setting.findOne({ key: "dailyReset" });

  const now = Date.now();

  if (!setting) {
    const nextReset = now + 24 * 60 * 60 * 1000;
    setting = new Setting({
      key: "dailyReset",
      value: { nextReset },
    });
    await setting.save();
    return { nextReset };
  }

  return setting.value;
}

async function ensureDailyReset() {
  const info = await getDailyResetInfo();
  const now = Date.now();

  if (now >= info.nextReset) {
    await User.updateMany({}, { $set: { coinzDaily: 0 } });
    const nextReset = now + 24 * 60 * 60 * 1000;
    await Setting.updateOne(
      { key: "dailyReset" },
      { $set: { value: { nextReset } } }
    );
    return { nextReset };
  }

  return info;
}

// -----------------------------
// ROUTES
// -----------------------------

// Root
app.get("/", (req, res) => {
  res.send("AdRewards Backend is running!");
});

// Add reward
app.post("/reward", async (req, res) => {
  try {
    const { telegram_id, telegram_username, reward } = req.body;

    if (!telegram_id || !reward) {
      return res.status(400).json({ error: "Missing data" });
    }

    const resetInfo = await ensureDailyReset();

    let user = await User.findOne({ telegram_id });

    if (!user) {
      user = new User({
        telegram_id,
        telegram_username: telegram_username || null,
        coinzTotal: 0,
        coinzDaily: 0,
      });
    } else if (telegram_username && user.telegram_username !== telegram_username) {
      user.telegram_username = telegram_username;
    }

    user.coinzTotal += reward;
    user.coinzDaily += reward;
    await user.save();

    const remainingMs = resetInfo.nextReset - Date.now();

    res.json({
      success: true,
      coinzTotal: user.coinzTotal,
      coinzDaily: user.coinzDaily,
      dailyResetInSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Leaderboard
app.get("/leaderboard", async (req, res) => {
  try {
    const type = req.query.type === "daily" ? "daily" : "alltime";

    const resetInfo = await ensureDailyReset();
    const remainingMs = resetInfo.nextReset - Date.now();
    const dailyResetInSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    let sortField = type === "daily" ? "coinzDaily" : "coinzTotal";

    const users = await User.find({})
      .sort({ [sortField]: -1 })
      .limit(50)
      .select("telegram_username telegram_id coinzTotal coinzDaily");

    res.json({
      type,
      dailyResetInSeconds,
      users,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// -----------------------------
// START SERVER (RENDER)
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
