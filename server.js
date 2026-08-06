require("dotenv").config();

const express = require("express");
const cors = require("cors");

const db = require("./src/config/db");
const authRoutes = require("./src/routes/auth");
const schoolHeadsRoutes = require("./src/routes/schoolHeads");
const studentsRoutes = require("./src/routes/students");
const facultyRoutes = require("./src/routes/faculty");
const evaluationsRoutes = require("./src/routes/evaluations");
const surveyQuestionsRoutes = require("./src/routes/surveyQuestions");
const semestersRoutes = require("./src/routes/semesters");
const errorHandler = require("./src/middleware/errorHandler");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/school-heads", schoolHeadsRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/evaluations", evaluationsRoutes);
app.use("/api/survey-questions", surveyQuestionsRoutes);
app.use("/api/semesters", semestersRoutes);

// Global error handler (must be last)
app.use(errorHandler);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
