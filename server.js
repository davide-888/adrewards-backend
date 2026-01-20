import express from "express";
import cors from "cors";
import mongoose from "mongoose";

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------
// DATABASE CONNECTION
// ----------------------
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("MongoDB connesso"))
    .catch(err => console.log(err));


// ----------------------
// SCHEMA UTENTI
// ----------------------
const UserSchema = new mongoose.Schema({
    telegram_id: String,
    coinz: Number,
    daily_coinz: Number,
    last_update: String
});

const User = mongoose.model("User", UserSchema);


// ----------------------
// AGGIORNA COINZ DOPO AD
// ----------------------
app.post("/reward", async (req, res) => {
    const { telegram_id, reward } = req.body;

    const today = new Date().toISOString().split("T")[0];

    let user = await User.findOne({ telegram_id });

    if (!user) {
        user = new User({
            telegram_id,
            coinz: 0,
            daily_coinz: 0,
            last_update: today
        });
    }

    // Reset giornaliero
    if (user.last_update !== today) {
        user.daily_coinz = 0;
        user.last_update = today;
    }

    user.coinz += reward;
    user.daily_coinz += reward;

    await user.save();

    res.json({ status: "ok", total: user.coinz });
});


// ----------------------
// CLASSIFICA GIORNALIERA
// ----------------------
app.get("/leaderboard", async (req, res) => {
    const today = new Date().toISOString().split("T")[0];

    const top = await User.find({ last_update: today })
        .sort({ daily_coinz: -1 })
        .limit(20);

    res.json(top);
});


// ----------------------
// AVVIO SERVER
// ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server attivo su porta " + PORT);
});
