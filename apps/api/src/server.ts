import express from "express";

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "ClinicWorks API is running"
    });
});

app.listen(PORT, () => {
    console.log(`ClinicWorks API running on port ${PORT}`);
});